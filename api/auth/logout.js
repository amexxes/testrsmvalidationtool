import {
  clearSessionCookie,
  deleteSessionByToken,
  getSessionTokenFromReq,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = getSessionTokenFromReq(req);

    if (token) {
      await deleteSessionByToken(token);
    }

    clearSessionCookie(res);

    return res.status(200).json({ ok: true });
  } catch (error) {
    clearSessionCookie(res);

    return res.status(200).json({
      ok: true,
      message: String(error?.message || error),
    });
  }
}
