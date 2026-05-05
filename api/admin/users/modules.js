import { requireAdmin, updateUserModulesByEmail } from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const email = String(body.email || "");
    const modules = body.modules || {};

    const user = await updateUserModulesByEmail(email, modules);

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (message === "Email is required" || message === "User not found") {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Update modules failed",
      message,
    });
  }
}
