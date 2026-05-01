import React, { useEffect, useState } from "react";
import ToolApp from "./ToolApp";
import LoginPage from "./LoginPage";
import AdminUsersPanel from "./AdminUsersPanel";
import ChangePasswordPanel from "./ChangePasswordPanel";
import AccountMenu from "./AccountMenu";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

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

  useEffect(() => {
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
              Official VAT VIES and TIN validation
            </div>
          </div>

          <AccountMenu
            user={user}
            onOpenUsers={() => setAdminOpen(true)}
            onOpenChangePassword={() => setChangePasswordOpen(true)}
            onLogout={handleLogout}
          />
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
