// /api/uk-vat-validate-batch.js

const HMRC_ACCEPT_HEADER = "application/vnd.hmrc.2.0+json";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getHmrcBaseUrl() {
  return process.env.HMRC_ENV === "production"
    ? "https://api.service.hmrc.gov.uk"
    : "https://test-api.service.hmrc.gov.uk";
}

function normalizeUkVat(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^GB/, "")
    .replace(/[^0-9]/g, "");
}

function isValidUkVatFormat(vrn) {
  return /^\d{9}$/.test(vrn) || /^\d{12}$/.test(vrn);
}

function mapAddress(address) {
  if (!address || typeof address !== "object") return "";

  return [
    address.line1,
    address.line2,
    address.line3,
    address.line4,
    address.line5,
    address.postcode,
    address.countryCode,
  ]
    .filter(Boolean)
    .join(", ");
}

async function getHmrcAccessToken() {
  const now = Date.now();

  if (cachedToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedToken;
  }

  const clientId = process.env.HMRC_CLIENT_ID;
  const clientSecret = process.env.HMRC_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing HMRC_CLIENT_ID or HMRC_CLIENT_SECRET");
  }

  const baseUrl = getHmrcBaseUrl();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "read:vat",
  });

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `HMRC token request failed: ${response.status}`);
  }

  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + Number(data.expires_in || 14400) * 1000;

  return cachedToken;
}

async function checkUkVat(vrn, token) {
  const baseUrl = getHmrcBaseUrl();

  const response = await fetch(
    `${baseUrl}/organisations/vat/check-vat-number/lookup/${encodeURIComponent(vrn)}`,
    {
      method: "GET",
      headers: {
        Accept: HMRC_ACCEPT_HEADER,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (response.status === 404) {
    return {
      input: `GB${vrn}`,
      vat_number: `GB${vrn}`,
      country_code: "GB",
      valid: false,
      state: "invalid",
      name: "",
      address: "",
      error: data?.message || "VAT number not found by HMRC",
      error_code: data?.code || "NOT_FOUND",
      checked_at: new Date().toISOString(),
    };
  }

  if (!response.ok) {
    return {
      input: `GB${vrn}`,
      vat_number: `GB${vrn}`,
      country_code: "GB",
      valid: false,
      state: "error",
      name: "",
      address: "",
      error: data?.message || `HMRC VAT check failed: ${response.status}`,
      error_code: data?.code || "HMRC_ERROR",
      checked_at: new Date().toISOString(),
    };
  }

  const target = data?.target || {};

  return {
    input: `GB${vrn}`,
    vat_number: `GB${target.vatNumber || vrn}`,
    country_code: "GB",
    valid: true,
    state: "valid",
    name: target.name || "",
    address: mapAddress(target.address),
    error: "",
    error_code: "",
    checked_at: data?.processingDate || new Date().toISOString(),
    processing_date: data?.processingDate || "",
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
    const validVrns = [];
    const results = [];
    let duplicatesIgnored = 0;

    for (const raw of input) {
      const vrn = normalizeUkVat(raw);

      if (!vrn) continue;

      if (seen.has(vrn)) {
        duplicatesIgnored += 1;
        continue;
      }

      seen.add(vrn);

      if (!isValidUkVatFormat(vrn)) {
        results.push({
          input: String(raw || ""),
          vat_number: String(raw || ""),
          country_code: "GB",
          valid: false,
          state: "error",
          name: "",
          address: "",
          error: "Invalid UK VAT format. Expected GB + 9 or 12 digits.",
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
        });

        continue;
      }

      validVrns.push(vrn);
    }

    if (!validVrns.length && !results.length) {
      return res.status(400).json({
        error: "No UK VAT numbers supplied",
        results: [],
      });
    }

    const token = await getHmrcAccessToken();

    for (const vrn of validVrns) {
      const row = await checkUkVat(vrn, token);
      results.push(row);
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored: duplicatesIgnored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "UK VAT validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
