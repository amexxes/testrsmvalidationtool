import React, { useEffect, useState } from "react";

type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  modules?: Record<string, boolean>;
  vatSubscription?: "starter" | "business" | "enterprise";
  isTrial?: boolean;
  trialEndsAt?: string;
};

type Props = {
  onLoggedIn: (user: AuthUser) => void;
};

type LoginFormCardProps = {
  email: string;
  password: string;
  loginLoading: boolean;
  loginError: string;
  checkingStatus: boolean;
  bootstrapped: boolean;
  setupKey: string;
  setupEmail: string;
  setupPassword: string;
  bootstrapLoading: boolean;
  bootstrapError: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  setSetupKey: React.Dispatch<React.SetStateAction<string>>;
  setSetupEmail: React.Dispatch<React.SetStateAction<string>>;
  setSetupPassword: React.Dispatch<React.SetStateAction<string>>;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleBootstrap: (e: React.FormEvent) => Promise<void>;
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

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={shellStyle}>
      <div style={layoutStyle}>{children}</div>
    </div>
  );
}

function LoginBrandPanel() {
  return (
    <section style={brandPanelStyle}>
      <div>
        <img src="/rsmlogo.png" alt="RSM" style={logoStyle} />

        <div style={eyebrowStyle}>Validation Portal</div>

        <h1 style={headlineStyle}>
          Secure validation.
          <br />
          Clear results.
          <br />
          One workspace.
        </h1>

        <p style={brandTextStyle}>
          Check VAT, TIN, EORI and IBAN data in a clean customer portal.
        </p>
      </div>

      <div style={featureGridStyle}>
        {[
          "Batch validation",
          "Import and export",
          "Customer access control",
        ].map((item) => (
          <div key={item} style={featureItemStyle}>
            <span style={featureDotStyle} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoginSessionNote() {
  return (
    <div style={sessionNoteStyle}>
      <span style={sessionIconStyle}>i</span>
      <span>You stay signed in for 7 days.</span>
    </div>
  );
}

function LoginFormCard({
  email,
  password,
  loginLoading,
  loginError,
  checkingStatus,
  bootstrapped,
  setupKey,
  setupEmail,
  setupPassword,
  bootstrapLoading,
  bootstrapError,
  setEmail,
  setPassword,
  setSetupKey,
  setSetupEmail,
  setSetupPassword,
  handleLogin,
  handleBootstrap,
}: LoginFormCardProps) {
  return (
    <section style={formCardStyle}>
      <div>
        <h2 style={formTitleStyle}>Sign in</h2>
        <p style={formSubtitleStyle}>Use your portal account to continue.</p>
      </div>

      <LoginSessionNote />

      <form onSubmit={handleLogin} style={formStyle}>
        <label style={labelStyle}>
          Email
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
          />
        </label>

        <label style={labelStyle}>
          Password
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
        </label>

        {loginError && <div style={errorStyle}>{loginError}</div>}

        <button type="submit" style={primaryButtonStyle} disabled={loginLoading}>
          {loginLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {!checkingStatus && !bootstrapped && (
        <div style={setupBlockStyle}>
          <h3 style={setupTitleStyle}>First-time setup</h3>
          <p style={setupTextStyle}>Create the first administrator account.</p>

          <form onSubmit={handleBootstrap} style={formStyle}>
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
    </section>
  );
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
    <LoginShell>
      <LoginBrandPanel />

      <LoginFormCard
        email={email}
        password={password}
        loginLoading={loginLoading}
        loginError={loginError}
        checkingStatus={checkingStatus}
        bootstrapped={bootstrapped}
        setupKey={setupKey}
        setupEmail={setupEmail}
        setupPassword={setupPassword}
        bootstrapLoading={bootstrapLoading}
        bootstrapError={bootstrapError}
        setEmail={setEmail}
        setPassword={setPassword}
        setSetupKey={setSetupKey}
        setSetupEmail={setSetupEmail}
        setSetupPassword={setSetupPassword}
        handleLogin={handleLogin}
        handleBootstrap={handleBootstrap}
      />
    </LoginShell>
  );
}

const PORTAL_FONT =
  "'Prelo', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  boxSizing: "border-box",
  fontFamily: PORTAL_FONT,
  background:
    "radial-gradient(circle at 20% 15%, rgba(0,156,222,0.18), transparent 32%), radial-gradient(circle at 82% 85%, rgba(81,83,86,0.12), transparent 34%), linear-gradient(135deg, #F8FBFF 0%, #EEF3F8 100%)",
};

const layoutStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1040,
  minHeight: 610,
  display: "grid",
  gridTemplateColumns: "1.05fr 0.95fr",
  gap: 18,
  alignItems: "stretch",
};

const brandPanelStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 34,
  background: "rgba(255,255,255,0.58)",
  border: "1px solid rgba(255,255,255,0.64)",
  boxShadow: "0 24px 70px rgba(11,46,95,0.13)",
  backdropFilter: "blur(18px) saturate(1.3)",
  WebkitBackdropFilter: "blur(18px) saturate(1.3)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  color: "#2F3033",
};

const logoStyle: React.CSSProperties = {
  width: 128,
  height: "auto",
  display: "block",
  objectFit: "contain",
  marginBottom: 28,
};

const eyebrowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "7px 11px",
  borderRadius: 999,
  border: "1px solid rgba(81,83,86,0.12)",
  background: "rgba(255,255,255,0.48)",
  color: "#515356",
  fontSize: 11,
  lineHeight: 1,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 18,
};

const headlineStyle: React.CSSProperties = {
  margin: 0,
  color: "#2F3033",
  fontSize: 38,
  lineHeight: 1.06,
  fontWeight: 800,
  letterSpacing: "-0.03em",
};

const brandTextStyle: React.CSSProperties = {
  maxWidth: 430,
  margin: "18px 0 0",
  color: "#515356",
  fontSize: 15,
  lineHeight: 1.65,
  fontWeight: 300,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 30,
};

const featureItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 13px",
  borderRadius: 15,
  background: "rgba(255,255,255,0.46)",
  border: "1px solid rgba(81,83,86,0.08)",
  color: "#515356",
  fontSize: 13,
  fontWeight: 700,
};

const featureDotStyle: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  background: "#009CDE",
  flex: "0 0 auto",
};

const formCardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 30,
  background: "rgba(255,255,255,0.78)",
  border: "1px solid rgba(255,255,255,0.72)",
  boxShadow: "0 24px 70px rgba(11,46,95,0.13)",
  backdropFilter: "blur(18px) saturate(1.3)",
  WebkitBackdropFilter: "blur(18px) saturate(1.3)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const formTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#2F3033",
  fontSize: 26,
  lineHeight: 1.15,
  fontWeight: 800,
};

const formSubtitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#515356",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 300,
};

const sessionNoteStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  marginTop: 18,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(81,83,86,0.12)",
  background: "rgba(81,83,86,0.05)",
  color: "#515356",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 700,
};

const sessionIconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,156,222,0.14)",
  color: "#009CDE",
  fontSize: 11,
  fontWeight: 800,
  flex: "0 0 auto",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 20,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#515356",
  fontSize: 12,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  padding: "0 14px",
  borderRadius: 14,
  border: "1px solid rgba(81,83,86,0.14)",
  background: "rgba(255,255,255,0.88)",
  color: "#2F3033",
  outline: "none",
  fontSize: 14,
  fontFamily: PORTAL_FONT,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(0,156,222,0.96)",
  background: "#009CDE",
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 800,
  fontFamily: PORTAL_FONT,
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(0,156,222,0.18)",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(81,83,86,0.14)",
  background: "rgba(255,255,255,0.58)",
  color: "#2F3033",
  fontSize: 13,
  fontWeight: 800,
  fontFamily: PORTAL_FONT,
  cursor: "pointer",
};

const setupBlockStyle: React.CSSProperties = {
  marginTop: 26,
  paddingTop: 22,
  borderTop: "1px solid rgba(81,83,86,0.10)",
};

const setupTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#2F3033",
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 800,
};

const setupTextStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#515356",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 300,
};

const errorStyle: React.CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8F1D1D",
  fontSize: 13,
  fontWeight: 700,
};
