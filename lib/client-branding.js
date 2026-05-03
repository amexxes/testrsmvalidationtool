import crypto from "node:crypto";
import { redis } from "./redis.js";

const BRANDING_INDEX_KEY = "client-branding:index";
const BRANDING_PROFILE_PREFIX = "client-branding:profile:";
const BRANDING_DOMAIN_PREFIX = "client-branding:domain:";

const DEFAULT_BRANDING = {
  id: "default",
  clientName: "RSM Netherlands",
  portalTitle: "RSM Validation Portal",
  logoUrl: "/rsm-logo.svg",
  primaryColor: "#0B2E5F",
  accentColor: "#63C7F2",
  backgroundColor: "#F8FBFF",
  textColor: "#1E293B",
  allowedDomains: [],
  active: true,
};

function safeParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cleanString(value, maxLength = 200) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanHex(value, fallback) {
  const v = cleanString(value, 20);
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}

function getProfileKey(id) {
  return `${BRANDING_PROFILE_PREFIX}${String(id || "").trim()}`;
}

function getDomainKey(domain) {
  return `${BRANDING_DOMAIN_PREFIX}${normalizeDomain(domain)}`;
}

function normalizeDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function normalizeDomains(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[,\n;]/)
        .map((x) => x.trim());

  return Array.from(
    new Set(raw.map(normalizeDomain).filter((x) => x && x.includes(".")))
  );
}

function normalizeLogoUrl(value) {
  const v = cleanString(value, 1200);

  if (!v) return "";
  if (v.startsWith("/")) return v;
  if (v.startsWith("https://")) return v;
  if (v.startsWith("http://")) return v;
  if (v.startsWith("data:image/") && v.length <= 1200) return v;

  return "";
}

function normalizeProfile(raw) {
  if (!raw) return null;

  const now = new Date().toISOString();
  const id = cleanString(raw.id || crypto.randomUUID(), 80);

  return {
    id,
    clientName: cleanString(raw.clientName || "Client", 120),
    portalTitle: cleanString(raw.portalTitle || "Validation Portal", 120),
    logoUrl: normalizeLogoUrl(raw.logoUrl),
    primaryColor: cleanHex(raw.primaryColor, DEFAULT_BRANDING.primaryColor),
    accentColor: cleanHex(raw.accentColor, DEFAULT_BRANDING.accentColor),
    backgroundColor: cleanHex(raw.backgroundColor, DEFAULT_BRANDING.backgroundColor),
    textColor: cleanHex(raw.textColor, DEFAULT_BRANDING.textColor),
    allowedDomains: normalizeDomains(raw.allowedDomains),
    active: raw.active === false ? false : true,
    createdAt: raw.createdAt || now,
    updatedAt: now,
  };
}

export function getDefaultBranding() {
  return DEFAULT_BRANDING;
}

export async function listBrandingProfiles() {
  const ids = await redis.smembers(BRANDING_INDEX_KEY);

  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const profiles = await Promise.all(
    ids.map(async (id) => {
      const raw = await redis.get(getProfileKey(id));
      return normalizeProfile(safeParse(raw));
    })
  );

  return profiles
    .filter(Boolean)
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "nl"));
}

export async function saveBrandingProfile(payload = {}) {
  const existing = payload.id
    ? safeParse(await redis.get(getProfileKey(payload.id)))
    : null;

  const profile = normalizeProfile({
    ...existing,
    ...payload,
    id: payload.id || crypto.randomUUID(),
    createdAt: existing?.createdAt,
  });

  if (!profile.clientName) {
    throw new Error("Client name is required");
  }

  if (!profile.allowedDomains.length) {
    throw new Error("At least one client domain is required");
  }

  if (existing?.allowedDomains?.length) {
    await Promise.all(
      normalizeDomains(existing.allowedDomains).map((domain) =>
        redis.del(getDomainKey(domain))
      )
    );
  }

  await redis.set(getProfileKey(profile.id), JSON.stringify(profile));
  await redis.sadd(BRANDING_INDEX_KEY, profile.id);

  if (profile.active) {
    await Promise.all(
      profile.allowedDomains.map((domain) =>
        redis.set(getDomainKey(domain), profile.id)
      )
    );
  }

  return profile;
}

export async function deleteBrandingProfile(id) {
  const cleanId = cleanString(id, 80);

  if (!cleanId) {
    throw new Error("Branding id is required");
  }

  const existing = safeParse(await redis.get(getProfileKey(cleanId)));

  if (existing?.allowedDomains?.length) {
    await Promise.all(
      normalizeDomains(existing.allowedDomains).map((domain) =>
        redis.del(getDomainKey(domain))
      )
    );
  }

  await redis.del(getProfileKey(cleanId));
  await redis.srem(BRANDING_INDEX_KEY, cleanId);

  return true;
}

export async function getBrandingForEmail(email) {
  const domain = normalizeDomain(String(email || "").split("@")[1] || "");

  if (!domain) {
    return DEFAULT_BRANDING;
  }

  const profileId = await redis.get(getDomainKey(domain));
  const raw = profileId ? await redis.get(getProfileKey(profileId)) : null;
  const profile = normalizeProfile(safeParse(raw));

  if (!profile || !profile.active) {
    return DEFAULT_BRANDING;
  }

  return profile;
}
