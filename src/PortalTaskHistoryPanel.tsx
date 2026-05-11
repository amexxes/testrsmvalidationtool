// /src/PortalTaskHistoryPanel.tsx
import React from "react";
import type { PortalRunSummary } from "./portalRunHistory";

type Props = {
  open: boolean;
  runs: PortalRunSummary[];
  onClose: () => void;
  onClear: () => void;
  onContinue?: (run: PortalRunSummary) => void;
};

function formatDate(value: string) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("nl-NL");
  } catch {
    return value;
  }
}

function openActions(run: PortalRunSummary) {
  return (
    Number(run.invalid || 0) +
    Number(run.errors || 0) +
    Number(run.pending || 0) +
    Number(run.formatIssues || 0)
  );
}
function canContinue(run: PortalRunSummary) {
  return run.type === "vat" && Boolean(run.resume?.inputValue || run.resume?.frJobId);
}
function typeLabel(type: PortalRunSummary["type"]) {
  if (type === "vat") return "VAT / VIES";
  if (type === "tin") return "TIN";
  if (type === "eori") return "EORI";
  if (type === "iban") return "IBAN";
  if (type === "lei") return "LEI";
  if (type === "company") return "Company Register";

  return "Validation";
}

function badgeStyle(open: number): React.CSSProperties {
  if (open > 0) {
    return {
      background: "rgba(185,28,28,0.08)",
      border: "1px solid rgba(185,28,28,0.14)",
      color: "#8f1d1d",
    };
  }

  return {
    background: "rgba(10,122,61,0.08)",
    border: "1px solid rgba(10,122,61,0.14)",
    color: "#0a6a38",
  };
}

export default function PortalTaskHistoryPanel({
  open,
  runs,
  onClose,
  onClear,
  onContinue,
}: Props) {
  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Portal task list</h2>
            <p style={subtitleStyle}>Overview of previous validation runs and open actions.</p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClear} style={secondaryButtonStyle}>
              Clear
            </button>

            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Close
            </button>
          </div>
        </div>

        {!runs.length ? (
          <div style={emptyStyle}>No validation runs yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {runs.map((run) => {
              const openCount = openActions(run);

              return (
                <div key={run.id} style={runCardStyle}>
                  <div>
                    <div style={runTitleStyle}>
                      {typeLabel(run.type)} · {formatDate(run.createdAt)}
                    </div>

                    <div style={runMetaStyle}>
                      {run.label}
                      {run.country ? ` · Country: ${run.country}` : ""}
                      {run.caseRef ? ` · Case: ${run.caseRef}` : ""}
                    </div>
                  </div>

                  <div style={statsGridStyle}>
                    <Stat label="Total" value={run.total} />
                    <Stat label="Done" value={run.done} />
                    <Stat label="Valid" value={run.valid} />
                    <Stat label="Invalid" value={run.invalid} />
                    <Stat label="Errors" value={run.errors} />

<span
  style={{
    ...badgeBaseStyle,
    ...badgeStyle(openCount),
  }}
>
  {openCount ? `${openCount} open` : "All clear"}
</span>

{canContinue(run) && (
  <button
    type="button"
    onClick={() => onContinue?.(run)}
    style={continueButtonStyle}
  >
    Continue
  </button>
)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span style={statStyle}>
      <span style={statLabelStyle}>{label}</span>
      <b style={statValueStyle}>{value}</b>
    </span>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(5,16,34,0.42)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  zIndex: 30000,
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1040,
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto",
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  letterSpacing: "-0.03em",
  color: "#0B2E5F",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px dashed rgba(11,46,95,0.16)",
  color: "#64748b",
  background: "rgba(248,251,255,0.72)",
};

const runCardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) auto",
  gap: 16,
  alignItems: "center",
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "rgba(248,251,255,0.82)",
};

const runTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 850,
  color: "#0B2E5F",
};

const runMetaStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12.5,
  color: "#64748b",
  lineHeight: 1.45,
};

const statsGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  alignItems: "center",
};

const statStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 64,
  padding: "7px 9px",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(11,46,95,0.08)",
  color: "#0B2E5F",
  fontSize: 11,
};

const statLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 700,
};

const statValueStyle: React.CSSProperties = {
  color: "#0B2E5F",
  fontSize: 13,
  fontWeight: 900,
};

const badgeBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 850,
  whiteSpace: "nowrap",
};
const continueButtonStyle: React.CSSProperties = {
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,156,222,0.22)",
  background: "#009CDE",
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: 850,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
