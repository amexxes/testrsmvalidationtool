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
        border: "1px solid rgba(11,46,95,0.08)",
        background: "#fff",
        padding: 16,
        marginTop: 14,
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
          <div style={{ fontWeight: 800, color: "#0B2E5F" }}>Drafts</div>
          <div style={{ fontSize: 13, color: "#607089" }}>
            Save current input and continue later.
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || !String(inputValue || "").trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(11,46,95,0.12)",
            background: "#0B2E5F",
            color: "#fff",
            fontWeight: 700,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Save draft"}
        </button>
      </div>

      {error ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(185,28,28,0.08)",
            border: "1px solid rgba(185,28,28,0.12)",
            color: "#8f1d1d",
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: "#607089", fontSize: 14 }}>Loading drafts...</div>
      ) : visibleDrafts.length === 0 ? (
        <div style={{ color: "#607089", fontSize: 14 }}>No drafts yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleDrafts.map((draft) => (
            <div
              key={draft.id}
              style={{
                borderRadius: 14,
                border: "1px solid rgba(11,46,95,0.08)",
                padding: 12,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    color: "#0B2E5F",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {draft.title}
                </div>
                <div style={{ fontSize: 12, color: "#607089", marginTop: 4 }}>
                  {new Date(draft.updatedAt).toLocaleString("nl-NL")}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => onRestoreDraft(draft)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(11,46,95,0.12)",
                    background: "#fff",
                    color: "#0B2E5F",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Restore
                </button>

                <button
                  type="button"
                  onClick={() => void handleDeleteDraft(draft.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(185,28,28,0.12)",
                    background: "rgba(185,28,28,0.05)",
                    color: "#8f1d1d",
                    fontWeight: 700,
                    cursor: "pointer",
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
