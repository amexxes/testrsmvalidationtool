import React, { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

async function readApiResponse(resp: Response) {
  const text = await resp.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: resp.ok ? "" : `Request failed (${resp.status})`,
    };
  }
}

export default function ChangePasswordPanel({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
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
      const resp = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await readApiResponse(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || `Request failed (${resp.status})`);
        return;
      }

      setSuccess("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "#0B2E5F" }}>Change password</h2>
            <p style={{ margin: "6px 0 0", color: "#607089" }}>
              Your other sessions will be signed out after the password change.
            </p>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={inputStyle}
          />

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

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" style={primaryButtonStyle} disabled={loading}>
              {loading ? "Saving..." : "Save password"}
            </button>

            <button type="button" style={secondaryButtonStyle} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(5,16,34,0.42)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  zIndex: 20000,
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const closeButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.10)",
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
