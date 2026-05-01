import React, { useEffect, useState } from "react";

type UsageSummary = {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  normalUsers: number;
  totalEvents: number;
};

type UsageEvent = {
  id: string;
  type: string;
  actorEmail: string;
  targetEmail?: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AdminUsageDashboard({ open, onClose }: Props) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void loadDashboard();
  }, [open]);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
const [summaryResp, eventsResp] = await Promise.all([
  fetch("/api/admin/usage/summary", {
    credentials: "include",
    headers: {
      "x-admin-key": "een-lange-geheime-sleutel",
    },
  }),
  fetch("/api/admin/usage/events", {
    credentials: "include",
    headers: {
      "x-admin-key": "een-lange-geheime-sleutel",
    },
  }),
]);

      const summaryData = await summaryResp.json();
      const eventsData = await eventsResp.json();

      if (!summaryResp.ok) {
        setError(summaryData?.error || "Could not load summary");
        return;
      }

      if (!eventsResp.ok) {
        setError(eventsData?.error || "Could not load events");
        return;
      }

      setSummary(summaryData.summary || null);
      setEvents(Array.isArray(eventsData.events) ? eventsData.events : []);
    } catch {
      setError("Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#0B2E5F" }}>Usage dashboard</h2>
            <p style={{ margin: "6px 0 0", color: "#607089" }}>
              Overview of users and recent admin activity.
            </p>
          </div>

          <button onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
          <button onClick={loadDashboard} style={secondaryButtonStyle}>
            Refresh
          </button>
        </div>

        {error ? <div style={errorStyle}>{error}</div> : null}

        {loading ? (
          <div style={cardStyle}>Loading dashboard...</div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14,
                marginBottom: 24,
              }}
            >
              <MetricCard label="Total users" value={summary?.totalUsers ?? 0} />
              <MetricCard label="Active users" value={summary?.activeUsers ?? 0} />
              <MetricCard label="Admins" value={summary?.adminUsers ?? 0} />
              <MetricCard label="Normal users" value={summary?.normalUsers ?? 0} />
              <MetricCard label="Logged events" value={summary?.totalEvents ?? 0} />
            </div>

            <div style={cardStyle}>
              <h3 style={{ marginTop: 0, color: "#0B2E5F" }}>Recent activity</h3>

              {events.length === 0 ? (
                <div style={{ color: "#607089" }}>No events yet.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Type</th>
                        <th style={thStyle}>Actor</th>
                        <th style={thStyle}>Target</th>
                        <th style={thStyle}>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id}>
                          <td style={tdStyle}>{event.type}</td>
                          <td style={tdStyle}>{event.actorEmail}</td>
                          <td style={tdStyle}>{event.targetEmail || "—"}</td>
                          <td style={tdStyle}>
                            {event.createdAt
                              ? new Date(event.createdAt).toLocaleString("nl-NL")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: 13, color: "#607089", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#0B2E5F" }}>{value}</div>
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
  maxWidth: 1100,
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.98)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const cardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "#fff",
  padding: 18,
};

const metricCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "#fff",
  padding: 18,
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

const secondaryButtonStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
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
  marginBottom: 16,
};
