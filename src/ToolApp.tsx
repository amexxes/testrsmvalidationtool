// /src/ToolApp.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import UserDraftsPanel, { type UserDraft } from "./UserDraftsPanel";
import type { FrJobResponse, ValidateBatchResponse, VatRow } from "./types";
import type { PortalRunSummary } from "./portalRunHistory";
import {
  LANGUAGES,
  getStoredLanguage,
  storeLanguage,
  t,
  type PortalLanguage,
} from "./i18n";

type ActivePage = "vat" | "tin" | "eori";
type RowTone = "valid" | "invalid" | "pending" | "error";

type ClientBranding = {
  id?: string;
  clientName?: string;
  portalTitle?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
};

type ToolAppProps = {
  branding?: ClientBranding;
  viewAsEmail?: string;
  onRunCompleted?: (summary: PortalRunSummary) => void;
};

type TinRow = {
  index?: number;
  input_tin?: string;
  status?: "valid" | "invalid" | "error" | string;
  country?: string;
  tin_number?: string;
  request_date?: string | null;
  structure_valid?: boolean | null;
  syntax_valid?: boolean | null;
  message?: string;
};

type EoriRow = {
  input_eori?: string;
  eori?: string;
  valid?: boolean;
  status?: "valid" | "invalid" | "error" | string;
  trader_name?: string;
  address?: unknown;
  processing_date?: string;
  message?: string;
};

type Metric = {
  label: string;
  value: React.ReactNode;
  tone?: RowTone;
};

const DEFAULT_BRANDING: ClientBranding = {
  id: "default",
  clientName: "RSM Netherlands",
  portalTitle: "Validation Portal",
  logoUrl: "/rsmlogo.png",
  primaryColor: "#0B2E5F",
  accentColor: "#63C7F2",
  backgroundColor: "#F8FBFF",
  textColor: "#1E293B",
};

const PORTAL_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ACTION_FIRST_FIELD_STYLE: React.CSSProperties = {
  width: 420,
  minWidth: 420,
  maxWidth: 420,
  height: 38,
  boxSizing: "border-box",
};

const ACTION_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "420px 170px 170px",
  alignItems: "center",
  justifyContent: "start",
  gap: 10,
  width: "100%",
  overflowX: "auto",
  paddingBottom: 2,
};

const ACTION_BUTTON_STYLE: React.CSSProperties = {
  width: 170,
  minWidth: 170,
  maxWidth: 170,
  height: 38,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#FFFFFF",
  color: "#0B2E5F",
  fontFamily: PORTAL_FONT,
  fontSize: 13,
  fontWeight: 800,
  lineHeight: "38px",
  cursor: "pointer",
};

const COUNTRY_OPTIONS = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "EL", name: "Greece" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SE", name: "Sweden" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
];

const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^\d{10}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  EL: /^\d{9}$/,
  ES: /^[A-Z0-9]{9}$/,
  FI: /^\d{8}$/,
  FR: /^[0-9A-Z]{2}\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^[0-9A-Z]{8,9}$/,
  IT: /^\d{11}$/,
  LT: /^(?:\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
  XI: /^(?:\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
};

function normalizeLine(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeVatCandidate(value: string): string {
  const normalized = normalizeLine(value);
  return normalized.startsWith("GR") ? `EL${normalized.slice(2)}` : normalized;
}

function normalizeTinCandidate(value: string, country: string): string {
  let tin = String(value || "").trim();
  const cc = normalizeCountry(country);
  const altCc = cc === "EL" ? "GR" : cc;
  const upper = tin.toUpperCase();

  if (upper.startsWith(`${cc} `) || upper.startsWith(`${altCc} `)) tin = tin.slice(3);
  else if (upper.startsWith(cc) || upper.startsWith(altCc)) tin = tin.slice(2);

  return tin.trim();
}

function normalizeEoriCandidate(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "")
    .toUpperCase();
}

function validateEoriFormat(value: string): { ok: boolean; reason: string } {
  const eori = normalizeEoriCandidate(value);

  if (!eori) return { ok: false, reason: "Missing EORI" };

  if (eori.startsWith("XI")) {
    return {
      ok: false,
      reason: "XI EORI numbers must be checked via the EU EORI service",
    };
  }

  if (!eori.startsWith("GB")) {
    return {
      ok: false,
      reason: "Only GB EORI numbers are supported by the HMRC API",
    };
  }

  if (!/^GB\d{12,15}$/.test(eori)) {
    return {
      ok: false,
      reason: "Expected format: GB followed by 12 to 15 digits",
    };
  }

  return { ok: true, reason: "" };
}

function normalizeCountry(country: string): string {
  const value = String(country || "").toUpperCase().trim();
  return value === "GR" ? "EL" : value;
}

function validateVatFormat(value: string): { ok: boolean; reason: string } {
  const normalized = normalizeVatCandidate(value);

  if (normalized.length < 3) return { ok: false, reason: "Too short" };

  const country = normalized.slice(0, 2);
  const vatPart = normalized.slice(2);

  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, reason: "Missing country prefix" };
  if (!vatPart) return { ok: false, reason: "Missing VAT digits" };
  if (!/^[A-Z0-9]+$/.test(vatPart)) return { ok: false, reason: "Invalid characters" };

  const pattern = VAT_PATTERNS[country];
  if (pattern && !pattern.test(vatPart)) return { ok: false, reason: `Invalid format for ${country}` };

  return { ok: true, reason: "" };
}

function splitInputLines(value: string): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]): { values: string[]; duplicates: number } {
  const seen = new Set<string>();
  const out: string[] = [];
  let duplicates = 0;

  for (const value of values) {
    if (!value) continue;

    if (seen.has(value)) {
      duplicates += 1;
      continue;
    }

    seen.add(value);
    out.push(value);
  }

  return { values: out, duplicates };
}

function localeForLanguage(language: PortalLanguage): string {
  if (language === "nl") return "nl-NL";
  if (language === "de") return "de-DE";
  if (language === "fr") return "fr-FR";
  return "en-GB";
}

function formatDate(value: unknown, language: PortalLanguage): string {
  if (value === null || value === undefined || value === "") return "";

  let date: Date | null = null;

  if (typeof value === "number") {
    date = new Date(value < 1_000_000_000_000 ? value * 1000 : value);
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    date = Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(localeForLanguage(language));
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(displayValue).filter(Boolean).join(", ");
  }

  return String(value);
}

function statusTone(status: string | undefined): RowTone {
  const value = String(status || "").toLowerCase();

  if (value === "valid") return "valid";
  if (value === "invalid") return "invalid";
  if (value === "error") return "error";

  return "pending";
}

