import { requireSession } from "../../../lib/auth.js";
import { saveDraftForUser } from "../../../lib/user-drafts.js";

function parseBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  return req.body || {};
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const body = parseBody(req);

    const draft = await saveDraftForUser(auth.user.email, {
      activePage: body.activePage,
      title: body.title,
      referenceValue: body.referenceValue,
      inputValue: body.inputValue,
    });

    return res.status(200).json({
      ok: true,
      draft,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not save draft",
      message: String(error?.message || error),
    });
  }
}
