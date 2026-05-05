import React, { useEffect, useRef, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { LANGUAGES, type PortalLanguage } from "./i18n";

type Props = {
  user: {
    email: string;
    role: "admin" | "user";
  };
  language: PortalLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<PortalLanguage>>;
  onOpenUsers: () => void;
  onOpenUsage: () => void;
  onOpenBranding: () => void;
  onOpenViewAsUser?: () => void;
  onOpenTaskHistory?: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
};

const LANGUAGE_FLAGS: Record<PortalLanguage, string> = {
  en: "GB",
  nl: "NL",
  de: "DE",
  fr: "FR",
};

export default function AccountMenu({
  user,
  language,
  setLanguage,
  onOpenUsers,
  onOpenUsage,
  onOpenBranding,
  onOpenViewAsUser,
  onOpenTaskHistory,
  onOpenChangePassword,
  onLogout,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
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
  const isAdmin = user.role === "admin";

  return (
    <div ref={rootRef} style={rootStyle}>
      <style>
        {`
          @keyframes accountMenuDropIn {
            from {
              opacity: 0;
              transform: translateY(-8px) scale(0.98);
            }

            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes accountMenuItemDropIn {
            from {
              opacity: 0;
              transform: translateY(-6px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          ...triggerStyle,
          animation: open ? "accountMenuItemDropIn 220ms ease-out" : "none",
        }}
      >
        <span style={avatarStyle}>{initials}</span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={accountLabelStyle}>{isAdmin ? "Admin" : "Client"}</span>
          <span style={emailStyle}>{user.email}</span>
        </span>

        <span style={chevronStyle}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={menuStyle}>
          <div style={menuHeaderStyle}>
            <span style={largeAvatarStyle}>{initials}</span>

            <div style={{ minWidth: 0 }}>
              <div style={menuEmailStyle}>{user.email}</div>
              <div style={menuRoleStyle}>
                {isAdmin ? "Administrator" : "Client user"}
              </div>
            </div>
          </div>

          <div style={languageBlockStyle}>
            <div style={languageTitleStyle}>Language</div>

            <div style={languageButtonsStyle}>
              {LANGUAGES.map((item) => {
                const active = item.code === language;

                return (
                  <button
                    key={item.code}
                    type="button"
                    aria-label={item.label}
                    onClick={() => setLanguage(item.code)}
                    style={{
                      ...languageButtonStyle,
                      ...(active ? languageButtonActiveStyle : {}),
                    }}
                  >
                    <ReactCountryFlag
                      countryCode={LANGUAGE_FLAGS[item.code]}
                      svg
                      title={item.label}
                      style={{
                        width: "20px",
                        height: "15px",
                        borderRadius: 3,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {isAdmin && (
            <>
              <MenuItem label="Manage users" onClick={onOpenUsers} close={() => setOpen(false)} />
              <MenuItem label="Usage dashboard" onClick={onOpenUsage} close={() => setOpen(false)} />
              <MenuItem label="Client branding" onClick={onOpenBranding} close={() => setOpen(false)} />

              {onOpenViewAsUser && (
                <MenuItem label="View as user" onClick={onOpenViewAsUser} close={() => setOpen(false)} />
              )}
            </>
          )}

          {!isAdmin && onOpenTaskHistory && (
            <MenuItem label="Portal task list" onClick={onOpenTaskHistory} close={() => setOpen(false)} />
          )}

          <MenuItem label="Change password" onClick={onOpenChangePassword} close={() => setOpen(false)} />

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

function MenuItem({
  label,
  onClick,
  close,
}: {
  label: string;
  onClick: () => void;
  close: () => void;
}) {
  return (
    <button
      type="button"
      style={menuItemStyle}
      onClick={() => {
        close();
        onClick();
      }}
    >
      {label}
    </button>
  );
}

const rootStyle: React.CSSProperties = {
  position: "relative",
};

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 260,
  maxWidth: 340,
  height: 58,
  padding: "8px 10px",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(255,255,255,0.92)",
  color: "#0B2E5F",
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
};

const avatarStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #0B2E5F, #16457F)",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 900,
  flex: "0 0 auto",
};

const largeAvatarStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #0B2E5F, #16457F)",
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: 900,
  flex: "0 0 auto",
};

const accountLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  lineHeight: 1,
  color: "#64748B",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const emailStyle: React.CSSProperties = {
  display: "block",
  marginTop: 5,
  fontSize: 12,
  color: "#0B2E5F",
  fontWeight: 800,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chevronStyle: React.CSSProperties = {
  fontSize: 9,
  color: "#64748B",
  flex: "0 0 auto",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 10px)",
  width: 286,
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(148,163,184,0.22)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.18)",
  zIndex: 20000,
  animation: "accountMenuDropIn 240ms ease-out",
};

const menuHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.08)",
  background: "linear-gradient(135deg, rgba(248,251,255,0.96), rgba(255,255,255,0.98))",
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
  fontSize: 11,
  color: "#64748B",
  fontWeight: 700,
};

const languageBlockStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.06)",
  background: "#FFFFFF",
};

const languageTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748B",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const languageButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const languageButtonStyle: React.CSSProperties = {
  width: 38,
  height: 32,
  padding: 0,
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(255,255,255,0.92)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(15,23,42,0.06)",
};

const languageButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0B2E5F, #16457F)",
  border: "1px solid rgba(11,46,95,0.92)",
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "13px 16px",
  border: 0,
  background: "#FFFFFF",
  color: "#0B2E5F",
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
  borderBottom: "1px solid rgba(11,46,95,0.06)",
  animation: "accountMenuItemDropIn 220ms ease-out",
};

const dangerItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "13px 16px",
  border: 0,
  background: "rgba(185,28,28,0.05)",
  color: "#8F1D1D",
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
  animation: "accountMenuItemDropIn 220ms ease-out",
};
