import React, { useEffect, useRef, useState } from "react";

type Props = {
  user: {
    email: string;
    role: "admin" | "user";
  };
  onOpenUsers: () => void;
  onOpenUsage: () => void;
  onOpenBranding: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
};

export default function AccountMenu({
  user,
  onOpenUsers,
  onOpenUsage,
  onOpenBranding,
  onOpenChangePassword,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (!rootRef.current) return;

      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const initials = String(user.email || "?").slice(0, 1).toUpperCase();

  return (
    <div ref={rootRef} style={rootStyle}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={triggerStyle}
      >
        <span style={avatarStyle}>{initials}</span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={accountLabelStyle}>Account</span>
          <span style={emailStyle}>{user.email}</span>
        </span>

        <span style={chevronStyle}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={menuStyle}>
          <div style={menuHeaderStyle}>
            <div style={menuEmailStyle}>{user.email}</div>
            <div style={menuRoleStyle}>
              {user.role === "admin" ? "Administrator" : "User"}
            </div>
          </div>

          {user.role === "admin" && (
            <>
              <button
                type="button"
                style={menuItemStyle}
                onClick={() => {
                  setOpen(false);
                  onOpenUsers();
                }}
              >
                Manage users
              </button>

              <button
                type="button"
                style={menuItemStyle}
                onClick={() => {
                  setOpen(false);
                  onOpenUsage();
                }}
              >
                Usage dashboard
              </button>

              <button
                type="button"
                style={menuItemStyle}
                onClick={() => {
                  setOpen(false);
                  onOpenBranding();
                }}
              >
                Client branding
              </button>
            </>
          )}

          <button
            type="button"
            style={menuItemStyle}
            onClick={() => {
              setOpen(false);
              onOpenChangePassword();
            }}
          >
            Change password
          </button>

          <button
            type="button"
            style={dangerItemStyle}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  position: "relative",
};

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 280,
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(11,46,95,0.10)",
  background: "rgba(255,255,255,0.94)",
  color: "#0B2E5F",
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(11,46,95,0.08)",
};

const avatarStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #0B2E5F, #2BB3E6)",
  color: "#fff",
  fontWeight: 800,
  flex: "0 0 auto",
};

const accountLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  lineHeight: 1.2,
  color: "#64748b",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const emailStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 13,
  color: "#0B2E5F",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chevronStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  flex: "0 0 auto",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: "calc(100% + 10px)",
  width: 280,
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.18)",
  zIndex: 20000,
};

const menuHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.08)",
  background: "rgba(11,46,95,0.03)",
};

const menuEmailStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0B2E5F",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const menuRoleStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
  fontWeight: 700,
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  border: 0,
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
  borderBottom: "1px solid rgba(11,46,95,0.06)",
};

const dangerItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  border: 0,
  background: "rgba(185,28,28,0.05)",
  color: "#8f1d1d",
  fontWeight: 700,
  cursor: "pointer",
};
