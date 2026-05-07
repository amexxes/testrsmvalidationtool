import { requireAdmin, updateUserTrialByEmail } from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const email = String(body.email || "").trim().toLowerCase();
    const isTrial = Boolean(body.isTrial);
    const trialEndsAt = String(body.trialEndsAt || "").trim();

    const user = await updateUserTrialByEmail(email, {
      isTrial,
      trialEndsAt,
    });

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Update trial failed",
      message: String(error?.message || error),
    });
  }
}
