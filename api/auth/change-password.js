import {
  createSessionForUser,
  deleteAllPasswordResetTokensForEmail,
  deleteAllSessionsForEmail,
  requireSession,
  setSessionCookie,
  updateUserPasswordByEmail,
  verifyPassword,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    const ok = await verifyPassword(auth.user, currentPassword);
    if (!ok) {
      return res.status(400).json({ error: "Current password is not correct" });
    }

    await updateUserPasswordByEmail(auth.user.email, newPassword);
    await deleteAllPasswordResetTokensForEmail(auth.user.email);
    await deleteAllSessionsForEmail(auth.user.email);

    const refreshedUser = {
      ...auth.user,
      updatedAt: new Date().toISOString(),
    };

    const newToken = await createSessionForUser(refreshedUser);
    setSessionCookie(res, newToken);

    return res.status(200).json({
      ok: true,
      message: "Password changed",
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (message === "Password must be at least 8 characters") {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Change password failed",
      message,
    });
  }
}
