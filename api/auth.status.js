import { hasAnyAdmin } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const bootstrapped = await hasAnyAdmin();
  return res.status(200).json({ bootstrapped });
}
