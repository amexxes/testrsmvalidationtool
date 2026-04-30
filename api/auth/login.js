import {
  createSessionForUser,
  findUserByEmail,
  serializeUser,
  setSessionCookie,
  verifyPassword,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = body.email || "";
    const password = body.password || "";

    const user = await findUserByEmail(email);

    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await verifyPassword(user, password);

    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = await createSessionForUser(user);
    setSessionCookie(res, token);

    return res.status(200).json({
      ok: true,
      user: serializeUser(user),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Login failed",
      message: String(error?.message || error),
    });
  }
}
