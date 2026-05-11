import { requireModuleAccess } from "../lib/auth.js";

export const config = {
  maxDuration: 60,
};

const MAX_BATCH_SIZE = Number(process.env.COMPANY_REGISTER_MAX_BATCH_SIZE || 500);
const CONCURRENCY = Number(process.env.COMPANY_REGISTER_CONCURRENCY || 5);
const REQUEST_TIMEOUT_MS = Number(process.env.COMPANY_REGISTER_TIMEOUT_MS || 25000);

const COMPANIES_HOUSE_BASE_URL =
  process.env.COMPANIES_HOUSE_BASE_URL || "https://api.company-information.service.gov.uk";

const INSEE_BASE_URL =
  process.env.INSEE_SIRENE_BASE_URL || "https://api.insee.fr/api-sirene/3.11";

const BRREG_BASE_URL =
  process.env.BRREG_BASE_URL || "https://data.brreg.no/enhetsregisteret/api";

const ARES_BASE_URL =
  process.env.ARES_BASE_URL || "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";

function normalizeCountry(value) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "UK" || raw === "GB" || raw === "UNITED KINGDOM") return "GB";
  if (raw === "FR" || raw === "FRANCE") return "FR";
  if (raw === "NO" || raw === "NORWAY") return "NO";
  if (raw === "CZ" || raw === "CZECHIA" || raw === "CZECH REPUBLIC") return "CZ";

  return raw;
}

function normalizeNumber(country, value) {
  const raw = String(value || "").trim().toUpperCase();

  if (country === "GB") {
    return raw.replace(/[^A-Z0-9]/g, "");
  }

  if (country === "FR" || country === "NO") {
    return raw.replace(/\D/g, "");
  }

  if (country === "CZ") {
    const digits = raw.replace(/\D/g, "");
    return digits && digits.length <= 8 ? digits.padStart(8, "0") : digits;
  }

  return raw.replace(/\s+/g, "");
}

