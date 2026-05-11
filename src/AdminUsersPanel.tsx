import React, { useEffect, useState } from "react";

type ModuleKey = "vat" | "tin" | "eori" | "iban" | "lei" | "company";
type VatSubscription = "starter" | "business" | "enterprise";

type VatCreditStatus = {
  plan: "starter" | "business" | "enterprise";
  year: string;
  used: number;
  limit: number | null;
  unlimited: boolean;
  remaining: number | null;
};

type ClientModules = Record<ModuleKey, boolean>;

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
  modules?: Partial<ClientModules>;
  vatSubscription?: VatSubscription;
  vatCredits?: VatCreditStatus;
  isTrial?: boolean;
  trialEndsAt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_CLIENT_MODULES: ClientModules = {
  vat: true,
  tin: false,
  eori: false,
  iban: false,
  lei: false,
  company: false,
};

const ADMIN_CLIENT_MODULES: ClientModules = {
  vat: true,
  tin: true,
  eori: true,
  iban: true,
  lei: true,
  company: true,
};

const MODULE_OPTIONS: Array<{ key: ModuleKey; label: string }> = [
  { key: "vat", label: "VAT" },
  { key: "tin", label: "TIN" },
  { key: "eori", label: "EORI" },
  { key: "iban", label: "IBAN" },
  { key: "lei", label: "LEI" },
  { key: "company", label: "Company Register" },
];

const VAT_SUBSCRIPTION_OPTIONS: Array<{
  key: VatSubscription;
  label: string;
}> = [
  { key: "starter", label: "Starter - 50k VAT checks" },
  { key: "business", label: "Business - 100k VAT checks" },
  { key: "enterprise", label: "Enterprise - Unlimited" },
];

function normalizeSubscription(user: UserRow): VatSubscription {
  if (user.role === "admin") return "enterprise";

  if (user.vatSubscription === "business") return "business";
  if (user.vatSubscription === "enterprise") return "enterprise";

  return "starter";
}

function normalizeModules(user: UserRow): ClientModules {
  if (user.role === "admin") return ADMIN_CLIENT_MODULES;

  return {
    ...DEFAULT_CLIENT_MODULES,
    ...(user.modules || {}),
    vat: true,
  };
}

function VatCreditsIndicator({ user }: { user: UserRow }) {
  const credits = user.vatCredits;

  if (user.role === "admin") {
    return <span style={creditBadgeStyle}>Unlimited</span>;
  }

  if (!credits) {
    return <span style={creditBadgeStyle}>No data</span>;
  }

  if (credits.unlimited || credits.limit === null) {
    return <span style={creditBadgeStyle}>Unlimited</span>;
  }

  const used = Number(credits.used || 0);
  const limit = Number(credits.limit || 0);
  const remaining = Math.max(0, limit - used);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div style={{ minWidth: 180 }}>
      <div style={creditTopRowStyle}>
        <span>{used.toLocaleString("en-GB")}</span>
        <span>/ {limit.toLocaleString("en-GB")}</span>
      </div>

      <div style={creditBarOuterStyle}>
        <div style={{ ...creditBarInnerStyle, width: `${pct}%` }} />
      </div>

      <div style={creditSubTextStyle}>
        {remaining.toLocaleString("en-GB")} remaining
      </div>
    </div>
  );
}

export default function AdminUsersPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionLoadingEmail, setActionLoadingEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");

  useEffect(() => {
    if (!open) return;
    void loadUsers();
  }, [open]);

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/admin/users/list", {
        credentials: "include",
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not load users");
        return;
      }

      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setError("Could not load users");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();

    setCreateLoading(true);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, role }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not create user");
        return;
      }

      setSuccess("User created");
      setEmail("");
      setPassword("");
      setRole("user");
      await loadUsers();
    } catch {
      setError("Could not create user");
    } finally {
      setCreateLoading(false);
    }
  }

  async function updateUserModules(user: UserRow, nextModules: ClientModules) {
    if (user.role === "admin") return;

    setActionLoadingEmail(user.email);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/users/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: user.email,
          modules: nextModules,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not update modules");
        return;
      }

      setSuccess(`Modules updated for ${user.email}`);
      await loadUsers();
    } catch {
      setError("Could not update modules");
    } finally {
      setActionLoadingEmail("");
    }
  }

  async function updateUserSubscription(user: UserRow, vatSubscription: VatSubscription) {
    if (user.role === "admin") return;

    setActionLoadingEmail(user.email);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/users/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: user.email,
          vatSubscription,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not update subscription");
        return;
      }

      setSuccess(`Subscription updated for ${user.email}`);
      await loadUsers();
    } catch {
      setError("Could not update subscription");
    } finally {
      setActionLoadingEmail("");
    }
  }
