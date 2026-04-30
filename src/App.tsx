import React, { useEffect, useState } from "react";
import ToolApp from "./ToolApp";
import LoginPage from "./LoginPage";
import AdminUsersPanel from "./AdminUsersPanel";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

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

      const data = await resp.json();
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
          zIndex: 12000,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {user.role === "admin" && (
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            style={floatingSecondaryButton}
          >
            Users
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          style={floatingPrimaryButton}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          position: "fixed",
          left: 18,
          bottom: 18,
          zIndex: 12000,
          padding: "10px 14px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.90)",
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 10px 24px rgba(11,46,95,0.10)",
          color: "#0B2E5F",
          fontSize: 13,
        }}
      >
        Signed in as <b>{user.email}</b>
      </div>

      <AdminUsersPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    </>
  );
}

const floatingPrimaryButton: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(11,46,95,0.20)",
};

const floatingSecondaryButton: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "rgba(255,255,255,0.94)",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 12px 30px rgba(11,46,95,0.12)",
};
