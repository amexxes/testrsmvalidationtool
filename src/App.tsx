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
      <ToolApp />

      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 14000,
        }}
      >
        <AccountMenu
          user={user}
          onOpenUsers={() => setAdminOpen(true)}
          onOpenChangePassword={() => setChangePasswordOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      <AdminUsersPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChangePasswordPanel
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
