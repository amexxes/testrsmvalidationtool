import { listUsers, requireAdmin } from "../../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  try {
    const users = await listUsers();

    return res.status(200).json({
      ok: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      error: "List users failed",
      message: String(error?.message || error),
    });
  }
}
