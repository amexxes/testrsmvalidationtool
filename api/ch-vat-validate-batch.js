// /api/ch-vat-validate-batch.js

const CH_UID_ENDPOINT =
  process.env.CH_UID_ENDPOINT || "https://www.uid-wse.admin.ch/V5.0/PublicServices.svc";

const MAX_BATCH_SIZE = Number(process.env.CH_VAT_MAX_BATCH_SIZE || 20);
const TIMEOUT_MS = Number(process.env.CH_UID_TIMEOUT_MS || 15000);

function normalizeSwissVat(value) {
  const raw = String(value || "").trim().toUpperCase();

  const digits = raw.replace(/[^0-9]/g, "");

  if (digits.length !== 9) {
    return {
      ok: false,
      input: raw,
      vat_number: raw,
      reason: "Expected Swiss VAT format: CHE-123.456.789 or CHE123456789",
    };
  }

  return {
    ok: true,
    input: raw,
    digits,
    vat_number: `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`,
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

function buildSoapEnvelope(digits) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <ValidateVatNumber xmlns="http://www.uid.admin.ch/xmlns/uid-wse/5">
      <vatNumber>
        <uidOrganisationIdCategorie>CHE</uidOrganisationIdCategorie>
        <uidOrganisationId>${escapeXml(digits)}</uidOrganisationId>
      </vatNumber>
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
    /<[^:>]*:?ValidateVatNumberResult[^>]*>(true|false)<\/[^:>]*:?ValidateVatNumberResult>/i
  );

  if (!match) return null;
  return match[1].toLowerCase() === "true";
}

function parseSoapFault(xml) {
  const fault = String(xml || "").match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
  return fault ? fault[1].trim() : "";
}

async function checkSwissVat(item) {
  const envelope = buildSoapEnvelope(item.digits);

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

  if (fault) {
    throw new Error(fault);
  }

  if (!response.ok) {
    throw new Error(`Swiss UID API failed: ${response.status}`);
  }

  const valid = parseValidateVatResult(xml);

  if (valid === null) {
    throw new Error("Unexpected Swiss UID API response");
  }

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
    checked_at: new Date().toISOString(),
    source: "ch_uid",
  };
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
      try {
        results.push(await checkSwissVat(item));
      } catch (error) {
        results.push({
          input: item.input,
          vat_number: item.vat_number,
          country_code: "CH",
          valid: false,
          state: "error",
          name: "",
          address: "",
          error: error instanceof Error ? error.message : String(error),
          error_code: "CH_UID_ERROR",
          checked_at: new Date().toISOString(),
          source: "ch_uid",
        });
      }
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
