import {
  getSessionSecondsLeft,
  requireSession,
  serializeUser,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  const secondsLeft = await getSessionSecondsLeft(auth.token);

  return res.status(200).json({
    ok: true,
    user: serializeUser(auth.user),
    secondsLeft,
  });
}
