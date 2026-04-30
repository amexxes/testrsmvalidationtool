import React, { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AdminUsersPanel({ open, onClose }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
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

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: "#0B2E5F" }}>User management</h2>
            <p style={{ margin: "6px 0 0", color: "#607089" }}>
              Create users and let them sign in from multiple browsers.
            </p>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <form onSubmit={createUser} style={{ display: "grid", gap: 12, marginTop: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12 }}>
            <input
              type="email"
              placeholder="User email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as "user" | "admin")} style={inputStyle}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button type="submit" style={primaryButtonStyle} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create user"}
            </button>

            <button type="button" onClick={loadUsers} style={secondaryButtonStyle} disabled={loading}>
              Refresh list
            </button>
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>{success}</div>}
        </form>

        <div
          style={{
            marginTop: 24,
            borderRadius: 18,
            border: "1px solid rgba(11,46,95,0.10)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(11,46,95,0.04)",
              borderBottom: "1px solid rgba(11,46,95,0.08)",
              fontWeight: 700,
              color: "#0B2E5F",
            }}
          >
            Users
          </div>

          <div style={{ maxHeight: 340, overflow: "auto" }}>
            {loading ? (
              <div style={{ padding: 16, color: "#607089" }}>Loading users...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: 16, color: "#607089" }}>No users yet.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Active</th>
                    <th style={thStyle}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={tdStyle}>{user.email}</td>
                      <td style={tdStyle}>{user.role}</td>
                      <td style={tdStyle}>{user.active ? "Yes" : "No"}</td>
                      <td style={tdStyle}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleString("en-GB") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
  maxWidth: 980,
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
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

const closeButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.10)",
  background: "#fff",
  color: "#0B2E5F",
  fontWeight: 700,
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  color: "#607089",
  padding: "12px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.08)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(11,46,95,0.06)",
  fontSize: 14,
  color: "#203557",
};

const errorStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(185,28,28,0.08)",
  border: "1px solid rgba(185,28,28,0.12)",
  color: "#8f1d1d",
  fontSize: 14,
};

const successStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(10,122,61,0.08)",
  border: "1px solid rgba(10,122,61,0.12)",
  color: "#0a6a38",
  fontSize: 14,
};
