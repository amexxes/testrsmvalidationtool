// /src/UserDraftsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { t, type PortalLanguage } from "./i18n";

export type DraftPage = "vat" | "tin" | "eori" | "lei" | "company";

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

function pageLabel(page: DraftPage) {
  if (page === "vat") return "VAT";
  if (page === "tin") return "TIN";
  if (page === "eori") return "EORI";
  if (page === "lei") return "LEI";
  return "Company Register";
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
const PORTAL_FONT =
  "'Prelo', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

type DraftButtonIcon = "draft" | "restore" | "delete";

function DraftButtonText({
  icon,
  children,
}: {
  icon: DraftButtonIcon;
  children: React.ReactNode;
}) {
  const paths: Record<DraftButtonIcon, React.ReactNode> = {
    draft: (
      <>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M16 4v4h4" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
    restore: (
      <>
        <path d="M4 12a8 8 0 0 1 13.66-5.66" />
        <path d="M20 4v6h-6" />
        <path d="M20 12a8 8 0 0 1-13.66 5.66" />
      </>
    ),
    delete: (
      <>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </>
    ),
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        fontFamily: PORTAL_FONT,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <g
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths[icon]}
        </g>
      </svg>

      <span>{children}</span>
    </span>
  );
}

const DRAFT_PANEL_STYLE: React.CSSProperties = {
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.58)",
  background: "rgba(255,255,255,0.58)",
  boxShadow: "0 22px 60px rgba(11,46,95,0.12)",
  backdropFilter: "blur(18px) saturate(1.28)",
  WebkitBackdropFilter: "blur(18px) saturate(1.28)",
  padding: 18,
};

const DRAFT_BUTTON_STYLE: React.CSSProperties = {
  minWidth: 132,
  height: 38,
  minHeight: 38,
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.62)",
  background: "rgba(255,255,255,0.48)",
  color: "#0B2E5F",
  boxShadow: "0 12px 30px rgba(11,46,95,0.12)",
  backdropFilter: "blur(14px) saturate(1.25)",
  WebkitBackdropFilter: "blur(14px) saturate(1.25)",
  fontFamily: PORTAL_FONT,
  cursor: "pointer",
};

const DRAFT_DELETE_BUTTON_STYLE: React.CSSProperties = {
  ...DRAFT_BUTTON_STYLE,
  border: "1px solid rgba(185,28,28,0.14)",
  background: "rgba(185,28,28,0.05)",
  color: "#8F1D1D",
};

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
  <div style={DRAFT_PANEL_STYLE}>
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
            fontFamily: PORTAL_FONT,
            fontSize: 18,
            lineHeight: 1.2,
            fontWeight: 700,
            color: "#2F3033",
            margin: 0,
          }}
        >
          {t(language, "drafts")}
        </div>

        <div
          style={{
            fontFamily: PORTAL_FONT,
            fontSize: 13,
            lineHeight: 1.55,
            fontWeight: 300,
            color: "#515356",
            marginTop: 6,
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
          ...DRAFT_BUTTON_STYLE,
          minWidth: 154,
          padding: "0 14px",
          cursor: saving || !String(inputValue || "").trim() ? "not-allowed" : "pointer",
          opacity: saving || !String(inputValue || "").trim() ? 0.55 : 1,
        }}
      >
        <DraftButtonText icon="draft">
          {saving ? draftText(language, "saving") : t(language, "saveDraft")}
        </DraftButtonText>
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
          fontFamily: PORTAL_FONT,
          fontSize: 13,
          lineHeight: 1.45,
          fontWeight: 300,
        }}
      >
        <b style={{ fontWeight: 700 }}>{t(language, "error")}</b>: {error}
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
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: 12,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.58)",
                background: "rgba(255,255,255,0.48)",
                boxShadow: "0 12px 30px rgba(11,46,95,0.08)",
                backdropFilter: "blur(14px) saturate(1.25)",
                WebkitBackdropFilter: "blur(14px) saturate(1.25)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: PORTAL_FONT,
                    color: "#2F3033",
                    fontSize: 13,
                    lineHeight: 1.35,
                    fontWeight: 700,
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
                    fontFamily: PORTAL_FONT,
                    color: "#515356",
                    fontSize: 12,
                    lineHeight: 1.35,
                    fontWeight: 300,
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
                    ...DRAFT_BUTTON_STYLE,
                    minWidth: 132,
                    padding: "0 12px",
                  }}
                >
                  <DraftButtonText icon="restore">
                    {t(language, "restore")}
                  </DraftButtonText>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDeleteDraft(draft.id)}
                  style={{
                    ...DRAFT_DELETE_BUTTON_STYLE,
                    minWidth: 132,
                    padding: "0 12px",
                  }}
                >
                  <DraftButtonText icon="delete">
                    {t(language, "delete")}
                  </DraftButtonText>
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
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.58)",
  background: "rgba(255,255,255,0.38)",
  color: "#515356",
  fontFamily: PORTAL_FONT,
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 300,
  boxShadow: "0 10px 24px rgba(11,46,95,0.06)",
  backdropFilter: "blur(14px) saturate(1.25)",
  WebkitBackdropFilter: "blur(14px) saturate(1.25)",
};
