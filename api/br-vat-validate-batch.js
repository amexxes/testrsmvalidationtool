// /api/br-vat-validate-batch.js
//
// Brazil uses CNPJ, not VAT.
// This checks CNPJ registration status via configured Gov.br/ConectaGov CNPJ API access.

const BR_CNPJ_BEARER_TOKEN = process.env.BR_CNPJ_BEARER_TOKEN || "";
const BR_CNPJ_BASE_URL =
  process.env.BR_CNPJ_BASE_URL ||
  "https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnpj-basica/v2/basica";

const TIMEOUT_MS = Number(process.env.BR_VAT_TIMEOUT_MS || 15000);
const MAX_BATCH_SIZE = Number(process.env.BR_VAT_MAX_BATCH_SIZE || 50);

function normalizeBrazilVat(value) {
  const input = String(value || "").trim().toUpperCase();

  let compact = input.replace(/\s+/g, "").replace(/[.\-_/]/g, "");
  if (compact.startsWith("BR")) compact = compact.slice(2);
  if (compact.startsWith("CNPJ")) compact = compact.slice(4);

  if (!/^\d{14}$/.test(compact)) {
    return {
      ok: false,
      input,
      reason: "Expected Brazilian CNPJ format: BR11222333000181 or 11.222.333/0001-81",
    };
  }

  return {
    ok: true,
    input,
    digits: compact,
    vat_number: `BR${compact}`,
  };
}

function isValidCnpjChecksum(cnpj) {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  function calcDigit(base) {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const sum = base
      .split("")
      .reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);

    const remainder = sum % 11;
    return remainder < 2 ? "0" : String(11 - remainder);
  }

  const d1 = calcDigit(cnpj.slice(0, 12));
  const d2 = calcDigit(cnpj.slice(0, 12) + d1);

  return cnpj.endsWith(d1 + d2);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function formatAddress(data) {
  const fields = [
    data?.logradouro,
    data?.numero,
    data?.complemento,
    data?.bairro,
    data?.municipio?.descricao || data?.municipio,
    data?.uf,
    data?.cep,
  ];

  return fields.filter(Boolean).join(", ");
}

function situacaoIsActive(data) {
  const situacao = data?.situacaoCadastral;

  const code = String(situacao?.codigo || situacao?.codSituacaoCadastral || "").trim();
  const desc = String(situacao?.descricao || situacao || "").toUpperCase();

  return code === "2" || desc.includes("ATIVA");
}

async function checkBrazilVat(item) {
  const url = `${BR_CNPJ_BASE_URL}/${encodeURIComponent(item.digits)}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${BR_CNPJ_BEARER_TOKEN}`,
    },
  });

  if (response.status === 404) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "BR",
      valid: false,
      state: "invalid",
      name: "",
      address: "",
      message: "CNPJ not found.",
      error: "",
      error_code: "",
      checked_at: new Date().toISOString(),
      source: "gov_br_cnpj",
    };
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      input: item.input,
      vat_number: item.vat_number,
      country_code: "BR",
      valid: false,
      state: "error",
      name: "",
      address: "",
      message: "",
      error: data?.message || data?.error || `Gov.br CNPJ API failed: ${response.status}`,
      error_code: "BR_CNPJ_API_ERROR",
      checked_at: new Date().toISOString(),
      source: "gov_br_cnpj",
    };
  }

  const active = situacaoIsActive(data);

  return {
    input: item.input,
    vat_number: `BR${data?.ni || item.digits}`,
    country_code: "BR",
    valid: active,
    state: active ? "valid" : "invalid",
    name: data?.nomeEmpresarial || data?.razaoSocial || "",
    address: formatAddress(data),
    message: active ? "CNPJ active." : "CNPJ found, but registration status is not active.",
    error: "",
    error_code: "",
    checked_at: new Date().toISOString(),
    source: "gov_br_cnpj",
    cnpj: data?.ni || item.digits,
    registration_status:
      data?.situacaoCadastral?.descricao || data?.situacaoCadastral || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", message: "Use POST" });
  }

  if (!BR_CNPJ_BEARER_TOKEN) {
    return res.status(500).json({
      error: "Missing BR_CNPJ_BEARER_TOKEN",
      message: "Set BR_CNPJ_BEARER_TOKEN in environment variables.",
      results: [],
    });
  }

  try {
    const input = Array.isArray(req.body?.vat_numbers) ? req.body.vat_numbers : [];

    const seen = new Set();
    const prepared = [];
    const results = [];
    let duplicates_ignored = 0;

    for (const raw of input) {
      const normalized = normalizeBrazilVat(raw);

      if (!normalized.ok) {
        results.push({
          input: normalized.input,
          vat_number: normalized.input,
          country_code: "BR",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: normalized.reason,
          error_code: "INVALID_FORMAT",
          checked_at: new Date().toISOString(),
          source: "gov_br_cnpj",
        });
        continue;
      }

      if (!isValidCnpjChecksum(normalized.digits)) {
        results.push({
          input: normalized.input,
          vat_number: normalized.vat_number,
          country_code: "BR",
          valid: false,
          state: "error",
          name: "",
          address: "",
          message: "",
          error: "Invalid Brazilian CNPJ checksum.",
          error_code: "INVALID_CHECKSUM",
          checked_at: new Date().toISOString(),
          source: "gov_br_cnpj",
        });
        continue;
      }

      if (seen.has(normalized.digits)) {
        duplicates_ignored += 1;
        continue;
      }

      seen.add(normalized.digits);
      prepared.push(normalized);
    }

    if (prepared.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: "Brazilian CNPJ batch too large",
        message: `Maximum ${MAX_BATCH_SIZE} Brazilian CNPJ numbers per request.`,
        results,
      });
    }

    for (const item of prepared) {
      results.push(await checkBrazilVat(item));
    }

    return res.status(200).json({
      results,
      total: results.length,
      duplicates_ignored,
      checked_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Brazilian CNPJ validation failed",
      message: error instanceof Error ? error.message : String(error),
      results: [],
    });
  }
}
