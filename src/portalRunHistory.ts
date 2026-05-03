export type PortalRunType = "vat" | "tin";

export type PortalRunSummary = {
  id: string;
  type: PortalRunType;
  createdAt: string;
  updatedAt: string;
  label: string;
  total: number;
  done: number;
  valid: number;
  invalid: number;
  pending: number;
  errors: number;
  formatIssues?: number;
  country?: string;
  caseRef?: string;
};

const HISTORY_PREFIX = "portal_run_history:";
const MAX_RUNS = 50;

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function keyForUser(email: string) {
  return `${HISTORY_PREFIX}${normalizeEmail(email)}`;
}

function safeParse(value: string | null): PortalRunSummary[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPortalRunHistory(email: string): PortalRunSummary[] {
  return safeParse(localStorage.getItem(keyForUser(email))).sort((a, b) =>
    String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
  );
}

export function upsertPortalRunHistory(email: string, run: PortalRunSummary): PortalRunSummary[] {
  const current = loadPortalRunHistory(email);
  const next = [run, ...current.filter((item) => item.id !== run.id)]
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, MAX_RUNS);

  localStorage.setItem(keyForUser(email), JSON.stringify(next));
  return next;
}

export function clearPortalRunHistory(email: string): PortalRunSummary[] {
  localStorage.removeItem(keyForUser(email));
  return [];
}
