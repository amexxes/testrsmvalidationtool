function normalizeBasic(value) {
  return String(value || "").toUpperCase().trim();
}

function digitsOnly(value) {
  return normalizeBasic(value).replace(/\D+/g, "");
}

function compactAlnum(value) {
  return normalizeBasic(value).replace(/[^A-Z0-9]/g, "");
}

function isValidDate(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function luhn(value) {
  let sum = 0;
  let doubleDigit = false;

  for (let i = value.length - 1; i >= 0; i--) {
    let n = Number(value[i]);
    if (Number.isNaN(n)) return false;

    if (doubleDigit) {
      n *= 2;
      if (n > 9) n -= 9;
    }

    sum += n;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

function structureValidator(regex, normalizer = compactAlnum) {
  return function validate(raw) {
    const normalized = normalizer(raw);
    return {
      normalized,
      structureValid: regex.test(normalized),
      syntaxValid: null,
    };
  };
}

function checksumMod11Weighted(value, weights1, weights2) {
  let sum = 0;
  for (let i = 0; i < weights1.length; i++) {
    sum += Number(value[i]) * weights1[i];
  }
  let check = sum % 11;

  if (check === 10 && weights2) {
    sum = 0;
    for (let i = 0; i < weights2.length; i++) {
      sum += Number(value[i]) * weights2[i];
    }
    check = sum % 11;
    if (check === 10) check = 0;
  }

  return check;
}

function validateNL(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{9}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(normalized[i]) * (9 - i);
  }
  sum -= Number(normalized[8]);

  return {
    normalized,
    structureValid: true,
    syntaxValid: normalized !== "000000000" && sum % 11 === 0,
  };
}

function validateBE(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{11}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const base = normalized.slice(0, 9);
  const checksum = Number(normalized.slice(9));

  let c1 = 97 - (Number(base) % 97);
  if (c1 === 0) c1 = 97;

  let c2 = 97 - (Number(`2${base}`) % 97);
  if (c2 === 0) c2 = 97;

  return {
    normalized,
    structureValid: true,
    syntaxValid: checksum === c1 || checksum === c2,
  };
}

function validatePT(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{9}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(normalized[i]) * (9 - i);
  }

  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;

  return {
    normalized,
    structureValid: true,
    syntaxValid: Number(normalized[8]) === check,
  };
}

function validatePL(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{11}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += Number(normalized[i]) * weights[i];
  }

  const checksum = (10 - (sum % 10)) % 10;

  const yy = Number(normalized.slice(0, 2));
  let mm = Number(normalized.slice(2, 4));
  const dd = Number(normalized.slice(4, 6));

  let century = 1900;
  if (mm >= 1 && mm <= 12) century = 1900;
  else if (mm >= 21 && mm <= 32) {
    century = 2000;
    mm -= 20;
  } else if (mm >= 41 && mm <= 52) {
    century = 2100;
    mm -= 40;
  } else if (mm >= 61 && mm <= 72) {
    century = 2200;
    mm -= 60;
  } else if (mm >= 81 && mm <= 92) {
    century = 1800;
    mm -= 80;
  } else {
    return { normalized, structureValid: true, syntaxValid: false };
  }

  const year = century + yy;

  return {
    normalized,
    structureValid: true,
    syntaxValid:
      Number(normalized[10]) === checksum && isValidDate(year, mm, dd),
  };
}