function vatStatus(row: VatRow): RowTone {
  const raw = String((row as any).state || "").toLowerCase();

  if (raw === "error") return "error";
  if (typeof (row as any).valid === "boolean") return (row as any).valid ? "valid" : "invalid";
  if (raw === "valid" || raw === "invalid" || raw === "pending" || raw === "error") return raw as RowTone;

  return "pending";
}

function eoriStatus(row: EoriRow): RowTone {
  const rawStatus = String(row.status || "").toLowerCase();

  if (rawStatus === "valid") return "valid";
  if (rawStatus === "invalid") return "invalid";
  if (rawStatus === "error") return "error";

  if (typeof row.valid === "boolean") {
    return row.valid ? "valid" : "invalid";
  }

  return "pending";
}

function statusLabel(language: PortalLanguage, status: RowTone): string {
  if (status === "valid") return t(language, "valid");
  if (status === "invalid") return t(language, "invalid");
  if (status === "error") return t(language, "error");
  return t(language, "pending");
}

function rowBorder(tone: RowTone): string {
  if (tone === "valid") return "rgba(22,163,74,0.22)";
  if (tone === "invalid") return "rgba(220,38,38,0.20)";
  if (tone === "error") return "rgba(185,28,28,0.25)";
  return "rgba(11,46,95,0.10)";
}

function toneBackground(tone: RowTone): string {
  if (tone === "valid") return "rgba(22,163,74,0.08)";
  if (tone === "invalid") return "rgba(220,38,38,0.07)";
  if (tone === "error") return "rgba(185,28,28,0.08)";
  return "rgba(99,199,242,0.10)";
}

function countryName(code: string, language: PortalLanguage): string {
  const normalized = normalizeCountry(code);
  const displayCode = normalized === "EL" ? "GR" : normalized;

  try {
    const DisplayNames = (Intl as any).DisplayNames;
    if (!DisplayNames) return displayCode;

    const names = new DisplayNames([localeForLanguage(language)], { type: "region" });
    return names.of(displayCode) || displayCode;
  } catch {
    return displayCode;
  }
}

function localText(language: PortalLanguage, key: string): string {
  const copy: Record<PortalLanguage, Record<string, string>> = {
    en: {
      unique: "unique",
      lines: "lines",
      formatIssues: "format issues",
      clientCase: "Client / Case",
      vatPlaceholder: "Paste VAT numbers, one per line",
      tinPlaceholder: "Paste TINs, one per line",
      selectCountry: "Select country",
      job: "Job",
      ready: "Ready",
      imported: "Imported",
      validationFailed: "Validation failed",
      exportEmpty: "Nothing to export yet",
      inputCard: "Input card",
      retryUnresolved: "Retry unresolved",
      eoriTab: "EORI Validation",
      eoriPlaceholder: "Paste GB EORI numbers, one per line",
      eoriInputHelp: "Check UK-issued GB EORI numbers in batch via HMRC.",
      eoriImportant:
        "Only GB EORI numbers are supported by the HMRC API. XI EORI numbers must be checked via the EU EORI service.",
      eori: "EORI",
      inputEori: "Input EORI",
      traderName: "Trader name",
      processingDate: "Processing date",
    },
    nl: {
      unique: "uniek",
      lines: "regels",
      formatIssues: "formaatproblemen",
      clientCase: "Klant / dossier",
      vatPlaceholder: "Plak btw-nummers, één per regel",
      tinPlaceholder: "Plak TINs, één per regel",
      selectCountry: "Selecteer land",
      job: "Taak",
      ready: "Gereed",
      imported: "Geïmporteerd",
      validationFailed: "Validatie mislukt",
      exportEmpty: "Nog niets om te exporteren",
      inputCard: "Invoerkaart",
      retryUnresolved: "Opnieuw proberen",
      eoriTab: "EORI-validatie",
      eoriPlaceholder: "Plak GB EORI-nummers, één per regel",
      eoriInputHelp: "Controleer UK-uitgegeven GB EORI-nummers in batch via HMRC.",
      eoriImportant:
        "Alleen GB EORI-nummers worden ondersteund door de HMRC API. XI EORI-nummers moeten via de EU EORI-service worden gecontroleerd.",
      eori: "EORI",
      inputEori: "Invoer-EORI",
      traderName: "Handelsnaam",
      processingDate: "Verwerkingsdatum",
    },
    de: {
      unique: "eindeutig",
      lines: "Zeilen",
      formatIssues: "Formatprobleme",
      clientCase: "Kunde / Fall",
      vatPlaceholder: "USt-IdNr. einfügen, eine pro Zeile",
      tinPlaceholder: "TINs einfügen, eine pro Zeile",
      selectCountry: "Land wählen",
      job: "Aufgabe",
      ready: "Bereit",
      imported: "Importiert",
      validationFailed: "Validierung fehlgeschlagen",
      exportEmpty: "Noch nichts zu exportieren",
      inputCard: "Eingabekarte",
      retryUnresolved: "Offene erneut versuchen",
      eoriTab: "EORI-Prüfung",
      eoriPlaceholder: "GB-EORI-Nummern einfügen, eine pro Zeile",
      eoriInputHelp: "Prüfen Sie in UK ausgestellte GB-EORI-Nummern per Batch über HMRC.",
      eoriImportant:
        "Die HMRC API unterstützt nur GB-EORI-Nummern. XI-EORI-Nummern müssen über den EU-EORI-Dienst geprüft werden.",
      eori: "EORI",
      inputEori: "Eingabe-EORI",
      traderName: "Unternehmensname",
      processingDate: "Verarbeitungsdatum",
    },
    fr: {
      unique: "uniques",
      lines: "lignes",
      formatIssues: "problèmes de format",
      clientCase: "Client / dossier",
      vatPlaceholder: "Collez les numéros VAT, un par ligne",
      tinPlaceholder: "Collez les TINs, un par ligne",
      selectCountry: "Sélectionnez le pays",
      job: "Tâche",
      ready: "Prêt",
      imported: "Importé",
      validationFailed: "Validation échouée",
      exportEmpty: "Rien à exporter pour le moment",
      inputCard: "Carte de saisie",
      retryUnresolved: "Réessayer les non résolus",
      eoriTab: "Validation EORI",
      eoriPlaceholder: "Collez les numéros EORI GB, un par ligne",
      eoriInputHelp: "Contrôlez les numéros EORI GB émis au Royaume-Uni en lot via HMRC.",
      eoriImportant:
        "Seuls les numéros EORI GB sont pris en charge par l’API HMRC. Les numéros EORI XI doivent être vérifiés via le service EORI de l’UE.",
      eori: "EORI",
      inputEori: "EORI saisi",
      traderName: "Nom commercial",
      processingDate: "Date de traitement",
    },
  };

  return copy[language]?.[key] || copy.en[key] || key;
}

