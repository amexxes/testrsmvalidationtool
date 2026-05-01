import crypto from "node:crypto";
import { redis } from "./redis.js";

const USER_DRAFTS_KEY_PREFIX = "user:drafts";
const MAX_DRAFTS_PER_USER = 20;
const MAX_INPUT_LENGTH = 200000;

function getDraftsKey(userId) {
  return `${USER_DRAFTS_KEY_PREFIX}:${String(userId || "").trim()}`;
}

function safeParse(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function cleanInput(value) {
  return String(value || "").slice(0, MAX_INPUT_LENGTH);
}

function normalizePage(value) {
  return value === "tin" ? "tin" : "vat";
}

function sortDrafts(drafts) {
  return [...drafts].sort((a, b) => {
    const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTs - aTs;
  });
}

export async function listDraftsForUser(userId) {
  const key = getDraftsKey(userId);
  if (!key.endsWith(":")) {
    const raw = await redis.get(key);
    return sortDrafts(safeParse(raw));
  }
  return [];
}

export async function saveDraftForUser(userId, payload) {
  const key = getDraftsKey(userId);
  const existing = await listDraftsForUser(userId);

  const now = new Date().toISOString();
  const incomingId = cleanText(payload?.id, 80);
  const draftId = incomingId || crypto.randomUUID();

  const previous = existing.find((d) => d.id === draftId);

  const activePage = normalizePage(payload?.activePage);
  const referenceValue = cleanText(payload?.referenceValue, 120);
  const inputValue = cleanInput(payload?.inputValue);
  const title =
    cleanText(payload?.title, 120) ||
    referenceValue ||
    `${activePage.toUpperCase()} draft`;

  if (!inputValue.trim()) {
    throw new Error("Input is required");
  }

  const nextDraft = {
    id: draftId,
    title,
    activePage,
    referenceValue,
    inputValue,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  const filtered = existing.filter((d) => d.id !== draftId);
  const next = sortDrafts([nextDraft, ...filtered]).slice(0, MAX_DRAFTS_PER_USER);

  await redis.set(key, JSON.stringify(next));
  return nextDraft;
}

export async function deleteDraftForUser(userId, draftId) {
  const key = getDraftsKey(userId);
  const existing = await listDraftsForUser(userId);
  const next = existing.filter((d) => d.id !== String(draftId || "").trim());
  await redis.set(key, JSON.stringify(next));
  return true;
}
