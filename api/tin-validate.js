const TIN_SOAP_ENDPOINT =
  process.env.TIN_SOAP_ENDPOINT ||
  "https://ec.europa.eu/taxation_customs/tin/services/checkTinService";

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

function normalizeInputTin(countryCode, tinNumber) {
  let tin = String(tinNumber || "").trim();

  tin = tin.replace(/\s+/g, " ");

  const cc = String(countryCode || "").toUpperCase().trim();
  const altCc = cc === "EL" ? "GR" : cc;

  if (tin.toUpperCase().startsWith(`${cc} `)) tin = tin.slice(3).trim();
  if (tin.toUpperCase().startsWith(`${altCc} `)) tin = tin.slice(3).trim();
  if (tin.toUpperCase().startsWith(cc)) tin = tin.slice(2).trim();
  if (tin.toUpperCase().startsWith(altCc)) tin = tin.slice(2).trim();

  return tin;
}

function parseSoapFault(xml) {
  const faultString = extractTag(xml, "faultstring");
  if (!faultString) return null;
  return faultString;
}

function toBooleanOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).toLowerCase().trim();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    let country = String(body?.country || "").toUpperCase().trim();
    if (country === "GR") country = "EL";

    const rawTin = String(body?.tin || "");
    const tin = normalizeInputTin(country, rawTin);

    if (!country || !tin) {
      return res.status(400).json({ error: "country and tin are required" });
    }

    const envelope = buildSoapEnvelope(country, tin);

    const response = await fetch(TIN_SOAP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=UTF-8",
        Accept: "text/xml",
        SOAPAction: '""',
      },
      body: envelope,
    });

    const xml = await response.text();

    const fault = parseSoapFault(xml);
    if (fault) {
      const faultUpper = String(fault).toUpperCase().trim();

      if (faultUpper === "INVALID_INPUT") {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }

      if (faultUpper === "NO_INFORMATION") {
        return res.status(502).json({ error: "NO_INFORMATION" });
      }

      if (faultUpper === "SERVICE_UNAVAILABLE" || faultUpper === "SERVER_BUSY") {
        return res.status(503).json({ error: faultUpper });
      }

      return res.status(502).json({ error: fault });
    }

    const responseCountry = extractTag(xml, "countryCode") || country;
    const responseTin = extractTag(xml, "tinNumber") || tin;
    const requestDate = extractTag(xml, "requestDate");
    const validStructure = toBooleanOrNull(extractTag(xml, "validStructure"));
    const validSyntax = toBooleanOrNull(extractTag(xml, "validSyntax"));

    if (validStructure === null) {
      return res.status(502).json({
        error: "Unexpected SOAP response",
        raw: xml.slice(0, 1000),
      });
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

    return res.status(200).json({
      status,
      country: responseCountry,
      tin_number: responseTin,
      request_date: requestDate,
      structure_valid: validStructure,
      syntax_valid: validSyntax,
      message,
    });
  } catch (error) {
    return res.status(500).json({
      error: "tin-validate failed",
      message: String(error?.message || error),
    });
  }
}
