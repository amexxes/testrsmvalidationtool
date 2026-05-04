// /api/za-vat-validate-batch.js
//
// SARS has a public VAT Vendor Search, but no clean public JSON API for batch validation.
// This file is a safe wrapper for a licensed/internal provider endpoint.
// Do not scrape SARS pages from production.

const ZA_VAT_PROVIDER_URL = process.env.ZA_VAT_PROVIDER_URL || "";
const ZA_VAT_PROVIDER_KEY = process.env.ZA_VAT_PROVIDER_KEY || "";

const TIMEOUT_MS = Number(process.env.ZA_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.ZA_VAT_MAX_BATCH_SIZE || 50);

function normalizeSouthAfricaVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input.replace(/\s+/g, "").replace(/[.\-_/]/g, "");
  if (compact.startsWith("ZA")) compact = compact.slice(2);
  if (compact.startsWith("VAT")) compact = compact.slice(3);

  if (!/^\d{10}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected South African VAT format: ZA4123456789 or 4123456789",
    };
  }

  if (!compact.startsWith("4")) {
    return {
      ok: false,
      input,
      reason: "South African VAT numbers are expected to be 10 digits and usually start with 4.",
    };
  }

  return {
    ok: true,
    input,
    digits: compact,
    vat_number: `ZA${compact}`,
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

async function checkSouthAfricaVat(item) {
  if (!ZA_VAT_PROVIDER_URL) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "ZA",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message:
        "No official public SARS JSON API is configured. Use ZA_VAT_PROVIDER_URL for a licensed provider/internal service.",
      error: "ZA VAT provider not configured.",
      error_code: "ZA_PROVIDER_NOT_CONFIGURED",
      checked_at: new Date().toISOString(),
      source: "za_provider",
    };
  }

  const response = await fetchWithTimeout(ZA_VAT_PROVIDER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ZA_VAT_PROVIDER_KEY ? { Authorization: `Bearer ${ZA_VAT_PROVIDER_KEY}` } : {}),
    },
    body: JSON.stringify({ vat_number: item.digits, input: item.input }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "ZA",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message: "",
      error: data?.message || data?.error || `ZA VAT provider failed: ${response.status}`,
      error_code: "ZA_PROVIDER_ERROR",
      checked_at: new Date().toISOString(),
      source: "za_provider",
    };
  }

  const valid = Boolean(data?.valid);

  return {
    input: item.input,
    vat_number: data?.vat_number || item.vat_number,
    country_code: "ZA",
    valid,
    state: valid ? "valid" : "invalid",
    name: data?.name || data?.trading_name || "",
    address: data?.address || "",
    message:
      data?.message ||
      (valid
        ? "VAT number verified by configured ZA provider."
        : "VAT number not verified by configured ZA provider."),
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "za_provider",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", message: "Use POST" });
  }

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizeSouthAfricaVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "ZA",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "za_provider",
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

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "South African VAT batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} South African VAT numbers per request.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkSouthAfricaVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "South African VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
