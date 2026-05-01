import { requireSession } from "../../../lib/auth.js";
import { deleteDraftForUser } from "../../../lib/drafts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const draftId = String(req.body?.draftId || "").trim();
    if (!draftId) {
      return res.status(400).json({ error: "draftId is required" });
    }

    await deleteDraftForUser(auth.user.id, draftId);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: "Could not delete draft",
      message: String(error?.message || error),
    });
  }
}
