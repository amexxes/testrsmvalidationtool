// /src/App.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ToolApp from "./ToolApp";
import LoginPage from "./LoginPage";
import AdminUsersPanel from "./AdminUsersPanel";
import ChangePasswordPanel from "./ChangePasswordPanel";
import AccountMenu from "./AccountMenu";
import {
  getStoredLanguage,
  storeLanguage,
  type PortalLanguage,
} from "./i18n";
import AdminUsageDashboard from "./AdminUsageDashboard";
import AdminClientBrandingPanel from "./AdminClientBrandingPanel";
import PortalTaskHistoryPanel from "./PortalTaskHistoryPanel";
import AdminViewAsUserPanel from "./AdminViewAsUserPanel";
import {
  clearPortalRunHistory,
  loadPortalRunHistory,
  upsertPortalRunHistory,
  type PortalRunSummary,
} from "./portalRunHistory";

type ActivePage = "vat" | "tin" | "eori" | "iban";

type ClientModules = Record<ActivePage, boolean>;

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  modules?: Partial<ClientModules>;
  vatSubscription?: "starter" | "business" | "enterprise";
  isTrial?: boolean;
  trialEndsAt?: string;
};

const DEFAULT_CLIENT_MODULES: ClientModules = {
  vat: true,
  tin: false,
  eori: false,
  iban: false,
};

const ADMIN_CLIENT_MODULES: ClientModules = {
  vat: true,
  tin: true,
  eori: true,
  iban: true,
};

function normalizeClientModules(
  role: "admin" | "user",
  modules?: Partial<ClientModules>
): ClientModules {
  if (role === "admin") return ADMIN_CLIENT_MODULES;

  return {
    ...DEFAULT_CLIENT_MODULES,
    ...(modules || {}),
    vat: true,
  };
}

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
  isTrial?: boolean;
  trialEndsAt?: string;
};

const DEFAULT_BRANDING: ClientBranding = {
  id: "default",
  clientName: "RSM Netherlands",
  portalTitle: "RSM Validation Portal",
  logoUrl: "/rsmlogo.png",
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
  const [language, setLanguage] = useState<PortalLanguage>(() => getStoredLanguage());

  const [adminOpen, setAdminOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [brandingOpen, setBrandingOpen] = useState(false);

  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);
  const [portalRuns, setPortalRuns] = useState<PortalRunSummary[]>([]);

  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [viewAsLoading, setViewAsLoading] = useState(false);
  const [viewAsError, setViewAsError] = useState("");
  const [viewAsEmail, setViewAsEmail] = useState("");
  const [viewAsBranding, setViewAsBranding] = useState<ClientBranding | null>(null);

const effectiveBranding = useMemo(() => {
  const baseBranding = viewAsBranding || branding;

  return {
    ...baseBranding,
    isTrial: Boolean(user?.isTrial),
    trialEndsAt: user?.trialEndsAt || "",
  };
}, [viewAsBranding, branding, user]);
const effectiveClientModules = useMemo(() => {
  if (!user) return DEFAULT_CLIENT_MODULES;

  return normalizeClientModules(user.role, user.modules);
}, [user]);
  useEffect(() => {
    applyBrandingVars(DEFAULT_BRANDING);
    void loadSession();
  }, []);

  useEffect(() => {
    storeLanguage(language);
  }, [language]);

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
        setPortalRuns([]);
        resetViewAs(false);
        setBranding(DEFAULT_BRANDING);
        applyBrandingVars(DEFAULT_BRANDING);
        return;
      }

      const data = await readApiResponse(resp);
      const nextUser = data?.user || null;

      setUser(nextUser);

      if (nextUser) {
        setPortalRuns(loadPortalRunHistory(nextUser.email));
        await loadBranding();
      }
    } catch {
      setUser(null);
      setPortalRuns([]);
      resetViewAs(false);
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
    setTaskHistoryOpen(false);
    resetViewAs(false);

    setPortalRuns(loadPortalRunHistory(nextUser.email));

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
      setTaskHistoryOpen(false);

      resetViewAs(false);
      setPortalRuns([]);
      setBranding(DEFAULT_BRANDING);
      applyBrandingVars(DEFAULT_BRANDING);
    }
  }

