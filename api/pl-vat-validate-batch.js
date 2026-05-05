// /api/pl-vat-validate-batch.js

const PL_VAT_BASE_URL = process.env.PL_VAT_BASE_URL || "https://wl-api.mf.gov.pl";

const TIMEOUT_MS = Number(process.env.PL_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.PL_VAT_MAX_BATCH_SIZE || 30);

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePolishVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");

  if (compact.startsWith("PL")) compact = compact.slice(2);
  if (compact.startsWith("NIP")) compact = compact.slice(3);

  if (!/^\d{10}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Polish VAT/NIP format: PL1234563218 or 1234563218",
    };
  }

  return {
    ok: true,
    input,
    nip: compact,
    vat_number: `PL${compact}`,
  };
}

function isValidPolishNipChecksum(nip) {
  if (!/^\d{10}$/.test(nip)) return false;

  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = weights.reduce((acc, weight, index) => acc + Number(nip[index]) * weight, 0);
  const checksum = sum % 11;

  if (checksum === 10) return false;

  return checksum === Number(nip[9]);
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

function statusToState(statusVat) {
  const status = String(statusVat || "").trim().toLowerCase();

  return {
    valid: status === "czynny",
    status,
  };
}

function mapSubjectToRow(input, nip, subject, requestId, requestDateTime) {
  const statusVat = subject?.statusVat || "";
  const { valid } = statusToState(statusVat);

  const address =
    subject?.workingAddress ||
    subject?.residenceAddress ||
    "";

  return {
    input,
    vat_number: `PL${subject?.nip || nip}`,
    country_code: "PL",
    valid,
    state: valid ? "valid" : "invalid",
    name: subject?.name || "",
    address,
    message: valid
      ? "Active Polish VAT taxpayer."
      : `Polish VAT status: ${statusVat || "unknown"}.`,
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "pl_vat_whitelist",
    nip: subject?.nip || nip,
    regon: subject?.regon || "",
    krs: subject?.krs || "",
    status_vat: statusVat,
    request_id: requestId || "",
    request_date_time: requestDateTime || "",
  };
}

function errorRow(input, vatNumber, error, code = "PL_VAT_ERROR") {
  return {
    input,
    vat_number: vatNumber,
    country_code: "PL",
    valid: false,
    state: "error",
    name: "",
    address: "",
    message: "",
    error,
    error_code: code,
    checked_at: new Date().toISOString(),
    source: "pl_vat_whitelist",
  };
}

async function checkPolishVatBatch(items) {
  const nips = items.map((item) => item.nip).join(",");
  const date = todayIsoDate();

  const url = `${PL_VAT_BASE_URL}/api/search/nips/${encodeURIComponent(nips)}?date=${encodeURIComponent(date)}`;

  const response = await fetchWithTimeout(url, {
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
        data?.message || data?.error?.message || `Polish VAT Whitelist API failed: ${response.status}`,
        data?.code || data?.error?.code || "PL_VAT_API_ERROR"
      )
    );
  }

  const result = data?.result || {};
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const requestId = result?.requestId || "";
  const requestDateTime = result?.requestDateTime || "";

  const rowsByNip = new Map();

  for (const entry of entries) {
    const identifier = String(entry?.identifier || "").trim();

    if (entry?.error) {
      rowsByNip.set(
        identifier,
        errorRow(
          identifier,
          `PL${identifier}`,
          entry.error.message || "Polish VAT lookup failed.",
          entry.error.code || "PL_VAT_ENTRY_ERROR"
        )
      );
      continue;
    }

    const subjects = Array.isArray(entry?.subjects) ? entry.subjects : [];

    if (!subjects.length) {
      rowsByNip.set(identifier, {
        input: identifier,
        vat_number: `PL${identifier}`,
        country_code: "PL",
        valid: false,
        state: "invalid",
        name: "",
        address: "",
        message: "NIP not found in Polish VAT Whitelist.",
        error: "",
        error_code: "",
        checked_at: new Date().toISOString(),
        source: "pl_vat_whitelist",
        nip: identifier,
        request_id: requestId,
        request_date_time: requestDateTime,
      });
      continue;
    }

    rowsByNip.set(
      identifier,
      mapSubjectToRow(identifier, identifier, subjects[0], requestId, requestDateTime)
    );
  }

  return items.map((item) => {
    const row = rowsByNip.get(item.nip);

    if (!row) {
      return {
        input: item.input,
        vat_number: item.vat_number,
        country_code: "PL",
        valid: false,
        state: "invalid",
        name: "",
        address: "",
        message: "NIP not found in Polish VAT Whitelist.",
        error: "",
        error_code: "",
        checked_at: new Date().toISOString(),
        source: "pl_vat_whitelist",
        nip: item.nip,
        request_id: requestId,
        request_date_time: requestDateTime,
      };
    }

    return {
      ...row,
      input: item.input,
      vat_number: row.vat_number || item.vat_number,
    };
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

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizePolishVat(raw);

      if (!normalized.ok) {
        results.push(
          errorRow(
            normalized.input,
            normalized.input,
            normalized.reason,
            "INVALID_FORMAT"
          )
        );
        continue;
      }

      if (!isValidPolishNipChecksum(normalized.nip)) {
        results.push(
          errorRow(
            normalized.input,
            normalized.vat_number,
            "Invalid Polish NIP checksum.",
            "INVALID_CHECKSUM"
          )
        );
        continue;
      }

      if (seen.has(normalized.nip)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.nip);
      prepared.push(normalized);
    }

    if (!prepared.length && !results.length) {
      return res.status(400).json({
        error: "No Polish VAT/NIP numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Polish VAT/NIP batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Polish NIP numbers per request.`,
        results,
      });
    }

    if (prepared.length) {
      results.push(...(await checkPolishVatBatch(prepared)));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Polish VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
