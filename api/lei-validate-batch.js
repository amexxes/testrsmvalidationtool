import { requireModuleAccess } from "../lib/auth.js";

const GLEIF_API_BASE_URL =
  process.env.GLEIF_API_BASE_URL || "https://api.gleif.org/api/v1";

const MAX_BATCH_SIZE = Number(process.env.LEI_MAX_BATCH_SIZE || 500);
const CONCURRENCY = Number(process.env.LEI_CONCURRENCY || 5);
const REQUEST_TIMEOUT_MS = Number(process.env.GLEIF_REQUEST_TIMEOUT_MS || 20000);

function normalizeLei(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");
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
  const lei = normalizeLei(value);

  if (!lei) {
    return { ok: false, reason: "Missing LEI." };
  }

  if (!/^[A-Z0-9]{20}$/.test(lei)) {
    return { ok: false, reason: "LEI must contain exactly 20 letters/numbers." };
  }

  if (leiMod97(lei) !== 1) {
    return { ok: false, reason: "Invalid LEI checksum." };
  }

  return { ok: true, reason: "" };
}

function displayValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (value.name) return String(value.name);
    if (value.value) return String(value.value);
    return JSON.stringify(value);
  }
  return String(value);
}

function addressToString(address) {
  if (!address || typeof address !== "object") return "";

  return [
    address.firstAddressLine,
    address.additionalAddressLine?.join?.(", "),
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function makeFormatRow(inputLei, reason) {
  const lei = normalizeLei(inputLei);

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

function makeErrorRow(inputLei, message) {
  const lei = normalizeLei(inputLei);

  return {
    input_lei: inputLei,
    lei,
    valid: false,
    status: "error",
    source: "gleif",
    message,
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
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function pickRecord(data) {
  if (!data) return null;
  if (Array.isArray(data.data)) return data.data[0] || null;
  return data.data || null;
}

function mapGleifRecord(inputLei, record) {
  const attributes = record?.attributes || {};
  const entity = attributes.entity || {};
  const registration = attributes.registration || {};

  const legalName = displayValue(entity.legalName);
  const legalAddress = addressToString(entity.legalAddress);
  const headquartersAddress = addressToString(entity.headquartersAddress);

  const entityStatus = entity.status || "";
  const registrationStatus = registration.status || "";
  const jurisdiction = entity.legalJurisdiction || entity.legalAddress?.country || "";

  const isActiveIssued =
    entityStatus === "ACTIVE" && registrationStatus === "ISSUED";

  return {
    input_lei: inputLei,
    lei: record?.id || attributes.lei || normalizeLei(inputLei),
    valid: isActiveIssued,
    status: isActiveIssued ? "valid" : "invalid",
    source: "gleif",
    legal_name: legalName,
    entity_status: entityStatus,
    registration_status: registrationStatus,
    jurisdiction,
    legal_address: legalAddress,
    headquarters_address: headquartersAddress,
    initial_registration_date: registration.initialRegistrationDate || "",
    last_update_date: registration.lastUpdateDate || "",
    next_renewal_date: registration.nextRenewalDate || "",
    managing_lou: registration.managingLou || "",
    message: isActiveIssued
      ? "Active LEI."
      : `LEI found, but status is ${entityStatus || "unknown"} / ${
          registrationStatus || "unknown"
        }.`,
    checked_at: new Date().toISOString(),
  };
}

async function validateLeiWithGleif(inputLei) {
  const lei = normalizeLei(inputLei);
  const formatCheck = validateLeiFormat(lei);

  if (!formatCheck.ok) {
    return makeFormatRow(inputLei, formatCheck.reason);
  }

  const url = `${GLEIF_API_BASE_URL}/lei-records?filter[lei]=${encodeURIComponent(
    lei
  )}&page[size]=1`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.api+json, application/json",
      },
    });

    const data = await safeReadJson(response);

    if (!response.ok) {
      return makeErrorRow(
        inputLei,
        data?.errors?.[0]?.detail ||
          data?.message ||
          `GLEIF API returned HTTP ${response.status}.`
      );
    }

    const record = pickRecord(data);

    if (!record) {
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

    return mapGleifRecord(inputLei, record);
  } catch (error) {
    return makeErrorRow(
      inputLei,
      error?.name === "AbortError"
        ? "GLEIF API request timed out."
        : error?.message || "GLEIF API request failed."
    );
  }
}

async function mapLimit(items, limit, asyncFn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await asyncFn(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );

  return results;
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
    const uniqueValues = [];
    let duplicatesIgnored = 0;

    for (const value of inputValues) {
      const lei = normalizeLei(value);
      if (!lei) continue;

      if (seen.has(lei)) {
        duplicatesIgnored += 1;
        continue;
      }

      seen.add(lei);
      uniqueValues.push(value);
    }

    const results = await mapLimit(uniqueValues, CONCURRENCY, validateLeiWithGleif);

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
