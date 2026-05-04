// /api/no-vat-validate-batch.js

const BRREG_BASE_URL =
  process.env.BRREG_BASE_URL || "https://data.brreg.no/enhetsregisteret/api/enheter";

const TIMEOUT_MS = Number(process.env.NO_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.NO_VAT_MAX_BATCH_SIZE || 50);

function normalizeNorwayVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");

  if (compact.startsWith("NO")) compact = compact.slice(2);
  if (compact.endsWith("MVA")) compact = compact.slice(0, -3);

  if (!/^\d{9}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Norwegian VAT format: NO999999999MVA or 999999999MVA",
    };
  }

  return {
    ok: true,
    input,
    digits: compact,
    vat_number: `NO${compact}MVA`,
  };
}

function isValidNorwegianOrgNumber(digits) {
  if (!/^\d{9}$/.test(digits)) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => {
    return acc + Number(digits[index]) * weight;
  }, 0);

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;

  if (checkDigit === 10) return false;

  return Number(digits[8]) === checkDigit;
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

function formatAddress(address) {
  if (!address) return "";

  const lines = Array.isArray(address.adresse) ? address.adresse : [];
  const postalLine = [address.postnummer, address.poststed].filter(Boolean).join(" ");
  const country = address.land || "";

  return [...lines, postalLine, country].filter(Boolean).join(", ");
}

async function checkNorwayVat(item) {
  const url = `${BRREG_BASE_URL}/${encodeURIComponent(item.digits)}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "NO",
      valid: false,
      state: "invalid",
      name: "",
      address: "",
      message: "Organisation number not found.",
      error: "",
      error_code: "",
      checked_at: new Date().toISOString(),
      source: "brreg",
    };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "NO",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message: "",
      error: data?.message || `Brønnøysund API failed: ${response.status}`,
      error_code: "NO_BRREG_ERROR",
      checked_at: new Date().toISOString(),
      source: "brreg",
    };
  }

  const isVatRegistered = data?.registrertIMvaregisteret === true;
  const address = formatAddress(data?.forretningsadresse || data?.postadresse);

  return {
    input: item.input,
    vat_number: `NO${data?.organisasjonsnummer || item.digits}MVA`,
    country_code: "NO",
    valid: isVatRegistered,
    state: isVatRegistered ? "valid" : "invalid",
    name: data?.navn || "",
    address,
    message: isVatRegistered
      ? "Registered in the Norwegian VAT/MVA register."
      : "Organisation found, but not registered in the Norwegian VAT/MVA register.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "brreg",
    organisation_number: data?.organisasjonsnummer || item.digits,
    organisation_form: data?.organisasjonsform?.beskrivelse || "",
    registered_in_vat_register: isVatRegistered,
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
      const normalized = normalizeNorwayVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "NO",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "brreg",
        });
        continue;
      }

      if (!isValidNorwegianOrgNumber(normalized.digits)) {
        results.push({
          input: normalized.input,
          vat_number: normalized.vat_number,
          country_code: "NO",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: "Invalid Norwegian organisation number checksum.",
          error_code: "INVALID_CHECKSUM",
          checked_at: new Date().toISOString(),
          source: "brreg",
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
        error: "No Norwegian VAT numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Norwegian VAT batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Norwegian VAT numbers per request.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkNorwayVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Norwegian VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
