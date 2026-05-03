import React, { useEffect, useMemo, useState } from "react";

export type UserDraft = {
  id: string;
  title: string;
  activePage: "vat" | "tin";
  referenceValue: string;
  inputValue: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  activePage: "vat" | "tin";
  referenceValue?: string;
  inputValue: string;
  onRestoreDraft: (draft: UserDraft) => void;
};

async function readJson(resp: Response) {
  const text = await resp.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const buttonBase: React.CSSProperties = {
  borderRadius: 999,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease",
};

export default function UserDraftsPanel({
  activePage,
  referenceValue = "",
  inputValue,
  onRestoreDraft,
}: Props) {
  const [drafts, setDrafts] = useState<UserDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleDrafts = useMemo(
    () => drafts.filter((d) => d.activePage === activePage),
    [drafts, activePage]
  );

  useEffect(() => {
    void loadDrafts();
  }, [activePage]);

  async function loadDrafts() {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/user/drafts/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not load drafts");
        return;
      }

      setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load drafts");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    setError("");

    try {
      const title =
        String(referenceValue || "").trim() || `${activePage.toUpperCase()} draft`;

      const resp = await fetch("/api/user/drafts/save", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          activePage,
          title,
          referenceValue,
          inputValue,
        }),
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not save draft");
        return;
      }

      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft(draftId: string) {
    setError("");

    try {
      const resp = await fetch("/api/user/drafts/delete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ draftId }),
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not delete draft");
        return;
      }

      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete draft");
    }
  }

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(226, 232, 240, 0.92)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.88), rgba(248,250,252,0.78))",
        padding: 14,
        marginTop: 14,
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.035)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#0B2E5F",
              letterSpacing: "-0.01em",
            }}
          >
            Drafts
          </div>

          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "#64748b",
              marginTop: 2,
            }}
          >
            Save current input and continue later.
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || !String(inputValue || "").trim()}
          style={{
            ...buttonBase,
            padding: "9px 13px",
            border: "1px solid rgba(11,46,95,0.14)",
            background: saving ? "rgba(11,46,95,0.08)" : "rgba(11,46,95,0.96)",
            color: saving ? "#0B2E5F" : "#fff",
            opacity: saving || !String(inputValue || "").trim() ? 0.62 : 1,
            cursor:
              saving || !String(inputValue || "").trim() ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save draft"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            background: "rgba(185,28,28,0.055)",
            border: "1px solid rgba(185,28,28,0.12)",
            color: "#8f1d1d",
            fontSize: 13,
            lineHeight: 1.45,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>Loading drafts...</div>
      ) : visibleDrafts.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>No drafts yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visibleDrafts.map((draft) => (
            <div
              key={draft.id}
              style={{
                borderRadius: 16,
                border: "1px solid rgba(226, 232, 240, 0.88)",
                background: "rgba(255,255,255,0.72)",
                padding: 11,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 750,
                    color: "#0B2E5F",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {draft.title}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 4,
                  }}
                >
                  {new Date(draft.updatedAt).toLocaleString("nl-NL")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => onRestoreDraft(draft)}
                  style={{
                    ...buttonBase,
                    padding: "7px 10px",
                    border: "1px solid rgba(11,46,95,0.12)",
                    background: "rgba(255,255,255,0.88)",
                    color: "#0B2E5F",
                    fontSize: 12,
                  }}
                >
                  Restore
                </button>

                <button
                  type="button"
                  onClick={() => void handleDeleteDraft(draft.id)}
                  style={{
                    ...buttonBase,
                    padding: "7px 10px",
                    border: "1px solid rgba(185,28,28,0.12)",
                    background: "rgba(185,28,28,0.04)",
                    color: "#8f1d1d",
                    fontSize: 12,
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
