import { requireSession } from "../../lib/auth.js";
import { getBrandingForEmail } from "../../lib/client-branding.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const branding = await getBrandingForEmail(auth.user.email);

    return res.status(200).json({
      ok: true,
      branding,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load branding",
      message: String(error?.message || error),
    });
  }
}
