import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import UserDraftsPanel from "./UserDraftsPanel";
import { t, type PortalLanguage } from "./i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type LeiPageProps = {
  activePage?: string;
  setActivePage?: React.Dispatch<React.SetStateAction<any>>;
  branding?: any;
  language: PortalLanguage;
  setLanguage?: React.Dispatch<React.SetStateAction<PortalLanguage>>;
  userRole?: string;
  clientModules?: any;
  onRequestModuleUpgrade?: (module: any) => void;
  onRunCompleted?: (summary: any) => void;
};

type LeiRow = {
  input_lei?: string;
  lei?: string;
  valid?: boolean;
  status?: "valid" | "invalid" | "error" | string;
  source?: string;
  legal_name?: string;
  entity_status?: string;
  registration_status?: string;
  jurisdiction?: string;
  legal_address?: string;
  headquarters_address?: string;
  initial_registration_date?: string;
  last_update_date?: string;
  next_renewal_date?: string;
  managing_lou?: string;
  message?: string;
  checked_at?: string;
};

type ImportColumn = {
  key: string;
  label: string;
  values: string[];
};

type ImportPreview = {
  fileName: string;
  columns: ImportColumn[];
  selectedColumnKey: string;
  values: string[];
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
};

const PANEL_STYLE: React.CSSProperties = {
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.55)",
  background: "rgba(255,255,255,0.78)",
  boxShadow: "0 24px 60px rgba(15,23,42,0.10)",
};

const TABLE_WRAP_STYLE: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: 20,
  border: "1px solid rgba(15,23,42,0.08)",
  background: "rgba(255,255,255,0.84)",
};

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#475569",
  borderBottom: "1px solid rgba(15,23,42,0.08)",
  whiteSpace: "nowrap",
};

const TD_STYLE: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(15,23,42,0.06)",
  verticalAlign: "top",
};

function leiText(language: PortalLanguage, key: string) {
  const copy: Record<string, Record<string, string>> = {
    en: {
      title: "LEI Validation",
      help: "Paste LEI numbers or import an Excel/CSV/TXT file.",
      placeholder: "Paste one LEI per line",
      validate: "Validate LEI",
      export: "Export Excel",
      import: "Excel Import",
      caseRef: "Case reference",
      results: "Results",
      noResults: "No LEI results yet.",
      legalName: "Legal name",
      entityStatus: "Entity status",
      registrationStatus: "Registration status",
      jurisdiction: "Jurisdiction",
      nextRenewal: "Next renewal",
      message: "Message",
      all: "All",
      valid: "Valid",
      invalid: "Invalid",
      error: "Error",
    },
    nl: {
      title: "LEI-validatie",
      help: "Plak LEI-nummers of importeer een Excel/CSV/TXT-bestand.",
      placeholder: "Plak één LEI per regel",
      validate: "LEI valideren",
      export: "Excel export",
      import: "Excel Import",
      caseRef: "Dossierreferentie",
      results: "Resultaten",
      noResults: "Nog geen LEI-resultaten.",
      legalName: "Juridische naam",
      entityStatus: "Entiteitstatus",
      registrationStatus: "Registratiestatus",
      jurisdiction: "Jurisdictie",
      nextRenewal: "Volgende verlenging",
      message: "Melding",
      all: "Alles",
      valid: "Geldig",
      invalid: "Ongeldig",
      error: "Fout",
    },
    de: {
      title: "LEI-Validierung",
      help: "LEI-Nummern einfügen oder Excel/CSV/TXT-Datei importieren.",
      placeholder: "Eine LEI pro Zeile einfügen",
      validate: "LEI validieren",
      export: "Excel Export",
      import: "Excel Import",
      caseRef: "Fallreferenz",
      results: "Ergebnisse",
      noResults: "Noch keine LEI-Ergebnisse.",
      legalName: "Rechtlicher Name",
      entityStatus: "Entitätsstatus",
      registrationStatus: "Registrierungsstatus",
      jurisdiction: "Jurisdiktion",
      nextRenewal: "Nächste Verlängerung",
      message: "Meldung",
      all: "Alle",
      valid: "Gültig",
      invalid: "Ungültig",
      error: "Fehler",
    },
    fr: {
      title: "Validation LEI",
      help: "Collez des LEI ou importez un fichier Excel/CSV/TXT.",
      placeholder: "Collez un LEI par ligne",
      validate: "Valider LEI",
      export: "Export Excel",
      import: "Excel Import",
      caseRef: "Référence dossier",
      results: "Résultats",
      noResults: "Aucun résultat LEI.",
      legalName: "Nom légal",
      entityStatus: "Statut entité",
      registrationStatus: "Statut enregistrement",
      jurisdiction: "Juridiction",
      nextRenewal: "Prochain renouvellement",
      message: "Message",
      all: "Tous",
      valid: "Valide",
      invalid: "Invalide",
      error: "Erreur",
    },
  };

  return copy[language]?.[key] || copy.en[key] || key;
}

