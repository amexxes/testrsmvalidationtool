import { requireModuleAccess } from "../lib/auth.js";

export const config = {
  maxDuration: 60,
};

const MAX_BATCH_SIZE = Number(process.env.COMPANY_REGISTER_MAX_BATCH_SIZE || 500);
const CONCURRENCY = Number(process.env.COMPANY_REGISTER_CONCURRENCY || 5);
const REQUEST_TIMEOUT_MS = Number(process.env.COMPANY_REGISTER_TIMEOUT_MS || 25000);

const COMPANIES_HOUSE_BASE_URL =
  process.env.COMPANIES_HOUSE_BASE_URL || "https://api.company-information.service.gov.uk";
const KRS_BASE_URL =
  process.env.KRS_BASE_URL || "https://api-krs.ms.gov.pl/api/krs";
const PRH_YTJ_BASE_URL =
  process.env.PRH_YTJ_BASE_URL || "https://avoindata.prh.fi/opendata-ytj-api/v3";
const INSEE_BASE_URL =
  process.env.INSEE_SIRENE_BASE_URL || "https://api.insee.fr/api-sirene/3.11";
const BRREG_BASE_URL =
  process.env.BRREG_BASE_URL || "https://data.brreg.no/enhetsregisteret/api";
const ARES_BASE_URL =
  process.env.ARES_BASE_URL || "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest";
const RPO_BASE_URL =
  process.env.RPO_BASE_URL || "https://api.statistics.sk/rpo/v1";
const SKATTURINN_COMPANY_REGISTRY_URL_TEMPLATE =
  process.env.SKATTURINN_COMPANY_REGISTRY_URL_TEMPLATE || "";

const EE_ARIREG_SOAP_URL =
  process.env.EE_ARIREG_SOAP_URL || "";

const EE_ARIREG_USERNAME =
  process.env.EE_ARIREG_USERNAME || "";

const EE_ARIREG_PASSWORD =
  process.env.EE_ARIREG_PASSWORD || "";

function normalizeCountry(value) {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "UK" || raw === "GB" || raw === "UNITED KINGDOM") return "GB";
  if (raw === "FR" || raw === "FRANCE") return "FR";
  if (raw === "NO" || raw === "NORWAY") return "NO";
  if (raw === "CZ" || raw === "CZECHIA" || raw === "CZECH REPUBLIC") return "CZ";
  if (raw === "PL" || raw === "POLAND") return "PL";
  if (raw === "FI" || raw === "FINLAND") return "FI";
  if (raw === "SK" || raw === "SLOVAKIA" || raw === "SLOVAK REPUBLIC") return "SK";
  if (raw === "IS" || raw === "ICELAND") return "IS";
  if (raw === "EE" || raw === "ESTONIA") return "EE";

  return raw;
}