async function updateUserTrial(user: UserRow, isTrial: boolean, trialEndsAt: string) {
  if (user.role === "admin") return;

  setActionLoadingEmail(user.email);
  setError("");
  setSuccess("");

  try {
    const resp = await fetch("/api/admin/users/trial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: user.email,
        isTrial,
        trialEndsAt,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      setError(data?.error || data?.message || "Could not update trial");
      return;
    }

    setSuccess(`Trial updated for ${user.email}`);
    await loadUsers();
  } catch {
    setError("Could not update trial");
  } finally {
    setActionLoadingEmail("");
  }
}
async function resetVatCredits(user: UserRow) {
  if (user.role === "admin") return;

  const ok = window.confirm(`Reset VAT credits for ${user.email} to 0?`);
  if (!ok) return;

  setActionLoadingEmail(user.email);
  setError("");
  setSuccess("");

  try {
    const resp = await fetch("/api/admin/users/reset-vat-credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: user.email,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      setError(data?.error || data?.message || "Could not reset VAT credits");
      return;
    }

    setSuccess(`VAT credits reset for ${user.email}`);
    await loadUsers();
  } catch {
    setError("Could not reset VAT credits");
  } finally {
    setActionLoadingEmail("");
  }
} 
  
  async function resetPassword(email: string) {
    const newPassword = window.prompt(`Enter a new password for ${email}`);
    if (!newPassword) return;

    setActionLoadingEmail(email);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not reset password");
        return;
      }

      setSuccess(`Password reset for ${email}`);
      await loadUsers();
    } catch {
      setError("Could not reset password");
    } finally {
      setActionLoadingEmail("");
    }
  }

  async function deleteUser(email: string) {
    const ok = window.confirm(`Delete user ${email}?`);
    if (!ok) return;

    setActionLoadingEmail(email);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not delete user");
        return;
      }

      setSuccess(`Deleted ${email}`);
      await loadUsers();
    } catch {
      setError("Could not delete user");
    } finally {
      setActionLoadingEmail("");
    }
  }

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerRowStyle}>
          <div>
            <h2 style={titleStyle}>User management</h2>
            <p style={subtitleStyle}>Create users and manage module access per customer.</p>
          </div>

          <button type="button" style={closeButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>

        <form onSubmit={createUser} style={createGridStyle}>
          <input
            type="email"
            value={email}
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            value={password}
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            style={inputStyle}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <button type="submit" style={primaryButtonStyle} disabled={createLoading}>
            {createLoading ? "Creating..." : "Create user"}
          </button>

          <button type="button" style={secondaryButtonStyle} onClick={loadUsers}>
            Refresh list
          </button>
        </form>

        {error && <div style={errorStyle}>{error}</div>}
        {success && <div style={successStyle}>{success}</div>}

        <div style={sectionHeaderStyle}>Users</div>

        {loading ? (
          <div style={emptyStyle}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={emptyStyle}>No users yet.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
<th style={thStyle}>Email</th>
<th style={thStyle}>Role</th>
<th style={thStyle}>Subscription</th>
<th style={thStyle}>Trial</th>
<th style={thStyle}>VAT credits</th>
<th style={thStyle}>Modules</th>
<th style={thStyle}>Created</th>
<th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => {
                  const busy = actionLoadingEmail === user.email;
                  const modules = normalizeModules(user);
                  const isAdmin = user.role === "admin";

                  return (
                    <tr key={user.email}>
                      <td style={tdStyle}>{user.email}</td>

                      <td style={tdStyle}>
                        <span style={isAdmin ? roleAdminStyle : roleUserStyle}>
                          {isAdmin ? "Admin" : "User"}
                        </span>
                      </td>

<td style={tdStyle}>
  <select
    value={normalizeSubscription(user)}
    disabled={busy || isAdmin}
    onChange={(e) =>
      updateUserSubscription(user, e.target.value as VatSubscription)
    }
    style={{
      ...subscriptionSelectStyle,
      opacity: isAdmin ? 0.72 : 1,
      cursor: isAdmin ? "not-allowed" : "pointer",
    }}
    title={isAdmin ? "Admin is always Enterprise" : "VAT subscription"}
  >
    {VAT_SUBSCRIPTION_OPTIONS.map((option) => (
      <option key={option.key} value={option.key}>
        {option.label}
      </option>
    ))}
  </select>
</td>

<td style={tdStyle}>
  {isAdmin ? (
    <span style={trialInactiveBadgeStyle}>Not applicable</span>
  ) : (
    <div style={trialControlStyle}>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void updateUserTrial(user, !Boolean(user.isTrial), user.trialEndsAt || "")
        }
        style={{
          ...trialToggleStyle,
          ...(user.isTrial ? trialToggleActiveStyle : trialToggleInactiveStyle),
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {user.isTrial ? "Trial on" : "Trial off"}
      </button>

      <input
        type="date"
        value={String(user.trialEndsAt || "").slice(0, 10)}
        disabled={busy || !user.isTrial}
        onChange={(e) =>
          void updateUserTrial(user, Boolean(user.isTrial), e.target.value)
        }
        style={{
          ...trialDateStyle,
          opacity: user.isTrial ? 1 : 0.55,
          cursor: user.isTrial ? "pointer" : "not-allowed",
        }}
      />
    </div>
  )}
</td>

<td style={tdStyle}>
  <VatCreditsIndicator user={user} />
</td>

                      <td style={tdStyle}>
                        <div style={moduleGridStyle}>
                          {MODULE_OPTIONS.map((module) => {
                            const enabled = modules[module.key];
                            const locked = module.key === "vat" || isAdmin;

                            return (
                              <button
                                key={module.key}
                                type="button"
                                disabled={busy || locked}
                                onClick={() => {
                                  const nextModules: ClientModules = {
                                    ...modules,
                                    [module.key]: !enabled,
                                    vat: true,
                                  };

                                  void updateUserModules(user, nextModules);
                                }}
                                title={
                                  isAdmin
                                    ? "Admin has all modules"
                                    : module.key === "vat"
                                      ? "VAT is always included"
                                      : enabled
                                        ? `Disable ${module.label}`
                                        : `Enable ${module.label}`
                                }
                                style={{
                                  ...moduleButtonStyle,
                                  ...(enabled ? moduleButtonActiveStyle : moduleButtonInactiveStyle),
                                  cursor: locked || busy ? "not-allowed" : "pointer",
                                  opacity: locked && !isAdmin ? 0.85 : 1,
                                }}
                              >
                                <span style={moduleDotStyle}>{enabled ? "✓" : "+"}</span>
                                {module.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      <td style={tdStyle}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleString("en-GB") : "—"}
                      </td>

                      <td style={tdStyle}>
   <div style={actionRowStyle}>
  <button
    type="button"
    style={smallButtonStyle}
    onClick={() => resetPassword(user.email)}
    disabled={busy}
  >
    Reset password
  </button>

  <button
    type="button"
    style={smallButtonStyle}
    onClick={() => void resetVatCredits(user)}
    disabled={busy || isAdmin}
  >
    Reset credits
  </button>

  <button
    type="button"
    style={smallDangerButtonStyle}
    onClick={() => deleteUser(user.email)}
    disabled={busy}
  >
    Delete
  </button>
</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(5,16,34,0.42)",
  display: "grid",
  placeItems: "center",
  padding: 24,
  zIndex: 20000,
};

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 1320,
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto",
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  color: "#0B2E5F",
  fontSize: 22,
  lineHeight: 1.2,
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748B",
  fontSize: 13,
};

const createGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(180px, 0.8fr) 140px 140px 120px",
  gap: 10,
  alignItems: "center",
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #0B2E5F",
  background: "#0B2E5F",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const sectionHeaderStyle: React.CSSProperties = {
  marginTop: 18,
  marginBottom: 10,
  color: "#0B2E5F",
  fontSize: 15,
  fontWeight: 800,
};

const tableWrapStyle: React.CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid rgba(11,46,95,0.08)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  color: "#607089",
  padding: "12px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.08)",
  background: "rgba(248,251,255,0.92)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.06)",
  fontSize: 14,
  color: "#203557",
  verticalAlign: "top",
};

const moduleGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const moduleButtonStyle: React.CSSProperties = {
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  border: "1px solid rgba(11,46,95,0.12)",
};

const moduleButtonActiveStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0B2E5F, #16457F)",
  color: "#FFFFFF",
  borderColor: "rgba(11,46,95,0.92)",
};

const moduleButtonInactiveStyle: React.CSSProperties = {
  background: "rgba(241,245,249,0.8)",
  color: "#64748B",
  borderColor: "rgba(148,163,184,0.22)",
};

const moduleDotStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
};

const roleAdminStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(11,46,95,0.09)",
  color: "#0B2E5F",
  fontSize: 12,
  fontWeight: 800,
};

const roleUserStyle: React.CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background: "rgba(100,116,139,0.08)",
  color: "#64748B",
  fontSize: 12,
  fontWeight: 800,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const smallDangerButtonStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(185,28,28,0.12)",
  background: "rgba(185,28,28,0.06)",
  color: "#8f1d1d",
  fontWeight: 700,
  cursor: "pointer",
};

const closeButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.10)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const emptyStyle: React.CSSProperties = {
  padding: "18px 16px",
  borderRadius: 14,
  background: "rgba(248,251,255,0.82)",
  color: "#64748B",
  fontSize: 14,
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8f1d1d",
  fontSize: 14,
  marginTop: 10,
};

const successStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(10,122,61,0.08)",
  border: "1px solid rgba(10,122,61,0.12)",
  color: "#0a6a38",
  fontSize: 14,
  marginTop: 10,
};

const subscriptionSelectStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 210,
  height: 34,
  borderRadius: 999,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#FFFFFF",
  color: "#0B2E5F",
  fontSize: 12,
  fontWeight: 800,
  padding: "0 10px",
  outline: "none",
};

const creditBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(11,46,95,0.08)",
  color: "#0B2E5F",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const creditTopRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "#0B2E5F",
  fontSize: 12,
  fontWeight: 800,
};

const creditBarOuterStyle: React.CSSProperties = {
  width: "100%",
  height: 7,
  marginTop: 6,
  borderRadius: 999,
  overflow: "hidden",
  background: "rgba(148,163,184,0.22)",
};

const creditBarInnerStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 999,
  background: "linear-gradient(90deg, #63C7F2, #0B2E5F)",
};

const creditSubTextStyle: React.CSSProperties = {
  marginTop: 4,
  color: "#64748B",
  fontSize: 11,
  fontWeight: 700,
};
const trialControlStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 150,
};

const trialToggleStyle: React.CSSProperties = {
  height: 30,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  border: "1px solid rgba(11,46,95,0.12)",
};

const trialToggleActiveStyle: React.CSSProperties = {
  background: "rgba(63,156,53,0.10)",
  color: "#3F9C35",
  borderColor: "rgba(63,156,53,0.24)",
};

const trialToggleInactiveStyle: React.CSSProperties = {
  background: "rgba(241,245,249,0.8)",
  color: "#64748B",
  borderColor: "rgba(148,163,184,0.22)",
};

const trialDateStyle: React.CSSProperties = {
  height: 30,
  borderRadius: 999,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#FFFFFF",
  color: "#0B2E5F",
  fontSize: 12,
  fontWeight: 700,
  padding: "0 10px",
  outline: "none",
};

const trialInactiveBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 10px",
  borderRadius: 999,
  background: "rgba(100,116,139,0.08)",
  color: "#64748B",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};
