// /api/ch-vat-validate-batch.js

const CH_UID_ENDPOINT =
  process.env.CH_UID_ENDPOINT || "https://www.uid-wse.admin.ch/V5.0/PublicServices.svc";

const MAX_BATCH_SIZE = Number(process.env.CH_VAT_MAX_BATCH_SIZE || 20);
const TIMEOUT_MS = Number(process.env.CH_UID_TIMEOUT_MS || 15000);
const RETRY_AFTER_MS = Number(process.env.CH_UID_RETRY_AFTER_MS || 60000);
const MAX_RATE_LIMIT_RETRIES = Number(process.env.CH_UID_MAX_RATE_LIMIT_RETRIES || 1);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSwissVat(value) {
  const raw = String(value || "").trim().toUpperCase();

  const compact = raw
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "")
    .replace(/(MWST|TVA|IVA)$/i, "");

  if (!compact.startsWith("CHE") && !compact.startsWith("CH")) {
    return {
      ok: false,
      input: raw,
      vat_number: raw,
      reason: "Expected Swiss VAT format: CHE-123.456.789 or CHE123456789",
    };
  }

  const digits = compact.replace(/^[A-Z]+/, "");

  if (!/^\d{9}$/.test(digits)) {
    return {
      ok: false,
      input: raw,
      vat_number: raw,
      reason: "Expected Swiss VAT format: CHE-123.456.789 or CHE123456789",
    };
  }

  const canonical = `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;

  return {
    ok: true,
    input: raw,
    digits,
    query: canonical,
    vat_number: `${canonical} MWST`,
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(vatNumber) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <ValidateVatNumber xmlns="http://www.uid.admin.ch/xmlns/uid-wse/5">
      <vatNumber>${escapeXml(vatNumber)}</vatNumber>
    </ValidateVatNumber>
  </s:Body>
</s:Envelope>`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseValidateVatResult(xml) {
  const match = String(xml || "").match(
    /<[^:>]*:?ValidateVatNumberResult[^>]*>\s*(true|false)\s*<\/[^:>]*:?ValidateVatNumberResult>/i
  );

  if (!match) return null;
  return match[1].toLowerCase() === "true";
}

function parseSoapFault(xml) {
  const faultString = String(xml || "").match(/<[^:>]*:?faultstring[^>]*>([\s\S]*?)<\/[^:>]*:?faultstring>/i);
  const reasonText = String(xml || "").match(/<[^:>]*:?Text[^>]*>([\s\S]*?)<\/[^:>]*:?Text>/i);
  const code = String(xml || "").match(/Request_limit_exceeded|Data_validation_failed|Permission_denied/i);

  return {
    message: faultString?.[1]?.trim() || reasonText?.[1]?.trim() || "",
    code: code?.[0] || "",
  };
}

function isRateLimitError(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  return (
    error?.status === 429 ||
    text.includes("request_limit_exceeded") ||
    text.includes("request limit") ||
    text.includes("rate limit") ||
    text.includes("too many") ||
    text.includes("temporarily blocked")
  );
}

async function checkSwissVatOnce(item) {
  const envelope = buildSoapEnvelope(item.query);

  const response = await fetchWithTimeout(CH_UID_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml, application/xml, */*",
      SOAPAction: '"http://www.uid.admin.ch/xmlns/uid-wse/5/IPublicServices/ValidateVatNumber"',
    },
    body: envelope,
  });

  const xml = await response.text();
  const fault = parseSoapFault(xml);

  if (fault.message || fault.code) {
    const error = new Error(fault.message || fault.code || "Swiss UID SOAP fault");
    error.code = fault.code || "CH_UID_FAULT";
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Swiss UID API failed: ${response.status}`);
    error.code = response.status === 429 ? "REQUEST_LIMIT_EXCEEDED" : "CH_UID_HTTP_ERROR";
    error.status = response.status;
    throw error;
  }

  const valid = parseValidateVatResult(xml);

  if (valid === null) {
    const error = new Error("Unexpected Swiss UID API response");
    error.code = "CH_UID_UNEXPECTED_RESPONSE";
    error.status = response.status;
    throw error;
  }

  return valid;
}

async function checkSwissVat(item) {
  let attempt = 0;

  while (true) {
    try {
      const valid = await checkSwissVatOnce(item);

      return {
        input: item.input,
        vat_number: item.vat_number,
        country_code: "CH",
        valid,
        state: valid ? "valid" : "invalid",
        name: "",
        address: "",
        error: "",
        error_code: "",
        attempt: attempt + 1,
        checked_at: new Date().toISOString(),
        source: "ch_uid",
      };
    } catch (error) {
      const retryable = isRateLimitError(error);

      if (!retryable || attempt >= MAX_RATE_LIMIT_RETRIES) {
        return {
          input: item.input,
          vat_number: item.vat_number,
          country_code: "CH",
          valid: false,
          state: "error",
          name: "",
          address: "",
          error: error instanceof Error ? error.message : String(error),
          error_code: error?.code || "CH_UID_ERROR",
          attempt: attempt + 1,
          checked_at: new Date().toISOString(),
          source: "ch_uid",
          retry_after_ms: retryable ? RETRY_AFTER_MS : undefined,
        };
      }

      attempt += 1;
      await sleep(RETRY_AFTER_MS);
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
      message: "Use POST",
    });
  }

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizeSwissVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.vat_number,
          country_code: "CH",
          valid: false,
          state: "error",
          name: "",
          address: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "ch_uid",
        });
        continue;
      }

      if (seen.has(normalized.digits)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.digits);
      prepared.push(normalized);
    }

    if (!prepared.length && !results.length) {
      return res.status(400).json({
        error: "No Swiss VAT numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Swiss VAT batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Swiss VAT numbers per request because the UID Public Services are rate-limited.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkSwissVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Swiss VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
