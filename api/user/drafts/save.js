import { requireSession } from "../../../lib/auth.js";
import { saveDraftForUser } from "../../../lib/drafts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const draft = await saveDraftForUser(auth.user.id, req.body || {});
    return res.status(200).json({ ok: true, draft });
  } catch (error) {
    return res.status(400).json({
      error: "Could not save draft",
      message: String(error?.message || error),
    });
  }
}
