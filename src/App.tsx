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

type ClientBranding = {
  id: string;
  clientName: string;
  portalTitle: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  allowedDomains?: string[];
  active?: boolean;
};

const DEFAULT_BRANDING: ClientBranding = {
  id: "default",
  clientName: "RSM Netherlands",
  portalTitle: "RSM Validation Portal",
  logoUrl: "/rsm-logo.svg",
  primaryColor: "#0B2E5F",
  accentColor: "#63C7F2",
  backgroundColor: "#F8FBFF",
  textColor: "#1E293B",
  allowedDomains: [],
  active: true,
};

async function readApiResponse(resp: Response) {
  const text = await resp.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function applyBrandingVars(branding: ClientBranding) {
  const root = document.documentElement;

  root.style.setProperty("--navy", branding.primaryColor || DEFAULT_BRANDING.primaryColor);
  root.style.setProperty("--navy-soft", branding.primaryColor || DEFAULT_BRANDING.primaryColor);
  root.style.setProperty("--cyan", branding.accentColor || DEFAULT_BRANDING.accentColor);
  root.style.setProperty("--text", branding.textColor || DEFAULT_BRANDING.textColor);
  root.style.setProperty("--client-bg", branding.backgroundColor || DEFAULT_BRANDING.backgroundColor);

  document.title = branding.portalTitle || DEFAULT_BRANDING.portalTitle;
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [branding, setBranding] = useState<ClientBranding>(DEFAULT_BRANDING);

  const [adminOpen, setAdminOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);

  useEffect(() => {
    applyBrandingVars(DEFAULT_BRANDING);
    void loadSession();
  }, []);

  async function loadBranding() {
    try {
      const resp = await fetch("/api/branding/current", {
        credentials: "include",
      });

      if (!resp.ok) {
        setBranding(DEFAULT_BRANDING);
        applyBrandingVars(DEFAULT_BRANDING);
        return;
      }

      const data = await readApiResponse(resp);
      const nextBranding = data?.branding || DEFAULT_BRANDING;

      setBranding(nextBranding);
      applyBrandingVars(nextBranding);
    } catch {
      setBranding(DEFAULT_BRANDING);
      applyBrandingVars(DEFAULT_BRANDING);
    }
  }

  async function loadSession() {
    setChecking(true);

    try {
      const resp = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!resp.ok) {
        setUser(null);
        setBranding(DEFAULT_BRANDING);
        applyBrandingVars(DEFAULT_BRANDING);
        return;
      }

      const data = await readApiResponse(resp);
      const nextUser = data?.user || null;

      setUser(nextUser);

      if (nextUser) {
        await loadBranding();
      }
    } catch {
      setUser(null);
      setBranding(DEFAULT_BRANDING);
      applyBrandingVars(DEFAULT_BRANDING);
    } finally {
      setChecking(false);
    }
  }

  async function handleLoggedIn(nextUser: AuthUser) {
    setUser(nextUser);
    setChecking(false);
    setAdminOpen(false);
    setChangePasswordOpen(false);
    setUsageOpen(false);
    setBrandingOpen(false);

    await loadBranding();
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
      setBranding(DEFAULT_BRANDING);
      applyBrandingVars(DEFAULT_BRANDING);
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
      <ToolApp branding={branding} />

      <div style={accountMenuWrapStyle}>
        <AccountMenu
          user={user}
          onOpenUsers={() => setAdminOpen(true)}
          onOpenUsage={() => setUsageOpen(true)}
          onOpenBranding={() => setBrandingOpen(true)}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {user.role === "admin" && (
        <AdminUsersPanel
          open={adminOpen}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {user.role === "admin" && (
        <AdminUsageDashboard
          open={usageOpen}
          onClose={() => setUsageOpen(false)}
        />
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
