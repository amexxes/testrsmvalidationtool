import { requireAdmin } from "../../../lib/auth.js";
import { listBrandingProfiles } from "../../../lib/client-branding.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const profiles = await listBrandingProfiles();

    return res.status(200).json({
      ok: true,
      profiles,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load client branding",
      message: String(error?.message || error),
    });
  }
}
