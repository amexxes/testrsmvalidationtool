// /src/UserDraftsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { t, type PortalLanguage } from "./i18n";

export type DraftPage = "vat" | "tin" | "eori";

export type UserDraft = {
  id: string;
  title: string;
  activePage: DraftPage;
  referenceValue: string;
  inputValue: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  activePage: DraftPage;
  referenceValue?: string;
  inputValue: string;
  language: PortalLanguage;
  onRestoreDraft: (draft: UserDraft) => void;
};

function localeForLanguage(language: PortalLanguage): string {
  if (language === "nl") return "nl-NL";
  if (language === "de") return "de-DE";
  if (language === "fr") return "fr-FR";
  return "en-GB";
}

function pageLabel(page: DraftPage): string {
  if (page === "vat") return "VAT";
  if (page === "tin") return "TIN";
  return "EORI";
}

function draftText(language: PortalLanguage, key: string): string {
  const copy: Record<PortalLanguage, Record<string, string>> = {
    en: {
      help: "Save current input and continue later.",
      saving: "Saving...",
      loading: "Loading drafts...",
      empty: "No drafts yet.",
      loadError: "Could not load drafts",
      saveError: "Could not save draft",
      deleteError: "Could not delete draft",
      fallbackTitle: "draft",
    },
    nl: {
      help: "Sla je huidige invoer op en ga later verder.",
      saving: "Opslaan...",
      loading: "Concepten laden...",
      empty: "Nog geen concepten.",
      loadError: "Kon concepten niet laden",
      saveError: "Kon concept niet opslaan",
      deleteError: "Kon concept niet verwijderen",
      fallbackTitle: "concept",
    },
    de: {
      help: "Aktuelle Eingabe speichern und später fortfahren.",
      saving: "Speichern...",
      loading: "Entwürfe laden...",
      empty: "Noch keine Entwürfe.",
      loadError: "Entwürfe konnten nicht geladen werden",
      saveError: "Entwurf konnte nicht gespeichert werden",
      deleteError: "Entwurf konnte nicht gelöscht werden",
      fallbackTitle: "Entwurf",
    },
    fr: {
      help: "Enregistrez la saisie actuelle et continuez plus tard.",
      saving: "Enregistrement...",
      loading: "Chargement des brouillons...",
      empty: "Aucun brouillon pour le moment.",
      loadError: "Impossible de charger les brouillons",
      saveError: "Impossible d’enregistrer le brouillon",
      deleteError: "Impossible de supprimer le brouillon",
      fallbackTitle: "brouillon",
    },
  };

  return copy[language]?.[key] || copy.en[key] || key;
}

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
  language,
  onRestoreDraft,
}: Props) {
  const [drafts, setDrafts] = useState<UserDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => draft.activePage === activePage),
    [drafts, activePage]
  );

  useEffect(() => {
    void loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setError(data?.error || data?.message || draftText(language, "loadError"));
        return;
      }

      setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : draftText(language, "loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!String(inputValue || "").trim()) return;

    setSaving(true);
    setError("");

    try {
      const title =
        String(referenceValue || "").trim() ||
        `${pageLabel(activePage)} ${draftText(language, "fallbackTitle")}`;

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
        setError(data?.error || data?.message || draftText(language, "saveError"));
        return;
      }

      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : draftText(language, "saveError"));
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
        setError(data?.error || data?.message || draftText(language, "deleteError"));
        return;
      }

      await loadDrafts();
    } catch (err) {
      setError(err instanceof Error ? err.message : draftText(language, "deleteError"));
    }
  }

  return (
    <div
      style={{
        borderRadius: 22,
        border: "1px solid rgba(11,46,95,0.08)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 14px 42px rgba(15,23,42,0.05)",
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              color: "#0B2E5F",
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            {t(language, "drafts")}
          </div>

          <div
            style={{
              marginTop: 5,
              color: "#607089",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {draftText(language, "help")}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveDraft()}
          disabled={saving || !String(inputValue || "").trim()}
          style={{
            minWidth: 150,
            height: 38,
            borderRadius: 12,
            border: "1px solid rgba(11,46,95,0.12)",
            background: "#FFFFFF",
            color: "#0B2E5F",
            fontSize: 13,
            fontWeight: 850,
            cursor: saving || !String(inputValue || "").trim() ? "not-allowed" : "pointer",
            opacity: saving || !String(inputValue || "").trim() ? 0.55 : 1,
          }}
        >
          {saving ? draftText(language, "saving") : t(language, "saveDraft")}
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: "1px solid rgba(185,28,28,0.14)",
            background: "rgba(185,28,28,0.07)",
            color: "#8F1D1D",
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <b>{t(language, "error")}</b>: {error}
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div style={emptyStyle}>{draftText(language, "loading")}</div>
        ) : visibleDrafts.length === 0 ? (
          <div style={emptyStyle}>{draftText(language, "empty")}</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibleDrafts.map((draft) => (
              <div
                key={draft.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(220px, 1fr) auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(11,46,95,0.08)",
                  background: "#FFFFFF",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "#0B2E5F",
                      fontSize: 13,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={draft.title}
                  >
                    {draft.title}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      color: "#607089",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {new Date(draft.updatedAt).toLocaleString(localeForLanguage(language))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
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
                    {t(language, "restore")}
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
                    {t(language, "delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px dashed rgba(11,46,95,0.14)",
  background: "rgba(248,251,255,0.72)",
  color: "#607089",
  fontSize: 13,
  fontWeight: 700,
};
