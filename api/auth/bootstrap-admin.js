import {
  createSessionForUser,
  createUser,
  hasAnyAdmin,
  setSessionCookie,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const setupKey = process.env.ADMIN_SETUP_KEY;

    if (!setupKey) {
      return res.status(500).json({
        error: "ADMIN_SETUP_KEY is missing on Vercel",
      });
    }

    const alreadyBootstrapped = await hasAnyAdmin();
    if (alreadyBootstrapped) {
      return res.status(400).json({
        error: "An admin already exists",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const providedSetupKey = String(body.setupKey || "");
    const email = String(body.email || "");
    const password = String(body.password || "");

    if (providedSetupKey !== setupKey) {
      return res.status(401).json({
        error: "Setup key is not correct",
      });
    }

    const user = await createUser({
      email,
      password,
      role: "admin",
    });

    const token = await createSessionForUser(user);
    setSessionCookie(res, token);

    return res.status(200).json({
      ok: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Bootstrap failed",
      message: String(error?.message || error),
    });
  }
}
