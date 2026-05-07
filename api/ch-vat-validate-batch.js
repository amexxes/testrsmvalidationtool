// /api/ch-vat-validate-batch.js
import {
  requireModuleAccess,
  consumeVatCreditsForUser,
} from "../lib/auth.js";

const CH_UID_ENDPOINT =
  process.env.CH_UID_ENDPOINT || "https://www.uid-wse.admin.ch/V5.0/PublicServices.svc";

const MAX_BATCH_SIZE = Number(process.env.CH_VAT_MAX_BATCH_SIZE || 10);
const TIMEOUT_MS = Number(process.env.CH_UID_TIMEOUT_MS || 15000);
const RETRY_AFTER_MS = Number(process.env.CH_UID_RETRY_AFTER_MS || 60000);
const MAX_RATE_LIMIT_RETRIES = Number(process.env.CH_UID_MAX_RATE_LIMIT_RETRIES || 1);

const NS_UID_WSE = "http://www.uid.admin.ch/xmlns/uid-wse";
const NS_UID_WSE_5 = "http://www.uid.admin.ch/xmlns/uid-wse/5";
const NS_UID_SHARED = "http://www.uid.admin.ch/xmlns/uid-wse-shared/2";
const NS_ECH_0097 = "http://www.ech.ch/xmlns/eCH-0097/5";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function stripTags(value) {
  return decodeXml(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function tagTexts(xml, localName) {
  const re = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?${localName}>`,
    "gi"
  );

  return Array.from(String(xml || "").matchAll(re))
    .map((m) => stripTags(m[1]))
    .filter(Boolean);
}

function firstText(xml, localName) {
  return tagTexts(xml, localName)[0] || "";
}

function blocks(xml, localName) {
  const re = new RegExp(
    `<(?:[A-Za-z0-9_.-]+:)?${localName}\\b[^>]*>[\\s\\S]*?<\\/(?:[A-Za-z0-9_.-]+:)?${localName}>`,
    "gi"
  );

  return Array.from(String(xml || "").matchAll(re)).map((m) => m[0]);
}

function canonicalUidFromDigits(digits) {
  return `CHE-${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
}

function canonicalHrFromDigits(digits) {
  return `CH-${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10, 11)}`;
}

function isValidUidCheckDigit(digits) {
  if (!/^\d{9}$/.test(digits)) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((acc, weight, index) => acc + weight * Number(digits[index]), 0);
  const expected = String((11 - (sum % 11)) % 11);

  return digits[8] === expected;
}

function normalizeSwissInput(value) {
  const input = String(value || "").trim().toUpperCase();

  const compact = input
    .replace(/\s+/g, "")
    .replace(/[._/]/g, "")
    .replace(/(MWST|TVA|IVA)$/i, "");

  const alnum = compact.replace(/-/g, "");

  if (/^CHE\d{9}$/.test(alnum)) {
    const digits = alnum.slice(3);

    if (!isValidUidCheckDigit(digits)) {
      return {
        ok: false,
        input,
        reason: "Invalid Swiss UID checksum",
      };
    }

    return {
      ok: true,
      input,
      type: "uid",
      uidDigits: digits,
      uid: canonicalUidFromDigits(digits),
    };
  }

  if (/^CH\d{9}$/.test(alnum)) {
    const digits = alnum.slice(2);

    if (!isValidUidCheckDigit(digits)) {
      return {
        ok: false,
        input,
        reason: "Invalid Swiss UID checksum",
      };
    }

    return {
      ok: true,
      input,
      type: "uid",
      uidDigits: digits,
      uid: canonicalUidFromDigits(digits),
    };
  }

  if (/^CH\d{11}$/.test(alnum)) {
    const digits = alnum.slice(2);

    return {
      ok: true,
      input,
      type: "hr",
      hrDigits: digits,
      hrReference: canonicalHrFromDigits(digits),
    };
  }

  return {
    ok: false,
    input,
    reason: "Expected Swiss format: CHE-123.456.789 or CH-550-1105384-6",
  };
}

function soapEnvelope(body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    ${body}
  </s:Body>
</s:Envelope>`;
}

function buildValidateVatEnvelope(uid) {
  return soapEnvelope(`
<uid:ValidateVatNumber xmlns:uid="${NS_UID_WSE}">
  <uid:vatNumber>${escapeXml(uid)}</uid:vatNumber>
</uid:ValidateVatNumber>`);
}

function buildGetByUidEnvelope(uidDigits) {
  return soapEnvelope(`
<uid:GetByUID xmlns:uid="${NS_UID_WSE}" xmlns:ech97="${NS_ECH_0097}">
  <uid:uid>
    <ech97:uidOrganisationIdCategorie>CHE</ech97:uidOrganisationIdCategorie>
    <ech97:uidOrganisationId>${escapeXml(uidDigits)}</ech97:uidOrganisationId>
  </uid:uid>
</uid:GetByUID>`);
}

function buildSearchByHrEnvelope(hrReference) {
  return soapEnvelope(`
<uid:Search
  xmlns:uid="${NS_UID_WSE}"
  xmlns:wse5="${NS_UID_WSE_5}"
  xmlns:shared="${NS_UID_SHARED}"
  xmlns:ech97="${NS_ECH_0097}"
>
  <uid:searchParameters>
    <wse5:otherOrganisationId>
      <ech97:organisationIdCategory>CH.HR</ech97:organisationIdCategory>
      <ech97:organisationId>${escapeXml(hrReference)}</ech97:organisationId>
    </wse5:otherOrganisationId>
  </uid:searchParameters>
  <uid:config>
    <shared:searchMode>Auto</shared:searchMode>
    <shared:maxNumberOfRecords>1</shared:maxNumberOfRecords>
    <shared:searchNameAndAddressHistory>false</shared:searchNameAndAddressHistory>
  </uid:config>
</uid:Search>`);
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

function parseSoapFault(xml) {
  const message =
    firstText(xml, "faultstring") ||
    firstText(xml, "Text") ||
    firstText(xml, "ErrorDetail") ||
    firstText(xml, "Error");

  const codeMatch = String(xml || "").match(
    /Request_limit_exceeded|Data_validation_failed|Permission_denied|Unauthorized|Application_error/i
  );

  return {
    message,
    code: codeMatch?.[0] || "",
  };
}

function isRateLimitError(error) {
  const text = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  return (
    error?.status === 429 ||
    text.includes("request_limit_exceeded") ||
    text.includes("request limit") ||
    text.includes("rate limit") ||
    text.includes("too many")
  );
}

async function callSoap(operation, envelope) {
  let attempt = 0;

  while (true) {
    const response = await fetchWithTimeout(CH_UID_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml, application/xml, */*",
        SOAPAction: `"${NS_UID_WSE}/IPublicServices/${operation}"`,
      },
      body: envelope,
    });

    const xml = await response.text();
    const fault = parseSoapFault(xml);

    if (fault.message || fault.code || !response.ok) {
      const error = new Error(fault.message || `Swiss UID API failed: ${response.status}`);
      error.code = fault.code || (response.status === 429 ? "Request_limit_exceeded" : "CH_UID_HTTP_ERROR");
      error.status = response.status;

      if (isRateLimitError(error) && attempt < MAX_RATE_LIMIT_RETRIES) {
        attempt += 1;
        await sleep(RETRY_AFTER_MS);
        continue;
      }

      throw error;
    }

    return {
      xml,
      attempts: attempt + 1,
    };
  }
}

function parseValidateVatResult(xml) {
  const value = firstText(xml, "ValidateVatNumberResult").toLowerCase();

  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error("Unexpected Swiss UID ValidateVatNumber response");
}

function extractUidDigits(xml) {
  const category = firstText(xml, "uidOrganisationIdCategorie");
  const digits = firstText(xml, "uidOrganisationId");

  if (String(category).toUpperCase() !== "CHE") return "";
  if (!/^\d{9}$/.test(digits)) return "";

  return digits;
}

function extractOrganisationInfo(xml) {
  const name =
    firstText(xml, "organisationLegalName") ||
    firstText(xml, "organisationName") ||
    firstText(xml, "organisationAdditionalName");

  const addressBlocks = blocks(xml, "address");
  const legalAddress =
    addressBlocks.find((block) => firstText(block, "addressCategory").toUpperCase() === "LEGAL") ||
    addressBlocks.find((block) => firstText(block, "town") || firstText(block, "swissZipCode")) ||
    "";

  const street = firstText(legalAddress, "street");
  const houseNumber = firstText(legalAddress, "houseNumber");
  const zip = firstText(legalAddress, "swissZipCode") || firstText(legalAddress, "foreignZipCode");
  const town = firstText(legalAddress, "town");
  const country = firstText(legalAddress, "countryIdISO2");

  const line1 = firstText(legalAddress, "addressLine1");
  const line2 = firstText(legalAddress, "addressLine2");

  const streetLine = [street, houseNumber].filter(Boolean).join(" ");
  const townLine = [zip, town].filter(Boolean).join(" ");

  const address = [line1, line2, streetLine, townLine, country]
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .join(", ");

  return {
    name,
    address,
    vat_status: firstText(xml, "vatStatus"),
    vat_entry_status: firstText(xml, "vatEntryStatus"),
    vat_entry_date: firstText(xml, "vatEntryDate"),
    vat_liquidation_date: firstText(xml, "vatLiquidationDate"),
  };
}

async function validateVat(uid) {
  const { xml, attempts } = await callSoap("ValidateVatNumber", buildValidateVatEnvelope(uid));

  return {
    valid: parseValidateVatResult(xml),
    attempts,
  };
}

async function getByUid(uidDigits) {
  const { xml, attempts } = await callSoap("GetByUID", buildGetByUidEnvelope(uidDigits));

  return {
    xml,
    attempts,
    info: extractOrganisationInfo(xml),
  };
}

async function searchByHr(hrReference) {
  const { xml, attempts } = await callSoap("Search", buildSearchByHrEnvelope(hrReference));
  const uidDigits = extractUidDigits(xml);

  return {
    xml,
    attempts,
    uidDigits,
    info: extractOrganisationInfo(xml),
  };
}

function retryRow(item, error, attempt) {
  const retryable = isRateLimitError(error);

  return {
    input: item.input,
    vat_number: item.uid || item.hrReference || item.input,
    country_code: "CH",
    state: retryable ? "retry" : "error",
    name: "",
    address: "",
    error: error instanceof Error ? error.message : String(error),
    error_code: error?.code || "CH_UID_ERROR",
    attempt,
    next_retry_at: retryable ? Date.now() + RETRY_AFTER_MS : undefined,
    retry_after_ms: retryable ? RETRY_AFTER_MS : undefined,
    checked_at: new Date().toISOString(),
    source: "ch_uid",
  };
}

async function checkSwissItem(item) {
  let uidDigits = item.uidDigits || "";
  let resolvedFrom = "";
  let searchInfo = null;
  let totalAttempts = 0;

  if (item.type === "hr") {
    const searchResult = await searchByHr(item.hrReference);
    totalAttempts += searchResult.attempts;

    uidDigits = searchResult.uidDigits;
    searchInfo = searchResult.info;
    resolvedFrom = item.hrReference;

    if (!uidDigits) {
      return {
        input: item.input,
        vat_number: item.hrReference,
        country_code: "CH",
        valid: false,
        state: "invalid",
        name: "",
        address: "",
        message: `No UID found for HR reference ${item.hrReference}`,
        error: "",
        error_code: "",
        attempt: totalAttempts,
        checked_at: new Date().toISOString(),
        source: "ch_uid",
      };
    }
  }

  const uid = canonicalUidFromDigits(uidDigits);

  const vatResult = await validateVat(uid);
  totalAttempts += vatResult.attempts;

  let info = searchInfo;

  if (!info || (!info.name && !info.address)) {
    const detail = await getByUid(uidDigits);
    totalAttempts += detail.attempts;
    info = detail.info;
  }

  const message = resolvedFrom
    ? `Resolved ${resolvedFrom} to ${uid}. ${
        vatResult.valid ? "VAT/MWST active." : "UID found, but VAT/MWST is not active."
      }`
    : vatResult.valid
      ? "VAT/MWST active."
      : "UID found, but VAT/MWST is not active.";

  return {
    input: item.input,
    vat_number: `${uid} MWST`,
    country_code: "CH",
    valid: vatResult.valid,
    state: vatResult.valid ? "valid" : "invalid",
    name: info?.name || "",
    address: info?.address || "",
    message,
    error: "",
    error_code: "",
    attempt: totalAttempts,
    checked_at: new Date().toISOString(),
    source: "ch_uid",
    resolved_from: resolvedFrom || undefined,
    resolved_uid: resolvedFrom ? uid : undefined,
    vat_status: info?.vat_status || "",
    vat_entry_status: info?.vat_entry_status || "",
    vat_entry_date: info?.vat_entry_date || "",
    vat_liquidation_date: info?.vat_liquidation_date || "",
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

  const auth = await requireModuleAccess(req, res, "vat");
  if (!auth) return;

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizeSwissInput(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "CH",
          valid: false,
          state: "error",
          name: "",
          address: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "ch_uid",
        });

        continue;
      }

      const duplicateKey =
        normalized.type === "uid"
          ? `uid:${normalized.uidDigits}`
          : `hr:${normalized.hrDigits}`;

      if (seen.has(duplicateKey)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(duplicateKey);
      prepared.push(normalized);
    }

    if (!prepared.length && !results.length) {
      return res.status(400).json({
        error: "No Swiss VAT numbers supplied",
        results: [],
      });
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Swiss VAT batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Swiss identifiers per request. The UID PublicServices are rate-limited.`,
        results,
      });
    }

    let vat_credits = null;

    if (prepared.length) {
      try {
        vat_credits = await consumeVatCreditsForUser(auth.user, prepared.length);
      } catch (error) {
        if (error?.code === "VAT_CREDITS_EXCEEDED") {
          return res.status(403).json({
            error: "VAT_CREDITS_EXCEEDED",
            message: "VAT credit limit reached.",
            credits: error.details,
          });
        }

        throw error;
      }

      for (const item of prepared) {
        try {
          results.push(await checkSwissItem(item));
        } catch (error) {
          results.push(retryRow(item, error, 1));
        }
      }
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
      vat_credits,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Swiss VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