const handleRunCompleted = useCallback(
  (summary: PortalRunSummary) => {
    if (!user || user.role === "admin") return;

    const next = upsertPortalRunHistory(user.email, summary);
    setPortalRuns(next);
  },
  [user]
);

  function handleClearPortalRuns() {
    if (!user) return;

    const next = clearPortalRunHistory(user.email);
    setPortalRuns(next);
  }

  function resetViewAs(applyCurrentBranding = true) {
    setViewAsOpen(false);
    setViewAsLoading(false);
    setViewAsError("");
    setViewAsEmail("");
    setViewAsBranding(null);

    if (applyCurrentBranding) {
      applyBrandingVars(branding);
    }
  }

  async function handleViewAsUser(email: string) {
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail) {
      setViewAsError("Customer email is required");
      return;
    }

    setViewAsLoading(true);
    setViewAsError("");

    try {
      const resp = await fetch(
        `/api/admin/view-as/branding?email=${encodeURIComponent(cleanEmail)}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      const data = await readApiResponse(resp);

      if (!resp.ok) {
        setViewAsError(data?.error || data?.message || "Could not load view-as user");
        return;
      }

      const nextBranding = data?.branding || DEFAULT_BRANDING;

      setViewAsEmail(data?.viewAs?.email || cleanEmail);
      setViewAsBranding(nextBranding);
      applyBrandingVars(nextBranding);
      setViewAsOpen(false);
    } catch {
      setViewAsError("Could not load view-as user");
    } finally {
      setViewAsLoading(false);
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
      {user.role === "admin" && viewAsEmail && (
        <div style={viewAsBarStyle}>
          <div style={{ minWidth: 0 }}>
            <b>Viewing as</b>{" "}
            <span style={{ wordBreak: "break-word" }}>{viewAsEmail}</span>
          </div>

          <button type="button" onClick={() => resetViewAs(true)} style={viewAsStopButtonStyle}>
            Stop view as
          </button>
        </div>
      )}


      )}

      <ToolApp
        branding={effectiveBranding}
        viewAsEmail={viewAsEmail}
        language={language}
        setLanguage={setLanguage}
        userRole={user.role}
        clientModules={effectiveClientModules}
        onRunCompleted={handleRunCompleted}
        onRequestModuleUpgrade={(module) => {
          window.alert(`${module.toUpperCase()} is an add-on module.`);
        }}
      />

      <div style={accountMenuWrapStyle}>
        <AccountMenu
          user={user}
          language={language}
          setLanguage={setLanguage}
          onOpenUsers={() => setAdminOpen(true)}
          onOpenUsage={() => setUsageOpen(true)}
          onOpenBranding={() => setBrandingOpen(true)}
          onOpenViewAsUser={() => {
            setViewAsError("");
            setViewAsOpen(true);
          }}
          onOpenTaskHistory={() => setTaskHistoryOpen(true)}
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

      {user.role === "admin" && (
        <AdminViewAsUserPanel
          open={viewAsOpen}
          loading={viewAsLoading}
          error={viewAsError}
          onClose={() => setViewAsOpen(false)}
          onApply={handleViewAsUser}
        />
      )}

      {user.role !== "admin" && (
        <PortalTaskHistoryPanel
          open={taskHistoryOpen}
          runs={portalRuns}
          onClose={() => setTaskHistoryOpen(false)}
          onClear={handleClearPortalRuns}
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

const viewAsBarStyle: React.CSSProperties = {
  position: "fixed",
  top: 16,
  right: 24,
  zIndex: 26000,
  display: "flex",
  alignItems: "center",
  gap: 12,
  maxWidth: "calc(100vw - 48px)",
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "rgba(255,255,255,0.96)",
  color: "#0B2E5F",
  boxShadow: "0 18px 44px rgba(11,46,95,0.14)",
  fontSize: 13,
};

const viewAsStopButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "7px 10px",
  borderRadius: 999,
  border: "1px solid rgba(185,28,28,0.14)",
  background: "rgba(185,28,28,0.06)",
  color: "#8f1d1d",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 12,
};
