import crypto from "node:crypto";
import { redis } from "./redis.js";

const DRAFTS_INDEX_PREFIX = "user:drafts:index:";
const DRAFT_PREFIX = "user:draft:";
const MAX_TITLE_LENGTH = 120;
const MAX_REFERENCE_LENGTH = 200;
const MAX_INPUT_LENGTH = 500000;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function draftsIndexKey(email) {
  return `${DRAFTS_INDEX_PREFIX}${normalizeEmail(email)}`;
}

function draftKey(email, draftId) {
  return `${DRAFT_PREFIX}${normalizeEmail(email)}:${String(draftId || "")}`;
}

function cleanString(value, maxLength) {
  return String(value || "").slice(0, maxLength);
}

function normalizeActivePage(value) {
  const page = String(value || "").trim().toLowerCase();

  if (page === "tin") return "tin";
  if (page === "eori") return "eori";

  return "vat";
}

function normalizeDraft(raw) {
  if (!raw || !raw.id) return null;

  return {
    id: String(raw.id),
    title: cleanString(raw.title || `${normalizeActivePage(raw.activePage).toUpperCase()} draft`, MAX_TITLE_LENGTH),
    activePage: normalizeActivePage(raw.activePage),
    referenceValue: cleanString(raw.referenceValue, MAX_REFERENCE_LENGTH),
    inputValue: cleanString(raw.inputValue, MAX_INPUT_LENGTH),
    createdAt: raw.createdAt || raw.updatedAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

export async function listDraftsForUser(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return [];

  const ids = await redis.smembers(draftsIndexKey(normalizedEmail));
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const drafts = await Promise.all(
    ids.map(async (id) => normalizeDraft(safeParse(await redis.get(draftKey(normalizedEmail, id)))))
  );

  return drafts
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function saveDraftForUser(email, payload = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("User email is required");
  }

  const activePage = normalizeActivePage(payload.activePage);
  const now = new Date().toISOString();
  const draft = {
    id: crypto.randomUUID(),
    title: cleanString(payload.title || `${activePage.toUpperCase()} draft`, MAX_TITLE_LENGTH),
    activePage,
    referenceValue: cleanString(payload.referenceValue, MAX_REFERENCE_LENGTH),
    inputValue: cleanString(payload.inputValue, MAX_INPUT_LENGTH),
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(draftKey(normalizedEmail, draft.id), JSON.stringify(draft));
  await redis.sadd(draftsIndexKey(normalizedEmail), draft.id);

  return draft;
}

export async function deleteDraftForUser(email, draftId) {
  const normalizedEmail = normalizeEmail(email);
  const cleanDraftId = String(draftId || "").trim();

  if (!normalizedEmail) {
    throw new Error("User email is required");
  }

  if (!cleanDraftId) {
    throw new Error("Draft id is required");
  }

  await redis.del(draftKey(normalizedEmail, cleanDraftId));
  await redis.srem(draftsIndexKey(normalizedEmail), cleanDraftId);

  return true;
}
