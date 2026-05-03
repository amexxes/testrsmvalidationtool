import { requireSession } from "../../../lib/auth.js";
import { listDraftsForUser } from "../../../lib/user-drafts.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const drafts = await listDraftsForUser(auth.user.email);

    return res.status(200).json({
      ok: true,
      drafts,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load drafts",
      message: String(error?.message || error),
    });
  }
}
