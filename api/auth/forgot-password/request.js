import { createPasswordResetToken, normalizeEmail } from "../../../lib/auth.js";

function getBaseUrl(req) {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, "");
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;

  if (!host) return "";
  return `${proto}://${host}`;
}

async function sendResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "Forgot password email is not configured. Add RESEND_API_KEY and PASSWORD_RESET_FROM_EMAIL in Vercel."
    );
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your password",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0B2E5F;">
          <h2 style="margin-bottom: 12px;">Reset your password</h2>
          <p>You requested a password reset.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#0B2E5F;color:#ffffff;text-decoration:none;font-weight:700;">
              Reset password
            </a>
          </p>
          <p>This link expires in 1 hour.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  const text = await resp.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!resp.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        text ||
        `Email send failed (${resp.status})`
    );
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const email = normalizeEmail(body.email || "");

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const baseUrl = getBaseUrl(req);
    if (!baseUrl) {
      return res.status(500).json({ error: "Base URL could not be determined" });
    }

    const token = await createPasswordResetToken(email);

    if (token) {
      const resetUrl = `${baseUrl}/?resetToken=${encodeURIComponent(token)}`;
      await sendResetEmail({ to: email, resetUrl });
    }

    return res.status(200).json({
      ok: true,
      message: "If this email exists, a reset link has been sent.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Forgot password failed",
      message: String(error?.message || error),
    });
  }
}
