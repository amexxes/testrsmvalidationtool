// src/LoginPage.tsx
import React, { useEffect, useState } from "react";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

type Props = {
  onLoggedIn: (user: AuthUser) => void;
};

async function readApiResponse(resp: Response) {
  const text = await resp.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: resp.ok ? "" : `Request failed (${resp.status})`,
    };
  }
}

export default function LoginPage({ onLoggedIn }: Props) {
  const [bootstrapped, setBootstrapped] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [setupKey, setSetupKey] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      try {
        const resp = await fetch("/api/auth/status", {
          credentials: "include",
        });
        const data = await readApiResponse(resp);

        if (!mounted) return;
        setBootstrapped(Boolean(data?.bootstrapped));
      } catch {
        if (!mounted) return;
        setBootstrapped(true);
      } finally {
        if (!mounted) return;
        setCheckingStatus(false);
      }
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await readApiResponse(resp);

      if (!resp.ok) {
        setLoginError(data?.error || data?.message || `Request failed (${resp.status})`);
        return;
      }

      onLoggedIn(data.user);
    } catch {
      setLoginError("Request failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setBootstrapLoading(true);
    setBootstrapError("");

    try {
      const resp = await fetch("/api/auth/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          setupKey,
          email: setupEmail,
          password: setupPassword,
        }),
      });

      const data = await readApiResponse(resp);

      if (!resp.ok) {
        setBootstrapError(data?.error || data?.message || `Request failed (${resp.status})`);
        return;
      }

      onLoggedIn(data.user);
    } catch {
      setBootstrapError("Request failed");
    } finally {
      setBootstrapLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(circle at top left, rgba(43,179,230,0.28), transparent 30%), radial-gradient(circle at bottom right, rgba(11,46,95,0.24), transparent 30%), linear-gradient(135deg, #f5f8fc 0%, #eaf0f8 100%)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            padding: 32,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 24px 60px rgba(11,46,95,0.12)",
            color: "#0B2E5F",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ marginBottom: 20 }}>
              <img
                src="/rsmlogo.png"
                alt="RSM"
                style={{
                  height: 52,
                  width: "auto",
                  display: "block",
                  objectFit: "contain",
                }}
              />
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(11,46,95,0.08)",
                fontWeight: 700,
                marginBottom: 18,
              }}
            >
              <span>Validation Portal</span>
            </div>

            <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.08 }}>
              Secure access to the
              <br />
              RSM Validation Tool
              <br />
               
            </h1>

            <p style={{ marginTop: 16, color: "#4b607c", fontSize: 16, lineHeight: 1.6 }}>
              One login for official the VAT VIES and EC TIN validation.
            </p>

            <div
              style={{
                marginTop: 24,
                display: "grid",
                gap: 14,
              }}
            >
              {[
                "VAT VIES validation and batch checks",
                "TIN validation through the official EC service",
                "Bulk upload, filtering and export in one workspace",
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.55)",
                    border: "1px solid rgba(11,46,95,0.08)",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#2BB3E6",
                      flex: "0 0 auto",
                    }}
                  />
                  <span style={{ color: "#27456f" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: 24,
            padding: 28,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(0,0,0,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 24px 60px rgba(11,46,95,0.12)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 26, color: "#0B2E5F" }}>Sign in</h2>
          <p style={{ marginTop: 8, color: "#5f6f86", fontSize: 14 }}>
            Your session expires automatically after 24 hours.
          </p>

          <form onSubmit={handleLogin} style={{ display: "grid", gap: 12, marginTop: 18 }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />

            {loginError && <div style={errorStyle}>{loginError}</div>}

            <button type="submit" style={primaryButtonStyle} disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {!checkingStatus && !bootstrapped && (
            <div
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTop: "1px solid rgba(11,46,95,0.10)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, color: "#0B2E5F" }}>First-time setup</h3>
              <p style={{ marginTop: 8, color: "#5f6f86", fontSize: 14 }}>
                No admin exists yet. Create the first admin here.
              </p>

              <form onSubmit={handleBootstrap} style={{ display: "grid", gap: 12, marginTop: 14 }}>
                <input
                  type="text"
                  placeholder="Admin setup key"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="email"
                  placeholder="Admin email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="Admin password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  style={inputStyle}
                />

                {bootstrapError && <div style={errorStyle}>{bootstrapError}</div>}

                <button type="submit" style={secondaryButtonStyle} disabled={bootstrapLoading}>
                  {bootstrapLoading ? "Creating..." : "Create first admin"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "rgba(255,255,255,0.95)",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.14)",
  background: "rgba(43,179,230,0.12)",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8f1d1d",
  fontSize: 14,
};
