import React, { useState } from "react";

type Props = {
  open: boolean;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onApply: (email: string) => void;
};

export default function AdminViewAsUserPanel({
  open,
  loading = false,
  error = "",
  onClose,
  onApply,
}: Props) {
  const [email, setEmail] = useState("");

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>View as user</h2>
            <p style={subtitleStyle}>
              Preview the customer portal with the branding of a specific user.
            </p>
          </div>

          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Close
          </button>
        </div>

        <form
          style={formStyle}
          onSubmit={(e) => {
            e.preventDefault();
            onApply(email);
          }}
        >
          <label style={labelStyle}>
            Customer email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@client.com"
              style={inputStyle}
              autoComplete="off"
            />
          </label>

          {error ? <div style={errorStyle}>{error}</div> : null}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={loading || !email.trim()} style={primaryButtonStyle}>
              {loading ? "Loading..." : "View as user"}
            </button>

            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
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
  zIndex: 30000,
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 520,
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.97)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  letterSpacing: "-0.03em",
  color: "#0B2E5F",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.5,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 750,
  color: "#0B2E5F",
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
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8f1d1d",
  fontSize: 13,
};
