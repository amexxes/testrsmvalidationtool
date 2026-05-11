import { requireModuleAccess } from "../lib/auth.js";

export const config = {
  maxDuration: 60,
};

const GLEIF_API_BASE_URL =
  process.env.GLEIF_API_BASE_URL || "https://api.gleif.org/api/v1";

const MAX_BATCH_SIZE = Number(process.env.LEI_MAX_BATCH_SIZE || 500);
const GLEIF_CHUNK_SIZE = Number(process.env.GLEIF_LEI_CHUNK_SIZE || 200);
const REQUEST_TIMEOUT_MS = Number(process.env.GLEIF_REQUEST_TIMEOUT_MS || 25000);

function normalizeLeiCandidate(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "")
    .toUpperCase();
}

function leiMod97(lei) {
  let remainder = 0;

  for (const char of lei) {
    const code = char.charCodeAt(0);
    const value = code >= 65 && code <= 90 ? String(code - 55) : char;

    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

function validateLeiFormat(value) {
  const lei = normalizeLeiCandidate(value);

  if (!lei) return { ok: false, reason: "Missing LEI" };
  if (!/^[A-Z0-9]{20}$/.test(lei)) {
    return { ok: false, reason: "LEI must contain exactly 20 letters/numbers" };
  }

  if (leiMod97(lei) !== 1) {
    return { ok: false, reason: "Invalid LEI checksum" };
  }

  return { ok: true, reason: "" };
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.value) return String(value.value);

    return Object.values(value).map(displayValue).filter(Boolean).join(", ");
  }

  return String(value);
}

function addressToString(address) {
  if (!address || typeof address !== "object") return "";

  const addressLines = Array.isArray(address.addressLines)
    ? address.addressLines
    : [];

  return [
    ...addressLines,
    address.firstAddressLine,
    Array.isArray(address.additionalAddressLine)
      ? address.additionalAddressLine.join(", ")
      : address.additionalAddressLine,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .map(displayValue)
    .filter(Boolean)
    .join(", ");
}

function makeInvalidFormatRow(inputLei, reason) {
  const lei = normalizeLeiCandidate(inputLei);

  return {
    input_lei: inputLei,
    lei,
    valid: false,
    status: "invalid",
    source: "local-format",
    message: reason,
    checked_at: new Date().toISOString(),
  };
}

function makeNotFoundRow(inputLei) {
  const lei = normalizeLeiCandidate(inputLei);

  return {
    input_lei: inputLei,
    lei,
    valid: false,
    status: "invalid",
    source: "gleif",
    message: "LEI not found in GLEIF.",
    checked_at: new Date().toISOString(),
  };
}

function makeErrorRow(inputLei, message) {
  const lei = normalizeLeiCandidate(inputLei);

  return {
    input_lei: inputLei,
    lei,
    valid: false,
    status: "error",
    source: "gleif",
    message: message || "GLEIF API request failed.",
    checked_at: new Date().toISOString(),
  };
}

function mapGleifRecord(inputLei, record) {
  const attributes = record?.attributes || {};
  const entity = attributes.entity || {};
  const registration = attributes.registration || {};

  const entityStatus = String(entity.status || "");
  const registrationStatus = String(registration.status || "");
  const activeIssued =
    entityStatus === "ACTIVE" && registrationStatus === "ISSUED";

  return {
    input_lei: inputLei,
    lei: record?.id || attributes.lei || normalizeLeiCandidate(inputLei),
    valid: activeIssued,
    status: activeIssued ? "valid" : "invalid",
    source: "gleif",
    legal_name: displayValue(entity.legalName),
    entity_status: entityStatus,
    registration_status: registrationStatus,
    jurisdiction:
      entity.legalJurisdiction ||
      entity.legalAddress?.country ||
      entity.headquartersAddress?.country ||
      "",
    legal_address: addressToString(entity.legalAddress),
    headquarters_address: addressToString(entity.headquartersAddress),
    initial_registration_date: registration.initialRegistrationDate || "",
    last_update_date: registration.lastUpdateDate || "",
    next_renewal_date: registration.nextRenewalDate || "",
    managing_lou: displayValue(registration.managingLou),
    message: activeIssued
      ? "Active LEI."
      : `LEI found, but status is ${entityStatus || "unknown"} / ${
          registrationStatus || "unknown"
        }.`,
    checked_at: new Date().toISOString(),
  };
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGleifRecords(leis) {
  const url = new URL(`${GLEIF_API_BASE_URL}/lei-records`);
  url.searchParams.set("filter[lei]", leis.join(","));
  url.searchParams.set("page[size]", String(Math.max(1, leis.length)));

  const response = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/vnd.api+json, application/json",
    },
  });

  const data = await safeReadJson(response);

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.detail ||
        data?.message ||
        `GLEIF API returned HTTP ${response.status}`
    );
  }

  if (Array.isArray(data?.data)) return data.data;
  if (data?.data) return [data.data];

  return [];
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireModuleAccess(req, res, "lei");
  if (!auth) return;

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const inputValues = Array.isArray(body.leis)
      ? body.leis
      : Array.isArray(body.values)
        ? body.values
        : [];

    if (!inputValues.length) {
      return res.status(400).json({
        error: "No LEI values supplied.",
        results: [],
      });
    }

    if (inputValues.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Too many LEI values. Max batch size is ${MAX_BATCH_SIZE}.`,
        results: [],
      });
    }

    const seen = new Set();
    const uniqueInputs = [];
    let duplicatesIgnored = 0;

    for (const value of inputValues) {
      const lei = normalizeLeiCandidate(value);
      if (!lei) continue;

      if (seen.has(lei)) {
        duplicatesIgnored += 1;
        continue;
      }

      seen.add(lei);
      uniqueInputs.push({
        input: String(value || ""),
        lei,
        format: validateLeiFormat(lei),
      });
    }

    const validLeis = uniqueInputs
      .filter((item) => item.format.ok)
      .map((item) => item.lei);

    const recordsByLei = new Map();
    const errorsByLei = new Map();

    for (const chunk of chunkArray(validLeis, GLEIF_CHUNK_SIZE)) {
      try {
        const records = await fetchGleifRecords(chunk);

        for (const record of records) {
          const lei = normalizeLeiCandidate(record?.id || record?.attributes?.lei || "");
          if (lei) recordsByLei.set(lei, record);
        }
      } catch (error) {
        for (const lei of chunk) {
          errorsByLei.set(
            lei,
            error?.name === "AbortError"
              ? "GLEIF API request timed out."
              : error?.message || "GLEIF API request failed."
          );
        }
      }
    }

    const results = uniqueInputs.map((item) => {
      if (!item.format.ok) {
        return makeInvalidFormatRow(item.input, item.format.reason);
      }

      if (errorsByLei.has(item.lei)) {
        return makeErrorRow(item.input, errorsByLei.get(item.lei));
      }

      const record = recordsByLei.get(item.lei);

      if (!record) {
        return makeNotFoundRow(item.input);
      }

      return mapGleifRecord(item.input, record);
    });

    const stats = results.reduce(
      (acc, row) => {
        if (row.status === "valid") acc.valid += 1;
        else if (row.status === "error") acc.errors += 1;
        else acc.invalid += 1;

        return acc;
      },
      { valid: 0, invalid: 0, errors: 0 }
    );

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored: duplicatesIgnored,
      stats,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "LEI validation failed.",
      message: error?.message || String(error),
      results: [],
    });
  }
}
