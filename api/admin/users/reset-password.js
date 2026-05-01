import {
  deleteAllPasswordResetTokensForEmail,
  deleteAllSessionsForEmail,
  normalizeEmail,
  requireAdmin,
  updateUserPasswordByEmail,
} from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = normalizeEmail(body.email || "");
    const newPassword = String(body.newPassword || "");

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and new password are required" });
    }

    await updateUserPasswordByEmail(email, newPassword);
    await deleteAllSessionsForEmail(email);
    await deleteAllPasswordResetTokensForEmail(email);

    return res.status(200).json({
      ok: true,
      message: "Password reset",
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (
      message === "User not found" ||
      message === "Password must be at least 8 characters"
    ) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Admin reset password failed",
      message,
    });
  }
}
