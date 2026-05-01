import {
  countAdmins,
  deleteUserByEmail,
  findUserByEmail,
  normalizeEmail,
  requireAdmin,
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

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (email === auth.user.email) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    if (user.role === "admin") {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: "You cannot delete the last admin" });
      }
    }

    await deleteUserByEmail(email);

    return res.status(200).json({
      ok: true,
      message: "User deleted",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Delete user failed",
      message: String(error?.message || error),
    });
  }
}
