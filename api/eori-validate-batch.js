// /api/eori-validate-batch.js
import { requireModuleAccess } from "../lib/auth.js";
const DEFAULT_HMRC_EORI_API_BASE_URL = "https://api.service.hmrc.gov.uk";
const HMRC_EORI_API_PATH = "/customs/eori/lookup/check-multiple-eori";
const MAX_BATCH_SIZE = 10;

function normalizeEori(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "")
    .toUpperCase();
}

function validateGbEoriFormat(value) {
  const eori = normalizeEori(value);

  if (!eori) {
    return { ok: false, reason: "Missing EORI" };
  }

  if (eori.startsWith("XI")) {
    return {
      ok: false,
      reason: "XI EORI numbers must be checked via the EU EORI service",
    };
  }

  if (!eori.startsWith("GB")) {
    return {
      ok: false,
      reason: "Only GB EORI numbers are supported by the HMRC API",
    };
  }

  if (!/^GB\d{12,15}$/.test(eori)) {
    return {
      ok: false,
      reason: "Expected format: GB followed by 12 to 15 digits",
    };
  }

  return { ok: true, reason: "" };
}

function chunkArray(values, size) {
  const chunks = [];

  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }

  return chunks;
}

async function safeReadJson(response) {
  const text = await response.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function mapHmrcResult(inputEori, hmrcRow) {
  const companyDetails = hmrcRow?.companyDetails || {};
  const valid = Boolean(hmrcRow?.valid);
  const returnedEori = hmrcRow?.eori || inputEori;

  return {
    input_eori: inputEori,
    eori: returnedEori,
    valid,
    status: valid ? "valid" : "invalid",
    trader_name: companyDetails?.traderName || "",
    address: companyDetails?.address || "",
    processing_date: hmrcRow?.processingDate || "",
    message: valid ? "" : "Invalid EORI",
  };
}

function makeErrorRow(inputEori, message) {
  return {
    input_eori: inputEori,
    eori: inputEori,
    valid: false,
    status: "error",
    trader_name: "",
    address: "",
    processing_date: "",
    message: message || "EORI validation failed",
  };
}

async function callHmrcBatch(batch) {
  const baseUrl = String(process.env.HMRC_EORI_API_BASE_URL || DEFAULT_HMRC_EORI_API_BASE_URL).replace(/\/+$/, "");
  const url = `${baseUrl}${HMRC_EORI_API_PATH}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ eoris: batch }),
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.raw ||
      `HMRC EORI API returned HTTP ${response.status}`;

    return batch.map((eori) => makeErrorRow(eori, message));
  }

  if (!Array.isArray(data)) {
    return batch.map((eori) => makeErrorRow(eori, "Unexpected HMRC EORI API response"));
  }

  const byEori = new Map();

  for (const row of data) {
    const eori = normalizeEori(row?.eori);
    if (eori) byEori.set(eori, row);
  }

  return batch.map((inputEori) => {
    const hmrcRow = byEori.get(inputEori);
    if (!hmrcRow) return makeErrorRow(inputEori, "No result returned by HMRC");
    return mapHmrcResult(inputEori, hmrcRow);
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
    const auth = await requireModuleAccess(req, res, "eori");
    if (!auth) return;

    const body = req.body || {};
    const input = Array.isArray(body.eoris) ? body.eoris : [];

    const seen = new Set();
    const validEoris = [];
    const invalidRows = [];
    let duplicatesIgnored = 0;

    for (const rawValue of input) {
      const eori = normalizeEori(rawValue);
      if (!eori) continue;

      if (seen.has(eori)) {
        duplicatesIgnored += 1;
        continue;
      }

      seen.add(eori);

      const format = validateGbEoriFormat(eori);

      if (!format.ok) {
        invalidRows.push({
          input_eori: eori,
          eori,
          valid: false,
          status: "error",
          trader_name: "",
          address: "",
          processing_date: "",
          message: format.reason,
        });
        continue;
      }

      validEoris.push(eori);
    }

    if (!validEoris.length && !invalidRows.length) {
      return res.status(400).json({
        error: "No EORI numbers supplied",
        message: "Provide at least one EORI number in eoris",
        results: [],
      });
    }

    const hmrcRows = [];

    for (const batch of chunkArray(validEoris, MAX_BATCH_SIZE)) {
      const batchRows = await callHmrcBatch(batch);
      hmrcRows.push(...batchRows);
    }

    const results = [...hmrcRows, ...invalidRows];

    const stats = results.reduce(
      (acc, row) => {
        if (row.status === "valid") acc.valid += 1;
        else if (row.status === "invalid") acc.invalid += 1;
        else if (row.status === "error") acc.errors += 1;
        return acc;
      },
      { valid: 0, invalid: 0, errors: 0 }
    );

    return res.status(200).json({
      results,
      total: results.length,
      valid: stats.valid,
      invalid: stats.invalid,
      errors: stats.errors,
      duplicates_ignored: duplicatesIgnored,
      checked_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      error: "EORI validation failed",
      message: err?.message || String(err),
      results: [],
    });
  }
}
