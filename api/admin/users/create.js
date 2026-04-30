import { createUser, requireAdmin } from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = String(body.email || "");
    const password = String(body.password || "");
    const role = String(body.role || "user");

    const user = await createUser({
      email,
      password,
      role: role === "admin" ? "admin" : "user",
    });

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    const message = String(error?.message || error);

    if (message === "User already exists") {
      return res.status(409).json({ error: message });
    }

    if (
      message === "Email is required" ||
      message === "Password must be at least 8 characters" ||
      message === "Email is not valid"
    ) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({
      error: "Create user failed",
      message,
    });
  }
}
