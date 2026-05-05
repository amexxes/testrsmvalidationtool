// /api/kr-vat-validate-batch.js

const KR_NTS_SERVICE_KEY = process.env.KR_NTS_SERVICE_KEY || "";
const KR_NTS_STATUS_URL =
  process.env.KR_NTS_STATUS_URL || "https://api.odcloud.kr/api/nts-businessman/v1/status";

const TIMEOUT_MS = Number(process.env.KR_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.KR_VAT_MAX_BATCH_SIZE || 100);

function normalizeKoreaVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input.replace(/\s+/g, "").replace(/[.\-_/]/g, "");

  if (compact.startsWith("KR")) compact = compact.slice(2);
  if (compact.startsWith("BRN")) compact = compact.slice(3);

  if (!/^\d{10}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Korean business registration format: KR1234567890 or 1234567890",
    };
  }

  return {
    ok: true,
    input,
    businessNumber: compact,
    vat_number: `KR${compact}`,
  };
}

function isValidKoreanBusinessNumber(digits) {
  if (!/^\d{10}$/.test(digits)) return false;

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * weights[i];
  }

  sum += Math.floor((Number(digits[8]) * 5) / 10);

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(digits[9]);
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

function errorRow(input, vatNumber, error, code = "KR_NTS_ERROR") {
  return {
    input,
    vat_number: vatNumber,
    country_code: "KR",
    valid: false,
    state: "error",
    name: "",
    address: "",
    message: "",
    error,
    error_code: code,
    checked_at: new Date().toISOString(),
    source: "kr_nts",
  };
}

function notFoundRow(item) {
  return {
    input: item.input,
    vat_number: item.vat_number,
    country_code: "KR",
    valid: false,
    state: "invalid",
    name: "",
    address: "",
    message: "Korean business registration number not found.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "kr_nts",
    business_registration_number: item.businessNumber,
  };
}

function mapKoreaRecord(item, record) {
  const statusCode = String(record?.b_stt_cd || "").trim();
  const statusText = String(record?.b_stt || "").trim();
  const taxType = String(record?.tax_type || "").trim();
  const taxTypeCode = String(record?.tax_type_cd || "").trim();

  const active = statusCode === "01";

  return {
    input: item.input,
    vat_number: `KR${record?.b_no || item.businessNumber}`,
    country_code: "KR",
    valid: active,
    state: active ? "valid" : "invalid",
    name: "",
    address: "",
    message: active
      ? `Korean business is active. Tax type: ${taxType || "unknown"}.`
      : `Korean business status: ${statusText || "unknown"}.`,
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "kr_nts",
    business_registration_number: record?.b_no || item.businessNumber,
    business_status: statusText,
    business_status_code: statusCode,
    tax_type: taxType,
    tax_type_code: taxTypeCode,
    end_date: record?.end_dt || "",
    invoice_apply_date: record?.invoice_apply_dt || "",
  };
}

async function checkKoreaVatBatch(items) {
  const url = new URL(KR_NTS_STATUS_URL);
  url.searchParams.set("serviceKey", KR_NTS_SERVICE_KEY);

  const response = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      b_no: items.map((item) => item.businessNumber),
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return items.map((item) =>
      errorRow(
        item.input,
        item.vat_number,
        data?.msg || data?.message || data?.error || `Korean NTS API failed: ${response.status}`,
        "KR_NTS_API_ERROR"
      )
    );
  }

  const records = Array.isArray(data?.data) ? data.data : [];
  const byNumber = new Map();

  for (const record of records) {
    const number = String(record?.b_no || "").replace(/\D/g, "");
    if (number) byNumber.set(number, record);
  }

  return items.map((item) => {
    const record = byNumber.get(item.businessNumber);
    return record ? mapKoreaRecord(item, record) : notFoundRow(item);
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

  if (!KR_NTS_SERVICE_KEY) {
    return res.status(500).json({
      error: "Missing KR_NTS_SERVICE_KEY",
      message: "Set KR_NTS_SERVICE_KEY in environment variables.",
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
      const normalized = normalizeKoreaVat(raw);

      if (!normalized.ok) {
        results.push(errorRow(normalized.input, normalized.input, normalized.reason, "INVALID_FORMAT"));
        continue;
      }

      if (!isValidKoreanBusinessNumber(normalized.businessNumber)) {
        results.push(
          errorRow(
            normalized.input,
            normalized.vat_number,
            "Invalid Korean business registration number checksum.",
            "INVALID_CHECKSUM"
          )
        );
        continue;
      }

      if (seen.has(normalized.businessNumber)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.businessNumber);
      prepared.push(normalized);
    }

    if (!prepared.length && !results.length) {
      return res.status(400).json({
        error: "No Korean business registration numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Korean business registration batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Korean business registration numbers per request.`,
        results,
      });
    }

    if (prepared.length) {
      results.push(...(await checkKoreaVatBatch(prepared)));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Korean business registration validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