function validateSE(raw) {
  const basic = normalizeBasic(raw).replace(/\s+/g, "");
  let normalized = basic.replace(/[^\d]/g, "");

  if (normalized.length === 12) normalized = normalized.slice(2);

  if (!/^\d{10}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  return {
    normalized,
    structureValid: true,
    syntaxValid: luhn(normalized),
  };
}

const FINLAND_CHECK_CHARS = "0123456789ABCDEFHJKLMNPRSTUVWXY";

function validateFI(raw) {
  const normalized = normalizeBasic(raw).replace(/\s+/g, "");
  const match = normalized.match(/^(\d{2})(\d{2})(\d{2})([+\-A])(\d{3})([0-9A-Y])$/);

  if (!match) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const [, dd, mm, yy, sep, individual, checkChar] = match;

  const year =
    sep === "+"
      ? 1800 + Number(yy)
      : sep === "-"
      ? 1900 + Number(yy)
      : 2000 + Number(yy);

  const dateOk = isValidDate(year, Number(mm), Number(dd));
  const control = FINLAND_CHECK_CHARS[Number(`${dd}${mm}${yy}${individual}`) % 31];

  return {
    normalized,
    structureValid: true,
    syntaxValid: dateOk && control === checkChar,
  };
}

const ES_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

function validateES(raw) {
  const normalized = compactAlnum(raw);

  if (/^\d{8}[A-Z]$/.test(normalized)) {
    const number = Number(normalized.slice(0, 8));
    const expected = ES_LETTERS[number % 23];
    return {
      normalized,
      structureValid: true,
      syntaxValid: normalized[8] === expected,
    };
  }

  if (/^[XYZ]\d{7}[A-Z]$/.test(normalized)) {
    const prefixMap = { X: "0", Y: "1", Z: "2" };
    const number = Number(prefixMap[normalized[0]] + normalized.slice(1, 8));
    const expected = ES_LETTERS[number % 23];
    return {
      normalized,
      structureValid: true,
      syntaxValid: normalized[8] === expected,
    };
  }

  return { normalized, structureValid: false, syntaxValid: null };
}

const IT_ODD = {
  "0": 1,
  "1": 0,
  "2": 5,
  "3": 7,
  "4": 9,
  "5": 13,
  "6": 15,
  "7": 17,
  "8": 19,
  "9": 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};

const IT_EVEN = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

function validateIT(raw) {
  const normalized = compactAlnum(raw);
  if (!/^[A-Z0-9]{16}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = normalized[i];
    sum += (i + 1) % 2 === 1 ? IT_ODD[ch] : IT_EVEN[ch];
  }

  const expected = String.fromCharCode(65 + (sum % 26));

  return {
    normalized,
    structureValid: true,
    syntaxValid: normalized[15] === expected,
  };
}

function validateEE(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{11}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const first = Number(normalized[0]);
  const yy = Number(normalized.slice(1, 3));
  const mm = Number(normalized.slice(3, 5));
  const dd = Number(normalized.slice(5, 7));

  let century = 1900;
  if (first === 1 || first === 2) century = 1800;
  else if (first === 3 || first === 4) century = 1900;
  else if (first === 5 || first === 6) century = 2000;
  else if (first === 7 || first === 8) century = 2100;

  const dateOk = first >= 1 && first <= 8 && isValidDate(century + yy, mm, dd);

  const check = checksumMod11Weighted(
    normalized,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 1],
    [3, 4, 5, 6, 7, 8, 9, 1, 2, 3]
  );

  return {
    normalized,
    structureValid: true,
    syntaxValid: dateOk && Number(normalized[10]) === check,
  };
}

function validateLT(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{11}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const first = Number(normalized[0]);
  const yy = Number(normalized.slice(1, 3));
  const mm = Number(normalized.slice(3, 5));
  const dd = Number(normalized.slice(5, 7));

  let century = 1900;
  if (first === 1 || first === 2) century = 1800;
  else if (first === 3 || first === 4) century = 1900;
  else if (first === 5 || first === 6) century = 2000;

  const dateOk = first >= 1 && first <= 6 && isValidDate(century + yy, mm, dd);

  const check = checksumMod11Weighted(
    normalized,
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 1],
    [3, 4, 5, 6, 7, 8, 9, 1, 2, 3]
  );

  return {
    normalized,
    structureValid: true,
    syntaxValid: dateOk && Number(normalized[10]) === check,
  };
}

function validateHR(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{11}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  let a = 10;
  for (let i = 0; i < 10; i++) {
    a = (a + Number(normalized[i])) % 10;
    if (a === 0) a = 10;
    a = (a * 2) % 11;
  }

  let check = 11 - a;
  if (check === 10) check = 0;

  return {
    normalized,
    structureValid: true,
    syntaxValid: Number(normalized[10]) === check,
  };
}

function validateRO(raw) {
  const normalized = digitsOnly(raw);
  if (!/^\d{13}$/.test(normalized)) {
    return { normalized, structureValid: false, syntaxValid: null };
  }

  const first = Number(normalized[0]);
  const yy = Number(normalized.slice(1, 3));
  const mm = Number(normalized.slice(3, 5));
  const dd = Number(normalized.slice(5, 7));

  let dateOk = true;
  if (first >= 1 && first <= 8) {
    let century = 1900;
    if (first === 1 || first === 2) century = 1900;
    else if (first === 3 || first === 4) century = 1800;
    else if (first === 5 || first === 6) century = 2000;
    else if (first === 7 || first === 8) century = 2000;
    dateOk = isValidDate(century + yy, mm, dd);
  }

  const control = "279146358279";
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(normalized[i]) * Number(control[i]);
  }
  let check = sum % 11;
  if (check === 10) check = 1;

  return {
    normalized,
    structureValid: true,
    syntaxValid: dateOk && Number(normalized[12]) === check,
  };
}

