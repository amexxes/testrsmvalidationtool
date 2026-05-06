import React, { useEffect, useRef, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { LANGUAGES, type PortalLanguage } from "./i18n";

type Props = {
user: {
  email: string;
  role: "admin" | "user";
  vatSubscription?: "starter" | "business" | "enterprise";
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
const PORTAL_FONT =
  "'Prelo', 'Noto Sans', 'Noto Sans Georgian', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans JP', 'Noto Sans TC', 'Noto Sans SC', 'Noto Sans KR', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const RSM_BLUE = "#009CDE";
const RSM_TEXT = "#515356";
const RSM_DARK = "#2F3033";
const RSM_RED = "#8F1D1D";
function subscriptionLabel(value?: "starter" | "business" | "enterprise") {
  if (value === "business") return "Business";
  if (value === "enterprise") return "Enterprise";
  return "Starter";
}
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
  const subscription = subscriptionLabel(user.vatSubscription);

  return (
 <div ref={rootRef} style={rootStyle}>
  <style>
    {`
      @keyframes accountMenuDropIn {
        from {
          opacity: 0;
          transform: translateY(14px) scaleY(0.88);
        }

        to {
          opacity: 1;
          transform: translateY(0) scaleY(1);
        }
      }
    `}
  </style>

  <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={triggerStyle}
      >
        <span style={avatarStyle}>{initials}</span>

<span style={{ minWidth: 0, flex: 1 }}>
  <span style={accountLabelStyle}>Account</span>
  <span style={emailStyle}>{user.email}</span>
  <span style={subscriptionStyle}>Subscription: {subscription}</span>
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
onClick={() => {
  setLanguage(item.code);
}}
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

              {onOpenViewAsUser && (
                <button
                  type="button"
                  style={menuItemStyle}
                  onClick={() => {
                    setOpen(false);
                    onOpenViewAsUser();
                  }}
                >
                  View as user
                </button>
              )}
            </>
          )}

          {user.role !== "admin" && onOpenTaskHistory && (
            <button
              type="button"
              style={menuItemStyle}
              onClick={() => {
                setOpen(false);
                onOpenTaskHistory();
              }}
            >
              Portal task list
            </button>
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
  fontFamily: PORTAL_FONT,
  color: RSM_TEXT,
};

const triggerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 280,
  maxWidth: 360,
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.58)",
  background: "rgba(255,255,255,0.62)",
  color: RSM_DARK,
  cursor: "pointer",
  boxShadow: "0 14px 34px rgba(81,83,86,0.14)",
  backdropFilter: "blur(18px) saturate(1.35)",
  WebkitBackdropFilter: "blur(18px) saturate(1.35)",
  fontFamily: PORTAL_FONT,
};

const avatarStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: RSM_BLUE,
  color: "#fff",
  fontFamily: PORTAL_FONT,
  fontWeight: 700,
  flex: "0 0 auto",
};

const accountLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: PORTAL_FONT,
  fontSize: 11,
  lineHeight: 1.2,
  color: RSM_TEXT,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const emailStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  fontFamily: PORTAL_FONT,
  fontSize: 13,
  color: RSM_DARK,
  fontWeight: 700,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chevronStyle: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 10,
  color: RSM_TEXT,
  flex: "0 0 auto",
};

const menuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: "calc(100% + 10px)",
  width: 286,
  borderRadius: 18,
  overflow: "hidden",
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(255,255,255,0.58)",
  boxShadow: "0 24px 60px rgba(81,83,86,0.18)",
  backdropFilter: "blur(18px) saturate(1.35)",
  WebkitBackdropFilter: "blur(18px) saturate(1.35)",
  zIndex: 20000,
  transformOrigin: "bottom right",
  animation: "accountMenuDropIn 520ms cubic-bezier(0.16, 1, 0.3, 1)",
  fontFamily: PORTAL_FONT,
  color: RSM_TEXT,
};

const menuHeaderStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid rgba(81,83,86,0.10)",
  background: "rgba(255,255,255,0.38)",
};

const menuEmailStyle: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 13,
  fontWeight: 700,
  color: RSM_DARK,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const menuRoleStyle: React.CSSProperties = {
  marginTop: 4,
  fontFamily: PORTAL_FONT,
  fontSize: 12,
  color: RSM_TEXT,
  fontWeight: 300,
};

const languageBlockStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(81,83,86,0.08)",
  background: "rgba(255,255,255,0.34)",
};

const languageTitleStyle: React.CSSProperties = {
  fontFamily: PORTAL_FONT,
  fontSize: 12,
  fontWeight: 700,
  color: RSM_TEXT,
  marginBottom: 8,
};

const languageButtonsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const languageButtonStyle: React.CSSProperties = {
  width: 36,
  height: 30,
  padding: 0,
  borderRadius: 999,
  border: "1px solid rgba(81,83,86,0.16)",
  background: "rgba(255,255,255,0.58)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontFamily: PORTAL_FONT,
};

const languageButtonActiveStyle: React.CSSProperties = {
  background: RSM_BLUE,
  color: "#fff",
};

const menuItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  border: 0,
  background: "rgba(255,255,255,0.42)",
  color: RSM_DARK,
  fontFamily: PORTAL_FONT,
  fontWeight: 700,
  cursor: "pointer",
  borderBottom: "1px solid rgba(81,83,86,0.08)",
};

const dangerItemStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  border: 0,
  background: "rgba(185,28,28,0.05)",
  color: RSM_RED,
  fontFamily: PORTAL_FONT,
  fontWeight: 700,
  cursor: "pointer",
};

const subscriptionStyle: React.CSSProperties = {
  display: "block",
  marginTop: 3,
  fontFamily: PORTAL_FONT,
  fontSize: 11,
  color: RSM_TEXT,
  fontWeight: 300,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