function normalizeNumber(country, value) {
  const raw = String(value || "").trim().toUpperCase();

  if (country === "GB") {
    return raw.replace(/[^A-Z0-9]/g, "");
  }

  if (country === "FR" || country === "NO" || country === "IS" || country === "EE") {
    return raw.replace(/\D/g, "");
  }

  if (country === "CZ" || country === "SK") {
    const digits = raw.replace(/\D/g, "");
    return digits && digits.length <= 8 ? digits.padStart(8, "0") : digits;
  }

  if (country === "PL") {
    const digits = raw.replace(/\D/g, "");
    return digits && digits.length <= 10 ? digits.padStart(10, "0") : digits;
  }

  if (country === "FI") {
    const cleaned = raw.replace(/\s+/g, "");

    if (/^\d{8}$/.test(cleaned)) {
      return `${cleaned.slice(0, 7)}-${cleaned.slice(7)}`;
    }

    return cleaned;
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

  if (country === "PL") {
    if (!/^\d{10}$/.test(number)) {
      return { ok: false, reason: "Expected Polish KRS number: 10 digits." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "FI") {
    if (!validateFinnishBusinessId(number)) {
      return { ok: false, reason: "Expected Finnish Business ID: 1234567-8." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "SK") {
    if (!/^\d{8}$/.test(number)) {
      return { ok: false, reason: "Expected Slovak IČO: 8 digits." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "IS") {
    if (!validateIcelandKennitala(number)) {
      return { ok: false, reason: "Expected Icelandic kennitala: 10 digits." };
    }
    return { ok: true, reason: "" };
  }

  if (country === "EE") {
    if (!/^\d{8}$/.test(number)) {
      return { ok: false, reason: "Expected Estonian registry code: 8 digits." };
    }
    return { ok: true, reason: "" };
  }

  return { ok: false, reason: `Country ${country} is not supported yet.` };
}

function validateFinnishBusinessId(value) {
  const businessId = String(value || "").trim();

  if (!/^\d{7}-\d$/.test(businessId)) return false;

  const digits = businessId.replace("-", "");
  const weights = [7, 9, 10, 5, 8, 4, 2];

  const sum = weights.reduce((total, weight, index) => {
    return total + Number(digits[index]) * weight;
  }, 0);

  const remainder = sum % 11;

  if (remainder === 1) return false;

  const checkDigit = remainder === 0 ? 0 : 11 - remainder;

  return checkDigit === Number(digits[7]);
}
function validateIcelandKennitala(value) {
  const kennitala = String(value || "").replace(/\D/g, "");

  if (!/^\d{10}$/.test(kennitala)) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => {
    return total + Number(kennitala[index]) * weight;
  }, 0);

  const checkDigit = (11 - (sum % 11)) % 11;

  if (checkDigit === 10) return false;

  return checkDigit === Number(kennitala[8]);
}

function currentTimedEntry(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  return entries.find((entry) => !entry.validTo) || entries[0] || null;
}

function currentTimedValue(entries) {
  const entry = currentTimedEntry(entries);
  return entry?.value || "";
}

function currentCodeValue(entries) {
  const entry = currentTimedEntry(entries);
  return entry?.value?.value || entry?.value?.code || "";
}

async function validateSk(input, country, number) {
  const searchUrl = new URL(`${RPO_BASE_URL}/search`);
  searchUrl.searchParams.set("identifier", number);

  const searchResult = await fetchJson(searchUrl.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  const entityId = searchResult.data?.results?.[0]?.id;

  if (searchResult.notFound || !entityId) {
    return makeNotFoundRow(input, country, number, "rpo");
  }

  const detailUrl = `${RPO_BASE_URL}/entity/${encodeURIComponent(entityId)}`;

  const detailResult = await fetchJson(detailUrl, {
    headers: {
      Accept: "application/json",
    },
  });

  if (detailResult.notFound || !detailResult.data) {
    return makeNotFoundRow(input, country, number, "rpo");
  }

  const entity = detailResult.data;
  const address = currentTimedEntry(entity.addresses);
  const active = !entity.termination;

  return {
    input,
    country,
    registration_number: currentTimedValue(entity.identifiers) || number,
    valid: active,
    status: active ? "valid" : "invalid",
    company_name: currentTimedValue(entity.fullNames),
    registry_status: active ? "active" : "terminated",
    legal_form: currentCodeValue(entity.legalForms),
    address:
      address?.formatedAddress ||
      makeAddress([
        address?.street,
        address?.regNumber,
        address?.buildingNumber,
        Array.isArray(address?.postalCodes) ? address.postalCodes.join(", ") : "",
        address?.municipality?.value,
        address?.country?.value,
      ]),
    registration_date: entity.establishment || "",
    source: "rpo",
    message: active
      ? "Company found in Slovak RPO."
      : "Company found in Slovak RPO, but is terminated.",
    checked_at: new Date().toISOString(),
  };
}
function firstNonEmpty(...values) {
  return values.find((value) => value !== null && value !== undefined && String(value).trim() !== "") || "";
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function xmlValue(xml, tagName) {
  const patterns = [
    new RegExp(`<[^>]*:${tagName}[^>]*>([\\s\\S]*?)<\\/[^>]*:${tagName}>`, "i"),
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = String(xml || "").match(pattern);
    if (match) {
      return match[1]
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
    }
  }

  return "";
}

async function validateIs(input, country, number) {
  if (!SKATTURINN_COMPANY_REGISTRY_URL_TEMPLATE) {
    return makeErrorRow(
      input,
      country,
      number,
      "skatturinn",
      "Missing SKATTURINN_COMPANY_REGISTRY_URL_TEMPLATE. Configure it with the Skatturinn Company Registry API URL."
    );
  }

  const url = SKATTURINN_COMPANY_REGISTRY_URL_TEMPLATE.replace("{number}", encodeURIComponent(number));

  const { notFound, data } = await fetchJson(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (notFound || !data) return makeNotFoundRow(input, country, number, "skatturinn");

  const record = Array.isArray(data) ? data[0] : data.data || data.company || data;

  if (!record) return makeNotFoundRow(input, country, number, "skatturinn");

  return {
    input,
    country,
    registration_number: firstNonEmpty(record.kennitala, record.kt, record.id, number),
    valid: true,
    status: "valid",
    company_name: firstNonEmpty(record.name, record.nafn, record.legalName, record.companyName),
    registry_status: firstNonEmpty(record.status, record.stada, "registered"),
    legal_form: firstNonEmpty(record.legalForm, record.rekstrarform, record.type),
    address: firstNonEmpty(
      record.address,
      record.heimilisfang,
      makeAddress([record.street, record.postalCode, record.city])
    ),
    registration_date: firstNonEmpty(record.registrationDate, record.skraningardagur, record.dateRegistered),
    source: "skatturinn",
    message: "Company found in Icelandic Company Registry.",
    checked_at: new Date().toISOString(),
  };
}

async function validateEe(input, country, number) {
  if (!EE_ARIREG_SOAP_URL || !EE_ARIREG_USERNAME || !EE_ARIREG_PASSWORD) {
    return makeErrorRow(
      input,
      country,
      number,
      "ee_arireg",
      "Missing EE_ARIREG_SOAP_URL, EE_ARIREG_USERNAME or EE_ARIREG_PASSWORD."
    );
  }

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://arireg.x-road.eu/producer/">
  <soapenv:Body>
    <prod:lihtandmed_v2>
      <prod:keha>
        <prod:ariregister_kasutajanimi>${xmlEscape(EE_ARIREG_USERNAME)}</prod:ariregister_kasutajanimi>
        <prod:ariregister_parool>${xmlEscape(EE_ARIREG_PASSWORD)}</prod:ariregister_parool>
        <prod:ariregister_valjundi_formaat>xml</prod:ariregister_valjundi_formaat>
        <prod:ariregistri_kood>${xmlEscape(number)}</prod:ariregistri_kood>
        <prod:keel>eng</prod:keel>
      </prod:keha>
    </prod:lihtandmed_v2>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetchWithTimeout(EE_ARIREG_SOAP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml",
    },
    body: soapBody,
  });

  const xml = await response.text();

  if (!response.ok) {
    throw new Error(`Estonian e-Business Register returned HTTP ${response.status}`);
  }

  const foundCount = Number(xmlValue(xml, "leitud_ettevotjate_arv") || 0);

  if (!foundCount) {
    return makeNotFoundRow(input, country, number, "ee_arireg");
  }

  const registryCode = xmlValue(xml, "ariregistri_kood") || number;
  const name = xmlValue(xml, "evnimi");
  const legalForm = firstNonEmpty(xmlValue(xml, "oiguslik_vorm_tekstina"), xmlValue(xml, "oiguslik_vorm"));
  const status = firstNonEmpty(xmlValue(xml, "staatus_tekstina"), xmlValue(xml, "staatus"));
  const address = firstNonEmpty(
    xmlValue(xml, "aadress_ads__ads_normaliseeritud_taisaadress"),
    makeAddress([
      xmlValue(xml, "asukoht_ettevotja_aadressis"),
      xmlValue(xml, "asukoha_ehak_tekstina"),
      xmlValue(xml, "indeks_ettevotja_aadressis"),
    ])
  );

  return {
    input,
    country,
    registration_number: registryCode,
    valid: true,
    status: "valid",
    company_name: name,
    registry_status: status,
    legal_form: legalForm,
    address,
    registration_date: xmlValue(xml, "esmakande_aeg"),
    source: "ee_arireg",
    message: "Company found in Estonian e-Business Register.",
    checked_at: new Date().toISOString(),
  };
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
async function validatePl(input, country, number) {
  async function fetchKrsByRegister(registerType) {
    const url = `${KRS_BASE_URL}/OdpisAktualny/${encodeURIComponent(
      number
    )}?rejestr=${registerType}&format=json`;

    return await fetchJson(url, {
      headers: {
        Accept: "application/json",
      },
    });
  }

  let result = await fetchKrsByRegister("P");

  if (result.notFound) {
    result = await fetchKrsByRegister("S");
  }

  if (result.notFound) return makeNotFoundRow(input, country, number, "krs");

  const odpis = result.data?.odpis || {};
  const header = odpis?.naglowekA || {};
  const entity = odpis?.dane?.dzial1?.danePodmiotu || {};
  const seatAddress = odpis?.dane?.dzial1?.siedzibaIAdres || {};
  const address = seatAddress?.adres || {};
  const seat = seatAddress?.siedziba || {};

  return {
    input,
    country,
    registration_number: header.numerKRS || number,
    valid: true,
    status: "valid",
    company_name: entity.nazwa || "",
    registry_status: header.stanPozycji ? String(header.stanPozycji) : "",
    legal_form: entity.formaPrawna || "",
    address: makeAddress([
      address.ulica,
      address.nrDomu,
      address.nrLokalu,
      address.kodPocztowy,
      address.poczta,
      seat.miejscowosc,
      seat.kraj,
    ]),
    registration_date: header.dataRejestracjiWKRS || "",
    source: "krs",
    message: "Company found in Polish KRS.",
    checked_at: new Date().toISOString(),
  };
}

function pickDescription(items) {
  if (!Array.isArray(items)) return "";

  const english = items.find((item) => String(item.languageCode) === "3");
  return english?.description || items[0]?.description || "";
}

async function validateFi(input, country, number) {
  const url = new URL(`${PRH_YTJ_BASE_URL}/companies`);
  url.searchParams.set("businessId", number);

  const { notFound, data } = await fetchJson(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  if (notFound || !Array.isArray(data?.companies) || !data.companies.length) {
    return makeNotFoundRow(input, country, number, "prh_ytj");
  }

  const company = data.companies[0];
  const currentName =
    company.names?.find((name) => !name.endDate)?.name ||
    company.names?.[0]?.name ||
    "";

  const companyForm = company.companyForms?.find((form) => !form.endDate) || company.companyForms?.[0] || {};
  const address = company.addresses?.find((item) => item.type === 1) || company.addresses?.[0] || {};
  const postOffice = address.postOffices?.find((item) => String(item.languageCode) === "3") || address.postOffices?.[0];

  return {
    input,
    country,
    registration_number: company.businessId?.value || number,
    valid: true,
    status: "valid",
    company_name: currentName,
    registry_status: company.tradeRegisterStatus || company.status || "",
    legal_form: pickDescription(companyForm.descriptions) || companyForm.type || "",
    address: makeAddress([
      address.street,
      address.buildingNumber,
      address.postCode,
      postOffice?.city,
      address.country,
      address.freeAddressLine,
    ]),
    registration_date: company.registrationDate || company.businessId?.registrationDate || "",
    source: "prh_ytj",
    message: "Company found in Finnish PRH/YTJ.",
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
if (country === "PL") return await validatePl(input, country, number);
if (country === "FI") return await validateFi(input, country, number);
if (country === "SK") return await validateSk(input, country, number);
if (country === "IS") return await validateIs(input, country, number);
if (country === "EE") return await validateEe(input, country, number);

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
      : country === "CZ"
        ? "ares"
        : country === "PL"
          ? "krs"
          : country === "FI"
            ? "prh_ytj"
            : country === "SK"
              ? "rpo"
              : country === "IS"
                ? "skatturinn"
                : country === "EE"
                  ? "ee_arireg"
                  : "company_register",
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
