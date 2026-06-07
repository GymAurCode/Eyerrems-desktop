import { useState, useEffect } from "react";
import { Shield, Users as UsersIcon, Activity, Settings, CheckCircle, AlertCircle, DollarSign, Save } from "lucide-react";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import { useAuthStore } from "../store/auth";
import { useCurrencyStore, CURRENCY_OPTIONS, type CurrencyCode } from "../store/currency";
import RolesTabRbac from "../modules/Admin/tabs/RolesTab";
import UsersTabRbac from "../modules/Admin/tabs/UsersTab";
import MonitoringTab from "../modules/Admin/tabs/MonitoringTab";

const TABS = [
  { key: "roles", label: "Roles", icon: Shield },
  { key: "users", label: "Users", icon: UsersIcon },
  { key: "monitoring", label: "Monitoring", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
] as const;
type TabKey = typeof TABS[number]["key"];

// ── Settings Tab (moved from inline in old Admin) ─────────────────────────────
function SettingsTab() {
  const { currencyCode, saveCurrency } = useCurrencyStore();
  const [selected, setSelected] = useState<CurrencyCode>(currencyCode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setSelected(currencyCode); }, [currencyCode]);

  const handleSave = async () => {
    setSaving(true); setErr(""); setSaved(false);
    try {
      await saveCurrency(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to save currency settings");
    } finally { setSaving(false); }
  };

  const previewAmount = 1250000;
  const previewCfg = CURRENCY_OPTIONS.find((c) => c.code === selected)!;
  const previewFormatted = `${previewCfg.symbol} ${new Intl.NumberFormat(previewCfg.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(previewAmount)}`;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          <DollarSign size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary">Currency Settings</h2>
          <p className="text-xs text-muted mt-0.5">
            Choose the currency symbol displayed across the entire application.
          </p>
        </div>
      </div>

      <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Select Currency</p>
        </div>
        <div className="p-5 space-y-3">
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = selected === opt.code;
            return (
              <label key={opt.code} onClick={() => setSelected(opt.code)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  border: isActive ? "1px solid rgba(99,102,241,0.5)" : "1px solid var(--border)",
                  background: isActive ? "rgba(99,102,241,0.08)" : "transparent",
                }}
              >
                <div className="relative flex-shrink-0">
                  <input type="radio" name="currency" value={opt.code} checked={isActive}
                    onChange={() => setSelected(opt.code)} className="sr-only" />
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{ borderColor: isActive ? "#6366f1" : "var(--border)", background: isActive ? "#6366f1" : "transparent" }}>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{ background: isActive ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "var(--border)", color: isActive ? "#fff" : "var(--text-secondary)" }}>
                  {opt.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-secondary"}`}>
                    {opt.code} — {opt.code === "PKR" ? "Pakistani Rupee" : "US Dollar"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Symbol: <span className="font-mono">{opt.symbol}</span>
                    &nbsp;·&nbsp;Example: <span className="font-mono">{opt.symbol} 1,250,000</span>
                  </p>
                </div>
                {isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                    Selected
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(59,130,246,0.15)" }}>
          <DollarSign size={14} className="text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted">Preview</p>
          <p className="text-sm font-semibold text-primary font-mono mt-0.5">{previewFormatted}</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={12} /> {err}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2 rounded-lg"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <CheckCircle size={12} /> Currency settings saved successfully.
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving || selected === currencyCode}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Main AdminPage ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const canManageRbac = isSuperAdmin || user?.role === "Admin" || user?.roles?.includes("Admin") || false;

  const [tab, setTab] = useState<TabKey>(canManageRbac ? "roles" : "users");

  useEffect(() => {
    if (!canManageRbac && tab === "roles") {
      setTab("users");
    }
  }, [canManageRbac, tab]);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Administration</h1>
        <p className="text-xs text-muted mt-0.5">Manage roles, users, monitoring and system settings</p>
      </div>

      <ModuleTabs
        tabs={TABS.map((t) => ({ label: t.label, value: t.key, icon: t.icon }))}
        activeTab={tab}
        onChange={(v) => setTab(v as TabKey)}
        moduleColor={MODULE_COLORS.admin.primary}
      />

      {tab === "roles" && <RolesTabRbac />}
      {tab === "users" && <UsersTabRbac />}
      {tab === "monitoring" && <MonitoringTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
