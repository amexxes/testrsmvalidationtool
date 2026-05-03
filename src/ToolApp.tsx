// /src/ToolApp.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import ReactCountryFlag from "react-country-flag";
import type { FrJobResponse, ValidateBatchResponse, VatRow } from "./types";
import type { PortalRunSummary } from "./portalRunHistory";
import * as XLSX from "xlsx";
import UserDraftsPanel from "./UserDraftsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LANGUAGES,
  getStoredLanguage,
  storeLanguage,
  t,
  type PortalLanguage,
} from "./i18n";

type SortState = { colIndex: number | null; asc: boolean };
type ActivePage = "vat" | "tin";

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

const PAGE_TITLE_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 20,
  lineHeight: 1.2,
  fontWeight: 700,
  color: "#0B2E5F",
  margin: 0,
};

const PAGE_SUBTITLE_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 500,
  color: "#0B2E5F",
  marginTop: 6,
};

const SMALL_HEADER_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 800,
  color: "#0B2E5F",
};

const TABLE_HEADER_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 800,
  color: "#0B2E5F",
};

const TABLE_META_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 500,
};

const TH_STYLE: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 800,
  letterSpacing: "0.02em",
  color: "#0B2E5F",
  cursor: "pointer",
};

const ACTION_FIRST_FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  height: 38,
  minHeight: 38,
  boxSizing: "border-box",
  display: "block",
};

const ACTION_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 150px 150px",
  alignItems: "center",
  gap: 10,
  width: "100%",
  height: 38,
};

const ACTION_BUTTON_STYLE: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  height: 38,
  minHeight: 38,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  whiteSpace: "nowrap",
  lineHeight: "38px",
  paddingTop: 0,
  paddingBottom: 0,
  alignSelf: "center",
};

const BANNER_INNER_STYLE: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "nowrap",
  padding: "18px 22px",
};

const BANNER_LEFT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  minWidth: 0,
  flex: "0 1 360px",
  maxWidth: 360,
};

const BANNER_RIGHT_STYLE: React.CSSProperties = {
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
};

const BANNER_STATUS_BAR_STYLE: React.CSSProperties = {
  height: 36,
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "nowrap",
  gap: 8,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(11,46,95,0.10)",
  background: "rgba(255,255,255,0.82)",
  color: "#0B2E5F",
  fontFamily: PORTAL_FONT,
  fontSize: 12,
  lineHeight: "36px",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

const BANNER_STATUS_ITEM_STYLE: React.CSSProperties = {
  height: 36,
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 5,
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

const BANNER_STATUS_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 600,
  opacity: 0.72,
  whiteSpace: "nowrap",
};

const BANNER_STATUS_VALUE_STYLE: React.CSSProperties = {
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const BANNER_DOT_STYLE: React.CSSProperties = {
  opacity: 0.35,
  whiteSpace: "nowrap",
};

const BANNER_CONTROL_STYLE: React.CSSProperties = {
  height: 36,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  flex: "0 0 auto",
};

type PageSwitcherProps = {
  activePage: ActivePage;
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>;
  language: PortalLanguage;
};

type BrandedPageProps = {
  activePage: ActivePage;
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>;
  branding: ClientBranding;
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
  onRunCompleted?: (summary: PortalRunSummary) => void;
};

type LanguageSwitcherProps = {
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
};

type PortalBannerProps = {
  title: string;
  modeValue: string;
  meta: { label: string; value: string }[];
  activePage: ActivePage;
  setActivePage: React.Dispatch<React.SetStateAction<ActivePage>>;
  branding: ClientBranding;
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
};

const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  AT: { lat: 48.2082, lon: 16.3738 },
  BE: { lat: 50.8503, lon: 4.3517 },
  BG: { lat: 42.6977, lon: 23.3219 },
  CY: { lat: 35.1856, lon: 33.3823 },
  CZ: { lat: 50.0755, lon: 14.4378 },
  DE: { lat: 52.52, lon: 13.405 },
  DK: { lat: 55.6761, lon: 12.5683 },
  EE: { lat: 59.437, lon: 24.7536 },
  EL: { lat: 37.9838, lon: 23.7275 },
  ES: { lat: 40.4168, lon: -3.7038 },
  FI: { lat: 60.1699, lon: 24.9384 },
  FR: { lat: 48.8566, lon: 2.3522 },
  HR: { lat: 45.815, lon: 15.9819 },
  HU: { lat: 47.4979, lon: 19.0402 },
  IE: { lat: 53.3498, lon: -6.2603 },
  IT: { lat: 41.9028, lon: 12.4964 },
  LT: { lat: 54.6872, lon: 25.2797 },
  LU: { lat: 49.6116, lon: 6.1319 },
  LV: { lat: 56.9496, lon: 24.1052 },
  MT: { lat: 35.8989, lon: 14.5146 },
  NL: { lat: 52.3676, lon: 4.9041 },
  PL: { lat: 52.2297, lon: 21.0122 },
  PT: { lat: 38.7223, lon: -9.1393 },
  RO: { lat: 44.4268, lon: 26.1025 },
  SE: { lat: 59.3293, lon: 18.0686 },
  SI: { lat: 46.0569, lon: 14.5058 },
  SK: { lat: 48.1486, lon: 17.1077 },
  XI: { lat: 54.5973, lon: -5.9301 },
};

const ERROR_MAP: Record<string, Partial<Record<PortalLanguage, string>> & { en: string }> = {
  MS_MAX_CONCURRENT_REQ: {
    en: "Member State has too many concurrent checks; we will try again later.",
    nl: "De lidstaat heeft te veel gelijktijdige controles; we proberen het later opnieuw.",
    de: "Der Mitgliedstaat hat zu viele gleichzeitige Prüfungen; wir versuchen es später erneut.",
    fr: "L’État membre a trop de contrôles simultanés ; nous réessaierons plus tard.",
  },
  MS_UNAVAILABLE: {
    en: "Member State is temporarily unavailable; we will try again later.",
    nl: "De lidstaat is tijdelijk niet beschikbaar; we proberen het later opnieuw.",
    de: "Der Mitgliedstaat ist vorübergehend nicht verfügbar; wir versuchen es später erneut.",
    fr: "L’État membre est temporairement indisponible ; nous réessaierons plus tard.",
  },
  TIMEOUT: {
    en: "Timeout when calling VIES; we will try again later.",
    nl: "Timeout bij het aanroepen van VIES; we proberen het later opnieuw.",
    de: "Zeitüberschreitung beim Aufruf von VIES; wir versuchen es später erneut.",
    fr: "Délai dépassé lors de l’appel à VIES ; nous réessaierons plus tard.",
  },
  GLOBAL_MAX_CONCURRENT_REQ: {
    en: "VIES is busy; we will try again later.",
    nl: "VIES is druk; we proberen het later opnieuw.",
    de: "VIES ist ausgelastet; wir versuchen es später erneut.",
    fr: "VIES est occupé ; nous réessaierons plus tard.",
  },
  SERVICE_UNAVAILABLE: {
    en: "VIES service is unavailable; we will try again later.",
    nl: "De VIES-service is niet beschikbaar; we proberen het later opnieuw.",
    de: "Der VIES-Dienst ist nicht verfügbar; wir versuchen es später erneut.",
    fr: "Le service VIES est indisponible ; nous réessaierons plus tard.",
  },
  NETWORK_ERROR: {
    en: "Network error when calling VIES; we will try again later.",
    nl: "Netwerkfout bij het aanroepen van VIES; we proberen het later opnieuw.",
    de: "Netzwerkfehler beim Aufruf von VIES; wir versuchen es später erneut.",
    fr: "Erreur réseau lors de l’appel à VIES ; nous réessaierons plus tard.",
  },
};

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

type RowState = "valid" | "invalid" | "retry" | "queued" | "processing" | "error";

type ImportPreviewData = {
  totalFound: number;
  readyCount: number;
  duplicatesRemoved: number;
  skippedCount: number;
  prefixRemoved?: number;
  columnLabel: string;
  examples: string[];
  payloadText: string;
};

type ParsedImportFileValues = {
  values: string[];
  totalFound: number;
  columnLabel: string;
};

function normalizeLine(s: string): string {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function normalizeVatCandidate(v: string): string {
  let n = normalizeLine(v);
  if (n.startsWith("GR")) n = "EL" + n.slice(2);
  return n;
}

function normalizeTsMs(ts: any): number | undefined {
  const n = typeof ts === "number" ? ts : Number(ts);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 1_000_000_000_000) return n * 1000;
  return n;
}

function rowKeyStable(r: Partial<VatRow>, fallbackIdx?: number): string {
  const vat = String((r as any).vat_number || "").trim();
  const input = String((r as any).input || "").trim();
  const cc = String((r as any).country_code || "").trim();
  const part = String((r as any).vat_part || "").trim();

  if (vat) return `vat:${normalizeVatCandidate(vat)}`;
  if (input) return `in:${normalizeVatCandidate(input)}`;
  if (cc || part) return `cc:${cc}:${part}`;
  return `idx:${fallbackIdx ?? 0}`;
}

function stateClass(state?: string): string {
  const s = String(state || "").toLowerCase();
  if (["valid", "invalid", "retry", "queued", "processing", "error"].includes(s)) return s;
  return "queued";
}

function stateLabel(state: string | undefined, language: PortalLanguage): string {
  const s = String(state || "").toLowerCase();

  if (s === "valid") return t(language, "valid");
  if (s === "invalid") return t(language, "invalid");
  if (s === "queued") return t(language, "pending");
  if (s === "processing") return t(language, "pending");
  if (s === "error") return t(language, "error");

  if (s === "retry") {
    if (language === "nl") return "Opnieuw";
    if (language === "de") return "Erneut";
    if (language === "fr") return "Réessai";
    return "Retry";
  }

  return s || "unknown";
}

function humanError(code?: string, fallback?: string, language: PortalLanguage = "en") {
  const c = (code || "").trim();
  const mapped = ERROR_MAP[c];

  if (mapped) {
    return mapped[language] || mapped.en;
  }

  return fallback || c || "";
}

function localText(language: PortalLanguage, key: string): string {
  const copy: Record<string, Record<string, string>> = {
    en: {
      unique: "unique",
      lines: "lines",
      duplicates: "duplicates",
      formatIssues: "format issues",
      countries: "countries",
      mapUnavailable: "Map unavailable",
      eta: "ETA",
      bad: "Bad",
      ok: "OK",
      asc: "asc",
      desc: "desc",
      tinValidationFailed: "TIN validation failed",
      vatInfographic: "VAT validation — infographic",
      retryUnresolved: "Retry unresolved",
    },
    nl: {
      unique: "uniek",
      lines: "regels",
      duplicates: "duplicaten",
      formatIssues: "formaatproblemen",
      countries: "landen",
      mapUnavailable: "Kaart niet beschikbaar",
      eta: "ETA",
      bad: "Fout",
      ok: "OK",
      asc: "oplopend",
      desc: "aflopend",
      tinValidationFailed: "TIN-validatie mislukt",
      vatInfographic: "VAT-validatie — infographic",
      retryUnresolved: "Opnieuw proberen",
    },
    de: {
      unique: "eindeutig",
      lines: "Zeilen",
      duplicates: "Duplikate",
      formatIssues: "Formatprobleme",
      countries: "Länder",
      mapUnavailable: "Karte nicht verfügbar",
      eta: "ETA",
      bad: "Fehlerhaft",
      ok: "OK",
      asc: "aufsteigend",
      desc: "absteigend",
      tinValidationFailed: "TIN-Prüfung fehlgeschlagen",
      vatInfographic: "VAT-Prüfung — Infografik",
      retryUnresolved: "Offene erneut versuchen",
    },
    fr: {
      unique: "uniques",
      lines: "lignes",
      duplicates: "doublons",
      formatIssues: "problèmes de format",
      countries: "pays",
      mapUnavailable: "Carte indisponible",
      eta: "ETA",
      bad: "Incorrect",
      ok: "OK",
      asc: "croissant",
      desc: "décroissant",
      tinValidationFailed: "Échec de la validation TIN",
      vatInfographic: "Validation VAT — infographie",
      retryUnresolved: "Réessayer les non résolus",
    },
  };

  return copy[language]?.[key] || copy.en[key] || key;
}

function formatEta(ts?: number) {
  if (!ts) return "";
  const diff = Math.max(0, ts - Date.now());
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

function validateFormatStrict(vatNumberWithPrefix: string) {
  const v = normalizeVatCandidate(vatNumberWithPrefix);
  if (v.length < 3) return { ok: false, reason: "Too short" };

  const cc = v.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(cc)) return { ok: false, reason: "Missing country prefix" };

  const rest = v.slice(2);
  if (!rest) return { ok: false, reason: "Missing VAT digits" };
  if (!/^[A-Z0-9]+$/.test(rest)) return { ok: false, reason: "Invalid characters" };

  const re = VAT_PATTERNS[cc];
  if (re && !re.test(rest)) return { ok: false, reason: `Invalid format for ${cc}` };

  return { ok: true, reason: "" };
}

function validateFormat(vatNumberWithPrefix: string) {
  const v = normalizeLine(vatNumberWithPrefix);
  if (v.length < 3) return { ok: false, reason: "Too short" };
  const cc = v.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(cc)) return { ok: false, reason: "Missing country prefix" };
  const rest = v.slice(2);
  if (!rest) return { ok: false, reason: "Missing VAT digits" };
  if (!/^[A-Z0-9]+$/.test(rest)) return { ok: false, reason: "Invalid characters" };
  return { ok: true, reason: "" };
}