function validateFormat(country, number) {
  if (!country) return { ok: false, reason: "Missing country." };
  if (!number) return { ok: false, reason: "Missing registration number." };

  if (country === "GB") {
    if (!/^[A-Z0-9]{2,8}$/.test(number)) {
      return { ok: false, reason: "Expected UK Companies House number." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "FR") {
    if (!/^\d{9}$/.test(number) && !/^\d{14}$/.test(number)) {
      return { ok: false, reason: "Expected French SIREN 9 digits or SIRET 14 digits." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "NO") {
    if (!/^\d{9}$/.test(number)) {
      return { ok: false, reason: "Expected Norwegian organisation number: 9 digits." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "CZ") {
    if (!/^\d{8}$/.test(number)) {
      return { ok: false, reason: "Expected Czech IČO: 8 digits." };
    }
    return { ok: true, reason: "" };
  }

  return { ok: false, reason: `Country ${country} is not supported yet.` };
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value).map(displayValue).filter(Boolean).join(", ");
  }

  return String(value);
}

function makeAddress(parts) {
  return parts.map(displayValue).filter(Boolean).join(", ");
}

function makeInvalidRow(input, country, number, message) {
  return {
    input,
    country,
    registration_number: number,
    valid: false,
    status: "invalid",
    company_name: "",
    registry_status: "",
    legal_form: "",
    address: "",
    registration_date: "",
    source: "local-format",
    message,
    checked_at: new Date().toISOString(),
  };
}

function makeNotFoundRow(input, country, number, source) {
  return {
    input,
    country,
    registration_number: number,
    valid: false,
    status: "invalid",
    company_name: "",
    registry_status: "",
    legal_form: "",
    address: "",
    registration_date: "",
    source,
    message: "Registration number not found.",
    checked_at: new Date().toISOString(),
  };
}

function makeErrorRow(input, country, number, source, message) {
  return {
    input,
    country,
    registration_number: number,
    valid: false,
    status: "error",
    company_name: "",
    registry_status: "",
    legal_form: "",
    address: "",
    registration_date: "",
    source,
    message: message || "Company register API request failed.",
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

async function fetchJson(url, options = {}) {
  const response = await fetchWithTimeout(url, options);
  const data = await safeReadJson(response);

  if (response.status === 404) {
    return { notFound: true, data: null };
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        data?.title ||
        `Register API returned HTTP ${response.status}`
    );
  }

  return { notFound: false, data };
}

async function validateGb(input, country, number) {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;

  if (!apiKey) {
    return makeErrorRow(
      input,
      country,
      number,
      "companies_house",
      "Missing COMPANIES_HOUSE_API_KEY."
    );
  }

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const url = `${COMPANIES_HOUSE_BASE_URL}/company/${encodeURIComponent(number)}`;

  const { notFound, data } = await fetchJson(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (notFound) return makeNotFoundRow(input, country, number, "companies_house");

  const address = data?.registered_office_address || {};

  return {
    input,
    country,
    registration_number: data?.company_number || number,
    valid: true,
    status: "valid",
    company_name: data?.company_name || "",
    registry_status: data?.company_status || "",
    legal_form: data?.type || "",
    address: makeAddress([
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country,
    ]),
    registration_date: data?.date_of_creation || "",
    source: "companies_house",
    message: "Company found in Companies House.",
    checked_at: new Date().toISOString(),
  };
}

async function validateFr(input, country, number) {
  const apiKey = process.env.INSEE_API_KEY || process.env.INSEE_SIRENE_API_KEY;

  if (!apiKey) {
    return makeErrorRow(
      input,
      country,
      number,
      "insee_sirene",
      "Missing INSEE_API_KEY or INSEE_SIRENE_API_KEY."
    );
  }

  const endpoint = number.length === 14 ? "siret" : "siren";
  const url = `${INSEE_BASE_URL}/${endpoint}/${encodeURIComponent(number)}`;

  const { notFound, data } = await fetchJson(url, {
    headers: {
      Accept: "application/json",
      "X-INSEE-Api-Key-Integration": apiKey,
    },
  });

  if (notFound) return makeNotFoundRow(input, country, number, "insee_sirene");

  if (endpoint === "siret") {
    const etablissement = data?.etablissement || {};
    const uniteLegale = etablissement?.uniteLegale || {};
    const address = etablissement?.adresseEtablissement || {};

    const name =
      uniteLegale.denominationUniteLegale ||
      [uniteLegale.prenom1UniteLegale, uniteLegale.nomUniteLegale].filter(Boolean).join(" ");

    return {
      input,
      country,
      registration_number: etablissement.siret || number,
      valid: true,
      status: "valid",
      company_name: name || "",
      registry_status: etablissement.etatAdministratifEtablissement || "",
      legal_form: uniteLegale.categorieJuridiqueUniteLegale || "",
      address: makeAddress([
        address.numeroVoieEtablissement,
        address.typeVoieEtablissement,
        address.libelleVoieEtablissement,
        address.codePostalEtablissement,
        address.libelleCommuneEtablissement,
      ]),
      registration_date: etablissement.dateCreationEtablissement || "",
      source: "insee_sirene",
      message: "SIRET found in INSEE Sirene.",
      checked_at: new Date().toISOString(),
    };
  }

  const uniteLegale = data?.uniteLegale || {};
  const name =
    uniteLegale.denominationUniteLegale ||
    [uniteLegale.prenom1UniteLegale, uniteLegale.nomUniteLegale].filter(Boolean).join(" ");

  return {
    input,
    country,
    registration_number: uniteLegale.siren || number,
    valid: true,
    status: "valid",
    company_name: name || "",
    registry_status: uniteLegale.etatAdministratifUniteLegale || "",
    legal_form: uniteLegale.categorieJuridiqueUniteLegale || "",
    address: "",
    registration_date: uniteLegale.dateCreationUniteLegale || "",
    source: "insee_sirene",
    message: "SIREN found in INSEE Sirene.",
    checked_at: new Date().toISOString(),
  };
}

async function validateNo(input, country, number) {
  const url = `${BRREG_BASE_URL}/enheter/${encodeURIComponent(number)}`;

  const { notFound, data } = await fetchJson(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (notFound) return makeNotFoundRow(input, country, number, "brreg");

  const address = data?.forretningsadresse || data?.postadresse || {};

  return {
    input,
    country,
    registration_number: data?.organisasjonsnummer || number,
    valid: true,
    status: "valid",
    company_name: data?.navn || "",
    registry_status: data?.konkurs
      ? "bankrupt"
      : data?.underAvvikling
        ? "under_liquidation"
        : data?.slettedato
          ? "deleted"
          : "registered",
    legal_form: data?.organisasjonsform?.beskrivelse || data?.organisasjonsform?.kode || "",
    address: makeAddress([
      address.adresse,
      address.postnummer,
      address.poststed,
      address.land,
    ]),
    registration_date: data?.stiftelsesdato || "",
    source: "brreg",
    message: "Organisation found in Brønnøysund Register Centre.",
    checked_at: new Date().toISOString(),
  };
}

async function validateCz(input, country, number) {
  const url = `${ARES_BASE_URL}/ekonomicke-subjekty/${encodeURIComponent(number)}`;

  const { notFound, data } = await fetchJson(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (notFound) return makeNotFoundRow(input, country, number, "ares");

  const address = data?.sidlo || {};

  return {
    input,
    country,
    registration_number: data?.ico || number,
    valid: true,
    status: "valid",
    company_name: data?.obchodniJmeno || "",
    registry_status: displayValue(data?.stavSubjektu),
    legal_form: displayValue(data?.pravniForma),
    address:
      address.textovaAdresa ||
      makeAddress([
        address.nazevUlice,
        address.cisloDomovni,
        address.cisloOrientacni,
        address.nazevObce,
        address.psc,
        address.nazevStatu,
      ]),
    registration_date: data?.datumVzniku || "",
    source: "ares",
    message: "Company found in ARES.",
    checked_at: new Date().toISOString(),
  };
}

async function validateOne(item) {
  const country = normalizeCountry(item.country);
  const number = normalizeNumber(country, item.registration_number || item.number || item.value);
  const input = item.input || item.registration_number || item.number || item.value || "";

  const format = validateFormat(country, number);

  if (!format.ok) {
    return makeInvalidRow(input, country, number, format.reason);
  }

  try {
    if (country === "GB") return await validateGb(input, country, number);
    if (country === "FR") return await validateFr(input, country, number);
    if (country === "NO") return await validateNo(input, country, number);
    if (country === "CZ") return await validateCz(input, country, number);

    return makeInvalidRow(input, country, number, `Country ${country} is not supported yet.`);
  } catch (error) {
    return makeErrorRow(
      input,
      country,
      number,
      country === "GB"
        ? "companies_house"
        : country === "FR"
          ? "insee_sirene"
          : country === "NO"
            ? "brreg"
            : "ares",
      error?.name === "AbortError"
        ? "Register API request timed out."
        : error?.message || "Register API request failed."
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

function parseItems(body) {
  if (Array.isArray(body.items)) {
    return body.items;
  }

  const country = normalizeCountry(body.country);

  const values = Array.isArray(body.registration_numbers)
    ? body.registration_numbers
    : Array.isArray(body.numbers)
      ? body.numbers
      : Array.isArray(body.values)
        ? body.values
        : [];

  return values.map((value) => ({
    country,
    registration_number: value,
    input: value,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireModuleAccess(req, res, "company");
  if (!auth) return;

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const rawItems = parseItems(body);

    if (!rawItems.length) {
      return res.status(400).json({
        error: "No company registration numbers supplied.",
        results: [],
      });
    }

    if (rawItems.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Too many values. Max batch size is ${MAX_BATCH_SIZE}.`,
        results: [],
      });
    }

    const seen = new Set();
    const items = [];
    let duplicatesIgnored = 0;

    for (const rawItem of rawItems) {
      const country = normalizeCountry(rawItem.country);
      const number = normalizeNumber(
        country,
        rawItem.registration_number || rawItem.number || rawItem.value
      );

      if (!country || !number) continue;

      const key = `${country}:${number}`;

      if (seen.has(key)) {
        duplicatesIgnored += 1;
        continue;
      }

      seen.add(key);

      items.push({
        ...rawItem,
        country,
        registration_number: number,
        input: rawItem.input || rawItem.registration_number || rawItem.number || rawItem.value,
      });
    }

    const results = await mapLimit(items, CONCURRENCY, validateOne);

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
      error: "Company register validation failed.",
      message: error?.message || String(error),
      results: [],
    });
  }
}
