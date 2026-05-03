import { requireAdmin } from "../../../lib/auth.js";
import { getBrandingForEmail } from "../../../lib/client-branding.js";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const email = String(req.query.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    const branding = await getBrandingForEmail(email);

    return res.status(200).json({
      ok: true,
      viewAs: {
        email,
      },
      branding,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load view-as branding",
      message: String(error?.message || error),
    });
  }
}
