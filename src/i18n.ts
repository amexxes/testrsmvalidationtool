export type PortalLanguage = "en" | "nl" | "de" | "fr";

export const LANGUAGES: Array<{ code: PortalLanguage; label: string }> = [
  { code: "en", label: "EN" },
  { code: "nl", label: "NL" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
];

export const DEFAULT_LANGUAGE: PortalLanguage = "en";

export function getStoredLanguage(): PortalLanguage {
  const value = localStorage.getItem("portalLanguage");

  if (value === "nl" || value === "de" || value === "fr" || value === "en") {
    return value;
  }

  return DEFAULT_LANGUAGE;
}

export function storeLanguage(language: PortalLanguage) {
  localStorage.setItem("portalLanguage", language);
}

const translations = {
  en: {
    credits: "Credits",
    unlimited: "Unlimited",
    mode: "Mode",
    lastUpdate: "Last update",
    country: "Country",
    validate: "Validate",
    validating: "Validating…",
    clear: "Clear",
    cancel: "Cancel",
    progress: "Progress",
    preCheck: "Pre-check",
    results: "Results",
    export: "Export",
    saveDraft: "Save draft",
    drafts: "Drafts",
    restore: "Restore",
    delete: "Delete",
    vatSubtitle: "VAT / VIES batch checks and review.",
    tinSubtitle: "TIN batch checks and review.",
  },
  nl: {
    credits: "Credits",
    unlimited: "Onbeperkt",
    mode: "Modus",
    lastUpdate: "Laatste update",
    country: "Land",
    validate: "Valideren",
    validating: "Valideren…",
    clear: "Wissen",
    cancel: "Annuleren",
    progress: "Voortgang",
    preCheck: "Voorcontrole",
    results: "Resultaten",
    export: "Exporteren",
    saveDraft: "Concept opslaan",
    drafts: "Concepten",
    restore: "Herstellen",
    delete: "Verwijderen",
    vatSubtitle: "VAT / VIES batchvalidaties en review.",
    tinSubtitle: "TIN batchvalidaties en review.",
  },
  de: {
    credits: "Credits",
    unlimited: "Unbegrenzt",
    mode: "Modus",
    lastUpdate: "Letzte Aktualisierung",
    country: "Land",
    validate: "Prüfen",
    validating: "Prüfen…",
    clear: "Leeren",
    cancel: "Abbrechen",
    progress: "Fortschritt",
    preCheck: "Vorprüfung",
    results: "Ergebnisse",
    export: "Exportieren",
    saveDraft: "Entwurf speichern",
    drafts: "Entwürfe",
    restore: "Wiederherstellen",
    delete: "Löschen",
    vatSubtitle: "VAT / VIES-Batchprüfungen und Review.",
    tinSubtitle: "TIN-Batchprüfungen und Review.",
  },
  fr: {
    credits: "Crédits",
    unlimited: "Illimité",
    mode: "Mode",
    lastUpdate: "Dernière mise à jour",
    country: "Pays",
    validate: "Valider",
    validating: "Validation…",
    clear: "Effacer",
    cancel: "Annuler",
    progress: "Progression",
    preCheck: "Pré-contrôle",
    results: "Résultats",
    export: "Exporter",
    saveDraft: "Enregistrer le brouillon",
    drafts: "Brouillons",
    restore: "Restaurer",
    delete: "Supprimer",
    vatSubtitle: "Contrôles batch VAT / VIES et revue.",
    tinSubtitle: "Contrôles batch TIN et revue.",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(language: PortalLanguage, key: TranslationKey): string {
  return translations[language]?.[key] || translations.en[key] || key;
}
