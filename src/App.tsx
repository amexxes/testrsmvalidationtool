// /src/App.tsx
import React, { useEffect, useState } from "react";
import ToolApp from "./ToolApp";
import LoginPage from "./LoginPage";
import AdminUsersPanel from "./AdminUsersPanel";
import ChangePasswordPanel from "./ChangePasswordPanel";
import AccountMenu from "./AccountMenu";
import AdminUsageDashboard from "./AdminUsageDashboard";
import AdminClientBrandingPanel from "./AdminClientBrandingPanel";

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
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const AccountMenuAny = AccountMenu as any;

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);

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

  function handleLoggedIn(nextUser: AuthUser) {
    setUser(nextUser);
    setChecking(false);
    setAdminOpen(false);
    setChangePasswordOpen(false);
    setUsageOpen(false);
    setBrandingOpen(false);
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
      setUsageOpen(false);
      setBrandingOpen(false);
    }
  }

  if (checking) {
    return (
      <div style={loadingShellStyle}>
        <div style={loadingCardStyle}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <>
      <ToolApp />

      <div style={accountMenuWrapStyle}>
        <AccountMenuAny
          user={user}
          onOpenUsers={() => setAdminOpen(true)}
          onOpenUsage={() => setUsageOpen(true)}
          onOpenBranding={() => setBrandingOpen(true)}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {user.role === "admin" && (
        <AdminUsersPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      )}

   {user.role === "admin" && (
  <AdminClientBrandingPanel
    open={brandingOpen}
    onClose={() => setBrandingOpen(false)}
  />
)}

      <ChangePasswordPanel
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}

const loadingShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background:
    "radial-gradient(circle at top, rgba(43,179,230,0.10), transparent 30%), linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
};

const loadingCardStyle: React.CSSProperties = {
  minWidth: 220,
  padding: "18px 20px",
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.88)",
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 600,
  textAlign: "center",
  boxShadow: "0 14px 40px rgba(15,23,42,0.08)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const accountMenuWrapStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  right: 24,
  zIndex: 25000,
  maxWidth: "calc(100vw - 32px)",
};
