import {
  requireSession,
  getVatCreditStatusForUser,
} from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed",
      message: "Use GET",
    });
  }

  const auth = await requireSession(req, res);
  if (!auth) return;

  try {
    const vat_credits = await getVatCreditStatusForUser(auth.user);

    return res.status(200).json({
      ok: true,
      vat_credits,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not load VAT credits",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