function normalizeLeiCandidate(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[.\-_/]/g, "");
}

function leiMod97(lei: string) {
  let remainder = 0;

  for (const char of lei) {
    const code = char.charCodeAt(0);
    const value = code >= 65 && code <= 90 ? String(code - 55) : char;

    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }

  return remainder;
}

function validateLeiFormat(value: string) {
  const lei = normalizeLeiCandidate(value);

  if (!lei) return false;
  if (!/^[A-Z0-9]{20}$/.test(lei)) return false;

  return leiMod97(lei) === 1;
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  const candidates = [",", ";", "\t", "|"];

  return candidates
    .map((delimiter) => ({
      delimiter,
      count: splitDelimitedLine(firstLine, delimiter).length,
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function excelColumnName(index: number) {
  let name = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function isLikelyHeader(value: string) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return [
    "lei",
    "leinumber",
    "inputlei",
    "legalentityidentifier",
    "number",
    "nummer",
  ].includes(normalized);
}

async function readImportColumns(file: File): Promise<ImportColumn[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    const maxColumns = Math.max(0, ...rows.map((row) => row.length));

    return Array.from({ length: maxColumns }, (_, columnIndex) => {
      const values = rows
        .map((row) => String(row[columnIndex] || "").trim())
        .filter(Boolean);

      const firstValue = values[0] || "";
      const hasHeader = isLikelyHeader(firstValue);

      return {
        key: String(columnIndex),
        label: hasHeader
          ? `${excelColumnName(columnIndex)} - ${firstValue}`
          : excelColumnName(columnIndex),
        values: hasHeader ? values.slice(1) : values,
      };
    }).filter((column) => column.values.length > 0);
  }

  const text = await file.text();
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => splitDelimitedLine(line, delimiter));

  const maxColumns = Math.max(0, ...rows.map((row) => row.length));

  return Array.from({ length: maxColumns }, (_, columnIndex) => {
    const values = rows
      .map((row) => String(row[columnIndex] || "").trim())
      .filter(Boolean);

    const firstValue = values[0] || "";
    const hasHeader = isLikelyHeader(firstValue);

    return {
      key: String(columnIndex),
      label: hasHeader
        ? `${excelColumnName(columnIndex)} - ${firstValue}`
        : excelColumnName(columnIndex),
      values: hasHeader ? values.slice(1) : values,
    };
  }).filter((column) => column.values.length > 0);
}

function buildImportPreview(fileName: string, columns: ImportColumn[], selectedColumnKey: string) {
  const selectedColumn = columns.find((column) => column.key === selectedColumnKey);
  const rawValues = selectedColumn?.values || [];

  const normalizedValues = rawValues
    .map(normalizeLeiCandidate)
    .filter(Boolean);

  const seen = new Set<string>();
  const uniqueValues: string[] = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  normalizedValues.forEach((value) => {
    if (seen.has(value)) {
      duplicateCount += 1;
      return;
    }

    seen.add(value);
    uniqueValues.push(value);

    if (!validateLeiFormat(value)) {
      invalidCount += 1;
    }
  });

  return {
    fileName,
    columns,
    selectedColumnKey,
    values: uniqueValues,
    validCount: uniqueValues.length - invalidCount,
    duplicateCount,
    invalidCount,
  };
}

function selectBestColumn(columns: ImportColumn[]) {
  return (
    [...columns]
      .map((column) => ({
        column,
        score: column.values.filter((value) => validateLeiFormat(value)).length,
      }))
      .sort((a, b) => b.score - a.score)[0]?.column || columns[0]
  );
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function statusLabel(language: PortalLanguage, status?: string) {
  if (status === "valid") return leiText(language, "valid");
  if (status === "error") return leiText(language, "error");
  return leiText(language, "invalid");
}

function statusClass(status?: string) {
  if (status === "valid") return "status-pill ok";
  if (status === "error") return "status-pill error";
  return "status-pill warn";
}

export default function LeiPage({
  language,
  onRunCompleted,
}: LeiPageProps) {
  const [caseRef, setCaseRef] = useState("");
  const [leiInput, setLeiInput] = useState("");
  const [rows, setRows] = useState<LeiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);

  const importFileRef = useRef<HTMLInputElement | null>(null);

  const inputValues = useMemo(
    () =>
      leiInput
        .split(/\r?\n/)
        .map(normalizeLeiCandidate)
        .filter(Boolean),
    [leiInput]
  );

  const precheck = useMemo(() => {
    const seen = new Set<string>();
    let duplicateCount = 0;
    let invalidCount = 0;

    inputValues.forEach((value) => {
      if (seen.has(value)) {
        duplicateCount += 1;
        return;
      }

      seen.add(value);

      if (!validateLeiFormat(value)) {
        invalidCount += 1;
      }
    });

    return {
      total: inputValues.length,
      unique: seen.size,
      duplicateCount,
      invalidCount,
    };
  }, [inputValues]);

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.status === "valid") acc.valid += 1;
        else if (row.status === "error") acc.error += 1;
        else acc.invalid += 1;

        return acc;
      },
      {
        total: rows.length,
        valid: 0,
        invalid: 0,
        error: 0,
      }
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;

      const haystack = [
        row.input_lei,
        row.lei,
        row.legal_name,
        row.entity_status,
        row.registration_status,
        row.jurisdiction,
        row.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [rows, search, statusFilter]);

  async function handleImportFile(file: File) {
    const columns = await readImportColumns(file);
    const bestColumn = selectBestColumn(columns);
    setImportPreview(buildImportPreview(file.name, columns, bestColumn.key));
  }

  function handleImportColumnChange(columnKey: string) {
    if (!importPreview) return;

    setImportPreview(
      buildImportPreview(importPreview.fileName, importPreview.columns, columnKey)
    );
  }

  function confirmImport() {
    if (!importPreview) return;

    setLeiInput(importPreview.values.join("\n"));
    setImportPreview(null);
    setRows([]);
    setError("");
  }

  async function validateLei() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/lei-validate-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          leis: inputValues,
          case_ref: caseRef,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "LEI validation failed.");
      }

      const nextRows = Array.isArray(data.results) ? data.results : [];
      setRows(nextRows);

      onRunCompleted?.({
        id: `lei-${Date.now()}`,
        type: "lei",
        label: "LEI validation run",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        total: nextRows.length,
        done: nextRows.length,
        valid: nextRows.filter((row: LeiRow) => row.status === "valid").length,
        invalid: nextRows.filter((row: LeiRow) => row.status === "invalid").length,
        errors: nextRows.filter((row: LeiRow) => row.status === "error").length,
        pending: 0,
        formatIssues: precheck.invalidCount,
      });
    } catch (validationError: any) {
      setError(validationError?.message || "LEI validation failed.");
    } finally {
      setLoading(false);
    }
  }

  function exportExcel() {
    const headers = [
      "case_ref",
      "input_lei",
      "lei",
      "valid",
      "status",
      "source",
      "legal_name",
      "entity_status",
      "registration_status",
      "jurisdiction",
      "legal_address",
      "headquarters_address",
      "initial_registration_date",
      "last_update_date",
      "next_renewal_date",
      "managing_lou",
      "message",
      "checked_at",
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
      ...rows.map((row) => [
        caseRef,
        row.input_lei || "",
        row.lei || "",
        row.valid === true ? "TRUE" : "FALSE",
        row.status || "",
        row.source || "",
        row.legal_name || "",
        row.entity_status || "",
        row.registration_status || "",
        row.jurisdiction || "",
        row.legal_address || "",
        row.headquarters_address || "",
        row.initial_registration_date || "",
        row.last_update_date || "",
        row.next_renewal_date || "",
        row.managing_lou || "",
        row.message || "",
        row.checked_at || "",
      ]),
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "LEI Results");
    XLSX.writeFile(workbook, `lei-results-${Date.now()}.xlsx`);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={PANEL_STYLE}>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 26 }}>{leiText(language, "title")}</h2>
              <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                {leiText(language, "help")}
              </p>
            </div>

            <UserDraftsPanel
              activePage="lei"
              referenceValue={caseRef}
              inputValue={leiInput}
              language={language}
              onRestoreDraft={(draft) => {
                setCaseRef(draft.referenceValue || "");
                setLeiInput(draft.inputValue || "");
                setRows([]);
                setError("");
              }}
            />
          </div>
        </CardHeader>

        <CardContent>
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
              event.currentTarget.value = "";
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto auto auto",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <input
              value={caseRef}
              onChange={(event) => setCaseRef(event.target.value)}
              placeholder={leiText(language, "caseRef")}
              style={{
                minHeight: 44,
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,0.12)",
                padding: "0 14px",
              }}
            />

            <Button
              type="button"
              variant="secondary"
              onClick={() => importFileRef.current?.click()}
            >
              {leiText(language, "import")}
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={!rows.length}
              onClick={exportExcel}
            >
              {leiText(language, "export")}
            </Button>

            <Button
              type="button"
              disabled={!inputValues.length || loading}
              onClick={validateLei}
            >
              {loading ? t(language, "processing") : leiText(language, "validate")}
            </Button>
          </div>

          <textarea
            value={leiInput}
            onChange={(event) => {
              setLeiInput(event.target.value);
              setRows([]);
              setError("");
            }}
            placeholder={leiText(language, "placeholder")}
            rows={9}
            style={{
              width: "100%",
              resize: "vertical",
              borderRadius: 18,
              border: "1px solid rgba(15,23,42,0.12)",
              padding: 14,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 14,
            }}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 12,
              color: "#475569",
              fontSize: 13,
            }}
          >
            <span>Total: {precheck.total}</span>
            <span>Unique: {precheck.unique}</span>
            <span>Duplicates: {precheck.duplicateCount}</span>
            <span>Format issues: {precheck.invalidCount}</span>
          </div>

          {error ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "rgba(220,38,38,0.08)",
                color: "#991b1b",
              }}
            >
              {error}
            </div>
          ) : null}

          {importPreview ? (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "rgba(248,250,252,0.92)",
              }}
            >
              <strong>{importPreview.fileName}</strong>

              <div style={{ marginTop: 10 }}>
                <select
                  value={importPreview.selectedColumnKey}
                  onChange={(event) => handleImportColumnChange(event.target.value)}
                  style={{
                    minHeight: 40,
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.12)",
                    padding: "0 10px",
                  }}
                >
                  {importPreview.columns.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginTop: 10, color: "#475569", fontSize: 13 }}>
                Valid: {importPreview.validCount} · Invalid:{" "}
                {importPreview.invalidCount} · Duplicates:{" "}
                {importPreview.duplicateCount}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Button type="button" onClick={confirmImport}>
                  Import
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card style={PANEL_STYLE}>
        <CardHeader>
          <h3 style={{ margin: 0 }}>{leiText(language, "results")}</h3>
        </CardHeader>

        <CardContent>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div>Total: {stats.total}</div>
            <div>{leiText(language, "valid")}: {stats.valid}</div>
            <div>{leiText(language, "invalid")}: {stats.invalid}</div>
            <div>{leiText(language, "error")}: {stats.error}</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px minmax(0, 1fr)",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              style={{
                minHeight: 40,
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                padding: "0 10px",
              }}
            >
              <option value="all">{leiText(language, "all")}</option>
              <option value="valid">{leiText(language, "valid")}</option>
              <option value="invalid">{leiText(language, "invalid")}</option>
              <option value="error">{leiText(language, "error")}</option>
            </select>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(language, "search")}
              style={{
                minHeight: 40,
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                padding: "0 12px",
              }}
            />
          </div>

          <div style={TABLE_WRAP_STYLE}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>LEI</th>
                  <th style={TH_STYLE}>Status</th>
                  <th style={TH_STYLE}>{leiText(language, "legalName")}</th>
                  <th style={TH_STYLE}>{leiText(language, "entityStatus")}</th>
                  <th style={TH_STYLE}>{leiText(language, "registrationStatus")}</th>
                  <th style={TH_STYLE}>{leiText(language, "jurisdiction")}</th>
                  <th style={TH_STYLE}>{leiText(language, "nextRenewal")}</th>
                  <th style={TH_STYLE}>{leiText(language, "message")}</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length ? (
                  filteredRows.map((row, index) => (
                    <tr key={`${row.lei || row.input_lei}-${index}`}>
                      <td style={TD_STYLE}>
                        <code>{displayValue(row.lei || row.input_lei)}</code>
                      </td>
                      <td style={TD_STYLE}>
                        <span className={statusClass(row.status)}>
                          {statusLabel(language, row.status)}
                        </span>
                      </td>
                      <td style={TD_STYLE}>{displayValue(row.legal_name)}</td>
                      <td style={TD_STYLE}>{displayValue(row.entity_status)}</td>
                      <td style={TD_STYLE}>
                        {displayValue(row.registration_status)}
                      </td>
                      <td style={TD_STYLE}>{displayValue(row.jurisdiction)}</td>
                      <td style={TD_STYLE}>
                        {displayValue(row.next_renewal_date)}
                      </td>
                      <td style={TD_STYLE}>{displayValue(row.message)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td style={TD_STYLE} colSpan={8}>
                      {leiText(language, "noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
