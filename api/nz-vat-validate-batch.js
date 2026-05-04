// /api/nz-vat-validate-batch.js

const NZBN_SUBSCRIPTION_KEY = process.env.NZBN_SUBSCRIPTION_KEY || "";
const NZBN_BASE_URL =
  process.env.NZBN_BASE_URL || "https://api.business.govt.nz/gateway/nzbn/v5/entities";

const TIMEOUT_MS = Number(process.env.NZ_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.NZ_VAT_MAX_BATCH_SIZE || 50);

function normalizeNewZealandVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input.replace(/\s+/g, "").replace(/[.\-_/]/g, "");
  if (compact.startsWith("NZ")) compact = compact.slice(2);
  if (compact.endsWith("GST")) compact = compact.slice(0, -3);

  if (!/^\d{13}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason:
        "Expected New Zealand NZBN format: NZ9429000106078. Public GST-number validation is not available via NZBN API.",
    };
  }

  return {
    ok: true,
    input,
    nzbn: compact,
    vat_number: `NZ${compact}`,
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

function pickName(data) {
  return (
    data?.entityName ||
    data?.entityNameDetails?.entityName ||
    data?.tradingName ||
    ""
  );
}

function formatAddress(address) {
  if (!address) return "";

  const fields = [
    address.address1,
    address.address2,
    address.address3,
    address.address4,
    address.postCode,
    address.countryCode,
  ];

  return fields.filter(Boolean).join(", ");
}

function pickAddress(data) {
  return (
    formatAddress(data?.registeredAddress) ||
    formatAddress(data?.addressForService) ||
    formatAddress(data?.postalAddress) ||
    ""
  );
}

function isActiveEntity(data) {
  const status = String(
    data?.entityStatusDescription ||
      data?.entityStatus ||
      data?.registrationStatus ||
      ""
  ).toLowerCase();

  if (!status) return true;
  if (status.includes("removed")) return false;
  if (status.includes("inactive")) return false;
  if (status.includes("deregistered")) return false;

  return true;
}

async function checkNewZealandVat(item) {
  const url = `${NZBN_BASE_URL}/${encodeURIComponent(item.nzbn)}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      "Ocp-Apim-Subscription-Key": NZBN_SUBSCRIPTION_KEY,
    },
  });

  if (response.status === 404) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "NZ",
      valid: false,
      state: "invalid",
      name: "",
      address: "",
      message: "NZBN not found.",
      error: "",
      error_code: "",
      checked_at: new Date().toISOString(),
      source: "nzbn",
    };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "NZ",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message: "",
      error: data?.message || data?.error || `NZBN API failed: ${response.status}`,
      error_code: "NZ_NZBN_ERROR",
      checked_at: new Date().toISOString(),
      source: "nzbn",
    };
  }

  const active = isActiveEntity(data);

  return {
    input: item.input,
    vat_number: `NZ${data?.nzbn || item.nzbn}`,
    country_code: "NZ",
    valid: active,
    state: active ? "valid" : "invalid",
    name: pickName(data),
    address: pickAddress(data),
    message: active
      ? "NZBN entity found. GST registration is not confirmed by the NZBN API."
      : "NZBN entity found, but entity is not active.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "nzbn",
    nzbn: data?.nzbn || item.nzbn,
    entity_status: data?.entityStatusDescription || data?.entityStatus || "",
    entity_type: data?.entityTypeDescription || data?.entityType || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", message: "Use POST" });
  }

  if (!NZBN_SUBSCRIPTION_KEY) {
    return res.status(500).json({
      error: "Missing NZBN_SUBSCRIPTION_KEY",
      message: "Set NZBN_SUBSCRIPTION_KEY in environment variables.",
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
      const normalized = normalizeNewZealandVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "NZ",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "nzbn",
        });
        continue;
      }

      if (seen.has(normalized.nzbn)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.nzbn);
      prepared.push(normalized);
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "New Zealand NZBN batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} New Zealand NZBN numbers per request.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkNewZealandVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "New Zealand NZBN validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
