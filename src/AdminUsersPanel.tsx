import React, { useEffect, useState } from "react";

type ModuleKey = "vat" | "tin" | "eori" | "iban";

type ClientModules = Record<ModuleKey, boolean>;

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  updatedAt?: string | null;
  modules?: Partial<ClientModules>;
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
};

const ADMIN_CLIENT_MODULES: ClientModules = {
  vat: true,
  tin: true,
  eori: true,
  iban: true,
};

const MODULE_OPTIONS: Array<{ key: ModuleKey; label: string }> = [
  { key: "vat", label: "VAT" },
  { key: "tin", label: "TIN" },
  { key: "eori", label: "EORI" },
  { key: "iban", label: "IBAN" },
];

function normalizeModules(user: UserRow): ClientModules {
  if (user.role === "admin") return ADMIN_CLIENT_MODULES;

  return {
    ...DEFAULT_CLIENT_MODULES,
    ...(user.modules || {}),
    vat: true,
  };
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
  maxWidth: 1180,
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