const TIN_RULES = {
  AT: { label: "Austria", support: "pending", validate: null },
  BE: { label: "Belgium", support: "syntax", validate: validateBE },
  BG: { label: "Bulgaria", support: "pending", validate: null },
  CY: { label: "Cyprus", support: "pending", validate: null },
  CZ: {
    label: "Czech Republic",
    support: "structure",
    validate: structureValidator(/^\d{9,10}$/, digitsOnly),
  },
  DE: {
    label: "Germany",
    support: "structure",
    validate: structureValidator(/^\d{11}$/, digitsOnly),
  },
  DK: {
    label: "Denmark",
    support: "structure",
    validate: structureValidator(/^\d{10}$/, digitsOnly),
  },
  EE: { label: "Estonia", support: "syntax", validate: validateEE },
  EL: { label: "Greece", support: "pending", validate: null },
  ES: { label: "Spain", support: "syntax", validate: validateES },
  FI: { label: "Finland", support: "syntax", validate: validateFI },
  FR: {
    label: "France",
    support: "structure",
    validate: structureValidator(/^\d{13}$/, digitsOnly),
  },
  HR: { label: "Croatia", support: "syntax", validate: validateHR },
  HU: { label: "Hungary", support: "pending", validate: null },
  IE: {
    label: "Ireland",
    support: "structure",
    validate: structureValidator(/^\d{7}[A-Z]{1,2}$/i, compactAlnum),
  },
  IT: { label: "Italy", support: "syntax", validate: validateIT },
  LT: { label: "Lithuania", support: "syntax", validate: validateLT },
  LU: { label: "Luxembourg", support: "pending", validate: null },
  LV: {
    label: "Latvia",
    support: "structure",
    validate: structureValidator(/^\d{11}$/, digitsOnly),
  },
  MT: { label: "Malta", support: "pending", validate: null },
  NL: { label: "Netherlands", support: "syntax", validate: validateNL },
  PL: { label: "Poland", support: "syntax", validate: validatePL },
  PT: { label: "Portugal", support: "syntax", validate: validatePT },
  RO: { label: "Romania", support: "syntax", validate: validateRO },
  SE: { label: "Sweden", support: "syntax", validate: validateSE },
  SI: { label: "Slovenia", support: "pending", validate: null },
  SK: {
    label: "Slovakia",
    support: "structure",
    validate: structureValidator(/^\d{9,10}$/, digitsOnly),
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const country = String(body?.country || "").toUpperCase().trim();
    const subject = String(body?.subject || "unknown").trim() || "unknown";
    const tin = String(body?.tin || "");

    if (!country || !tin.trim()) {
      return res.status(400).json({ error: "country and tin are required" });
    }

    const rule = TIN_RULES[country];
    if (!rule) {
      return res.status(400).json({ error: `Unsupported country: ${country}` });
    }

    if (!rule.validate) {
      return res.status(200).json({
        status: "not_implemented",
        country,
        country_label: rule.label,
        subject,
        subject_applied: false,
        support: rule.support,
        input: tin,
        normalized: compactAlnum(tin),
        structure_valid: null,
        syntax_valid: null,
        check_level: "pending",
        message:
          `Country added in dropdown. Validation rule for ${rule.label} is not implemented yet in this version.`,
        disclaimer:
          "This check verifies structure and, where available, syntax only. It does not confirm existence or identity.",
      });
    }

    const checked = rule.validate(tin);

    let status = "invalid";
    let check_level = "none";
    let message = `Invalid ${rule.label} TIN format`;

    if (checked.structureValid && checked.syntaxValid === null) {
      status = "valid";
      check_level = "structure";
      message = `Valid ${rule.label} TIN structure`;
    } else if (checked.structureValid && checked.syntaxValid === true) {
      status = "valid";
      check_level = "syntax";
      message = `Valid ${rule.label} TIN structure and syntax`;
    } else if (checked.structureValid && checked.syntaxValid === false) {
      status = "invalid";
      check_level = "syntax";
      message = `Invalid ${rule.label} TIN syntax`;
    }

    const subjectApplied = subject === "unknown";

    if (!subjectApplied) {
      message += " Subject-specific rule not yet loaded; generic country rule used.";
    }

    return res.status(200).json({
      status,
      country,
      country_label: rule.label,
      subject,
      subject_applied: subjectApplied,
      support: rule.support,
      input: tin,
      normalized: checked.normalized,
      structure_valid: checked.structureValid,
      syntax_valid: checked.syntaxValid,
      check_level,
      message,
      disclaimer:
        "This check verifies structure and, where available, syntax only. It does not confirm existence or identity.",
    });
  } catch (e) {
    return res.status(500).json({
      error: "tin-validate failed",
      message: String(e?.message || e),
    });
  }
}
