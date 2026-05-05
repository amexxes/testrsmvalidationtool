// /api/jp-vat-validate-batch.js

const JP_INVOICE_APP_ID = process.env.JP_INVOICE_APP_ID || "";
const JP_INVOICE_BASE_URL =
  process.env.JP_INVOICE_BASE_URL || "https://web-api.invoice-kohyo.nta.go.jp/1/num";

const TIMEOUT_MS = Number(process.env.JP_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.JP_VAT_MAX_BATCH_SIZE || 10);

function normalizeJapanVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input.replace(/\s+/g, "").replace(/[.\-_/]/g, "");

  if (compact.startsWith("JP")) compact = compact.slice(2);
  if (!compact.startsWith("T") && /^\d{13}$/.test(compact)) compact = `T${compact}`;

  if (!/^T\d{13}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Japanese invoice registration format: JPT1234567890123 or T1234567890123",
    };
  }

  return {
    ok: true,
    input,
    registrationNumber: compact,
    vat_number: `JP${compact}`,
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isExpired(record) {
  const expireDate = String(record?.expireDate || "").trim();
  if (!expireDate) return false;

  const today = new Date().toISOString().slice(0, 10);
  return expireDate <= today;
}

function mapJapanRecord(item, record) {
  const valid = Boolean(record) && !isExpired(record);

  return {
    input: item.input,
    vat_number: `JP${record?.registratedNumber || item.registrationNumber}`,
    country_code: "JP",
    valid,
    state: valid ? "valid" : "invalid",
    name: record?.name || record?.tradeName || "",
    address: record?.address || record?.addressInside || "",
    message: valid
      ? "Japanese qualified invoice issuer found."
      : "Japanese invoice registration found, but it is expired or inactive.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "jp_invoice_nta",
    invoice_registration_number: record?.registratedNumber || item.registrationNumber,
    registration_date: record?.registrationDate || "",
    update_date: record?.updateDate || "",
    expire_date: record?.expireDate || "",
    disposal_date: record?.disposalDate || "",
    process: record?.process || "",
    latest: record?.latest || "",
  };
}

function notFoundRow(item) {
  return {
    input: item.input,
    vat_number: item.vat_number,
    country_code: "JP",
    valid: false,
    state: "invalid",
    name: "",
    address: "",
    message: "Japanese invoice registration number not found.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "jp_invoice_nta",
    invoice_registration_number: item.registrationNumber,
  };
}

function errorRow(input, vatNumber, error, code = "JP_INVOICE_ERROR") {
  return {
    input,
    vat_number: vatNumber,
    country_code: "JP",
    valid: false,
    state: "error",
    name: "",
    address: "",
    message: "",
    error,
    error_code: code,
    checked_at: new Date().toISOString(),
    source: "jp_invoice_nta",
  };
}

async function checkJapanVatBatch(items) {
  const url = new URL(JP_INVOICE_BASE_URL);

  url.searchParams.set("id", JP_INVOICE_APP_ID);
  url.searchParams.set("number", items.map((item) => item.registrationNumber).join(","));
  url.searchParams.set("type", "21");
  url.searchParams.set("history", "0");

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return items.map((item) =>
      errorRow(
        item.input,
        item.vat_number,
        data?.message || data?.error || `Japan NTA Invoice API failed: ${response.status}`,
        "JP_INVOICE_API_ERROR"
      )
    );
  }

  const announcements = Array.isArray(data?.announcement) ? data.announcement : [];
  const byNumber = new Map();

  for (const record of announcements) {
    const number = String(record?.registratedNumber || "").trim().toUpperCase();
    if (number) byNumber.set(number, record);
  }

  return items.map((item) => {
    const record = byNumber.get(item.registrationNumber);
    return record ? mapJapanRecord(item, record) : notFoundRow(item);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
      message: "Use POST",
    });
  }

  if (!JP_INVOICE_APP_ID) {
    return res.status(500).json({
      error: "Missing JP_INVOICE_APP_ID",
      message: "Set JP_INVOICE_APP_ID in environment variables.",
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
      const normalized = normalizeJapanVat(raw);

      if (!normalized.ok) {
        results.push(errorRow(normalized.input, normalized.input, normalized.reason, "INVALID_FORMAT"));
        continue;
      }

      if (seen.has(normalized.registrationNumber)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.registrationNumber);
      prepared.push(normalized);
    }

    if (!prepared.length && !results.length) {
      return res.status(400).json({
        error: "No Japanese invoice registration numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Japanese invoice batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Japanese invoice registration numbers per request.`,
        results,
      });
    }

    if (prepared.length) {
      results.push(...(await checkJapanVatBatch(prepared)));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Japanese invoice registration validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
