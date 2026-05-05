// /api/iban-validate-batch.js
import { requireModuleAccess } from "../lib/auth.js";
const MAX_BATCH_SIZE = Number(process.env.IBAN_MAX_BATCH_SIZE || 500);

const IBAN_LENGTHS = {
  AD: 24, AE: 23, AL: 28, AO: 25, AT: 20, AZ: 28,
  BA: 20, BE: 16, BF: 27, BG: 22, BH: 22, BI: 27, BJ: 28, BR: 29, BY: 28,
  CH: 21, CI: 28, CM: 27, CR: 22, CV: 25, CY: 28, CZ: 24,
  DE: 22, DK: 18, DO: 28, DZ: 24,
  EE: 20, EG: 29, ES: 24,
  FI: 18, FO: 18, FR: 27,
  GA: 27, GB: 22, GE: 22, GI: 23, GL: 18, GR: 27, GT: 28,
  HR: 21, HU: 28,
  IE: 22, IL: 23, IQ: 23, IR: 26, IS: 26, IT: 27,
  JO: 30,
  KM: 27, KW: 30, KZ: 20,
  LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25,
  MA: 28, MC: 27, MD: 24, ME: 22, MG: 27, MK: 19, ML: 28, MR: 27, MT: 31, MU: 30, MZ: 25,
  NE: 28, NI: 32, NL: 18, NO: 15,
  PK: 24, PL: 28, PS: 29, PT: 25,
  QA: 29,
  RO: 24, RS: 22,
  SA: 24, SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, SN: 28, SO: 23, ST: 25, SV: 28,
  TD: 27, TG: 28, TL: 23, TN: 24, TR: 26,
  UA: 29,
  VA: 22, VG: 24,
  XK: 20,
};

function normalizeIban(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function formatIban(iban) {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

function ibanMod97(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;

  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const value = code >= 65 && code <= 90 ? String(code - 55) : char;

    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

function bankIdentifier(iban) {
  const country = iban.slice(0, 2);

  if (country === "NL") return iban.slice(4, 8);
  if (country === "GB") return iban.slice(4, 8);
  if (country === "DE") return iban.slice(4, 12);
  if (country === "BE") return iban.slice(4, 7);
  if (country === "FR") return iban.slice(4, 14);
  if (country === "ES") return iban.slice(4, 12);
  if (country === "IT") return iban.slice(5, 15);

  return "";
}

function validateIban(raw) {
  const input = String(raw || "").trim();
  const iban = normalizeIban(raw);
  const country = iban.slice(0, 2);

  if (!iban) {
    return {
      input,
      iban,
      country_code: "",
      valid: false,
      state: "error",
      error_code: "MISSING_IBAN",
      error: "Missing IBAN.",
      message: "",
    };
  }

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) {
    return {
      input,
      iban,
      country_code: country,
      valid: false,
      state: "error",
      error_code: "INVALID_FORMAT",
      error: "Invalid IBAN format.",
      message: "",
    };
  }

  const expectedLength = IBAN_LENGTHS[country];

  if (!expectedLength) {
    return {
      input,
      iban,
      country_code: country,
      valid: false,
      state: "error",
      error_code: "UNSUPPORTED_COUNTRY",
      error: `Unsupported IBAN country: ${country}.`,
      message: "",
    };
  }

  if (iban.length !== expectedLength) {
    return {
      input,
      iban,
      country_code: country,
      valid: false,
      state: "invalid",
      error_code: "INVALID_LENGTH",
      error: "",
      message: `Invalid IBAN length for ${country}. Expected ${expectedLength} characters.`,
    };
  }

  const checksumOk = ibanMod97(iban) === 1;

  return {
    input,
    iban: formatIban(iban),
    iban_compact: iban,
    country_code: country,
    valid: checksumOk,
    state: checksumOk ? "valid" : "invalid",
    bank_identifier: bankIdentifier(iban),
    error_code: checksumOk ? "" : "INVALID_CHECKSUM",
    error: "",
    message: checksumOk ? "Valid IBAN format and checksum." : "Invalid IBAN checksum.",
    checked_at: new Date().toISOString(),
    source: "local_iban_mod97",
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
const auth = await requireModuleAccess(req, res, "iban");
if (!auth) return;
  const input =
    Array.isArray(req.body?.ibans)
      ? req.body.ibans
      : Array.isArray(req.body?.values)
        ? req.body.values
        : [];

  if (input.length > MAX_BATCH_SIZE) {
    return res.status(400).json({
      error: "IBAN batch too large",
      message: `Maximum ${MAX_BATCH_SIZE} IBANs per request.`,
      results: [],
    });
  }

  const seen = new Set();
  const results = [];
  let duplicates_ignored = 0;

  for (const raw of input) {
    const normalized = normalizeIban(raw);

    if (normalized && seen.has(normalized)) {
      duplicates_ignored += 1;
      continue;
    }

    if (normalized) seen.add(normalized);
    results.push(validateIban(raw));
  }

  return res.status(200).json({
    results,
    total: results.length,
    duplicates_ignored,
    checked_at: new Date().toISOString(),
  });
}