function excelColumnName(index: number): string {
  let n = index + 1;
  let out = "";

  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }

  return out;
}

function isLikelyImportHeader(value: string): boolean {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]/g, "");

  return [
    "vat",
    "vatnumber",
    "btwnummer",
    "btw",
    "tin",
    "tinnumber",
    "inputtin",
    "taxnumber",
    "taxidentificationnumber",
    "number",
    "nummer",
  ].includes(v);
}

async function readImportFileValues(
  file: File,
  isUsefulValue: (value: string) => boolean
): Promise<ParsedImportFileValues> {
  const name = (file.name || "").toLowerCase();
  const isCsvLike = name.endsWith(".csv") || name.endsWith(".txt");

  if (isCsvLike) {
    const text = await file.text();

    const values = text
      .split(/\r?\n|,|;|\t/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    return {
      values,
      totalFound: values.length,
      columnLabel: "CSV/TXT",
    };
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheetName = wb.SheetNames?.[0];
  const ws = firstSheetName ? wb.Sheets[firstSheetName] : null;

  if (!ws) {
    return {
      values: [],
      totalFound: 0,
      columnLabel: "—",
    };
  }

  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: "",
  }) as any[][];

  const maxCols = aoa.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);

  let bestCol = 0;
  let bestScore = -1;
  let bestFilled = -1;
  let bestValues: string[] = [];

  for (let col = 0; col < maxCols; col++) {
    const values = aoa
      .map((row) => String(row?.[col] ?? "").trim())
      .filter(Boolean);

    const score = values.reduce((sum, value) => sum + (isUsefulValue(value) ? 1 : 0), 0);

    if (score > bestScore || (score === bestScore && values.length > bestFilled)) {
      bestCol = col;
      bestScore = score;
      bestFilled = values.length;
      bestValues = values;
    }
  }

  return {
    values: bestValues,
    totalFound: bestValues.length,
    columnLabel: `Sheet 1, kolom ${excelColumnName(bestCol)}`,
  };
}

function isRetryableError(codeOrError?: string, details?: string) {
  const c = String(codeOrError || "").trim().toUpperCase();
  const d = String(details || "").toLowerCase();

  if (
    c === "NETWORK_ERROR" ||
    c === "TIMEOUT" ||
    c === "SERVICE_UNAVAILABLE" ||
    c === "GLOBAL_MAX_CONCURRENT_REQ" ||
    c === "MS_MAX_CONCURRENT_REQ" ||
    c === "MS_UNAVAILABLE"
  ) {
    return true;
  }

  if (d.includes("abort") || d.includes("aborted") || d.includes("timeout")) return true;

  return false;
}

function displayState(r: VatRow): RowState {
  const raw = String((r as any).state || "").toLowerCase();
  const v = (r as any).valid;

  if (raw === "error") return "error";
  if (typeof v === "boolean") return v ? "valid" : "invalid";

  const errorCode = String((r as any).error_code || "").trim();
  const errorText = String((r as any).error || "").trim();
  const details = String((r as any).details || "").trim();

  const retryable = isRetryableError(errorCode || errorText, details);

  if ((raw === "queued" || raw === "processing") && retryable) return "retry";

  const hasResult = Boolean(String((r as any).name || "").trim() || String((r as any).address || "").trim());
  if (raw === "retry" && hasResult && !errorCode && !errorText) return "valid";

  if (
    raw === "valid" ||
    raw === "invalid" ||
    raw === "retry" ||
    raw === "queued" ||
    raw === "processing"
  ) {
    return raw as RowState;
  }

  return "queued";
}

function vatInputFromRow(r: VatRow): string {
  const direct = String((r as any).vat_number || (r as any).input || "").trim();
  if (direct) return normalizeVatCandidate(direct);

  const cc = String((r as any).country_code || "").trim().toUpperCase();
  const part = String((r as any).vat_part || "").trim();

  if (cc && part) return normalizeVatCandidate(`${cc}${part}`);
  return "";
}

function computeCountryCountsFromInput(text: string): Record<string, number> {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const seen = new Set<string>();
  const counts: Record<string, number> = {};

  for (const line of lines) {
    const v = normalizeLine(line);
    if (!v || v.length < 2) continue;

    let cc = v.slice(0, 2);
    if (!/^[A-Z]{2}$/.test(cc)) continue;
    if (cc === "GR") cc = "EL";

    const key = cc + v.slice(2);
    if (seen.has(key)) continue;
    seen.add(key);

    counts[cc] = (counts[cc] || 0) + 1;
  }

  return counts;
}

function vatCcToIso2ForFlag(ccRaw: string): string {
  let cc = String(ccRaw || "").toUpperCase().trim();
  if (cc === "EL") cc = "GR";
  if (cc === "XI") cc = "GB";
  return cc;
}

function localeForLanguage(language: PortalLanguage): string {
  if (language === "nl") return "nl-NL";
  if (language === "de") return "de-DE";
  if (language === "fr") return "fr-FR";
  return "en-GB";
}

function countryName(code: string, language: PortalLanguage): string {
  const displayCode = code === "EL" ? "GR" : code;

  try {
    const DisplayNames = (Intl as any).DisplayNames;
    if (!DisplayNames) return code;

    const names = new DisplayNames([localeForLanguage(language)], { type: "region" });
    return names.of(displayCode) || code;
  } catch {
    return code;
  }
}

