// /api/au-vat-validate-batch.js

const ABN_LOOKUP_GUID = process.env.ABN_LOOKUP_GUID || "";
const ABN_LOOKUP_BASE_URL =
  process.env.ABN_LOOKUP_BASE_URL || "https://abr.business.gov.au/json/AbnDetails.aspx";

const TIMEOUT_MS = Number(process.env.AU_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.AU_VAT_MAX_BATCH_SIZE || 50);

function normalizeAustralianVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");

  if (compact.startsWith("AU")) compact = compact.slice(2);
  if (compact.startsWith("ABN")) compact = compact.slice(3);

  if (!/^\d{11}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Australian ABN/GST format: AU51824753556 or 51824753556",
    };
  }

  return {
    ok: true,
    input,
    digits: compact,
    vat_number: `AU${compact}`,
  };
}

function isValidAbnChecksum(digits) {
  if (!/^\d{11}$/.test(digits)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const nums = digits.split("").map(Number);

  nums[0] -= 1;

  const sum = nums.reduce((acc, digit, index) => {
    return acc + digit * weights[index];
  }, 0);

  return sum % 89 === 0;
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

function parseJsonp(text) {
  const raw = String(text || "").trim();

  const start = raw.indexOf("(");
  const end = raw.lastIndexOf(")");

  if (start === -1 || end === -1 || end <= start) {
    return JSON.parse(raw);
  }

  return JSON.parse(raw.slice(start + 1, end));
}

function formatAddress(data) {
  return [data?.AddressState, data?.AddressPostcode]
    .filter(Boolean)
    .join(" ");
}

async function checkAustralianVat(item) {
  const url = new URL(ABN_LOOKUP_BASE_URL);

  url.searchParams.set("abn", item.digits);
  url.searchParams.set("callback", "callback");
  url.searchParams.set("guid", ABN_LOOKUP_GUID);

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/javascript, application/json, */*",
    },
  });

  const text = await response.text();
  const data = parseJsonp(text);

  if (!response.ok) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "AU",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message: "",
      error: data?.Message || `ABN Lookup failed: ${response.status}`,
      error_code: "AU_ABN_LOOKUP_ERROR",
      checked_at: new Date().toISOString(),
      source: "abn_lookup",
    };
  }

  const message = String(data?.Message || "").trim();
  const abnStatus = String(data?.AbnStatus || "").trim();
  const gstStatus = String(data?.Gst || "").trim();

  const isActiveAbn = abnStatus.toLowerCase() === "active";
  const isGstRegistered = Boolean(gstStatus);

  if (message) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "AU",
      valid: false,
      state: "invalid",
      name: "",
      address: "",
      message,
      error: "",
      error_code: "",
      checked_at: new Date().toISOString(),
      source: "abn_lookup",
    };
  }

  return {
    input: item.input,
    vat_number: `AU${data?.Abn || item.digits}`,
    country_code: "AU",
    valid: isActiveAbn && isGstRegistered,
    state: isActiveAbn && isGstRegistered ? "valid" : "invalid",
    name: data?.EntityName || "",
    address: formatAddress(data),
    message:
      isActiveAbn && isGstRegistered
        ? "ABN active and registered for GST."
        : isActiveAbn
          ? "ABN active, but not registered for GST."
          : "ABN found, but not active.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "abn_lookup",
    abn_status: abnStatus,
    gst_status: gstStatus,
    entity_type: data?.EntityTypeName || "",
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

  if (!ABN_LOOKUP_GUID) {
    return res.status(500).json({
      error: "Missing ABN_LOOKUP_GUID",
      message: "Set ABN_LOOKUP_GUID in environment variables.",
      results: [],
    });
  }

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizeAustralianVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "AU",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "abn_lookup",
        });
        continue;
      }

      if (!isValidAbnChecksum(normalized.digits)) {
        results.push({
          input: normalized.input,
          vat_number: normalized.vat_number,
          country_code: "AU",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: "Invalid Australian ABN checksum.",
          error_code: "INVALID_CHECKSUM",
          checked_at: new Date().toISOString(),
          source: "abn_lookup",
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
        error: "No Australian ABN/GST numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Australian ABN/GST batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Australian ABN/GST numbers per request.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkAustralianVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Australian ABN/GST validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