async function readJson(resp: Response): Promise<any> {
  const text = await resp.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readTabularFile(file: File): Promise<string[]> {
  const name = String(file.name || "").toLowerCase();

  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = await file.text();

    return text
      .split(/\r?\n|,|;|\t/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames?.[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;

  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  return rows
    .flat()
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function writeWorkbook(filename: string, sheetName: string, headers: string[], rows: unknown[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function actionButtonStyle(disabled?: boolean, primary?: boolean): React.CSSProperties {
  return {
    ...ACTION_BUTTON_STYLE,
    background: primary ? "#0B2E5F" : "#FFFFFF",
    color: primary ? "#FFFFFF" : "#0B2E5F",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function textInputStyle(): React.CSSProperties {
  return {
    ...ACTION_FIRST_FIELD_STYLE,
    borderRadius: 12,
    border: "1px solid rgba(11,46,95,0.12)",
    padding: "0 12px",
    color: "#0B2E5F",
    fontFamily: PORTAL_FONT,
    fontSize: 13,
    fontWeight: 700,
    outline: "none",
    background: "#fff",
  };
}

function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 22,
    border: "1px solid rgba(11,46,95,0.08)",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 14px 42px rgba(15,23,42,0.05)",
    padding: 18,
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 210,
    boxSizing: "border-box",
    resize: "vertical",
    borderRadius: 18,
    border: "1px solid rgba(11,46,95,0.10)",
    background: "#FFFFFF",
    padding: 14,
    color: "#0B2E5F",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.55,
    outline: "none",
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: PORTAL_FONT,
        fontSize: 20,
        lineHeight: 1.2,
        fontWeight: 800,
        color: "#0B2E5F",
        margin: 0,
      }}
    >
      {children}
    </div>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: PORTAL_FONT,
        fontSize: 14,
        lineHeight: 1.55,
        fontWeight: 500,
        color: "#42526A",
        marginTop: 6,
      }}
    >
      {children}
    </div>
  );
}

function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
        gap: 10,
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            borderRadius: 16,
            border: `1px solid ${rowBorder(item.tone || "pending")}`,
            background: toneBackground(item.tone || "pending"),
            padding: "12px 13px",
          }}
        >
          <div
            style={{
              color: "#5F6E82",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {item.label}
          </div>
          <div style={{ marginTop: 7, color: "#0B2E5F", fontSize: 22, fontWeight: 900 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: RowTone; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 84,
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        border: `1px solid ${rowBorder(tone)}`,
        background: toneBackground(tone),
        color: tone === "invalid" || tone === "error" ? "#8F1D1D" : "#0B2E5F",
        fontSize: 12,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function LanguageSwitcher({
  language,
  setLanguage,
}: {
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
}) {
  return (
    <div
      style={{
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: "1px solid rgba(11,46,95,0.10)",
        background: "rgba(255,255,255,0.88)",
        flex: "0 0 auto",
      }}
    >
      {LANGUAGES.map((item) => {
        const active = item.code === language;

        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLanguage(item.code)}
            style={{
              width: 34,
              height: 28,
              border: 0,
              borderRadius: 999,
              background: active ? "#0B2E5F" : "transparent",
              color: active ? "#FFFFFF" : "#0B2E5F",
              fontSize: 11,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function PageSwitcher({
  activePage,
  setActivePage,
  language,
}: {
  activePage: ActivePage;
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>;
  language: PortalLanguage;
}) {
  return (
    <div
      style={{
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: "1px solid rgba(11,46,95,0.10)",
        background: "rgba(255,255,255,0.88)",
        flex: "0 0 auto",
      }}
    >
      <button
        type="button"
        onClick={() => setActivePage("vat")}
        style={{
          height: 28,
          minWidth: 148,
          padding: "0 12px",
          border: 0,
          borderRadius: 999,
          background: activePage === "vat" ? "#0B2E5F" : "transparent",
          color: activePage === "vat" ? "#FFFFFF" : "#0B2E5F",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {t(language, "vatTab")}
      </button>

      <button
        type="button"
        onClick={() => setActivePage("tin")}
        style={{
          height: 28,
          minWidth: 112,
          padding: "0 12px",
          border: 0,
          borderRadius: 999,
          background: activePage === "tin" ? "#0B2E5F" : "transparent",
          color: activePage === "tin" ? "#FFFFFF" : "#0B2E5F",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {t(language, "tinTab")}
      </button>

      <button
        type="button"
        onClick={() => setActivePage("eori")}
        style={{
          height: 28,
          minWidth: 112,
          padding: "0 12px",
          border: 0,
          borderRadius: 999,
          background: activePage === "eori" ? "#0B2E5F" : "transparent",
          color: activePage === "eori" ? "#FFFFFF" : "#0B2E5F",
          fontSize: 12,
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {localText(language, "eoriTab")}
      </button>
    </div>
  );
}

function PortalBanner({
  branding,
  activePage,
  setActivePage,
  language,
  setLanguage,
  lastUpdate,
}: {
  branding: ClientBranding;
  activePage: ActivePage;
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>;
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
  lastUpdate: string;
}) {
  const logoUrl = branding.logoUrl || DEFAULT_BRANDING.logoUrl;
  const title = "Validation Portal";
  const modeValue =
    activePage === "vat"
      ? t(language, "vatTab")
      : activePage === "tin"
        ? t(language, "tinTab")
        : localText(language, "eoriTab");

  return (
    <div
      style={{
        borderRadius: 26,
        border: "1px solid rgba(11,46,95,0.08)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.82))",
        boxShadow: "0 18px 54px rgba(15,23,42,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 4,
          background: `linear-gradient(90deg, ${branding.primaryColor || "#0B2E5F"}, ${
            branding.accentColor || "#63C7F2"
          })`,
        }}
      />

      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "nowrap",
          padding: "18px 22px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 0,
            flex: "0 1 370px",
          }}
        >
          <div
            style={{
              minWidth: 152,
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "#FFFFFF",
              border: "1px solid rgba(11,46,95,0.08)",
            }}
          >
            <img
              src={logoUrl}
              alt={`${branding.clientName || "RSM"} logo`}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = "/rsmlogo.png";
              }}
              style={{ maxWidth: 150, maxHeight: 58, objectFit: "contain" }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: branding.primaryColor || "#0B2E5F",
                fontFamily: PORTAL_FONT,
                fontSize: 20,
                fontWeight: 900,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>

            <div style={{ marginTop: 4, color: "#526174", fontSize: 13, fontWeight: 700 }}>
              {branding.clientName || DEFAULT_BRANDING.clientName}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            minWidth: 0,
            flex: "1 1 auto",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          <div
            style={{
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 12px",
              borderRadius: 999,
              border: "1px solid rgba(11,46,95,0.10)",
              background: "rgba(255,255,255,0.88)",
              color: "#0B2E5F",
              fontSize: 12,
              fontWeight: 800,
              flex: "0 0 auto",
            }}
          >
            <span style={{ opacity: 0.72 }}>{t(language, "mode")}</span>
            <span>{modeValue}</span>
            <span style={{ opacity: 0.35 }}>•</span>
            <span style={{ opacity: 0.72 }}>{t(language, "lastUpdate")}</span>
            <span>{lastUpdate || "—"}</span>
          </div>

          <LanguageSwitcher language={language} setLanguage={setLanguage} />
          <PageSwitcher activePage={activePage} setActivePage={setActivePage} language={language} />
        </div>
      </div>
    </div>
  );
}

function CreditsVisual({ language }: { language: PortalLanguage }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 18,
        border: "1px solid rgba(11,46,95,0.08)",
        background: "#FFFFFF",
      }}
    >
      <div>
        <div style={{ color: "#0B2E5F", fontSize: 13, fontWeight: 900 }}>{t(language, "credits")}</div>
        <div style={{ marginTop: 3, color: "#607089", fontSize: 12, fontWeight: 700 }}>
          {t(language, "unlimited")}
        </div>
      </div>

      <div style={{ width: 150, height: 9, borderRadius: 999, background: "rgba(11,46,95,0.08)" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, #0B2E5F, #63C7F2)",
          }}
        />
      </div>
    </div>
  );
}

function InputDistribution({
  entries,
  language,
}: {
  entries: Array<[string, number]>;
  language: PortalLanguage;
}) {
  if (!entries.length) return null;

  const max = Math.max(...entries.map(([, count]) => count));

  return (
    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      <div style={{ color: "#0B2E5F", fontSize: 13, fontWeight: 900 }}>{t(language, "inputByCountry")}</div>

      {entries.map(([country, count]) => (
        <div
          key={country}
          style={{ display: "grid", gridTemplateColumns: "54px 1fr 44px", gap: 8, alignItems: "center" }}
        >
          <div style={{ color: "#0B2E5F", fontSize: 12, fontWeight: 900 }}>{country}</div>

          <div style={{ height: 9, borderRadius: 999, background: "rgba(11,46,95,0.08)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(8, (count / max) * 100)}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg, #0B2E5F, #63C7F2)",
              }}
            />
          </div>

          <div style={{ color: "#607089", fontSize: 12, fontWeight: 800, textAlign: "right" }}>{count}</div>
        </div>
      ))}
    </div>
  );
}

function resultCellStyle(tone: RowTone): React.CSSProperties {
  return {
    padding: "10px",
    color: "#0B2E5F",
    fontSize: 13,
    fontWeight: 700,
    borderTop: `1px solid ${rowBorder(tone)}`,
    borderBottom: `1px solid ${rowBorder(tone)}`,
    background: "#FFFFFF",
    verticalAlign: "top",
  };
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(185,28,28,0.14)",
        background: "rgba(185,28,28,0.07)",
        color: "#8F1D1D",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(99,199,242,0.18)",
        background: "rgba(99,199,242,0.08)",
        color: "#0B2E5F",
        padding: "10px 12px",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function VatPage({
  language,
  onRunCompleted,
  setLastUpdate,
}: {
  language: PortalLanguage;
  onRunCompleted?: (summary: PortalRunSummary) => void;
  setLastUpdate: (value: string) => void;
}) {
  const [vatInput, setVatInput] = useState("");
  const [caseRef, setCaseRef] = useState("");
  const [rows, setRows] = useState<VatRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const currentRunStartedAtRef = useRef<string>("");

  const inputLines = useMemo(() => splitInputLines(vatInput), [vatInput]);

  const precheck = useMemo(() => {
    const normalized = inputLines.map(normalizeVatCandidate).filter(Boolean);
    const unique = uniqueValues(normalized);
    const formatIssues = unique.values.filter((value) => !validateVatFormat(value).ok).length;

    return {
      lines: inputLines.length,
      unique: unique.values.length,
      duplicates: unique.duplicates,
      formatIssues,
    };
  }, [inputLines]);

  const countryEntries = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();

    for (const line of inputLines) {
      const normalized = normalizeVatCandidate(line);
      if (normalized.length < 2 || seen.has(normalized)) continue;

      seen.add(normalized);

      const country = normalized.slice(0, 2);
      if (/^[A-Z]{2}$/.test(country)) counts[country] = (counts[country] || 0) + 1;
    }

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [inputLines]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [filter, rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((row) => vatStatus(row) === "valid").length;
    const invalid = rows.filter((row) => vatStatus(row) === "invalid").length;
    const errors = rows.filter((row) => vatStatus(row) === "error").length;
    const pending = Math.max(0, total - valid - invalid - errors);

    return { total, valid, invalid, pending, errors, done: valid + invalid + errors };
  }, [rows]);

  useEffect(() => {
    if (!onRunCompleted || !currentRunIdRef.current || !rows.length) return;

    onRunCompleted({
      id: currentRunIdRef.current,
      type: "vat",
      createdAt: currentRunStartedAtRef.current || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      label: "VAT / VIES validation run",
      total: stats.total,
      done: stats.done,
      valid: stats.valid,
      invalid: stats.invalid,
      pending: stats.pending,
      errors: stats.errors,
      formatIssues: precheck.formatIssues,
      caseRef: caseRef || undefined,
    });
  }, [caseRef, onRunCompleted, precheck.formatIssues, rows.length, stats]);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  function stopPolling() {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setActiveJobId(null);
  }

  function cancelValidation() {
    validateAbortRef.current?.abort();
    validateAbortRef.current = null;
    stopPolling();
    setLoading(false);
  }

  function clearVat() {
    cancelValidation();
    setVatInput("");
    setCaseRef("");
    setRows([]);
    setFilter("");
    setError("");
    setDuplicatesIgnored(0);
    setLastUpdate("—");
    currentRunIdRef.current = null;
    currentRunStartedAtRef.current = "";
  }

  function enrichVatRow(row: VatRow): VatRow {
    const input = String((row as any).vat_number || (row as any).input || "");
    const format = validateVatFormat(input);

    return {
      ...row,
      format_ok: format.ok,
      format_reason: format.reason,
      case_ref: (row as any).case_ref || caseRef,
    };
  }

  async function pollJob(jobId: string) {
    try {
      pollAbortRef.current?.abort();

      const controller = new AbortController();
      pollAbortRef.current = controller;

      const resp = await fetch(`/api/fr-job/${encodeURIComponent(jobId)}`, { signal: controller.signal });
      if (!resp.ok) return;

      const data = (await resp.json()) as FrJobResponse & any;
      const nextRows = Array.isArray(data?.results) ? data.results.map((row: VatRow) => enrichVatRow(row)) : [];

      if (nextRows.length) setRows(nextRows);

      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));

      const status = String(data?.job?.status || "").toLowerCase();
      const hasPending = nextRows.some((row: VatRow) => vatStatus(row) === "pending");

      if (status === "completed" && !hasPending) stopPolling();
    } catch (err) {
      if ((err as any)?.name !== "AbortError") setError(String((err as Error)?.message || err));
    }
  }

  async function validateVat() {
    const normalized = uniqueValues(inputLines.map(normalizeVatCandidate).filter(Boolean)).values;
    if (!normalized.length) return;

    stopPolling();
    setLoading(true);
    setError("");
    setRows([]);
    setDuplicatesIgnored(0);

    currentRunIdRef.current = `vat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    currentRunStartedAtRef.current = new Date().toISOString();

    validateAbortRef.current?.abort();
    const controller = new AbortController();
    validateAbortRef.current = controller;

    try {
      const resp = await fetch("/api/validate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat_numbers: normalized, case_ref: caseRef }),
        signal: controller.signal,
      });

      const data = (await readJson(resp)) as ValidateBatchResponse & any;

      if (!resp.ok) throw new Error(data?.error || data?.message || localText(language, "validationFailed"));

      setDuplicatesIgnored(Number(data?.duplicates_ignored || 0));

      const nextRows = Array.isArray(data?.results) ? data.results.map((row: VatRow) => enrichVatRow(row)) : [];
      setRows(nextRows);
      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));

      if (data?.fr_job_id) {
        setActiveJobId(String(data.fr_job_id));

        await pollJob(String(data.fr_job_id));

        pollTimerRef.current = window.setInterval(() => {
          void pollJob(String(data.fr_job_id));
        }, 1500);
      }
    } catch (err) {
      if ((err as any)?.name !== "AbortError") setError(String((err as Error)?.message || err));
    } finally {
      validateAbortRef.current = null;
      setLoading(false);
    }
  }

  async function importVatFile(file: File) {
    const rawValues = await readTabularFile(file);
    const normalized = rawValues.map(normalizeVatCandidate).filter(Boolean);
    const unique = uniqueValues(normalized).values.filter((value) => validateVatFormat(value).ok);

    if (unique.length) {
      setVatInput(unique.join("\n"));
      setFilter("");
      setError("");
    }
  }

  function exportVatExcel() {
    if (!rows.length) {
      setError(localText(language, "exportEmpty"));
      return;
    }

    const headers = [
      "case_ref",
      "input",
      "vat_number",
      "country_code",
      "valid",
      "state",
      "name",
      "address",
      "error_code",
      "error",
      "attempt",
      "next_retry_at",
      "checked_at",
      "format_ok",
      "format_reason",
    ];

    writeWorkbook(
      `vat_results_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`,
      "VAT Results",
      headers,
      rows.map((row) =>
        headers.map((header) => {
          const value = (row as any)[header];
          if (header === "checked_at" || header === "next_retry_at") return formatDate(value, language);
          return value === null || value === undefined ? "" : value;
        })
      )
    );
  }

  function restoreDraft(draft: UserDraft) {
    setCaseRef(draft.referenceValue || "");
    setVatInput(draft.inputValue || "");
    setFilter("");
    setRows([]);
    setError("");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{t(language, "vatTab")}</SectionTitle>
          </div>

          <CreditsVisual language={language} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={ACTION_ROW_STYLE}>
            <input
              value={caseRef}
              onChange={(event) => setCaseRef(event.target.value)}
              placeholder={t(language, "clientCasePlaceholder")}
              style={textInputStyle()}
            />

            <button type="button" onClick={() => importFileRef.current?.click()} style={actionButtonStyle()}>
              {t(language, "importXlsxCsv")}
            </button>

            <button type="button" onClick={exportVatExcel} style={actionButtonStyle(!rows.length)} disabled={!rows.length}>
              {t(language, "exportExcel")}
            </button>
          </div>

          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void importVatFile(file);
            }}
          />

          <textarea
            value={vatInput}
            onChange={(event) => setVatInput(event.target.value)}
            placeholder={localText(language, "vatPlaceholder")}
            rows={9}
            style={textareaStyle()}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void validateVat()}
              disabled={loading || !precheck.unique}
              style={actionButtonStyle(loading || !precheck.unique, true)}
            >
              {loading ? t(language, "validating") : t(language, "validate")}
            </button>

            <button type="button" onClick={loading ? cancelValidation : clearVat} style={actionButtonStyle()}>
              {loading ? t(language, "cancel") : t(language, "clear")}
            </button>

            {activeJobId ? (
              <div style={{ alignSelf: "center", color: "#607089", fontSize: 13, fontWeight: 800 }}>
                {localText(language, "job")}: {activeJobId}
              </div>
            ) : null}
          </div>

          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </div>
      </div>

      <div style={cardStyle()}>
        <SectionTitle>{t(language, "preCheck")}</SectionTitle>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: precheck.lines },
              { label: localText(language, "unique"), value: precheck.unique },
              { label: t(language, "duplicatesIgnored"), value: precheck.duplicates + duplicatesIgnored },
              {
                label: localText(language, "formatIssues"),
                value: precheck.formatIssues,
                tone: precheck.formatIssues ? "invalid" : "valid",
              },
            ]}
          />
        </div>

        <InputDistribution entries={countryEntries} language={language} />
      </div>

      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{t(language, "results")}</SectionTitle>
            <SectionSubtitle>
              {t(language, "showing")} {filteredRows.length} {t(language, "rows")}
            </SectionSubtitle>
          </div>

          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t(language, "searchResults")}
            style={{ ...textInputStyle(), width: 260, minWidth: 220, maxWidth: 260 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: stats.total },
              { label: t(language, "done"), value: stats.done, tone: "valid" },
              { label: t(language, "valid"), value: stats.valid, tone: "valid" },
              { label: t(language, "invalid"), value: stats.invalid, tone: "invalid" },
              { label: t(language, "pending"), value: stats.pending, tone: "pending" },
              { label: t(language, "error"), value: stats.errors, tone: stats.errors ? "error" : "pending" },
            ]}
          />
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 860, borderCollapse: "separate", borderSpacing: "0 8px" }}>
            <thead>
              <tr>
                {[
                  t(language, "state"),
                  t(language, "vat"),
                  t(language, "name"),
                  t(language, "address"),
                  t(language, "case"),
                  t(language, "checkedAt"),
                  t(language, "message"),
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      color: "#0B2E5F",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "0 10px 4px",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row, index) => {
                  const tone = vatStatus(row);

                  return (
                    <tr key={`${(row as any).vat_number || (row as any).input || index}-${index}`}>
                      <td style={{ ...resultCellStyle(tone), borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}>
                        <StatusPill tone={tone}>{statusLabel(language, tone)}</StatusPill>
                      </td>
                      <td style={resultCellStyle(tone)}>{(row as any).vat_number || (row as any).input || ""}</td>
                      <td style={resultCellStyle(tone)}>{(row as any).name || ""}</td>
                      <td style={resultCellStyle(tone)}>{(row as any).address || ""}</td>
                      <td style={resultCellStyle(tone)}>{(row as any).case_ref || caseRef || ""}</td>
                      <td style={resultCellStyle(tone)}>{formatDate((row as any).checked_at, language)}</td>
                      <td style={{ ...resultCellStyle(tone), borderTopRightRadius: 14, borderBottomRightRadius: 14 }}>
                        {(row as any).error_code || (row as any).error || (row as any).format_reason || ""}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ color: "#607089", fontSize: 14, padding: "18px 10px" }}>
                    {t(language, "noResultsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserDraftsPanel
        activePage="vat"
        referenceValue={caseRef}
        inputValue={vatInput}
        language={language}
        onRestoreDraft={restoreDraft}
      />
    </div>
  );
}

function TinPage({
  language,
  onRunCompleted,
  setLastUpdate,
}: {
  language: PortalLanguage;
  onRunCompleted?: (summary: PortalRunSummary) => void;
  setLastUpdate: (value: string) => void;
}) {
  const [country, setCountry] = useState("NL");
  const [tinInput, setTinInput] = useState("");
  const [rows, setRows] = useState<TinRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const currentRunStartedAtRef = useRef<string>("");

  const inputLines = useMemo(() => splitInputLines(tinInput), [tinInput]);

  const normalizedTins = useMemo(() => {
    return uniqueValues(inputLines.map((line) => normalizeTinCandidate(line, country)).filter(Boolean));
  }, [country, inputLines]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [filter, rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((row) => statusTone(row.status) === "valid").length;
    const invalid = rows.filter((row) => statusTone(row.status) === "invalid").length;
    const errors = rows.filter((row) => statusTone(row.status) === "error").length;

    return { total, valid, invalid, errors, pending: 0, done: total };
  }, [rows]);

  useEffect(() => {
    if (!onRunCompleted || !currentRunIdRef.current || !rows.length) return;

    onRunCompleted({
      id: currentRunIdRef.current,
      type: "tin",
      createdAt: currentRunStartedAtRef.current || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      label: "TIN validation run",
      total: stats.total,
      done: stats.done,
      valid: stats.valid,
      invalid: stats.invalid,
      pending: stats.pending,
      errors: stats.errors,
      country,
    });
  }, [country, onRunCompleted, rows.length, stats]);

  useEffect(() => {
    return () => validateAbortRef.current?.abort();
  }, []);

  function cancelValidation() {
    validateAbortRef.current?.abort();
    validateAbortRef.current = null;
    setLoading(false);
  }

  function clearTin() {
    cancelValidation();
    setTinInput("");
    setRows([]);
    setFilter("");
    setError("");
    setLastUpdate("—");
    currentRunIdRef.current = null;
    currentRunStartedAtRef.current = "";
  }

  async function validateTin() {
    if (!normalizedTins.values.length) return;

    setLoading(true);
    setError("");
    setRows([]);

    currentRunIdRef.current = `tin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    currentRunStartedAtRef.current = new Date().toISOString();

    validateAbortRef.current?.abort();
    const controller = new AbortController();
    validateAbortRef.current = controller;

    try {
      const resp = await fetch("/api/tin-validate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, tins: normalizedTins.values }),
        signal: controller.signal,
      });

      const data = await readJson(resp);

      if (!resp.ok) throw new Error(data?.error || data?.message || localText(language, "validationFailed"));

      setRows(Array.isArray(data?.results) ? data.results : []);
      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));
    } catch (err) {
      if ((err as any)?.name !== "AbortError") setError(String((err as Error)?.message || err));
    } finally {
      validateAbortRef.current = null;
      setLoading(false);
    }
  }

  async function importTinFile(file: File) {
    const rawValues = await readTabularFile(file);
    const imported = uniqueValues(rawValues.map((value) => normalizeTinCandidate(value, country)).filter(Boolean)).values;

    if (imported.length) {
      setTinInput(imported.join("\n"));
      setFilter("");
      setError("");
    }
  }

  function exportTinExcel() {
    if (!rows.length) {
      setError(localText(language, "exportEmpty"));
      return;
    }

    const headers = [
      "country",
      "input_tin",
      "tin_number",
      "status",
      "structure_valid",
      "syntax_valid",
      "request_date",
      "message",
    ];

    writeWorkbook(
      `tin_results_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`,
      "TIN Results",
      headers,
      rows.map((row) => headers.map((header) => (row as any)[header] ?? ""))
    );
  }

  function restoreDraft(draft: UserDraft) {
    const restoredCountry = normalizeCountry(draft.referenceValue || country || "NL");

    setCountry(restoredCountry);
    setTinInput(draft.inputValue || "");
    setFilter("");
    setRows([]);
    setError("");
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{t(language, "tinTab")}</SectionTitle>
            <SectionSubtitle>{t(language, "tinInputHelp")}</SectionSubtitle>
          </div>

          <CreditsVisual language={language} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={ACTION_ROW_STYLE}>
            <select value={country} onChange={(event) => setCountry(event.target.value)} style={textInputStyle()}>
              {COUNTRY_OPTIONS.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} — {countryName(item.code, language)}
                </option>
              ))}
            </select>

            <button type="button" onClick={() => importFileRef.current?.click()} style={actionButtonStyle()}>
              {t(language, "importXlsxCsv")}
            </button>

            <button type="button" onClick={exportTinExcel} style={actionButtonStyle(!rows.length)} disabled={!rows.length}>
              {t(language, "exportExcel")}
            </button>
          </div>

          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void importTinFile(file);
            }}
          />

          <InfoBox>{t(language, "tinImportant")}</InfoBox>

          <textarea
            value={tinInput}
            onChange={(event) => setTinInput(event.target.value)}
            placeholder={localText(language, "tinPlaceholder")}
            rows={9}
            style={textareaStyle()}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void validateTin()}
              disabled={loading || !normalizedTins.values.length}
              style={actionButtonStyle(loading || !normalizedTins.values.length, true)}
            >
              {loading ? t(language, "validating") : t(language, "validate")}
            </button>

            <button type="button" onClick={loading ? cancelValidation : clearTin} style={actionButtonStyle()}>
              {loading ? t(language, "cancel") : t(language, "clear")}
            </button>
          </div>

          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </div>
      </div>

      <div style={cardStyle()}>
        <SectionTitle>{t(language, "preCheck")}</SectionTitle>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: inputLines.length },
              { label: localText(language, "unique"), value: normalizedTins.values.length },
              { label: t(language, "duplicatesIgnored"), value: normalizedTins.duplicates },
              { label: t(language, "country"), value: country },
            ]}
          />
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{t(language, "results")}</SectionTitle>
            <SectionSubtitle>
              {t(language, "showing")} {filteredRows.length} {t(language, "rows")}
            </SectionSubtitle>
          </div>

          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t(language, "searchResults")}
            style={{ ...textInputStyle(), width: 260, minWidth: 220, maxWidth: 260 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: stats.total },
              { label: t(language, "valid"), value: stats.valid, tone: "valid" },
              { label: t(language, "invalid"), value: stats.invalid, tone: "invalid" },
              { label: t(language, "error"), value: stats.errors, tone: stats.errors ? "error" : "pending" },
            ]}
          />
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 820, borderCollapse: "separate", borderSpacing: "0 8px" }}>
            <thead>
              <tr>
                {[
                  t(language, "state"),
                  t(language, "country"),
                  t(language, "inputTin"),
                  t(language, "returnedTin"),
                  t(language, "structure"),
                  t(language, "syntax"),
                  t(language, "date"),
                  t(language, "message"),
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      color: "#0B2E5F",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "0 10px 4px",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row, index) => {
                  const tone = statusTone(row.status);

                  return (
                    <tr key={`${row.input_tin || row.tin_number || index}-${index}`}>
                      <td style={{ ...resultCellStyle(tone), borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}>
                        <StatusPill tone={tone}>{statusLabel(language, tone)}</StatusPill>
                      </td>
                      <td style={resultCellStyle(tone)}>{row.country || country}</td>
                      <td style={resultCellStyle(tone)}>{row.input_tin || ""}</td>
                      <td style={resultCellStyle(tone)}>{row.tin_number || ""}</td>
                      <td style={resultCellStyle(tone)}>
                        {row.structure_valid === null || row.structure_valid === undefined
                          ? ""
                          : String(row.structure_valid)}
                      </td>
                      <td style={resultCellStyle(tone)}>
                        {row.syntax_valid === null || row.syntax_valid === undefined ? "" : String(row.syntax_valid)}
                      </td>
                      <td style={resultCellStyle(tone)}>{row.request_date || ""}</td>
                      <td style={{ ...resultCellStyle(tone), borderTopRightRadius: 14, borderBottomRightRadius: 14 }}>
                        {row.message || ""}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ color: "#607089", fontSize: 14, padding: "18px 10px" }}>
                    {t(language, "noResultsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserDraftsPanel
        activePage="tin"
        referenceValue={country}
        inputValue={tinInput}
        language={language}
        onRestoreDraft={restoreDraft}
      />
    </div>
  );
}

function EoriPage({
  language,
  onRunCompleted,
  setLastUpdate,
}: {
  language: PortalLanguage;
  onRunCompleted?: (summary: PortalRunSummary) => void;
  setLastUpdate: (value: string) => void;
}) {
  const [eoriInput, setEoriInput] = useState("");
  const [rows, setRows] = useState<EoriRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const currentRunStartedAtRef = useRef<string>("");

  const inputLines = useMemo(() => splitInputLines(eoriInput), [eoriInput]);

  const preparedEoris = useMemo(() => {
    const normalized = inputLines.map(normalizeEoriCandidate).filter(Boolean);
    return uniqueValues(normalized);
  }, [inputLines]);

  const formatIssues = useMemo(() => {
    return preparedEoris.values.filter((value) => !validateEoriFormat(value).ok).length;
  }, [preparedEoris.values]);

  const validInputEoris = useMemo(() => {
    return preparedEoris.values.filter((value) => validateEoriFormat(value).ok);
  }, [preparedEoris.values]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  }, [filter, rows]);

  const retryEoriLines = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const row of rows) {
      if (eoriStatus(row) !== "error") continue;

      const eori = normalizeEoriCandidate(row.input_eori || row.eori || "");
      if (!eori || seen.has(eori)) continue;

      seen.add(eori);
      out.push(eori);
    }

    return out;
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((row) => eoriStatus(row) === "valid").length;
    const invalid = rows.filter((row) => eoriStatus(row) === "invalid").length;
    const errors = rows.filter((row) => eoriStatus(row) === "error").length;

    return { total, valid, invalid, errors, pending: 0, done: total };
  }, [rows]);

  useEffect(() => {
    if (!onRunCompleted || !currentRunIdRef.current || !rows.length) return;

    onRunCompleted({
      id: currentRunIdRef.current,
      type: "eori" as any,
      createdAt: currentRunStartedAtRef.current || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      label: "EORI validation run",
      total: stats.total,
      done: stats.done,
      valid: stats.valid,
      invalid: stats.invalid,
      pending: stats.pending,
      errors: stats.errors,
      formatIssues,
      country: "GB",
    });
  }, [formatIssues, onRunCompleted, rows.length, stats]);

  useEffect(() => {
    return () => validateAbortRef.current?.abort();
  }, []);

  function cancelValidation() {
    validateAbortRef.current?.abort();
    validateAbortRef.current = null;
    setLoading(false);
  }

  function clearEori() {
    cancelValidation();
    setEoriInput("");
    setRows([]);
    setFilter("");
    setError("");
    setLastUpdate("—");
    currentRunIdRef.current = null;
    currentRunStartedAtRef.current = "";
  }

  async function validateEori(inputOverride?: string[]) {
    const eoris = inputOverride || validInputEoris;
    if (!eoris.length) return;

    setLoading(true);
    setError("");
    setRows([]);

    currentRunIdRef.current = `eori-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    currentRunStartedAtRef.current = new Date().toISOString();

    validateAbortRef.current?.abort();
    const controller = new AbortController();
    validateAbortRef.current = controller;

    try {
      const resp = await fetch("/api/eori-validate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoris }),
        signal: controller.signal,
      });

      const data = await readJson(resp);

      if (!resp.ok) throw new Error(data?.error || data?.message || localText(language, "validationFailed"));

      setRows(Array.isArray(data?.results) ? data.results : []);
      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));
    } catch (err) {
      if ((err as any)?.name !== "AbortError") setError(String((err as Error)?.message || err));
    } finally {
      validateAbortRef.current = null;
      setLoading(false);
    }
  }

  async function importEoriFile(file: File) {
    const rawValues = await readTabularFile(file);
    const imported = uniqueValues(rawValues.map(normalizeEoriCandidate).filter(Boolean)).values;

    if (imported.length) {
      setEoriInput(imported.join("\n"));
      setFilter("");
      setError("");
    }
  }

  function exportEoriExcel() {
    if (!rows.length) {
      setError(localText(language, "exportEmpty"));
      return;
    }

    const headers = ["input_eori", "eori", "status", "valid", "trader_name", "address", "processing_date", "message"];

    writeWorkbook(
      `eori_results_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`,
      "EORI Results",
      headers,
      rows.map((row) =>
        headers.map((header) => {
          const value = (row as any)[header];
          if (header === "address") return displayValue(value);
          return value ?? "";
        })
      )
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{localText(language, "eoriTab")}</SectionTitle>
            <SectionSubtitle>{localText(language, "eoriInputHelp")}</SectionSubtitle>
          </div>

          <CreditsVisual language={language} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={ACTION_ROW_STYLE}>
            <input value="GB EORI" readOnly style={{ ...textInputStyle(), opacity: 0.92 }} />

            <button type="button" onClick={() => importFileRef.current?.click()} style={actionButtonStyle()}>
              {t(language, "importXlsxCsv")}
            </button>

            <button type="button" onClick={exportEoriExcel} style={actionButtonStyle(!rows.length)} disabled={!rows.length}>
              {t(language, "exportExcel")}
            </button>
          </div>

          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void importEoriFile(file);
            }}
          />

          <InfoBox>{localText(language, "eoriImportant")}</InfoBox>

          <textarea
            value={eoriInput}
            onChange={(event) => setEoriInput(event.target.value)}
            placeholder={localText(language, "eoriPlaceholder")}
            rows={9}
            style={textareaStyle()}
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void validateEori()}
              disabled={loading || !validInputEoris.length}
              style={actionButtonStyle(loading || !validInputEoris.length, true)}
            >
              {loading ? t(language, "validating") : t(language, "validate")}
            </button>

            <button type="button" onClick={loading ? cancelValidation : clearEori} style={actionButtonStyle()}>
              {loading ? t(language, "cancel") : t(language, "clear")}
            </button>

            <button
              type="button"
              onClick={() => void validateEori(retryEoriLines)}
              disabled={loading || !retryEoriLines.length}
              style={actionButtonStyle(loading || !retryEoriLines.length)}
            >
              {localText(language, "retryUnresolved")}
            </button>
          </div>

          {error ? <ErrorBox>{error}</ErrorBox> : null}
        </div>
      </div>

      <div style={cardStyle()}>
        <SectionTitle>{t(language, "preCheck")}</SectionTitle>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: inputLines.length },
              { label: localText(language, "unique"), value: preparedEoris.values.length },
              { label: t(language, "duplicatesIgnored"), value: preparedEoris.duplicates },
              {
                label: localText(language, "formatIssues"),
                value: formatIssues,
                tone: formatIssues ? "invalid" : "valid",
              },
            ]}
          />
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
          <div>
            <SectionTitle>{t(language, "results")}</SectionTitle>
            <SectionSubtitle>
              {t(language, "showing")} {filteredRows.length} {t(language, "rows")}
            </SectionSubtitle>
          </div>

          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t(language, "searchResults")}
            style={{ ...textInputStyle(), width: 260, minWidth: 220, maxWidth: 260 }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <MetricGrid
            items={[
              { label: t(language, "total"), value: stats.total },
              { label: t(language, "valid"), value: stats.valid, tone: "valid" },
              { label: t(language, "invalid"), value: stats.invalid, tone: "invalid" },
              { label: t(language, "error"), value: stats.errors, tone: stats.errors ? "error" : "pending" },
            ]}
          />
        </div>

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 860, borderCollapse: "separate", borderSpacing: "0 8px" }}>
            <thead>
              <tr>
                {[
                  t(language, "state"),
                  localText(language, "inputEori"),
                  localText(language, "eori"),
                  localText(language, "traderName"),
                  t(language, "address"),
                  localText(language, "processingDate"),
                  t(language, "message"),
                ].map((header) => (
                  <th
                    key={header}
                    style={{
                      textAlign: "left",
                      color: "#0B2E5F",
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "0 10px 4px",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row, index) => {
                  const tone = eoriStatus(row);

                  return (
                    <tr key={`${row.eori || row.input_eori || index}-${index}`}>
                      <td style={{ ...resultCellStyle(tone), borderTopLeftRadius: 14, borderBottomLeftRadius: 14 }}>
                        <StatusPill tone={tone}>{statusLabel(language, tone)}</StatusPill>
                      </td>
                      <td style={resultCellStyle(tone)}>{row.input_eori || ""}</td>
                      <td style={resultCellStyle(tone)}>{row.eori || ""}</td>
                      <td style={resultCellStyle(tone)}>{row.trader_name || ""}</td>
                      <td style={resultCellStyle(tone)}>{displayValue(row.address)}</td>
                      <td style={resultCellStyle(tone)}>{row.processing_date || ""}</td>
                      <td style={{ ...resultCellStyle(tone), borderTopRightRadius: 14, borderBottomRightRadius: 14 }}>
                        {row.message || ""}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ color: "#607089", fontSize: 14, padding: "18px 10px" }}>
                    {t(language, "noResultsYet")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ToolApp({ branding: brandingProp, onRunCompleted }: ToolAppProps) {
  const branding = { ...DEFAULT_BRANDING, ...(brandingProp || {}) };
  const [activePage, setActivePage] = useState<ActivePage>("vat");
  const [language, setLanguage] = useState<PortalLanguage>(() => getStoredLanguage());
  const [lastUpdate, setLastUpdate] = useState("—");

  useEffect(() => {
    storeLanguage(language);
  }, [language]);

  useEffect(() => {
    setLastUpdate("—");
  }, [activePage]);

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: 22,
        background: branding.backgroundColor || DEFAULT_BRANDING.backgroundColor,
        color: branding.textColor || DEFAULT_BRANDING.textColor,
        fontFamily: PORTAL_FONT,
      }}
    >
      <div style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 18 }}>
        <PortalBanner
          branding={branding}
          activePage={activePage}
          setActivePage={setActivePage}
          language={language}
          setLanguage={setLanguage}
          lastUpdate={lastUpdate}
        />

        {activePage === "vat" ? (
          <VatPage language={language} onRunCompleted={onRunCompleted} setLastUpdate={setLastUpdate} />
        ) : activePage === "tin" ? (
          <TinPage language={language} onRunCompleted={onRunCompleted} setLastUpdate={setLastUpdate} />
        ) : (
          <EoriPage language={language} onRunCompleted={onRunCompleted} setLastUpdate={setLastUpdate} />
        )}
      </div>
    </div>
  );
}
