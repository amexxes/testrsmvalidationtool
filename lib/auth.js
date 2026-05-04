import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redis } from "./redis.js";

export const SESSION_COOKIE_NAME = "rsm_auth_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24;
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

const USERS_INDEX_KEY = "auth:users:index";
const ADMINS_INDEX_KEY = "auth:admins:index";

function isProduction() {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
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

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getUserKey(email) {
  return `auth:user:${normalizeEmail(email)}`;
}

function getSessionKey(token) {
  return `auth:session:${token}`;
}

function getUserSessionsKey(email) {
  return `auth:user-sessions:${normalizeEmail(email)}`;
}

function getPasswordResetKey(token) {
  return `auth:password-reset:${token}`;
}

function getPasswordResetIndexKey(email) {
  return `auth:password-reset-index:${normalizeEmail(email)}`;
}

export function serializeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    active: Boolean(user.active),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || null,
  };
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const raw = await redis.get(getUserKey(normalized));
  return safeParse(raw);
}

export async function hasAnyAdmin() {
  const admins = await redis.smembers(ADMINS_INDEX_KEY);
  return Array.isArray(admins) && admins.length > 0;
}

export async function countAdmins() {
  const admins = await redis.smembers(ADMINS_INDEX_KEY);
  return Array.isArray(admins) ? admins.length : 0;
}

export async function createUser({ email, password, role = "user" }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (cleanPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (!normalizedEmail.includes("@")) {
    throw new Error("Email is not valid");
  }

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await bcrypt.hash(cleanPassword, 12);

  const now = new Date().toISOString();

  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    role: role === "admin" ? "admin" : "user",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(getUserKey(normalizedEmail), JSON.stringify(user));
  await redis.sadd(USERS_INDEX_KEY, normalizedEmail);

  if (user.role === "admin") {
    await redis.sadd(ADMINS_INDEX_KEY, normalizedEmail);
  }

  return serializeUser(user);
}

export async function listUsers() {
  const emails = await redis.smembers(USERS_INDEX_KEY);

  if (!Array.isArray(emails) || emails.length === 0) {
    return [];
  }

  const users = await Promise.all(emails.map((email) => findUserByEmail(email)));

  return users
    .filter(Boolean)
    .map(serializeUser)
    .sort((a, b) => a.email.localeCompare(b.email, "en"));
}

export async function verifyPassword(user, password) {
  if (!user?.passwordHash) return false;
  return bcrypt.compare(String(password || ""), user.passwordHash);
}

export async function createSessionForUser(user) {
  const token = crypto.randomBytes(32).toString("hex");

  const session = {
    userId: user.id,
    email: user.email,
    role: user.role,
    createdAt: new Date().toISOString(),
  };

  await redis.set(getSessionKey(token), JSON.stringify(session), {
    ex: SESSION_TTL_SECONDS,
  });

  await redis.sadd(getUserSessionsKey(user.email), token);

  return token;
}

export async function getSessionByToken(token) {
  if (!token) return null;
  const raw = await redis.get(getSessionKey(token));
  return safeParse(raw);
}

export async function getSessionSecondsLeft(token) {
  if (!token) return -2;
  return redis.ttl(getSessionKey(token));
}

export async function deleteSessionByToken(token) {
  if (!token) return;

  const session = await getSessionByToken(token);
  await redis.del(getSessionKey(token));

  if (session?.email) {
    await redis.srem(getUserSessionsKey(session.email), token);
  }
}

export async function deleteAllSessionsForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const sessionKey = getUserSessionsKey(normalizedEmail);
  const tokens = await redis.smembers(sessionKey);

  if (Array.isArray(tokens) && tokens.length > 0) {
    await Promise.all(tokens.map((token) => redis.del(getSessionKey(token))));
  }

  await redis.del(sessionKey);
}

export async function updateUserPasswordByEmail(email, newPassword) {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(newPassword || "");

  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  if (cleanPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("User not found");
  }

  user.passwordHash = await bcrypt.hash(cleanPassword, 12);
  user.updatedAt = new Date().toISOString();

  await redis.set(getUserKey(normalizedEmail), JSON.stringify(user));

  return serializeUser(user);
}

export async function createPasswordResetToken(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const user = await findUserByEmail(normalizedEmail);
  if (!user || !user.active) return null;

  await deleteAllPasswordResetTokensForEmail(normalizedEmail);

  const token = crypto.randomBytes(32).toString("hex");
  const payload = {
    email: normalizedEmail,
    createdAt: new Date().toISOString(),
  };

  await redis.set(getPasswordResetKey(token), JSON.stringify(payload), {
    ex: PASSWORD_RESET_TTL_SECONDS,
  });

  await redis.sadd(getPasswordResetIndexKey(normalizedEmail), token);

  return token;
}

export async function getPasswordResetByToken(token) {
  if (!token) return null;
  const raw = await redis.get(getPasswordResetKey(token));
  return safeParse(raw);
}

export async function deletePasswordResetByToken(token) {
  if (!token) return;

  const payload = await getPasswordResetByToken(token);
  await redis.del(getPasswordResetKey(token));

  if (payload?.email) {
    await redis.srem(getPasswordResetIndexKey(payload.email), token);
  }
}

export async function deleteAllPasswordResetTokensForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const indexKey = getPasswordResetIndexKey(normalizedEmail);
  const tokens = await redis.smembers(indexKey);

  if (Array.isArray(tokens) && tokens.length > 0) {
    await Promise.all(tokens.map((token) => redis.del(getPasswordResetKey(token))));
  }

  await redis.del(indexKey);
}

export async function deleteUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const user = await findUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error("User not found");
  }

  await deleteAllSessionsForEmail(normalizedEmail);
  await deleteAllPasswordResetTokensForEmail(normalizedEmail);

  await redis.del(getUserKey(normalizedEmail));
  await redis.srem(USERS_INDEX_KEY, normalizedEmail);
  await redis.srem(ADMINS_INDEX_KEY, normalizedEmail);

  return serializeUser(user);
}

export function parseCookies(cookieHeader = "") {
  const out = {};

  for (const part of String(cookieHeader || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    out[key] = decodeURIComponent(value);
  }

  return out;
}

export function getSessionTokenFromReq(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE_NAME] || "";
}

function buildSessionCookie(token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token || "")}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (isProduction()) {
    parts.push("Secure");
  }

  if (maxAgeSeconds <= 0) {
    parts.push("Max-Age=0");
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  } else {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }

  return parts.join("; ");
}

export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", buildSessionCookie(token, SESSION_TTL_SECONDS));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", buildSessionCookie("", 0));
}

export async function requireSession(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const session = await getSessionByToken(token);
  if (!session?.email) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Session expired" });
    return null;
  }

  const user = await findUserByEmail(session.email);
  if (!user || !user.active) {
    await deleteSessionByToken(token);
    clearSessionCookie(res);
    res.status(401).json({ error: "User not found or inactive" });
    return null;
  }

  return {
    token,
    session,
    user,
  };
}

export async function requireAdmin(req, res) {
  const auth = await requireSession(req, res);
  if (!auth) return null;

  if (auth.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }

  return auth;
}
