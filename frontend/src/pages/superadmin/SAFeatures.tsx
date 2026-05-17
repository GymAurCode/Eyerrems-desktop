import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RefreshCw, ToggleLeft } from "lucide-react";
import { saApi, Company, CompanyFeature } from "../../lib/superAdminApi";

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

export default function SAFeatures() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected,  setSelected]  = useState<number | null>(null);
  const [features,  setFeatures]  = useState<CompanyFeature[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    saApi.listCompanies().then((cs) => {
      setCompanies(cs);
      if (cs.length > 0) setSelected(cs[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    saApi.getFeatures(selected)
      .then(setFeatures)
      .finally(() => setLoading(false));
  }, [selected]);

  const toggle = async (key: string, current: boolean) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await saApi.updateFeatures(selected, { [key]: !current });
      setFeatures(updated);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const setAll = async (enabled: boolean) => {
    if (!selected) return;
    setSaving(true);
    const all = Object.fromEntries(features.map((f) => [f.feature_key, enabled]));
    try { setFeatures(await saApi.updateFeatures(selected, all)); }
    catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold sa-text-primary">Feature Management</h1>
        <p className="text-xs mt-0.5 sa-text-muted">Enable or disable modules per company</p>
      </div>

      {/* Company picker */}
      <div className="sa-card-faint p-4">
        <p className="text-xs font-semibold mb-3 sa-text-secondary">Select Company</p>
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all border"
              style={{
                background:  selected === c.id ? "var(--sa-accent-soft)"  : "transparent",
                borderColor: selected === c.id ? "var(--sa-accent)"       : "var(--sa-border)",
                color:       selected === c.id ? "var(--sa-accent-light)" : "var(--sa-icon-color)",
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Feature toggles */}
      {selected && (
        <div className="sa-card-faint p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ToggleLeft size={15} style={{ color: "var(--sa-accent)" }} />
              <span className="text-sm font-semibold sa-text-primary">
                {companies.find((c) => c.id === selected)?.name} — Modules
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setAll(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 border"
                style={{ color: "#10b981", borderColor: "rgba(16,185,129,0.25)", background: "transparent" }}
              >
                Enable All
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAll(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 border"
                style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.25)", background: "transparent" }}
              >
                Disable All
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={18} className="animate-spin" style={{ color: "var(--sa-accent)" }} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {features.map((f) => (
                <div
                  key={f.feature_key}
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: "var(--sa-accent-faint)" }}
                >
                  <div className="flex items-center gap-3">
                    {f.enabled
                      ? <CheckCircle size={15} style={{ color: "#10b981" }} />
                      : <XCircle    size={15} style={{ color: "#ef4444" }} />}
                    <div>
                      <p className="text-sm font-medium sa-text-primary">
                        {FEATURE_LABELS[f.feature_key] ?? f.feature_key}
                      </p>
                      <p className="text-[10px] sa-text-muted">{f.feature_key}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => toggle(f.feature_key, f.enabled)}
                    className="sa-toggle"
                    style={{ background: f.enabled ? "var(--sa-accent)" : "var(--sa-border)" }}
                  >
                    <span
                      className="sa-toggle-thumb"
                      style={{ left: f.enabled ? "22px" : "2px" }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
