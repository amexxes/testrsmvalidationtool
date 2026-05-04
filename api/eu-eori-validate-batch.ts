// /api/eu-eori-validate-batch.ts

type ApiRequest = {
  method?: string;
  body?: any;
};

type ApiResponse = {
  status: (code: number) => {
    json: (body: any) => void;
  };
};

type EoriValidationService = "eu";

type EoriRow = {
  input_eori: string;
  eori: string;
  valid: boolean;
  status: "valid" | "invalid" | "error";
  trader_name: string;
  address: string;
  processing_date: string;
  message: string;
  service: EoriValidationService;
};

const EU_EORI_ENDPOINT =
  "https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation";

const MAX_PER_REQUEST = 10;
const TIMEOUT_MS = 20000;

const EU_EORI_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
]);

function normalizeEoriCandidate(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "")
    .toUpperCase();
}

function validateEuEoriFormat(value: string): { ok: boolean; reason: string } {
  const eori = normalizeEoriCandidate(value);
  const countryCode = eori.slice(0, 2);
  const euCountryCode = countryCode === "GR" ? "EL" : countryCode;

  if (!eori) return { ok: false, reason: "Missing EORI" };
  if (!/^[A-Z]{2}/.test(eori)) return { ok: false, reason: "Missing country prefix" };

  if (countryCode === "GB") {
    return { ok: false, reason: "GB EORI numbers must be checked via HMRC" };
  }

  if (!EU_EORI_COUNTRY_CODES.has(euCountryCode)) {
    return { ok: false, reason: "Only EU EORI numbers are supported by this endpoint" };
  }

  if (!/^[A-Z]{2}[A-Z0-9]{1,15}$/.test(eori)) {
    return {
      ok: false,
      reason: "Expected EU format: country code followed by max 15 letters or digits",
    };
  }

  return { ok: true, reason: "" };
}

function escapeXml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return String(value || "")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

function getXmlTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function getXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${tag}>`, "gi");
  return xml.match(regex) || [];
}

function buildSoapEnvelope(eoris: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ev:validateEORI xmlns:ev="http://eori.ws.eos.dds.s/">
      ${eoris.map((eori) => `<ev:eori>${escapeXml(eori)}</ev:eori>`).join("\n")}
    </ev:validateEORI>
  </soap:Body>
</soap:Envelope>`;
}

function parseValidity(status: string, statusDescr: string): boolean | null {
  const s = String(status || "").trim().toLowerCase();
  const d = String(statusDescr || "").trim().toLowerCase();
  const combined = `${s} ${d}`;

  if (combined.includes("not valid") || combined.includes("invalid") || combined.includes("not found")) {
    return false;
  }

  if (combined.includes("valid")) {
    return true;
  }

  if (s === "1" || s === "true") return true;
  if (s === "0" || s === "false") return false;

  return null;
}

function parseResultBlock(inputEori: string, block: string, requestDate: string): EoriRow {
  const returnedEori = normalizeEoriCandidate(getXmlTag(block, "eori") || inputEori);
  const status = getXmlTag(block, "status");
  const statusDescr = getXmlTag(block, "statusDescr");

  const name = getXmlTag(block, "name");
  const street = getXmlTag(block, "street");
  const postalCode = getXmlTag(block, "postalCode");
  const city = getXmlTag(block, "city");
  const country = getXmlTag(block, "country");

  const valid = parseValidity(status, statusDescr);

  const address = [street, [postalCode, city].filter(Boolean).join(" "), country]
    .filter(Boolean)
    .join(", ");

  return {
    input_eori: inputEori,
    eori: returnedEori,
    valid: valid === true,
    status: valid === true ? "valid" : valid === false ? "invalid" : "error",
    trader_name: name,
    address,
    processing_date: requestDate,
    message: statusDescr || status || "",
    service: "eu",
  };
}

async function callEuEoriService(eoris: string[]): Promise<EoriRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(EU_EORI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": 'text/xml;charset="utf-8"',
        Accept: "text/xml",
      },
      body: buildSoapEnvelope(eoris),
      signal: controller.signal,
    });

    const xml = await resp.text();

    if (!resp.ok) {
      throw new Error(`EU EORI service returned HTTP ${resp.status}`);
    }

    const fault = getXmlTag(xml, "faultstring");
    if (fault) {
      throw new Error(fault);
    }

    const requestDate = getXmlTag(xml, "requestDate");
    const resultBlocks = getXmlBlocks(xml, "result");

    if (!resultBlocks.length) {
      return eoris.map((eori) => ({
        input_eori: eori,
        eori,
        valid: false,
        status: "error",
        trader_name: "",
        address: "",
        processing_date: requestDate,
        message: "No result returned by EU EORI service",
        service: "eu",
      }));
    }

    const parsedRows = resultBlocks.map((block, index) => parseResultBlock(eoris[index] || "", block, requestDate));

    const byEori = new Map(
      parsedRows.map((row) => [normalizeEoriCandidate(row.eori || row.input_eori), row])
    );

    return eoris.map((eori, index) => {
      return (
        byEori.get(normalizeEoriCandidate(eori)) ||
        parsedRows[index] || {
          input_eori: eori,
          eori,
          valid: false,
          status: "error",
          trader_name: "",
          address: "",
          processing_date: requestDate,
          message: "No matching result returned by EU EORI service",
          service: "eu",
        }
      );
    });
  } finally {
    clearTimeout(timeout);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const input = Array.isArray(body.eoris) ? body.eoris : [];

    const normalized = Array.from(
      new Set(input.map((value: string) => normalizeEoriCandidate(value)).filter(Boolean))
    );

    const invalidRows: EoriRow[] = [];
    const validEoris: string[] = [];

    for (const eori of normalized) {
      const format = validateEuEoriFormat(eori);

      if (!format.ok) {
        invalidRows.push({
          input_eori: eori,
          eori,
          valid: false,
          status: "invalid",
          trader_name: "",
          address: "",
          processing_date: "",
          message: format.reason,
          service: "eu",
        });
      } else {
        validEoris.push(eori);
      }
    }

    const serviceRows: EoriRow[] = [];

    for (const batch of chunk(validEoris, MAX_PER_REQUEST)) {
      const rows = await callEuEoriService(batch);
      serviceRows.push(...rows);
    }

    return res.status(200).json({
      results: [...invalidRows, ...serviceRows],
    });
  } catch (error: unknown) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "EU EORI validation failed",
    });
  }
}
