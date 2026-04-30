const DEFAULT_TIN_REST_BASE =
  process.env.TIN_REST_BASE || "https://ec.europa.eu/taxation_customs/tin";

const ENDPOINT_CANDIDATES = Array.from(
  new Set(
    [
      process.env.TIN_REST_ENDPOINT,
      `${DEFAULT_TIN_REST_BASE}/check-tin-number`,
      `${DEFAULT_TIN_REST_BASE}/api/check-tin-number`,
      `${DEFAULT_TIN_REST_BASE}/rest/check-tin-number`,
    ].filter(Boolean)
  )
);

function normalizeCountry(country) {
  const c = String(country || "").toUpperCase().trim();
  if (c === "GR") return "EL";
  return c;
}

function normalizeTinInput(countryCode, tinNumber) {
  let tin = String(tinNumber || "").trim();
  if (!tin) return tin;

  const cc = normalizeCountry(countryCode);
  const altCc = cc === "EL" ? "GR" : cc;

  const upperTin = tin.toUpperCase();

  if (upperTin.startsWith(`${cc} `)) tin = tin.slice(3).trim();
  else if (upperTin.startsWith(`${altCc} `)) tin = tin.slice(3).trim();
  else if (upperTin.startsWith(cc)) tin = tin.slice(2).trim();
  else if (upperTin.startsWith(altCc)) tin = tin.slice(2).trim();

  return tin;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toBooleanOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;

  const s = String(value).trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj[key];
    }
  }
  return undefined;
}

function mapResponse(data, fallbackCountry, fallbackTin) {
  const root = data?.data ?? data?.result ?? data;

  const country =
    pick(root, ["countryCode", "country_code", "country"]) ?? fallbackCountry;

  const tinNumber =
    pick(root, ["tinNumber", "tin_number", "tin"]) ?? fallbackTin;

  const requestDate =
    pick(root, ["requestDate", "request_date", "date"]) ?? null;

  const validStructure = toBooleanOrNull(
    pick(root, ["validStructure", "valid_structure"])
  );

  const validSyntax = toBooleanOrNull(
    pick(root, ["validSyntax", "valid_syntax"])
  );

  if (validStructure === null) {
    return null;
  }

  let status = "invalid";
  let message = "Invalid TIN structure";

  if (validStructure === false) {
    status = "invalid";
    message = "Invalid TIN structure";
  } else if (validStructure === true && validSyntax === null) {
    status = "valid";
    message = "Valid TIN structure";
  } else if (validStructure === true && validSyntax === true) {
    status = "valid";
    message = "Valid TIN structure and syntax";
  } else if (validStructure === true && validSyntax === false) {
    status = "invalid";
    message = "Valid TIN structure but invalid syntax";
  }

  return {
    status,
    country,
    tin_number: tinNumber,
    request_date: requestDate,
    structure_valid: validStructure,
    syntax_valid: validSyntax,
    message,
    raw: data,
  };
}

async function callTinRest(country, tin) {
  const payload = {
    countryCode: country,
    tinNumber: tin,
  };

  let lastError = null;

  for (const endpoint of ENDPOINT_CANDIDATES) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const data = tryParseJson(text);

      if (response.ok && data) {
        const mapped = mapResponse(data, country, tin);
        if (mapped) {
          mapped.endpoint_used = endpoint;
          return mapped;
        }
      }

      if (data && !response.ok) {
        const remoteError =
          data.error ||
          data.message ||
          data.code ||
          `HTTP ${response.status}`;
        lastError = { status: response.status, error: remoteError, endpoint };
        continue;
      }

      if (!response.ok) {
        lastError = {
          status: response.status,
          error: `HTTP ${response.status}`,
          endpoint,
          body: text.slice(0, 500),
        };
        continue;
      }

      lastError = {
        status: 502,
        error: "Unexpected REST response shape",
        endpoint,
        body: text.slice(0, 500),
      };
    } catch (err) {
      lastError = {
        status: 500,
        error: String(err?.message || err),
        endpoint,
      };
    }
  }

  const error = new Error(lastError?.error || "TIN REST validation failed");
  error.details = lastError;
  throw error;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const country = normalizeCountry(body?.country);
    const tin = normalizeTinInput(country, body?.tin);

    if (!country || !tin) {
      return res.status(400).json({ error: "country and tin are required" });
    }

    const result = await callTinRest(country, tin);

    return res.status(200).json(result);
  } catch (err) {
    const details = err?.details || null;

    return res.status(details?.status || 500).json({
      error: "tin-validate failed",
      message: String(err?.message || err),
      details,
    });
  }
}
