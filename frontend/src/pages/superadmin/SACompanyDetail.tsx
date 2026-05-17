import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { saApi, Company, CompanyUser, CompanyFeature } from "../../lib/superAdminApi";

const FEATURE_LABELS: Record<string, string> = {
  property_module:     "Properties",
  crm_module:          "CRM",
  finance_module:      "Finance",
  tenant_module:       "Tenants",
  construction_module: "Construction",
  hr_module:           "HR",
  mail_module:         "Mail",
  reminders_module:    "Reminders",
};

export default function SACompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const companyId = Number(id);

  const [company,  setCompany]  = useState<Company | null>(null);
  const [features, setFeatures] = useState<CompanyFeature[]>([]);
  const [users,    setUsers]    = useState<CompanyUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [tab,      setTab]      = useState<"overview" | "features" | "users">("overview");

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      saApi.getCompany(companyId),
      saApi.getFeatures(companyId),
      saApi.listUsers(companyId),
    ])
      .then(([c, f, u]) => { setCompany(c); setFeatures(f); setUsers(u); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [companyId]);

  const toggleFeature = async (key: string, current: boolean) => {
    setSaving(true);
    try {
      const updated = await saApi.updateFeatures(companyId, { [key]: !current });
      setFeatures(updated);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    if (!company) return;
    setSaving(true);
    try {
      const updated = await saApi.setStatus(companyId, company.status === "active" ? "suspended" : "active");
      setCompany(updated);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={20} className="animate-spin" style={{ color: "var(--sa-accent)" }} />
      </div>
    );
  }

  if (!company) return <p className="sa-error">Company not found.</p>;

  return (
    <div className="space-y-5 animate-slide-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/super-admin/companies")}
            className="sa-btn-ghost w-8 h-8 p-0 flex items-center justify-center"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-xl font-bold sa-text-primary">{company.name}</h1>
            <p className="text-xs sa-text-muted">/{company.slug} · {company.plan}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={toggleStatus}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 border"
          style={{
            background: company.status === "active" ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
            color:      company.status === "active" ? "#ef4444" : "#10b981",
            borderColor: company.status === "active" ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)",
          }}
        >
          {saving ? "…" : company.status === "active" ? "Suspend Company" : "Activate Company"}
        </button>
      </div>

      {/* Tabs */}
      <div className="sa-tab-bar">
        {(["overview", "features", "users"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`sa-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Status",   value: company.status, color: company.status === "active" ? "#10b981" : "#ef4444" },
            { label: "Plan",     value: company.plan,   color: "var(--sa-accent)" },
            { label: "Users",    value: users.length,   color: "#3b82f6" },
            { label: "Features", value: `${features.filter((f) => f.enabled).length}/${features.length}`, color: "#f59e0b" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border p-4"
              style={{
                background: `color-mix(in srgb, ${color} 8%, var(--sa-bg-surface))`,
                borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
              }}
            >
              <p className="text-xl font-bold mb-1" style={{ color }}>{value}</p>
              <p className="text-xs sa-text-muted">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Features */}
      {tab === "features" && (
        <div className="sa-card-faint p-5 space-y-3">
          <p className="text-sm font-semibold sa-text-primary mb-4">Module Feature Flags</p>
          {features.length === 0 ? (
            <p className="text-xs sa-text-muted">No features configured.</p>
          ) : (
            features.map((f) => (
              <div
                key={f.feature_key}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "var(--sa-accent-faint)" }}
              >
                <div className="flex items-center gap-3">
                  {f.enabled
                    ? <CheckCircle size={15} style={{ color: "#10b981" }} />
                    : <XCircle    size={15} style={{ color: "#ef4444" }} />}
                  <span className="text-sm font-medium sa-text-primary">
                    {FEATURE_LABELS[f.feature_key] ?? f.feature_key}
                  </span>
                  <span className="text-[10px] sa-text-muted">{f.feature_key}</span>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggleFeature(f.feature_key, f.enabled)}
                  className="sa-toggle"
                  style={{ background: f.enabled ? "var(--sa-accent)" : "var(--sa-border)" }}
                >
                  <span
                    className="sa-toggle-thumb"
                    style={{ left: f.enabled ? "22px" : "2px" }}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="sa-table-wrap">
          <div className="sa-section-header">
            <Users size={14} style={{ color: "var(--sa-accent)" }} />
            <span className="text-sm font-semibold sa-text-primary">Users ({users.length})</span>
          </div>
          {users.length === 0 ? (
            <p className="text-xs text-center py-8 sa-text-muted">No users in this company.</p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="sa-table-row flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="sa-avatar">{u.full_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="text-sm font-medium sa-text-primary">{u.full_name}</p>
                    <p className="text-[10px] sa-text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.roles.map((r) => (
                    <span key={r} className="text-[10px] px-2 py-0.5 rounded-full sa-badge">{r}</span>
                  ))}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: u.status === "active" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color:      u.status === "active" ? "#10b981" : "#ef4444",
                    }}
                  >
                    {u.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
