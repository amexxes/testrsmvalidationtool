import { requireAdmin } from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    return res.status(200).json({
      ok: true,
      events: [],
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load usage events",
      message: String(error?.message || error),
    });
  }
}
