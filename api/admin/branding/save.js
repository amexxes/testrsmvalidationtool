import { requireAdmin } from "../../../lib/auth.js";
import { saveBrandingProfile } from "../../../lib/client-branding.js";

function parseBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  return req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const body = parseBody(req);
    const profile = await saveBrandingProfile(body);

    return res.status(200).json({
      ok: true,
      profile,
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (
      message === "Client name is required" ||
      message === "At least one client domain is required"
    ) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Could not save client branding",
      message,
    });
  }
}
