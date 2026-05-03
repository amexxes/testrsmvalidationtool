import React, { useEffect, useMemo, useState } from "react";
import { t, type PortalLanguage } from "./i18n";

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
  language: PortalLanguage;
  onRestoreDraft: (draft: UserDraft) => void;
};

function localeForLanguage(language: PortalLanguage): string {
  if (language === "nl") return "nl-NL";
  if (language === "de") return "de-DE";
  if (language === "fr") return "fr-FR";
  return "en-GB";
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
    setSaving(true);
    setError("");

    try {
      const title =
        String(referenceValue || "").trim() ||
        `${activePage.toUpperCase()} ${draftText(language, "fallbackTitle")}`;

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
        marginTop: 14,
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(11,46,95,0.10)",
        background: "rgba(255,255,255,0.72)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div
            style={{
              fontSize: 20,
              lineHeight: 1.2,
              fontWeight: 700,
              color: "#0B2E5F",
              margin: 0,
            }}
          >
            {t(language, "drafts")}
          </div>

          <div
            style={{
              maxWidth: 760,
              fontSize: 14,
              lineHeight: 1.55,
              fontWeight: 500,
              color: "#0B2E5F",
              marginTop: 6,
            }}
          >
            {draftText(language, "help")}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || !inputValue.trim()}
          style={{
            padding: "9px 12px",
            borderRadius: 12,
            border: "1px solid rgba(11,46,95,0.12)",
            background: "#fff",
            color: "#0B2E5F",
            fontWeight: 800,
            cursor: saving || !inputValue.trim() ? "not-allowed" : "pointer",
            opacity: saving || !inputValue.trim() ? 0.55 : 1,
          }}
        >
          {saving ? draftText(language, "saving") : t(language, "saveDraft")}
        </button>
      </div>

      {error ? (
        <div className="callout" style={{ marginTop: 10 }}>
          <b style={{ color: "var(--bad)" }}>{t(language, "error")}</b>: {error}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{draftText(language, "loading")}</div>
        ) : visibleDrafts.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>{draftText(language, "empty")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleDrafts.map((draft) => (
              <div
                key={draft.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  padding: 10,
                  borderRadius: 14,
                  border: "1px solid rgba(11,46,95,0.10)",
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "#0B2E5F",
                      fontSize: 14,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {draft.title}
                  </div>

                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 3 }}>
                    {new Date(draft.updatedAt).toLocaleString(localeForLanguage(language))}
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
