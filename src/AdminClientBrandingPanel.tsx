import React, { useEffect, useMemo, useState } from "react";

type BrandingProfile = {
  id: string;
  clientName: string;
  portalTitle: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  allowedDomains: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const LOGO_PRESETS = [
  {
    key: "123inkt",
    label: "123inkt",
    clientName: "123inkt",
    portalTitle: "123inkt Validation Portal",
    logoUrl: "/123inktlogo.png",
    primaryColor: "#111827",
    accentColor: "#F59E0B",
    backgroundColor: "#FFFBF2",
    textColor: "#1E293B",
  },
  {
    key: "subway",
    label: "Subway",
    clientName: "Subway",
    portalTitle: "Subway Validation Portal",
    logoUrl: "/subwaylogo.png",
    primaryColor: "#008938",
    accentColor: "#FFC600",
    backgroundColor: "#F8FBF7",
    textColor: "#1E293B",
  },
    {
    key: "fastenal",
    label: "Fastenal",
    clientName: "Fastenal",
    portalTitle: "Fastenal Validation Portal",
    logoUrl: "/fastenallogo.png",
    primaryColor: "#003A8F",
    accentColor: "#E11C2A",
    backgroundColor: "#F4F7FB",
    textColor: "#1E293B",
  },
    {
    key: "taylormadegolf",
    label: "TaylorMade Golf",
    clientName: "TaylorMade Golf",
    portalTitle: "TaylorMade Golf Validation Portal",
    logoUrl: "/taylormadegolf.png",
    primaryColor: "#111827",
    accentColor: "#E31B23",
    backgroundColor: "#F7F7F7",
    textColor: "#1E293B",
  },
];

const EMPTY_FORM = {
  id: "",
  clientName: "",
  portalTitle: "",
  logoPreset: "123inkt",
  logoUrl: "/123inktlogo.png",
  primaryColor: "#0B2E5F",
  accentColor: "#63C7F2",
  backgroundColor: "#F8FBFF",
  textColor: "#1E293B",
  allowedDomainsText: "",
  active: true,
};

async function readJson(resp: Response) {
  const text = await resp.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function domainsToText(domains: string[]) {
  return Array.isArray(domains) ? domains.join("\n") : "";
}

function normalizeDomainsText(value: string) {
  return String(value || "")
    .split(/[,\n;]/)
    .map((x) => x.trim().toLowerCase().replace(/^@+/, ""))
    .filter(Boolean);
}

export default function AdminClientBrandingPanel({ open, onClose }: Props) {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedLogoPreset = useMemo(
    () => LOGO_PRESETS.find((item) => item.key === form.logoPreset) || LOGO_PRESETS[0],
    [form.logoPreset]
  );

  useEffect(() => {
    if (!open) return;
    void loadProfiles();
  }, [open]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  }

  async function loadProfiles() {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/admin/branding/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not load client branding");
        return;
      }

      setProfiles(Array.isArray(data?.profiles) ? data.profiles : []);
    } catch {
      setError("Could not load client branding");
    } finally {
      setLoading(false);
    }
  }

  function applyLogoPreset(key: string) {
    const preset = LOGO_PRESETS.find((item) => item.key === key) || LOGO_PRESETS[0];

    setForm((prev) => ({
      ...prev,
      logoPreset: preset.key,
      clientName: prev.clientName || preset.clientName,
      portalTitle: prev.portalTitle || preset.portalTitle,
      logoUrl: preset.logoUrl,
      primaryColor: preset.primaryColor,
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      textColor: preset.textColor,
    }));
  }

  function editProfile(profile: BrandingProfile) {
    const preset =
      LOGO_PRESETS.find((item) => item.logoUrl === profile.logoUrl) || LOGO_PRESETS[0];

    setForm({
      id: profile.id,
      clientName: profile.clientName || "",
      portalTitle: profile.portalTitle || "",
      logoPreset: preset.key,
      logoUrl: profile.logoUrl || preset.logoUrl,
      primaryColor: profile.primaryColor || preset.primaryColor,
      accentColor: profile.accentColor || preset.accentColor,
      backgroundColor: profile.backgroundColor || preset.backgroundColor,
      textColor: profile.textColor || "#1E293B",
      allowedDomainsText: domainsToText(profile.allowedDomains || []),
      active: profile.active !== false,
    });

    setError("");
    setSuccess("");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    const allowedDomains = normalizeDomainsText(form.allowedDomainsText);

    if (!form.clientName.trim()) {
      setSaving(false);
      setError("Client name is required");
      return;
    }

    if (!allowedDomains.length) {
      setSaving(false);
      setError("At least one client domain is required");
      return;
    }

    try {
      const resp = await fetch("/api/admin/branding/save", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id || undefined,
          clientName: form.clientName,
          portalTitle: form.portalTitle,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          accentColor: form.accentColor,
          backgroundColor: form.backgroundColor,
          textColor: form.textColor,
          allowedDomains,
          active: form.active,
        }),
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not save client branding");
        return;
      }

      setSuccess(form.id ? "Client branding updated" : "Client branding created");
      resetForm();
      await loadProfiles();
    } catch {
      setError("Could not save client branding");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(profile: BrandingProfile) {
    const ok = window.confirm(`Delete branding for ${profile.clientName}?`);
    if (!ok) return;

    setDeleteLoadingId(profile.id);
    setError("");
    setSuccess("");

    try {
      const resp = await fetch("/api/admin/branding/delete", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: profile.id }),
      });

      const data = await readJson(resp);

      if (!resp.ok) {
        setError(data?.error || data?.message || "Could not delete client branding");
        return;
      }

      setSuccess(`Deleted branding for ${profile.clientName}`);
      await loadProfiles();

      if (form.id === profile.id) {
        resetForm();
      }
    } catch {
      setError("Could not delete client branding");
    } finally {
      setDeleteLoadingId("");
    }
  }

  if (!open) return null;

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Client branding</h2>
            <p style={subtitleStyle}>Set logo, name and colours per client domain.</p>
          </div>

          <button type="button" onClick={onClose} style={closeButtonStyle}>
            Close
          </button>
        </div>

        <div style={gridStyle}>
          <form onSubmit={saveProfile} style={formCardStyle}>
            <div>
              <div style={sectionTitleStyle}>
                {form.id ? "Edit client" : "New client"}
              </div>
              <div style={sectionTextStyle}>
                Branding is matched by email domain, for example: client.nl.
              </div>
            </div>

            <label style={labelStyle}>
              Logo preset
              <select
                value={form.logoPreset}
                onChange={(e) => applyLogoPreset(e.target.value)}
                style={inputStyle}
              >
                {LOGO_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <div style={previewStyle}>
              <img
                src={form.logoUrl || selectedLogoPreset.logoUrl}
                alt={`${form.clientName || selectedLogoPreset.clientName} logo`}
                style={logoPreviewStyle}
              />
              <div>
                <div style={{ fontWeight: 800, color: form.primaryColor }}>
                  {form.clientName || selectedLogoPreset.clientName}
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                  {form.logoUrl || selectedLogoPreset.logoUrl}
                </div>
              </div>
            </div>

            <label style={labelStyle}>
              Client name
              <input
                value={form.clientName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, clientName: e.target.value }))
                }
                placeholder="123inkt"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Portal title
              <input
                value={form.portalTitle}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, portalTitle: e.target.value }))
                }
                placeholder="123inkt Validation Portal"
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Client domains
              <textarea
                value={form.allowedDomainsText}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    allowedDomainsText: e.target.value,
                  }))
                }
                placeholder={`123inkt.nl\nsubway.com`}
                style={{ ...inputStyle, minHeight: 84, resize: "vertical" }}
              />
            </label>

            <div style={colorGridStyle}>
              <label style={labelStyle}>
                Primary
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, primaryColor: e.target.value }))
                  }
                  style={colorInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Accent
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, accentColor: e.target.value }))
                  }
                  style={colorInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Background
                <input
                  type="color"
                  value={form.backgroundColor}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      backgroundColor: e.target.value,
                    }))
                  }
                  style={colorInputStyle}
                />
              </label>

              <label style={labelStyle}>
                Text
                <input
                  type="color"
                  value={form.textColor}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, textColor: e.target.value }))
                  }
                  style={colorInputStyle}
                />
              </label>
            </div>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, active: e.target.checked }))
                }
              />
              Active
            </label>

            <div style={buttonRowStyle}>
              <button type="submit" disabled={saving} style={primaryButtonStyle}>
                {saving ? "Saving..." : form.id ? "Save changes" : "Create branding"}
              </button>

              <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
                Reset
              </button>
            </div>
          </form>

          <div style={listCardStyle}>
            <div style={listHeaderStyle}>
              <div>
                <div style={sectionTitleStyle}>Clients</div>
                <div style={sectionTextStyle}>Existing client branding profiles.</div>
              </div>

              <button type="button" onClick={() => void loadProfiles()} style={secondaryButtonStyle}>
                Refresh
              </button>
            </div>

            {error ? <div style={errorStyle}>{error}</div> : null}
            {success ? <div style={successStyle}>{success}</div> : null}

            {loading ? (
              <div style={emptyStyle}>Loading client branding...</div>
            ) : profiles.length === 0 ? (
              <div style={emptyStyle}>No client branding yet.</div>
            ) : (
              <div style={profileListStyle}>
                {profiles.map((profile) => {
                  const busy = deleteLoadingId === profile.id;

                  return (
                    <div key={profile.id} style={profileCardStyle}>
                      <div style={profileMainStyle}>
                        <img
                          src={profile.logoUrl}
                          alt={`${profile.clientName} logo`}
                          style={profileLogoStyle}
                        />

                        <div style={{ minWidth: 0 }}>
                          <div style={profileTitleStyle}>{profile.clientName}</div>
                          <div style={profileMetaStyle}>
                            {(profile.allowedDomains || []).join(", ") || "No domains"}
                          </div>
                          <div style={chipRowStyle}>
                            <span
                              style={{
                                ...colorChipStyle,
                                background: profile.primaryColor,
                              }}
                            />
                            <span
                              style={{
                                ...colorChipStyle,
                                background: profile.accentColor,
                              }}
                            />
                            <span style={statusChipStyle}>
                              {profile.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={profileActionsStyle}>
                        <button
                          type="button"
                          onClick={() => editProfile(profile)}
                          style={smallButtonStyle}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void deleteProfile(profile)}
                          disabled={busy}
                          style={smallDangerButtonStyle}
                        >
                          {busy ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
  maxWidth: 1100,
  maxHeight: "calc(100vh - 48px)",
  overflow: "auto",
  borderRadius: 24,
  padding: 24,
  background: "rgba(255,255,255,0.96)",
  border: "1px solid rgba(0,0,0,0.08)",
  boxShadow: "0 24px 60px rgba(11,46,95,0.20)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 18,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  letterSpacing: "-0.03em",
  color: "#0B2E5F",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 14,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 420px) 1fr",
  gap: 18,
  alignItems: "start",
};

const formCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "rgba(248,251,255,0.82)",
};

const listCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "#fff",
};

const listHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#0B2E5F",
};

const sectionTextStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.45,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  fontSize: 13,
  fontWeight: 750,
  color: "#0B2E5F",
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

const colorGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const colorInputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  padding: 4,
  borderRadius: 12,
  border: "1px solid rgba(11,46,95,0.12)",
  background: "#fff",
  boxSizing: "border-box",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#0B2E5F",
  fontWeight: 700,
};

const previewStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "#fff",
};

const logoPreviewStyle: React.CSSProperties = {
  width: 72,
  height: 48,
  objectFit: "contain",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(11,46,95,0.08)",
  padding: 8,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
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

const profileListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const profileCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(11,46,95,0.08)",
  background: "rgba(248,251,255,0.72)",
};

const profileMainStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  minWidth: 0,
};

const profileLogoStyle: React.CSSProperties = {
  width: 64,
  height: 42,
  objectFit: "contain",
  borderRadius: 12,
  background: "#fff",
  border: "1px solid rgba(11,46,95,0.08)",
  padding: 7,
  flex: "0 0 auto",
};

const profileTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#0B2E5F",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const profileMetaStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: 12.5,
  color: "#64748b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 7,
};

const colorChipStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  border: "1px solid rgba(11,46,95,0.10)",
};

const statusChipStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "rgba(11,46,95,0.06)",
  color: "#0B2E5F",
  fontSize: 11,
  fontWeight: 800,
};

const profileActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexShrink: 0,
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

const emptyStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px dashed rgba(11,46,95,0.14)",
  color: "#64748b",
  fontSize: 14,
  background: "rgba(248,251,255,0.72)",
};
