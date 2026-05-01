import React, { useState } from "react";

type Props = {
  token: string;
  onDone: () => void;
};

export default function ResetPasswordPage({ token, onDone }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (newPassword !== repeatPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch("/api/auth/forgot-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Reset failed");
        return;
      }

      setSuccess("Your password has been reset. You can sign in now.");
    } catch {
      setError("Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(43,179,230,0.28), transparent 30%), radial-gradient(circle at bottom right, rgba(11,46,95,0.24), transparent 30%), linear-gradient(135deg, #f5f8fc 0%, #eaf0f8 100%)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 24,
          padding: 28,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.08)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 24px 60px rgba(11,46,95,0.12)",
        }}
      >
        <h1 style={{ margin: 0, color: "#0B2E5F" }}>Reset password</h1>
        <p style={{ marginTop: 8, color: "#5f6f86" }}>
          Enter a new password for your account.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Repeat new password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            style={inputStyle}
          />

          {error && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>{success}</div>}

          {!success ? (
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Saving..." : "Save new password"}
            </button>
          ) : (
            <button type="button" style={secondaryButtonStyle} onClick={onDone}>
              Back to sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "rgba(255,255,255,0.95)",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8f1d1d",
  fontSize: 14,
};

const successStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(10,122,61,0.08)",
  border: "1px solid rgba(10,122,61,0.12)",
  color: "#0a6a38",
  fontSize: 14,
};