function InputCountryBarChart({
  inputEntries,
  maxInputCount,
  language,
}: {
  inputEntries: Array<[string, number]>;
  maxInputCount: number;
  language: PortalLanguage;
}) {
  if (!inputEntries.length) return null;

  const total = inputEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ ...SMALL_HEADER_STYLE, fontSize: 12 }}>{t(language, "inputByCountry")}</div>
        <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {total} {t(language, "total").toLowerCase()}
        </div>
      </div>

      <div style={{ maxHeight: 150, overflow: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {inputEntries.map(([cc, n]) => {
          const pct = maxInputCount ? (n / maxInputCount) * 100 : 0;
          const iso2 = vatCcToIso2ForFlag(cc);

          return (
            <div
              key={cc}
              style={{
                display: "grid",
                gridTemplateColumns: "92px 1fr 34px",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ReactCountryFlag
                  countryCode={iso2}
                  svg
                  style={{ width: "18px", height: "14px", borderRadius: 3 }}
                  title={cc}
                />
                <span className="mono nowrap">{cc}</span>
              </div>

              <div
                title={`${cc}: ${n}`}
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.10)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, rgba(43,179,230,0.85), rgba(11,46,95,0.85))",
                  }}
                />
              </div>

              <div className="mono" style={{ textAlign: "right" }}>
                {n}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageSwitcher({ activePage, setActivePage, language }: PageSwitcherProps) {
  return (
    <div
      style={{
        height: 36,
        display: "inline-grid",
        gridTemplateColumns: "max-content max-content",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 3,
        borderRadius: 999,
        background: "rgba(255,255,255,0.82)",
        border: "1px solid rgba(226,232,240,0.95)",
        boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      <Button
        type="button"
        variant={activePage === "vat" ? "primary" : "secondary"}
        size="sm"
        onClick={() => setActivePage("vat")}
        style={{
          height: 28,
          minWidth: 148,
          padding: "0 12px",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {t(language, "vatTab")}
      </Button>

      <Button
        type="button"
        variant={activePage === "tin" ? "primary" : "secondary"}
        size="sm"
        onClick={() => setActivePage("tin")}
        style={{
          height: 28,
          minWidth: 112,
          padding: "0 12px",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {t(language, "tinTab")}
      </Button>
    </div>
  );
}

function LanguageSwitcher({ language, setLanguage }: LanguageSwitcherProps) {
  return (
    <div
      style={{
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: 4,
        borderRadius: 999,
        border: "1px solid rgba(11,46,95,0.10)",
        background: "rgba(255,255,255,0.76)",
        boxShadow: "0 8px 22px rgba(11,46,95,0.045)",
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
      aria-label="Language selector"
    >
      {LANGUAGES.map((item) => {
        const active = item.code === language;

        return (
          <button
            key={item.code}
            type="button"
            onClick={() => setLanguage(item.code)}
            style={{
              height: 28,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: 0,
              borderRadius: 999,
              padding: "0 9px",
              background: active ? "rgba(11,46,95,0.96)" : "transparent",
              color: active ? "#fff" : "#0B2E5F",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function PortalBanner({
  title,
  modeValue,
  meta = [],
  activePage,
  setActivePage,
  branding = DEFAULT_BRANDING,
  language,
  setLanguage,
}: PortalBannerProps) {
  const logoUrl = branding.logoUrl || DEFAULT_BRANDING.logoUrl;
  const logoAlt = `${branding.clientName || "RSM"} logo`;

  const statusItems = [{ label: t(language, "mode"), value: modeValue }, ...meta];

  return (
    <div className="banner">
      <div className="banner-accent" />

      <div style={BANNER_INNER_STYLE}>
        <div style={BANNER_LEFT_STYLE}>
          <div
            className="mark"
            aria-hidden="true"
            style={{
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 152,
              flex: "0 0 auto",
            }}
          >
            <img
              src={logoUrl}
              alt={logoAlt}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/rsmlogo.png";
              }}
              style={{
                maxWidth: 150,
                maxHeight: 58,
                objectFit: "contain",
              }}
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              className="title"
              style={{
                ...PAGE_TITLE_STYLE,
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Validation Portal
            </div>
          </div>
        </div>

        <div style={BANNER_RIGHT_STYLE}>
          <div style={BANNER_STATUS_BAR_STYLE}>
            {statusItems.map((item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                {index > 0 && <span style={BANNER_DOT_STYLE}>•</span>}

                <span style={BANNER_STATUS_ITEM_STYLE}>
                  <span style={BANNER_STATUS_LABEL_STYLE}>{item.label}</span>
                  <b style={BANNER_STATUS_VALUE_STYLE}>{item.value}</b>
                </span>
              </React.Fragment>
            ))}
          </div>

          <div style={BANNER_CONTROL_STYLE}>
            <LanguageSwitcher language={language} setLanguage={setLanguage} />
          </div>

          <div style={BANNER_CONTROL_STYLE}>
            <PageSwitcher activePage={activePage} setActivePage={setActivePage} language={language} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; tone?: "default" | "ok" | "bad" | "warn" }>;
}) {
  return (
    <div className="stats">
      {items.map((item) => (
        <div className="stat" key={item.label}>
          <span>{item.label}</span>
          <b
            style={{
              color:
                item.tone === "ok"
                  ? "var(--ok)"
                  : item.tone === "bad"
                    ? "var(--bad)"
                    : item.tone === "warn"
                      ? "var(--warn)"
                      : "var(--text)",
            }}
          >
            {item.value}
          </b>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <CardTitle style={PAGE_TITLE_STYLE}>{children}</CardTitle>;
}

function SectionSubtitle({
  children,
  maxWidth = 760,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return <CardDescription style={{ ...PAGE_SUBTITLE_STYLE, maxWidth }}>{children}</CardDescription>;
}

function ImportPreviewPanel({
  preview,
  language,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreviewData;
  language: PortalLanguage;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const labels: Record<string, Record<string, string>> = {
    en: {
      title: "Import preview",
      ready: "ready for import",
      found: "found",
      duplicates: "duplicates removed",
      skipped: "rows skipped",
      prefixes: "country codes removed",
      column: "Column used",
      example: "Example",
      confirm: "Confirm import",
    },
    nl: {
      title: "Importvoorbeeld",
      ready: "klaar voor import",
      found: "gevonden",
      duplicates: "duplicaten verwijderd",
      skipped: "regels overgeslagen",
      prefixes: "landcodes verwijderd",
      column: "Gebruikte kolom",
      example: "Voorbeeld",
      confirm: "Import bevestigen",
    },
    de: {
      title: "Importvorschau",
      ready: "bereit für Import",
      found: "gefunden",
      duplicates: "Duplikate entfernt",
      skipped: "Zeilen übersprungen",
      prefixes: "Ländercodes entfernt",
      column: "Verwendete Spalte",
      example: "Beispiel",
      confirm: "Import bestätigen",
    },
    fr: {
      title: "Aperçu de l’import",
      ready: "prêt pour l’import",
      found: "trouvé",
      duplicates: "doublons supprimés",
      skipped: "lignes ignorées",
      prefixes: "codes pays supprimés",
      column: "Colonne utilisée",
      example: "Exemple",
      confirm: "Confirmer l’import",
    },
  };

  const copy = labels[language] || labels.en;

  return (
    <div className="callout" style={{ marginTop: 12 }}>
      <div style={SMALL_HEADER_STYLE}>{copy.title}</div>

      <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
        <b>{preview.readyCount}</b> {copy.ready} · <b>{preview.totalFound}</b> {copy.found} ·{" "}
        <b>{preview.duplicatesRemoved}</b> {copy.duplicates} · <b>{preview.skippedCount}</b> {copy.skipped}
        {typeof preview.prefixRemoved === "number" && preview.prefixRemoved > 0
          ? ` · ${preview.prefixRemoved} ${copy.prefixes}`
          : ""}
      </div>

      <div className="mono" style={{ marginTop: 8, fontSize: 12 }}>
        {copy.column}: {preview.columnLabel}
      </div>

      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>{copy.example}</div>

      <div className="mono" style={{ marginTop: 4, fontSize: 12, whiteSpace: "pre-wrap" }}>
        {preview.examples.length ? preview.examples.join("\n") : "—"}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t(language, "cancel")}
        </Button>

        <Button variant="primary" size="sm" onClick={onConfirm} disabled={!preview.readyCount}>
          {copy.confirm}
        </Button>
      </div>
    </div>
  );
}

function VatPage({
  activePage,
  setActivePage,
  branding,
  language,
  setLanguage,
  onRunCompleted,
}: BrandedPageProps) {
  const [vatInput, setVatInput] = useState<string>("");
  const [caseRef, setCaseRef] = useState<string>("");
  const [filter, setFilter] = useState<string>("");

  const [rows, setRows] = useState<VatRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [duplicatesIgnored, setDuplicatesIgnored] = useState(0);
  const [viesStatus, setViesStatus] = useState<Array<{ countryCode: string; availability: string }>>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);

  const [, setFrText] = useState("-");
  const [lastUpdate, setLastUpdate] = useState("-");
  const [progressText, setProgressText] = useState("0/0");

  const [sortState, setSortState] = useState<SortState>({ colIndex: null, asc: true });
  const [sortLabel, setSortLabel] = useState<string>("");

  const [mapLegend, setMapLegend] = useState("—");
  const [mapCount, setMapCount] = useState(`0 ${localText(language, "countries")}`);
  const [mapGeoVersion, setMapGeoVersion] = useState(0);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const [activeFrJobId, setActiveFrJobId] = useState<string | null>(null);

  const currentRunIdRef = useRef<string | null>(null);
  const currentRunStartedAtRef = useRef<string>("");

  const [notes, setNotes] = useState<Record<string, { note: string; tag: "whitelist" | "blacklist" | "" }>>(() => {
    try {
      return JSON.parse(localStorage.getItem("vat_notes") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("vat_notes", JSON.stringify(notes));
  }, [notes]);

  const currentFrJobIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const geoJsonRef = useRef<any | null>(null);
  const loggedIsoRef = useRef<Set<string>>(new Set());

  const countryCounts = useMemo(() => computeCountryCountsFromInput(vatInput), [vatInput]);

  const inputEntries = useMemo(() => {
    return (Object.entries(countryCounts) as Array<[string, number]>)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [countryCounts]);

  const maxInputCount = useMemo(() => {
    return inputEntries.length ? Math.max(...inputEntries.map(([, n]) => n)) : 0;
  }, [inputEntries]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = !q ? rows : rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));

    if (sortState.colIndex !== null) return base;

    const prio = (r: VatRow) => {
      const s = displayState(r);
      if (s === "queued" || s === "retry" || s === "processing") return 0;
      return 1;
    };

    return [...base].sort((a, b) => {
      const pa = prio(a);
      const pb = prio(b);
      if (pa !== pb) return pa - pb;

      const na = normalizeTsMs((a as any).next_retry_at) ?? Number.POSITIVE_INFINITY;
      const nb = normalizeTsMs((b as any).next_retry_at) ?? Number.POSITIVE_INFINITY;
      if (na !== nb) return na - nb;

      return 0;
    });
  }, [rows, filter, sortState.colIndex]);

  const retryVatLines = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const row of rows) {
      const state = displayState(row);
      if (state !== "retry" && state !== "error") continue;

      const input = vatInputFromRow(row);
      if (!input || seen.has(input)) continue;

      seen.add(input);
      out.push(input);
    }

    return out;
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    let done = 0;
    let vOk = 0;
    let vBad = 0;
    let pending = 0;
    let err = 0;

    for (const r of rows) {
      const st = displayState(r);
      if (st === "valid") {
        done++;
        vOk++;
      } else if (st === "invalid") {
        done++;
        vBad++;
      } else if (st === "error") {
        done++;
        err++;
      } else if (st === "queued" || st === "retry" || st === "processing") {
        pending++;
      }
    }

    return { total, done, vOk, vBad, pending, err };
  }, [rows]);

  const progressPct = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.done / stats.total) * 100);
  }, [stats.total, stats.done]);

  const precheck = useMemo(() => {
    const rawLines = vatInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    let duplicates = 0;
    let badFormat = 0;
    const badExamples: string[] = [];

    for (const line of rawLines) {
      const n = normalizeVatCandidate(line);
      if (!n) continue;

      if (seen.has(n)) {
        duplicates++;
        continue;
      }

      seen.add(n);

      const fmt = validateFormatStrict(n);
      if (!fmt.ok) {
        badFormat++;
        if (badExamples.length < 5) badExamples.push(`${line} — ${fmt.reason}`);
      }
    }

    return { totalLines: rawLines.length, unique: seen.size, duplicates, badFormat, badExamples };
  }, [vatInput]);

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
      valid: stats.vOk,
      invalid: stats.vBad,
      pending: stats.pending,
      errors: stats.err,
      formatIssues: precheck.badFormat,
      caseRef: caseRef || undefined,
    });
  }, [
    caseRef,
    onRunCompleted,
    precheck.badFormat,
    rows.length,
    stats.done,
    stats.err,
    stats.pending,
    stats.total,
    stats.vBad,
    stats.vOk,
  ]);

  function stopPolling() {
    pollAbortRef.current?.abort();
    pollAbortRef.current = null;

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    currentFrJobIdRef.current = null;
    setActiveFrJobId(null);
  }

  function onCancel() {
    validateAbortRef.current?.abort();
    validateAbortRef.current = null;
    stopPolling();
    setLoading(false);
  }

  function enrichRow(r: VatRow): VatRow {
    const key = `${(r as any).country_code || ""}:${(r as any).vat_part || ""}`;
    const fmt = validateFormatStrict((r as any).vat_number || (r as any).input || "");
    const user = notes[key] || { note: "", tag: "" };
    const nextRetryAt = normalizeTsMs((r as any).next_retry_at);

    return {
      ...r,
      next_retry_at: nextRetryAt,
      format_ok: fmt.ok,
      format_reason: fmt.reason,
      note: user.note,
      tag: user.tag,
      case_ref: (r as any).case_ref || caseRef,
    } as any;
  }

  async function pollFrJob(jobId: string) {
    try {
      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const url = `/api/fr-job/${encodeURIComponent(jobId)}`;
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) return;

      const data = (await resp.json()) as FrJobResponse & any;

      setFrText(`${data.job.done}/${data.job.total} (${data.job.status})`);

      const rawResults: any[] = Array.isArray(data.results) ? data.results : [];
      const hasPendingRaw = rawResults.some((x) => {
        const s = String(x?.state || "").toLowerCase();
        return s === "queued" || s === "retry" || s === "processing";
      });

      setRows((prev) => {
        const map = new Map<string, VatRow>();

        for (let i = 0; i < prev.length; i++) {
          const r = prev[i];
          map.set(rowKeyStable(r, i), r);
        }

        let seq = 0;

        for (const raw of rawResults) {
          const incoming = { ...(raw as any) } as VatRow;
          (incoming as any).next_retry_at = normalizeTsMs((incoming as any).next_retry_at);

          const k = rowKeyStable(incoming, 100000 + seq++);
          const existing = map.get(k);

          const merged: any = { ...(existing || {}), ...(incoming as any) };
          const st = (incoming as any).state;

          if (st === undefined || st === null || st === "") {
            merged.state = (existing as any)?.state;
          }

          map.set(k, enrichRow(merged));
        }

        return Array.from(map.values());
      });

      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));

      if (data.job?.status === "completed" && !hasPendingRaw) {
        stopPolling();
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }

  async function runVatValidation(lines: string[]) {
    stopPolling();
    setImportPreview(null);
    setExpandedKey(null);
    setRows([]);
    setFrText("-");
    setLastUpdate("-");
    setSortState({ colIndex: null, asc: true });
    setSortLabel("");
    setLoading(true);
    setDuplicatesIgnored(0);
    setViesStatus([]);
    setActiveFrJobId(null);

    if (!lines.length) {
      setLoading(false);
      return;
    }

    currentRunIdRef.current = `vat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    currentRunStartedAtRef.current = new Date().toISOString();

    validateAbortRef.current?.abort();
    const controller = new AbortController();
    validateAbortRef.current = controller;

    try {
      const resp = await fetch("/api/validate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vat_numbers: lines, case_ref: caseRef }),
        signal: controller.signal,
      });

      const data = (await resp.json()) as ValidateBatchResponse & any;

      setDuplicatesIgnored(data.duplicates_ignored || 0);
      setViesStatus(Array.isArray(data.vies_status) ? data.vies_status : []);

      const enriched = (data.results || []).map((r: VatRow) =>
        enrichRow({ ...(r as any), case_ref: caseRef } as any)
      );

      setRows(enriched);
      setLastUpdate(new Date().toLocaleString(localeForLanguage(language)));

      if (data.fr_job_id) {
        currentFrJobIdRef.current = data.fr_job_id;
        setActiveFrJobId(data.fr_job_id);

        await pollFrJob(data.fr_job_id);

        pollTimerRef.current = window.setInterval(() => {
          const id = currentFrJobIdRef.current;
          if (id) void pollFrJob(id);
        }, 1500);
      } else {
        setFrText("-");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    } finally {
      validateAbortRef.current = null;
      setLoading(false);
    }
  }

  async function onValidate() {
    const lines = vatInput.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    await runVatValidation(lines);
  }

  async function onRetryVatUnresolved() {
    if (!retryVatLines.length || loading) return;

    const nextInput = retryVatLines.join("\n");
    setVatInput(nextInput);
    await runVatValidation(retryVatLines);
  }

  function onClear() {
    onCancel();
    setVatInput("");
    setCaseRef("");
    setFilter("");
    setRows([]);
    setFrText("-");
    setLastUpdate("-");
    setProgressText("0/0");
    setSortState({ colIndex: null, asc: true });
    setSortLabel("");
    setDuplicatesIgnored(0);
    setViesStatus([]);
    setExpandedKey(null);
    setImportPreview(null);
  }

  function getCellText(r: VatRow, colIndex: number): string {
    const cols: Array<string> = [
      displayState(r),
      (r as any).vat_number ?? "",
      (r as any).name ?? "",
      (r as any).address ?? "",
      (r as any).error_code ?? (r as any).error ?? "",
    ];

    return cols[colIndex] ?? "";
  }

  function sortByColumn(colIndex: number, label: string) {
    setSortState((prevSort) => {
      const asc = prevSort.colIndex === colIndex ? !prevSort.asc : true;

      setRows((prevRows) => {
        const copy = [...prevRows];

        copy.sort((a, b) => {
          const ta = getCellText(a, colIndex).toLowerCase();
          const tb = getCellText(b, colIndex).toLowerCase();
          const cmp = ta.localeCompare(tb, localeForLanguage(language));
          return asc ? cmp : -cmp;
        });

        return copy;
      });

      setSortLabel(`${t(language, "sort")}: ${label} (${asc ? localText(language, "asc") : localText(language, "desc")})`);
      return { colIndex, asc };
    });
  }

  useEffect(() => {
    setProgressText(`${stats.done}/${stats.total}`);
  }, [stats.done, stats.total]);

  function openImportDialog() {
    importFileRef.current?.click();
  }

  function confirmVatImport() {
    if (!importPreview) return;

    setVatInput(importPreview.payloadText);
    setExpandedKey(null);
    setFilter("");
    setRows([]);
    setDuplicatesIgnored(0);
    setViesStatus([]);
    setImportPreview(null);
  }

  async function importVatFile(file: File) {
    const parsed = await readImportFileValues(file, (value) => {
      const n = normalizeVatCandidate(value);
      return Boolean(n) && validateFormat(n).ok && !isLikelyImportHeader(value);
    });

    const seen = new Set<string>();
    const out: string[] = [];
    let duplicatesRemoved = 0;
    let skippedCount = 0;

    for (const value of parsed.values) {
      if (isLikelyImportHeader(value)) {
        skippedCount++;
        continue;
      }

      const n = normalizeVatCandidate(value);
      if (!n) {
        skippedCount++;
        continue;
      }

      const fmt = validateFormat(n);
      if (!fmt.ok) {
        skippedCount++;
        continue;
      }

      if (seen.has(n)) {
        duplicatesRemoved++;
        continue;
      }

      seen.add(n);
      out.push(n);
    }

    setImportPreview({
      totalFound: parsed.totalFound,
      readyCount: out.length,
      duplicatesRemoved,
      skippedCount,
      columnLabel: parsed.columnLabel,
      examples: out.slice(0, 10),
      payloadText: out.join("\n"),
    });
  }

  function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void importVatFile(f);
  }

  function exportExcel() {
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
      "note",
      "tag",
      "checked_at",
    ];

    const dateFields = new Set(["checked_at", "next_retry_at", "timestamp"]);

    const toExcelDate = (value: any): Date | "" => {
      if (value === null || value === undefined || value === "") return "";

      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const d = new Date(value);
        d.setMilliseconds(0);
        return d;
      }

      if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
          d.setMilliseconds(0);
          return d;
        }
        return "";
      }

      let n = Number(value);
      if (!Number.isFinite(n) || n <= 0) return "";

      if (n < 1_000_000_000_000) {
        n = n * 1000;
      } else if (n > 10_000_000_000_000) {
        n = Math.floor(n / 1000);
      }

      const d = new Date(n);
      if (Number.isNaN(d.getTime())) return "";
      d.setMilliseconds(0);
      return d;
    };

    const aoa = [
      headers,
      ...rows.map((r) =>
        headers.map((h) => {
          const v = (r as any)[h];
          if (dateFields.has(h)) return toExcelDate(v);
          return v === null || v === undefined ? "" : String(v);
        })
      ),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });

    for (let rowIdx = 1; rowIdx < aoa.length; rowIdx++) {
      for (const h of dateFields) {
        const colIdx = headers.indexOf(h);
        if (colIdx === -1) continue;

        const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        if (ws[addr]) {
          ws[addr].z = "yyyy-mm-dd hh:mm:ss";
        }
      }
    }

    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");

    const filename = `vat_results_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  useEffect(() => {
    const el = document.getElementById("countryMap");
    if (!el) return;

    try {
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      }).setView([53.5, 10], 3);

      const layer = L.layerGroup().addTo(map);

      mapRef.current = map;
      markerLayerRef.current = layer;

      fetch("/countries.geojson")
        .then(async (r) => {
          if (!r.ok) throw new Error(`countries.geojson HTTP ${r.status}`);
          return r.json();
        })
        .then((j) => {
          geoJsonRef.current = j;
          setMapGeoVersion((v) => v + 1);
        })
        .catch(() => {
          geoJsonRef.current = null;
          setMapGeoVersion((v) => v + 1);
        });
    } catch {
      el.innerHTML = `<div style='padding:12px;color:#6b7280;font-size:12px;'>${localText(language, "mapUnavailable")}</div>`;
    }

    return () => {
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const entries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

    setMapCount(`${entries.length} ${localText(language, "countries")}`);

    if (!entries.length) {
      setMapLegend("—");
    } else {
      const top = entries
        .slice(0, 6)
        .map(([cc, n]) => `${cc}(${n})`)
        .join(" · ");

      const more = entries.length > 6 ? ` +${entries.length - 6}` : "";
      setMapLegend(top + more);
    }

    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (geoJsonRef.current) {
      L.geoJSON(geoJsonRef.current as any, {
        style: (feature: any) => {
          const p = feature?.properties || {};

          const raw =
            p.ISO_A2 ??
            p.iso_a2 ??
            p.ISO2 ??
            p.iso2 ??
            p["alpha-2"] ??
            p["Alpha-2"] ??
            p["ISO3166-1-Alpha-2"] ??
            p.ISO_A3 ??
            p.iso_a3 ??
            p.ISO3 ??
            p.iso3 ??
            p.ADMIN ??
            p.name ??
            p.NAME ??
            p.Name;

          let cc = String(raw || "").toUpperCase().trim();

          if (cc === "FRA") cc = "FR";
          if (cc === "DEU") cc = "DE";
          if (cc === "NLD") cc = "NL";
          if (cc === "BEL") cc = "BE";
          if (cc === "LUX") cc = "LU";
          if (cc === "ESP") cc = "ES";
          if (cc === "PRT") cc = "PT";
          if (cc === "ITA") cc = "IT";
          if (cc === "IRL") cc = "IE";
          if (cc === "GRC") cc = "EL";
          if (cc === "GBR") cc = "XI";

          if (cc === "GR") cc = "EL";
          if (cc === "GB") cc = "XI";

          if (cc && !loggedIsoRef.current.has(cc)) {
            loggedIsoRef.current.add(cc);
          }

          const n = cc ? countryCounts[cc] || 0 : 0;
          const max = Math.max(0, ...Object.values(countryCounts));
          const ratio = max > 0 ? n / max : 0;

          let fill = "#d9f0f7";
          let stroke = "#b9deea";

          if (ratio >= 0.8) {
            fill = "#55b9d4";
            stroke = "#9fd8e8";
          } else if (ratio >= 0.55) {
            fill = "#78c8dd";
            stroke = "#b7e2ed";
          } else if (ratio >= 0.35) {
            fill = "#9ed9e9";
            stroke = "#cdebf3";
          } else if (ratio >= 0.18) {
            fill = "#c4e9f3";
            stroke = "#dff4f8";
          } else if (ratio > 0) {
            fill = "#ddf4fa";
            stroke = "#e9f8fb";
          }

          return {
            color: stroke,
            weight: n ? 0.9 : 0.65,
            opacity: n ? 0.95 : 0.75,
            fillColor: fill,
            fillOpacity: n ? 0.92 : 0.72,
          };
        },
        onEachFeature: (feature: any, lyr: any) => {
          const p = feature?.properties || {};
          const raw = p.ISO_A2 ?? p.iso_a2 ?? p.ISO2 ?? p.iso2 ?? p.ISO_A3 ?? p.iso_a3 ?? p.ISO3 ?? p.iso3;
          let cc = String(raw || "").toUpperCase().trim();

          if (cc === "FRA") cc = "FR";
          if (cc === "DEU") cc = "DE";
          if (cc === "NLD") cc = "NL";
          if (cc === "GRC") cc = "EL";
          if (cc === "GBR") cc = "XI";
          if (cc === "GR") cc = "EL";
          if (cc === "GB") cc = "XI";

          if (!cc) return;

          const n = countryCounts[cc] || 0;
          lyr.bindTooltip(`${cc} • ${n}`, { direction: "top", opacity: 0.9 });
        },
      }).addTo(layer);
    }

    const coords = Object.entries(countryCounts)
      .filter(([cc, n]) => n > 0 && COUNTRY_COORDS[cc])
      .map(([cc]) => {
        const c = COUNTRY_COORDS[cc];
        return L.latLng(c.lat, c.lon);
      });

    if (coords.length) {
      const b = L.latLngBounds(coords);
      map.fitBounds(b.pad(0.25), { animate: false, maxZoom: 4 });
    } else {
      map.setView([53.5, 10], 3, { animate: false } as any);
    }
  }, [countryCounts, mapGeoVersion, language]);

  return (
    <>
      <PortalBanner
        title={branding.portalTitle || "Validation Portal"}
        modeValue="VAT / VIES"
        meta={[
          { label: t(language, "credits"), value: t(language, "unlimited") },
          { label: t(language, "lastUpdate"), value: lastUpdate },
        ]}
        activePage={activePage}
        setActivePage={setActivePage}
        branding={branding}
        language={language}
        setLanguage={setLanguage}
      />

      <div className="wrap">
        <div className="grid" style={{ alignItems: "stretch" }}>
          <Card style={{ height: "100%" }}>
            <CardHeader className="pb-4">
              <SectionTitle>{t(language, "input")}</SectionTitle>
              <SectionSubtitle maxWidth={760}>{t(language, "vatInputHelp")}</SectionSubtitle>
            </CardHeader>

            <CardContent className="pt-0">
              <div style={ACTION_ROW_STYLE}>
                <input
                  type="text"
                  value={caseRef}
                  onChange={(e) => setCaseRef(e.target.value)}
                  placeholder={t(language, "clientCasePlaceholder")}
                  style={ACTION_FIRST_FIELD_STYLE}
                />

                <Button
                  variant="secondary"
                  size="md"
                  onClick={openImportDialog}
                  disabled={loading}
                  style={ACTION_BUTTON_STYLE}
                >
                  {t(language, "importXlsxCsv")}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={exportExcel}
                  disabled={!rows.length}
                  style={ACTION_BUTTON_STYLE}
                >
                  {t(language, "exportExcel")}
                </Button>

                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  style={{ display: "none" }}
                  onChange={onImportFileChange}
                />
              </div>

              {importPreview && (
                <ImportPreviewPanel
                  preview={importPreview}
                  language={language}
                  onCancel={() => setImportPreview(null)}
                  onConfirm={confirmVatImport}
                />
              )}

              {duplicatesIgnored > 0 && (
                <div className="callout" style={{ marginTop: 10 }}>
                  <b>{duplicatesIgnored}</b> {t(language, "duplicatesIgnored")}.
                </div>
              )}

              <textarea
                value={vatInput}
                onChange={(e) => {
                  setVatInput(e.target.value);
                  setImportPreview(null);
                }}
                placeholder={`NL123456789B01\nDE123456789\nFR12345678901\n...`}
                style={{ marginTop: 12 }}
              />

              <div
                className="callout"
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  lineHeight: 1.55,
                  fontWeight: 500,
                  color: "#0B2E5F",
                }}
              >
                <b>{t(language, "preCheck")}</b>: {precheck.unique} {localText(language, "unique")} /{" "}
                {precheck.totalLines} {localText(language, "lines")} · {precheck.duplicates}{" "}
                {localText(language, "duplicates")} · {precheck.badFormat} {localText(language, "formatIssues")}

                {precheck.badExamples.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary>{t(language, "examples")}</summary>
                    <div className="mono" style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 6 }}>
                      {precheck.badExamples.join("\n")}
                    </div>
                  </details>
                )}
              </div>

              <div className="row">
                <Button variant="primary" size="md" onClick={onValidate} disabled={loading}>
                  {loading ? t(language, "validating") : t(language, "validate")}
                </Button>

                <Button variant="secondary" size="md" onClick={onClear} disabled={loading}>
                  {t(language, "clear")}
                </Button>

                <Button variant="secondary" size="md" onClick={onCancel} disabled={!loading && !activeFrJobId}>
                  {t(language, "cancel")}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={onRetryVatUnresolved}
                  disabled={loading || !retryVatLines.length}
                >
                  {localText(language, "retryUnresolved")}
                </Button>

                <div style={{ flex: 1 }} />

                <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  <span>{t(language, "progress")}: </span>
                  <b style={{ color: "var(--text)" }}>{progressText}</b> ·{" "}
                  <b style={{ color: "var(--text)" }}>{progressPct}%</b>
                </div>
              </div>

              <UserDraftsPanel
                activePage="vat"
                referenceValue={caseRef}
                inputValue={vatInput}
                language={language}
                onRestoreDraft={(draft) => {
                  onCancel();
                  setCaseRef(draft.referenceValue || "");
                  setVatInput(draft.inputValue || "");
                  setRows([]);
                  setFilter("");
                  setExpandedKey(null);
                  setDuplicatesIgnored(0);
                  setViesStatus([]);
                  setFrText("-");
                  setLastUpdate("-");
                  setProgressText("0/0");
                  setSortState({ colIndex: null, asc: true });
                  setSortLabel("");
                  setImportPreview(null);
                }}
              />

              <div className="progress" aria-hidden="true">
                <div className="bar" style={{ width: `${progressPct}%` }} />
              </div>

              <MetricGrid
                items={[
                  { label: t(language, "total"), value: stats.total },
                  { label: t(language, "done"), value: stats.done },
                  { label: t(language, "valid"), value: stats.vOk, tone: "ok" },
                  { label: t(language, "invalid"), value: stats.vBad, tone: "bad" },
                  { label: t(language, "pending"), value: stats.pending, tone: "warn" },
                  { label: t(language, "error"), value: stats.err, tone: "bad" },
                ]}
              />

              <InputCountryBarChart inputEntries={inputEntries} maxInputCount={maxInputCount} language={language} />
            </CardContent>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 16, minHeight: 0 }}>
            <Card>
              <CardHeader className="pb-4">
                <SectionTitle>{t(language, "filter")}</SectionTitle>
                <SectionSubtitle maxWidth={520}>{t(language, "filterHelp")}</SectionSubtitle>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="filterBox">
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t(language, "searchResults")}
                  />

                  <div className="callout">
                    {t(language, "sorting")}: <span className="mono">{sortLabel || "—"}</span>
                  </div>
                </div>

                <div className="mapbox">
                  <div className="mapbox-head">
                    <div className="mapbox-title" style={SMALL_HEADER_STYLE}>
                      {t(language, "inputDistribution")}
                    </div>

                    <div className="mapbox-sub">
                      <span className="nowrap">{mapCount}</span>
                    </div>
                  </div>

                  <div id="countryMap" />

                  <div className="mapbox-foot">
                    <div id="mapLegend" title={mapLegend}>
                      {mapLegend}
                    </div>

                    <div className="map-attrib">
                      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                        © OpenStreetMap
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <CardHeader className="pb-4">
                <SectionTitle>{t(language, "viesStatusTitle")}</SectionTitle>
                <SectionSubtitle maxWidth={520}>{t(language, "viesStatusHelp")}</SectionSubtitle>
              </CardHeader>

              <CardContent
                className="pt-0"
                style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              >
                <div style={{ overflow: "auto", flex: 1, minHeight: 0 }}>
                  {!viesStatus.length ? (
                    <div style={{ padding: 12, color: "var(--muted)" }}>{t(language, "noData")}</div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 10,
                        padding: 6,
                      }}
                    >
                      {[...viesStatus]
                        .sort((a, b) => {
                          const ca = countryCounts[a.countryCode] || 0;
                          const cb = countryCounts[b.countryCode] || 0;
                          if (cb !== ca) return cb - ca;
                          return a.countryCode.localeCompare(b.countryCode, "en");
                        })
                        .map((c) => {
                          const ok = String(c.availability || "").toLowerCase() === "available";
                          const iso2 = vatCcToIso2ForFlag(c.countryCode);

                          return (
                            <div
                              key={c.countryCode}
                              title={`${c.countryCode} — ${c.availability}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                background: "rgba(255,255,255,0.18)",
                                backdropFilter: "blur(6px)",
                                WebkitBackdropFilter: "blur(6px)",
                              }}
                            >
                              <ReactCountryFlag
                                countryCode={iso2}
                                svg
                                style={{ width: "22px", height: "16px", borderRadius: 3 }}
                                title={c.countryCode}
                              />

                              <span
                                className="mono"
                                style={{
                                  fontWeight: 800,
                                  color: ok ? "var(--ok)" : "var(--bad)",
                                  fontSize: 14,
                                  lineHeight: "14px",
                                }}
                              >
                                {ok ? "✓" : "✕"}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="tableWrap" style={{ marginLeft: 12 }}>
          <div className="tableHeader">
            <strong style={TABLE_HEADER_STYLE}>{t(language, "results")}</strong>

            <div className="muted" style={TABLE_META_STYLE}>
              {t(language, "showing")} <b style={{ color: "var(--text)" }}>{filteredRows.length}</b>{" "}
              {t(language, "rows")}
            </div>
          </div>

          <div style={{ overflow: "auto", maxHeight: 520 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, width: 160 }} onClick={() => sortByColumn(0, t(language, "state"))}>
                    {t(language, "state")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 180 }} onClick={() => sortByColumn(1, t(language, "vat"))}>
                    {t(language, "vat")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 280 }} onClick={() => sortByColumn(2, t(language, "name"))}>
                    {t(language, "name")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 280 }} onClick={() => sortByColumn(3, t(language, "address"))}>
                    {t(language, "address")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 240 }} onClick={() => sortByColumn(4, t(language, "error"))}>
                    {t(language, "error")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r, idx) => {
                  const ds = displayState(r);
                  const st = stateLabel(ds, language);
                  const cls = stateClass(ds);

                  const key = rowKeyStable(r, idx);
                  const isOpen = expandedKey === key;

                  const nra = normalizeTsMs((r as any).next_retry_at);
                  const eta = ds === "retry" && nra && nra > Date.now() ? formatEta(nra) : "";

                  const isDone = ds === "valid" || ds === "invalid";
                  const errShown = isDone ? "" : humanError((r as any).error_code, (r as any).error, language);

                  return (
                    <React.Fragment key={`${key}-${idx}`}>
                      <tr onClick={() => setExpandedKey(isOpen ? null : key)} style={{ cursor: "pointer" }}>
                        <td>
                          <span className={`pill ${cls}`}>
                            <i aria-hidden="true" />
                            {st}
                            {cls === "retry" && eta ? ` (${localText(language, "eta")} ${eta})` : ""}
                          </span>
                        </td>

                        <td className="mono nowrap" title={(r as any).vat_number || (r as any).input || ""}>
                          {(r as any).vat_number || (r as any).input || ""}
                        </td>

                        <td title={(r as any).name || ""}>{(r as any).name || ""}</td>
                        <td title={(r as any).address || ""}>{(r as any).address || ""}</td>
                        <td title={errShown || ""}>{errShown || ""}</td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={5} className="rowDetails">
                            <div className="kv">
                              <span>{t(language, "case")}</span>
                              <b>{(r as any).case_ref || "—"}</b>

                              <span>{t(language, "checkedAt")}</span>
                              <b>
                                {(r as any).checked_at
                                  ? new Date((r as any).checked_at).toLocaleString(localeForLanguage(language))
                                  : "—"}
                              </b>

                              <span>{t(language, "errorCode")}</span>
                              <b>{isDone ? "—" : (r as any).error_code || "—"}</b>

                              <span>{t(language, "details")}</span>
                              <b>{isDone ? "—" : (r as any).details || "—"}</b>

                              <span>{t(language, "attempt")}</span>
                              <b>{typeof (r as any).attempt === "number" ? String((r as any).attempt) : "—"}</b>

                              <span>{t(language, "nextRetry")}</span>
                              <b>{nra ? new Date(nra).toLocaleString(localeForLanguage(language)) : "—"}</b>

                              <span>{t(language, "format")}</span>
                              <b>
                                {(r as any).format_ok === false
                                  ? `${localText(language, "bad")} (${(r as any).format_reason})`
                                  : localText(language, "ok")}
                              </b>
                            </div>

                            <div className="row" style={{ marginTop: 10 }}>
                              <select
                                value={(r as any).tag || ""}
                                onChange={(e) => {
                                  const key2 = `${(r as any).country_code || ""}:${(r as any).vat_part || ""}`;
                                  const nextTag = e.target.value as any;

                                  setNotes((prev) => ({
                                    ...prev,
                                    [key2]: { note: (r as any).note || "", tag: nextTag },
                                  }));

                                  setRows((prev) =>
                                    prev.map((x) =>
                                      `${(x as any).country_code || ""}:${(x as any).vat_part || ""}` === key2
                                        ? { ...(x as any), tag: nextTag }
                                        : x
                                    )
                                  );
                                }}
                              >
                                <option value="">{t(language, "noTag")}</option>
                                <option value="whitelist">{t(language, "whitelist")}</option>
                                <option value="blacklist">{t(language, "blacklist")}</option>
                              </select>

                              <input
                                type="text"
                                value={(r as any).note || ""}
                                onChange={(e) => {
                                  const key2 = `${(r as any).country_code || ""}:${(r as any).vat_part || ""}`;
                                  const nextNote = e.target.value;

                                  setNotes((prev) => ({
                                    ...prev,
                                    [key2]: { note: nextNote, tag: ((r as any).tag as any) || "" },
                                  }));

                                  setRows((prev) =>
                                    prev.map((x) =>
                                      `${(x as any).country_code || ""}:${(x as any).vat_part || ""}` === key2
                                        ? { ...(x as any), note: nextNote }
                                        : x
                                    )
                                  );
                                }}
                                placeholder={t(language, "notePlaceholder")}
                                style={{ flex: 1, minWidth: 260 }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {!filteredRows.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: "var(--muted)" }}>
                      {t(language, "noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function stripSelectedCountryPrefix(line: string, countryCode: string): string {
  let value = String(line || "").trim();
  if (!value) return value;

  const cc = String(countryCode || "").toUpperCase().trim();
  const altCc = cc === "EL" ? "GR" : cc;
  const upper = value.toUpperCase();

  if (upper.startsWith(`${cc} `)) return value.slice(3).trim();
  if (upper.startsWith(`${altCc} `)) return value.slice(3).trim();
  if (upper.startsWith(cc)) return value.slice(2).trim();
  if (upper.startsWith(altCc)) return value.slice(2).trim();

  return value;
}

function normalizeTinDuplicateKey(line: string, countryCode: string): string {
  return stripSelectedCountryPrefix(line, countryCode)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[.\-\/]/g, "");
}

function dedupeTinText(text: string, countryCode: string) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueLines: string[] = [];
  let duplicatesRemoved = 0;
  let prefixRemoved = 0;

  for (const line of lines) {
    const cleaned = stripSelectedCountryPrefix(line, countryCode);
    const key = normalizeTinDuplicateKey(line, countryCode);

    if (!key) continue;

    if (cleaned !== line) {
      prefixRemoved++;
    }

    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }

    seen.add(key);
    uniqueLines.push(cleaned);
  }

  return {
    totalLines: lines.length,
    uniqueLines,
    cleanedText: uniqueLines.join("\n"),
    duplicatesRemoved,
    prefixRemoved,
  };
}

function formatTinCleanupMessage(
  language: PortalLanguage,
  duplicatesRemoved: number,
  prefixRemoved: number,
  phase: "beforeValidation" | "duringImport"
) {
  const parts: string[] = [];

  if (language === "nl") {
    if (duplicatesRemoved > 0) parts.push(`${duplicatesRemoved} dubbele regel(s) verwijderd`);
    if (prefixRemoved > 0) parts.push(`landcode verwijderd uit ${prefixRemoved} regel(s)`);
    return `${parts.join(" en ")} ${phase === "beforeValidation" ? "vóór validatie" : "tijdens import"}.`;
  }

  if (language === "de") {
    if (duplicatesRemoved > 0) parts.push(`${duplicatesRemoved} doppelte Zeile(n) entfernt`);
    if (prefixRemoved > 0) parts.push(`Ländercode aus ${prefixRemoved} Zeile(n) entfernt`);
    return `${parts.join(" und ")} ${phase === "beforeValidation" ? "vor der Prüfung" : "beim Import"}.`;
  }

  if (language === "fr") {
    if (duplicatesRemoved > 0) parts.push(`${duplicatesRemoved} ligne(s) en double supprimée(s)`);
    if (prefixRemoved > 0) parts.push(`code pays supprimé de ${prefixRemoved} ligne(s)`);
    return `${parts.join(" et ")} ${phase === "beforeValidation" ? "avant validation" : "pendant l’import"}.`;
  }

  if (duplicatesRemoved > 0) parts.push(`Removed ${duplicatesRemoved} duplicate line(s)`);
  if (prefixRemoved > 0) parts.push(`removed the country code from ${prefixRemoved} line(s)`);
  return `${parts.join(" and ")} ${phase === "beforeValidation" ? "before validation" : "during import"}.`;
}

function TinPage({
  activePage,
  setActivePage,
  branding,
  language,
  setLanguage,
  onRunCompleted,
}: BrandedPageProps) {
  type TinSortKey =
    | "status"
    | "input_tin"
    | "tin_number"
    | "structure_valid"
    | "syntax_valid"
    | "request_date"
    | "message";

  const [country, setCountry] = useState("NL");
  const [tinInput, setTinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<TinSortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);
  const [importPreview, setImportPreview] = useState<ImportPreviewData | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  const currentRunIdRef = useRef<string | null>(null);
  const currentRunStartedAtRef = useRef<string>("");

  const countryOptions = [
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
  ].map((code) => ({
    code,
    label: countryName(code, language),
  }));

  function statusPillClass(status: string) {
    if (status === "valid") return "valid";
    if (status === "invalid") return "invalid";
    return "error";
  }

  function prettyStatus(status: string) {
    if (status === "valid") return t(language, "valid");
    if (status === "invalid") return t(language, "invalid");
    return t(language, "error");
  }

  function boolLabel(value: any) {
    if (value === null || value === undefined) {
      if (language === "nl") return "n.v.t.";
      if (language === "de") return "k. A.";
      return "n/a";
    }

    if (language === "nl") return value ? "ja" : "nee";
    if (language === "de") return value ? "ja" : "nein";
    if (language === "fr") return value ? "oui" : "non";

    return value ? "true" : "false";
  }

  function boolRank(value: any) {
    if (value === true) return 0;
    if (value === false) return 1;
    return 2;
  }

  function statusRank(status: string) {
    if (status === "valid") return 0;
    if (status === "invalid") return 1;
    return 2;
  }

  function tinSortLabel(key: TinSortKey) {
    if (key === "status") return t(language, "state");
    if (key === "input_tin") return t(language, "inputTin");
    if (key === "tin_number") return t(language, "returnedTin");
    if (key === "structure_valid") return t(language, "structure");
    if (key === "syntax_valid") return t(language, "syntax");
    if (key === "request_date") return t(language, "date");
    return t(language, "message");
  }

  function sortBy(nextKey: TinSortKey) {
    if (sortKey === nextKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(nextKey);
      setSortAsc(true);
    }
  }

  function sortIndicator(key: TinSortKey) {
    if (sortKey !== key) return "";
    return sortAsc ? " ↑" : " ↓";
  }

  const stats = useMemo(() => {
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === "valid").length,
      invalid: rows.filter((r) => r.status === "invalid").length,
      error: rows.filter((r) => r.status === "error").length,
    };
  }, [rows]);

  const validPct = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.valid / stats.total) * 100);
  }, [stats.total, stats.valid]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const base = rows.filter((r) => {
      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      const haystack = [
        r.input_tin,
        r.tin_number,
        r.request_date ? String(r.request_date).slice(0, 10) : "",
        r.message,
        r.status,
        boolLabel(r.structure_valid),
        boolLabel(r.syntax_valid),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    return [...base].sort((a, b) => {
      let cmp = 0;

      if (sortKey === "status") {
        cmp = statusRank(a.status) - statusRank(b.status);
      } else if (sortKey === "input_tin") {
        cmp = String(a.input_tin || "").localeCompare(String(b.input_tin || ""), localeForLanguage(language));
      } else if (sortKey === "tin_number") {
        cmp = String(a.tin_number || "").localeCompare(String(b.tin_number || ""), localeForLanguage(language));
      } else if (sortKey === "structure_valid") {
        cmp = boolRank(a.structure_valid) - boolRank(b.structure_valid);
      } else if (sortKey === "syntax_valid") {
        cmp = boolRank(a.syntax_valid) - boolRank(b.syntax_valid);
      } else if (sortKey === "request_date") {
        cmp = String(a.request_date || "").localeCompare(String(b.request_date || ""), localeForLanguage(language));
      } else if (sortKey === "message") {
        cmp = String(a.message || "").localeCompare(String(b.message || ""), localeForLanguage(language));
      }

      return sortAsc ? cmp : -cmp;
    });
  }, [rows, search, statusFilter, sortKey, sortAsc, language]);

  const retryTinLines = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const row of rows) {
      if (row.status !== "error") continue;

      const rawInput = String(row.input_tin || row.tin_number || "").trim();
      const key = normalizeTinDuplicateKey(rawInput, country);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      out.push(stripSelectedCountryPrefix(rawInput, country));
    }

    return out;
  }, [rows, country]);

  useEffect(() => {
    if (!onRunCompleted || !currentRunIdRef.current || !rows.length) return;

    onRunCompleted({
      id: currentRunIdRef.current,
      type: "tin",
      createdAt: currentRunStartedAtRef.current || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      label: "TIN validation run",
      total: stats.total,
      done: stats.total,
      valid: stats.valid,
      invalid: stats.invalid,
      pending: 0,
      errors: stats.error,
      country,
    });
  }, [country, onRunCompleted, rows.length, stats.error, stats.invalid, stats.total, stats.valid]);

  async function runTinValidationFromText(inputText: string) {
    const prepared = dedupeTinText(inputText, country);

    if (!prepared.uniqueLines.length) return;

    currentRunIdRef.current = `tin-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    currentRunStartedAtRef.current = new Date().toISOString();

    setImportPreview(null);

    if (prepared.cleanedText !== tinInput) {
      setTinInput(prepared.cleanedText);
    }

    if (prepared.duplicatesRemoved > 0 || prepared.prefixRemoved > 0) {
      setInfoMessage(
        formatTinCleanupMessage(language, prepared.duplicatesRemoved, prepared.prefixRemoved, "beforeValidation")
      );
    } else {
      setInfoMessage("");
    }

    setLoading(true);
    setError("");
    setRows([]);

    try {
      const resp = await fetch("/api/tin-validate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, tins: prepared.uniqueLines }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.message || data?.error || localText(language, "tinValidationFailed"));
        return;
      }

      setRows(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setError(localText(language, "tinValidationFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function onValidateTinBatch() {
    await runTinValidationFromText(tinInput);
  }

  async function onRetryTinUnresolved() {
    if (!retryTinLines.length || loading) return;
    await runTinValidationFromText(retryTinLines.join("\n"));
  }


  function onClearTin() {
    setTinInput("");
    setRows([]);
    setError("");
    setInfoMessage("");
    setSearch("");
    setStatusFilter("all");
    setSortKey("status");
    setSortAsc(true);
    setImportPreview(null);
  }

  function openImportDialog() {
    importFileRef.current?.click();
  }

  function confirmTinImport() {
    if (!importPreview) return;

    setTinInput(importPreview.payloadText);
    setRows([]);
    setError("");
    setSearch("");
    setStatusFilter("all");

    if ((importPreview.duplicatesRemoved || 0) > 0 || (importPreview.prefixRemoved || 0) > 0) {
      setInfoMessage(
        formatTinCleanupMessage(
          language,
          importPreview.duplicatesRemoved || 0,
          importPreview.prefixRemoved || 0,
          "duringImport"
        )
      );
    } else {
      setInfoMessage("");
    }

    setImportPreview(null);
  }

  async function importTinFile(file: File) {
    const parsed = await readImportFileValues(file, (value) => {
      if (isLikelyImportHeader(value)) return false;
      return normalizeTinDuplicateKey(value, country).length >= 3;
    });

    const candidates = parsed.values.filter((value) => {
      if (isLikelyImportHeader(value)) return false;
      return normalizeTinDuplicateKey(value, country).length >= 3;
    });

    const prepared = dedupeTinText(candidates.join("\n"), country);

    setRows([]);
    setError("");
    setSearch("");
    setStatusFilter("all");

    setImportPreview({
      totalFound: parsed.totalFound,
      readyCount: prepared.uniqueLines.length,
      duplicatesRemoved: prepared.duplicatesRemoved,
      skippedCount: parsed.totalFound - candidates.length,
      prefixRemoved: prepared.prefixRemoved,
      columnLabel: parsed.columnLabel,
      examples: prepared.uniqueLines.slice(0, 10),
      payloadText: prepared.cleanedText,
    });
  }

  function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    void importTinFile(f);
  }

  function exportTinExcel() {
    const headers = [
      "country",
      "input_tin",
      "returned_tin",
      "status",
      "structure_valid",
      "syntax_valid",
      "validation_date",
      "message",
    ];

    const aoa = [
      headers,
      ...filteredRows.map((r) => [
        country,
        r.input_tin || "",
        r.tin_number || "",
        r.status || "",
        r.structure_valid === null || r.structure_valid === undefined ? "" : String(r.structure_valid),
        r.syntax_valid === null || r.syntax_valid === undefined ? "" : String(r.syntax_valid),
        r.request_date ? String(r.request_date).slice(0, 10) : "",
        r.message || "",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws["!cols"] = [
      { wch: 10 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TIN Results");

    const filename = `tin_results_${country}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  return (
    <>
      <PortalBanner
        title={branding.portalTitle || "RSM Validation Portal"}
        modeValue="TIN"
        meta={[
          { label: t(language, "credits"), value: t(language, "unlimited") },
          { label: t(language, "country"), value: country },
        ]}
        activePage={activePage}
        setActivePage={setActivePage}
        branding={branding}
        language={language}
        setLanguage={setLanguage}
      />

      <div className="wrap">
        <div className="grid" style={{ alignItems: "stretch" }}>
          <Card style={{ height: "100%" }}>
            <CardHeader className="pb-4">
              <SectionTitle>{t(language, "input")}</SectionTitle>
              <SectionSubtitle maxWidth={760}>{t(language, "tinInputHelp")}</SectionSubtitle>
            </CardHeader>

            <CardContent className="pt-0">
              <div style={ACTION_ROW_STYLE}>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setRows([]);
                    setError("");
                    setInfoMessage("");
                    setImportPreview(null);
                  }}
                  style={{
                    ...ACTION_FIRST_FIELD_STYLE,
                    lineHeight: "20px",
                    padding: "0 10px",
                  }}
                >
                  {countryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={openImportDialog}
                  disabled={loading}
                  style={ACTION_BUTTON_STYLE}
                >
                  {t(language, "importXlsxCsv")}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={exportTinExcel}
                  disabled={!filteredRows.length}
                  style={ACTION_BUTTON_STYLE}
                >
                  {t(language, "exportExcel")}
                </Button>

                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  style={{ display: "none" }}
                  onChange={onImportFileChange}
                />
              </div>

              {importPreview && (
                <ImportPreviewPanel
                  preview={importPreview}
                  language={language}
                  onCancel={() => setImportPreview(null)}
                  onConfirm={confirmTinImport}
                />
              )}

              <textarea
                value={tinInput}
                onChange={(e) => {
                  setTinInput(e.target.value);
                  setImportPreview(null);
                }}
                placeholder={`123456782\n987654321\n...`}
                style={{ marginTop: 12 }}
              />

              {infoMessage && (
                <div className="callout" style={{ marginTop: 10 }}>
                  {infoMessage}
                </div>
              )}

              <div className="row" style={{ marginTop: 12 }}>
                <Button variant="primary" size="md" onClick={onValidateTinBatch} disabled={loading || !tinInput.trim()}>
                  {loading ? t(language, "validating") : t(language, "validate")}
                </Button>

                <Button variant="secondary" size="md" onClick={onClearTin} disabled={loading}>
                  {t(language, "clear")}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={onRetryTinUnresolved}
                  disabled={loading || !retryTinLines.length}
                >
                  {localText(language, "retryUnresolved")}
                </Button>
              </div>

              <UserDraftsPanel
                activePage="tin"
                referenceValue={country}
                inputValue={tinInput}
                language={language}
                onRestoreDraft={(draft) => {
                  setCountry(draft.referenceValue || "NL");
                  setTinInput(draft.inputValue || "");
                  setRows([]);
                  setError("");
                  setInfoMessage("");
                  setSearch("");
                  setStatusFilter("all");
                  setSortKey("status");
                  setSortAsc(true);
                  setImportPreview(null);
                }}
              />

              <div className="callout" style={{ marginTop: 14 }}>
                {t(language, "tinImportant")}
              </div>
            </CardContent>
          </Card>

          <Card style={{ height: "100%" }}>
            <CardHeader className="pb-4">
              <SectionTitle>{t(language, "dashboard")}</SectionTitle>
              <SectionSubtitle maxWidth={520}>{t(language, "overviewFiltersSorting")}</SectionSubtitle>
            </CardHeader>

            <CardContent className="pt-0">
              {error && (
                <div className="callout" style={{ marginTop: 10 }}>
                  <b style={{ color: "var(--bad)" }}>{t(language, "error")}</b>: {error}
                </div>
              )}

              {!error && !rows.length && (
                <div className="callout" style={{ marginTop: 10 }}>
                  {t(language, "noResultsYet")}
                </div>
              )}

              {!!rows.length && (
                <>
                  <MetricGrid
                    items={[
                      { label: t(language, "total"), value: stats.total },
                      { label: t(language, "valid"), value: stats.valid, tone: "ok" },
                      { label: t(language, "invalid"), value: stats.invalid, tone: "bad" },
                      { label: t(language, "error"), value: stats.error, tone: "bad" },
                    ]}
                  />

                  <div className="callout" style={{ marginTop: 12 }}>
                    <b>{t(language, "country")}</b>: {country}
                    <br />
                    <b>{t(language, "validRate")}</b>: {validPct}%
                  </div>

                  <div className="progress" aria-hidden="true" style={{ marginTop: 12 }}>
                    <div className="bar" style={{ width: `${validPct}%` }} />
                  </div>

                  <div className="filterBox" style={{ marginTop: 14 }}>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t(language, "searchResults")}
                    />

                    <div className="row" style={{ marginTop: 10 }}>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ minWidth: 180 }}
                      >
                        <option value="all">{t(language, "allStatuses")}</option>
                        <option value="valid">{t(language, "valid")}</option>
                        <option value="invalid">{t(language, "invalid")}</option>
                        <option value="error">{t(language, "error")}</option>
                      </select>

                      <div className="callout" style={{ margin: 0, padding: "10px 12px" }}>
                        {t(language, "sort")}:{" "}
                        <span className="mono">
                          {tinSortLabel(sortKey)} {sortAsc ? localText(language, "asc") : localText(language, "desc")}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="tableWrap" style={{ marginLeft: 12 }}>
          <div className="tableHeader">
            <strong style={TABLE_HEADER_STYLE}>{t(language, "results")}</strong>

            <div className="muted" style={TABLE_META_STYLE}>
              {t(language, "showing")} <b style={{ color: "var(--text)" }}>{filteredRows.length}</b>{" "}
              {t(language, "rows")}
            </div>
          </div>

          <div style={{ overflow: "auto", maxHeight: 520 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ ...TH_STYLE, width: 150 }} onClick={() => sortBy("status")}>
                    {t(language, "state")}
                    {sortIndicator("status")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 220 }} onClick={() => sortBy("input_tin")}>
                    {t(language, "inputTin")}
                    {sortIndicator("input_tin")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 220 }} onClick={() => sortBy("tin_number")}>
                    {t(language, "returnedTin")}
                    {sortIndicator("tin_number")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 120 }} onClick={() => sortBy("structure_valid")}>
                    {t(language, "structure")}
                    {sortIndicator("structure_valid")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 120 }} onClick={() => sortBy("syntax_valid")}>
                    {t(language, "syntax")}
                    {sortIndicator("syntax_valid")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 140 }} onClick={() => sortBy("request_date")}>
                    {t(language, "date")}
                    {sortIndicator("request_date")}
                  </th>

                  <th style={{ ...TH_STYLE, width: 320 }} onClick={() => sortBy("message")}>
                    {t(language, "message")}
                    {sortIndicator("message")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr key={`${r.input_tin}-${idx}`}>
                    <td>
                      <span className={`pill ${statusPillClass(r.status)}`}>
                        <i aria-hidden="true" />
                        {prettyStatus(r.status)}
                      </span>
                    </td>

                    <td className="mono nowrap">{r.input_tin || ""}</td>
                    <td className="mono nowrap">{r.tin_number || ""}</td>
                    <td>{boolLabel(r.structure_valid)}</td>
                    <td>{boolLabel(r.syntax_valid)}</td>
                    <td>{r.request_date ? String(r.request_date).slice(0, 10) : "—"}</td>
                    <td title={r.message || ""}>{r.message || ""}</td>
                  </tr>
                ))}

                {!filteredRows.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: 16, color: "var(--muted)" }}>
                      {t(language, "noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App({
  branding = DEFAULT_BRANDING,
  onRunCompleted,
}: ToolAppProps) {
  const [activePage, setActivePage] = useState<ActivePage>("vat");
  const [language, setLanguage] = useState<PortalLanguage>(() => getStoredLanguage());

  useEffect(() => {
    storeLanguage(language);
  }, [language]);

  return activePage === "vat" ? (
    <VatPage
      activePage={activePage}
      setActivePage={setActivePage}
      branding={branding}
      language={language}
      setLanguage={setLanguage}
      onRunCompleted={onRunCompleted}
    />
  ) : (
    <TinPage
      activePage={activePage}
      setActivePage={setActivePage}
      branding={branding}
      language={language}
      setLanguage={setLanguage}
      onRunCompleted={onRunCompleted}
    />
  );
}
