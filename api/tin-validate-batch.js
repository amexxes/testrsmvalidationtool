const DEFAULT_TIN_WSDL_URL =
  process.env.TIN_WSDL_URL ||
  "https://ec.europa.eu/taxation_customs/tin/checkTinService.wsdl";

let cachedSoapEndpoint = null;

function normalizeCountry(country) {
  const c = String(country || "").toUpperCase().trim();
  return c === "GR" ? "EL" : c;
}

function normalizeTinInput(countryCode, tinNumber) {
  let tin = String(tinNumber || "").trim();
  if (!tin) return tin;

  const cc = normalizeCountry(countryCode);
  const altCc = cc === "EL" ? "GR" : cc;
  const upper = tin.toUpperCase();

  if (upper.startsWith(`${cc} `)) tin = tin.slice(3).trim();
  else if (upper.startsWith(`${altCc} `)) tin = tin.slice(3).trim();
  else if (upper.startsWith(cc)) tin = tin.slice(2).trim();
  else if (upper.startsWith(altCc)) tin = tin.slice(2).trim();

  return tin;
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
    .replace(/&amp;/g, "&");
}

function extractTag(xml, tagName) {
  const re = new RegExp(
    `<(?:\\w+:)?${tagName}>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(re);
  return match ? decodeXml(match[1].trim()) : null;
}

function toBooleanOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

function buildSoapEnvelope(countryCode, tinNumber) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:tin:services:checkTin:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkTin>
      <urn:countryCode>${escapeXml(countryCode)}</urn:countryCode>
      <urn:tinNumber>${escapeXml(tinNumber)}</urn:tinNumber>
    </urn:checkTin>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSoapEndpoint() {
  if (process.env.TIN_SOAP_ENDPOINT) {
    return process.env.TIN_SOAP_ENDPOINT;
  }

  if (cachedSoapEndpoint) {
    return cachedSoapEndpoint;
  }

  const wsdlResp = await fetchWithTimeout(DEFAULT_TIN_WSDL_URL, {
    method: "GET",
    headers: {
      Accept: "text/xml, application/xml, */*",
    },
  });

  const wsdlText = await wsdlResp.text();

  if (!wsdlResp.ok) {
    throw new Error(`Unable to load TIN WSDL (${wsdlResp.status})`);
  }

  if (/temporarily unavailable/i.test(wsdlText)) {
    throw new Error("TIN WSDL temporarily unavailable");
  }

  const endpointMatch = wsdlText.match(
    /<(?:(?:\w+):)?address\b[^>]*location="([^"]+)"/i
  );

  if (!endpointMatch?.[1]) {
    throw new Error("SOAP endpoint not found in WSDL");
  }

  cachedSoapEndpoint = endpointMatch[1];
  return cachedSoapEndpoint;
}

function parseSoapFault(xml) {
  const faultString = extractTag(xml, "faultstring");
  return faultString ? faultString.trim() : null;
}

async function callTinSoap(country, tin) {
  const endpoint = await resolveSoapEndpoint();
  const envelope = buildSoapEnvelope(country, tin);

  const resp = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=UTF-8",
      Accept: "text/xml, application/xml, */*",
      SOAPAction: '""',
    },
    body: envelope,
  });

  const xml = await resp.text();

  if (/temporarily unavailable/i.test(xml)) {
    const err = new Error("SERVICE_UNAVAILABLE");
    err.httpStatus = 503;
    throw err;
  }

  const fault = parseSoapFault(xml);
  if (fault) {
    const err = new Error(fault);
    err.httpStatus =
      fault === "INVALID_INPUT"
        ? 400
        : fault === "SERVICE_UNAVAILABLE" || fault === "SERVER_BUSY"
        ? 503
        : 502;
    throw err;
  }

  const responseCountry = extractTag(xml, "countryCode") || country;
  const responseTin = extractTag(xml, "tinNumber") || tin;
  const requestDate = extractTag(xml, "requestDate");
  const validStructure = toBooleanOrNull(extractTag(xml, "validStructure"));
  const validSyntax = toBooleanOrNull(extractTag(xml, "validSyntax"));

  if (validStructure === null) {
    const err = new Error("Unexpected SOAP response");
    err.httpStatus = 502;
    throw err;
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
    country: responseCountry,
    tin_number: responseTin,
    request_date: requestDate,
    structure_valid: validStructure,
    syntax_valid: validSyntax,
    message,
  };
}

async function mapLimit(items, limit, asyncFn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await asyncFn(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const country = normalizeCountry(body?.country);
    const tinsRaw = Array.isArray(body?.tins) ? body.tins : [];
    const tins = tinsRaw
      .map((x) => normalizeTinInput(country, x))
      .filter(Boolean);

    if (!country || !tins.length) {
      return res.status(400).json({
        error: "country and tins are required",
      });
    }

    const results = await mapLimit(tins, 2, async (tin, index) => {
      try {
        const result = await callTinSoap(country, tin);
        return {
          index,
          input_tin: tin,
          ...result,
        };
      } catch (err) {
        return {
          index,
          input_tin: tin,
          status: "error",
          country,
          tin_number: tin,
          request_date: null,
          structure_valid: null,
          syntax_valid: null,
          message: String(err?.message || err),
        };
      }
    });

    const stats = {
      total: results.length,
      valid: results.filter((r) => r.status === "valid").length,
      invalid: results.filter((r) => r.status === "invalid").length,
      error: results.filter((r) => r.status === "error").length,
    };

    return res.status(200).json({
      country,
      stats,
      results,
    });
  } catch (err) {
    return res.status(err.httpStatus || 500).json({
      error: "tin-validate-batch failed",
      message: String(err?.message || err),
    });
  }
}
