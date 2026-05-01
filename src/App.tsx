import React, { useEffect, useState } from "react";
import ToolApp from "./ToolApp";
import LoginPage from "./LoginPage";
import AdminUsersPanel from "./AdminUsersPanel";
import ResetPasswordPage from "./ResetPasswordPage";
import ChangePasswordPanel from "./ChangePasswordPanel";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

function getResetTokenFromUrl() {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  return url.searchParams.get("resetToken") || "";
}

function removeResetTokenFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("resetToken");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

async function readApiResponse(resp: Response) {
  const text = await resp.text();

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    setResetToken(getResetTokenFromUrl());
    void loadSession();
  }, []);

  async function loadSession() {
    setChecking(true);

    try {
      const resp = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!resp.ok) {
        setUser(null);
        return;
      }

      const data = await readApiResponse(resp);
      setUser(data?.user || null);
    } catch {
      setUser(null);
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setAdminOpen(false);
      setChangePasswordOpen(false);
    }
  }

  function closeResetPage() {
    removeResetTokenFromUrl();
    setResetToken("");
  }

  if (resetToken) {
    return <ResetPasswordPage token={resetToken} onDone={closeResetPage} />;
  }

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "radial-gradient(circle at top left, rgba(43,179,230,0.28), transparent 30%), radial-gradient(circle at bottom right, rgba(11,46,95,0.24), transparent 30%), linear-gradient(135deg, #f5f8fc 0%, #eaf0f8 100%)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.84)",
            border: "1px solid rgba(0,0,0,0.08)",
            color: "#0B2E5F",
            fontWeight: 700,
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  return (
    <>
      <div style={headerOuterStyle}>
        <div style={headerInnerStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={headerTitleStyle}>RSM Validation Portal</div>
            <div style={headerSubtitleStyle}>
              VAT VIES checker and TIN checker
            </div>
          </div>

          <div style={headerRightStyle}>
            <div style={userChipStyle}>
              <span style={{ opacity: 0.7 }}>Signed in as</span>
              <b>{user.email}</b>
              {user.role === "admin" && <span style={adminBadgeStyle}>Admin</span>}
            </div>

            {user.role === "admin" && (
              <button
                type="button"
                onClick={() => setAdminOpen(true)}
                style={headerSecondaryButton}
              >
                Users
              </button>
            )}

            <button
              type="button"
              onClick={() => setChangePasswordOpen(true)}
              style={headerSecondaryButton}
            >
              Change password
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={headerPrimaryButton}
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 88 }}>
        <ToolApp />
      </div>

      <AdminUsersPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChangePasswordPanel
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}

const headerOuterStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 14000,
  padding: "14px 18px",
  background: "rgba(245,248,252,0.78)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  borderBottom: "1px solid rgba(11,46,95,0.08)",
};

const headerInnerStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const headerTitleStyle: React.CSSProperties = {
  color: "#0B2E5F",
  fontWeight: 800,
  fontSize: 18,
  lineHeight: 1.1,
};

const headerSubtitleStyle: React.CSSProperties = {
  color: "#5d708d",
  fontSize: 13,
  marginTop: 4,
};

const headerRightStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const userChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(0,0,0,0.08)",
  color: "#0B2E5F",
  fontSize: 13,
};

const adminBadgeStyle: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(43,179,230,0.12)",
  border: "1px solid rgba(43,179,230,0.18)",
  fontWeight: 700,
  fontSize: 12,
};

const headerPrimaryButton: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(11,46,95,0.14)",
};

const headerSecondaryButton: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "rgba(255,255,255,0.94)",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(11,46,95,0.08)",
};
