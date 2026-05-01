import {
  deleteAllPasswordResetTokensForEmail,
  deleteAllSessionsForEmail,
  getPasswordResetByToken,
  updateUserPasswordByEmail,
} from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const token = String(body.token || "");
    const newPassword = String(body.newPassword || "");

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    const reset = await getPasswordResetByToken(token);
    if (!reset?.email) {
      return res.status(400).json({ error: "Reset link is invalid or expired" });
    }

    await updateUserPasswordByEmail(reset.email, newPassword);
    await deleteAllSessionsForEmail(reset.email);
    await deleteAllPasswordResetTokensForEmail(reset.email);

    return res.status(200).json({
      ok: true,
      message: "Password reset complete",
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (message === "Password must be at least 8 characters") {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Reset password failed",
      message,
    });
  }
}
