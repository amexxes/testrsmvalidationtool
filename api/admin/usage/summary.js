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
      summary: {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.active).length,
        adminUsers: users.filter((u) => u.role === "admin").length,
        normalUsers: users.filter((u) => u.role === "user").length,
        totalEvents: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load usage summary",
      message: String(error?.message || error),
    });
  }
}
