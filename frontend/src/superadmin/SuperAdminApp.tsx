import { Routes, Route, useNavigate, useLocation, useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { Building2, LayoutDashboard, Plus, LogOut, AlertTriangle, Shield, ChevronDown, ChevronRight, Save, CheckCircle, XCircle } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Company {
  id: string;
  name: string;
  admin_email: string;
  phone: string | null;
  status: string;
  schema_name: string;
  expiry_date: string | null;
  created_at: string | null;
}

interface Stats {
  total_companies: number;
  active_companies: number;
  suspended_companies: number;
  expired_companies: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

// ── Layout ────────────────────────────────────────────────────────────────────

const NAV = [
  { path: "/superadmin",         label: "Overview",      icon: LayoutDashboard },
  { path: "/superadmin/companies", label: "Companies",    icon: Building2 },
  { path: "/superadmin/create",  label: "Create Company", icon: Plus },
];

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="w-60 h-screen flex flex-col border-r shrink-0" style={{ background: "#0f1117", borderColor: "#1e293b" }}>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: "#1e293b" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          <Building2 size={16} className="text-white" />
        </div>
        <div>
          <p className="text-xs font-semibold" style={{ color: "#f1f5f9" }}>SuperAdmin</p>
          <p className="text-[10px]" style={{ color: "#64748b" }}>Master Console</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                color: isActive ? "#60a5fa" : "#64748b",
              }}
            >
              <Icon size={18} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-3">
        <button
          onClick={() => { logout(); navigate("/superadmin/login", { replace: true }); }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all"
          style={{ color: "#ef4444" }}
        >
          <LogOut size={18} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen" style={{ background: "#0f1117", color: "#e2e8f0" }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

// ── Overview Page ─────────────────────────────────────────────────────────────

function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Stats>("/superadmin/stats").then((r) => setStats(r.data)),
      api.get<Company[]>("/superadmin/companies").then((r) => setCompanies(r.data.slice(0, 5))),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#3b82f6" }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>System-wide statistics and recent companies</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Companies" value={stats.total_companies} color="#3b82f6" />
          <StatCard label="Active" value={stats.active_companies} color="#10b981" />
          <StatCard label="Suspended" value={stats.suspended_companies} color="#f59e0b" />
          <StatCard label="Expired" value={stats.expired_companies} color="#ef4444" />
        </div>
      )}

      {/* Recent Companies */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b", background: "#111318" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "#1e293b" }}>
          <h2 className="font-semibold text-sm">Recent Companies</h2>
          <Link to="/superadmin/companies" className="text-xs font-medium" style={{ color: "#60a5fa" }}>View All</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#0a0b0f" }}>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Name</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Status</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Expiry</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "#1e293b" }}>
                <td className="px-5 py-3">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs" style={{ color: "#64748b" }}>{c.admin_email}</p>
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.status} expiryDate={c.expiry_date} /></td>
                <td className="px-5 py-3 text-xs" style={{ color: "#94a3b8" }}>{formatDate(c.expiry_date)}</td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={3} className="px-5 py-8 text-center text-sm" style={{ color: "#64748b" }}>No companies yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "#1e293b", background: "#111318" }}>
      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function StatusBadge({ status, expiryDate }: { status: string; expiryDate: string | null }) {
  const expired = isExpired(expiryDate);
  const effectiveStatus = expired && status === "active" ? "expired" : status;
  const colors: Record<string, { text: string; bg: string }> = {
    active:    { text: "#10b981", bg: "rgba(16,185,129,0.12)" },
    suspended: { text: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    expired:   { text: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const c = colors[effectiveStatus] ?? { text: "#64748b", bg: "rgba(100,116,139,0.12)" };
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: c.text, background: c.bg }}>
      {effectiveStatus}
    </span>
  );
}

// ── Companies Page ────────────────────────────────────────────────────────────

function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extendModal, setExtendModal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Company[]>("/superadmin/companies");
      setCompanies(data);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join("; ") : detail || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async (id: string) => {
    try { await api.patch(`/superadmin/companies/${id}/suspend`); fetchCompanies(); } catch {}
  };

  const handleActivate = async (id: string) => {
    try { await api.patch(`/superadmin/companies/${id}/activate`); fetchCompanies(); } catch {}
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this company and all its data? This cannot be undone.")) return;
    try { await api.delete(`/superadmin/companies/${id}`); fetchCompanies(); } catch {}
  };

  const handleExtend = async (id: string, days: number) => {
    try { await api.patch(`/superadmin/companies/${id}/extend-expiry`, { extend_days: days }); fetchCompanies(); setExtendModal(null); } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#3b82f6" }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>Manage all tenant companies</p>
        </div>
        <Link to="/superadmin/create" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "#2563eb", color: "#fff" }}>
          <Plus size={16} /> Create
        </Link>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b", background: "#111318" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#0a0b0f" }}>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Company</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Email</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Status</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Expiry</th>
              <th className="text-left px-5 py-3 font-medium" style={{ color: "#64748b" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const expired = isExpired(c.expiry_date);
              return (
                <tr key={c.id} className="border-t" style={{ borderColor: "#1e293b" }}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs" style={{ color: "#64748b" }}>{c.schema_name}</p>
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#94a3b8" }}>{c.admin_email}</td>
                  <td className="px-5 py-3"><StatusBadge status={c.status} expiryDate={c.expiry_date} /></td>
                  <td className="px-5 py-3 text-xs" style={{ color: "#94a3b8" }}>{formatDate(c.expiry_date)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {c.status === "active" && !expired ? (
                        <button onClick={() => handleSuspend(c.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)" }}>Suspend</button>
                      ) : (
                        <button onClick={() => handleActivate(c.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: "#10b981", background: "rgba(16,185,129,0.1)" }}>Activate</button>
                      )}
                      <button onClick={() => setExtendModal({ id: c.id, name: c.name })} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: "#3b82f6", background: "rgba(59,130,246,0.1)" }}>Extend</button>
                      <Link to={`/superadmin/companies/${c.id}/permissions`} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all inline-block" style={{ color: "#8b5cf6", background: "rgba(139,92,246,0.1)" }}>Permissions</Link>
                      <button onClick={() => handleDelete(c.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all" style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {companies.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-sm" style={{ color: "#64748b" }}>No companies found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Extend Expiry Modal */}
      {extendModal && (
        <ExtendModal
          companyName={extendModal.name}
          onSelect={(days) => handleExtend(extendModal.id, days)}
          onClose={() => setExtendModal(null)}
        />
      )}
    </div>
  );
}

function ExtendModal({ companyName, onSelect, onClose }: { companyName: string; onSelect: (days: number) => void; onClose: () => void }) {
  const [days, setDays] = useState(30);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-xl border p-6 w-80" style={{ borderColor: "#1e293b", background: "#111318" }}>
        <h3 className="font-semibold mb-2">Extend Expiry</h3>
        <p className="text-xs mb-4" style={{ color: "#64748b" }}>How many days to add for <strong>{companyName}</strong>?</p>
        <input type="number" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 30)} className="w-full px-3 py-2 rounded-lg border text-sm mb-4" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} min={1} />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "#1e293b" }}>Cancel</button>
          <button onClick={() => onSelect(days)} className="flex-1 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#2563eb", color: "#fff" }}>Extend</button>
        </div>
      </div>
    </div>
  );
}

// ── Create Company Page ───────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { value: "1_month",  label: "1 Month" },
  { value: "3_months", label: "3 Months" },
  { value: "6_months", label: "6 Months" },
  { value: "1_year",   label: "1 Year" },
  { value: "custom",   label: "Custom Date" },
];

function CreateCompanyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    admin_email: "",
    admin_password: "",
    phone: "",
    expiry_option: "1_year",
    custom_expiry_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/superadmin/companies", form);
      navigate("/superadmin/companies");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join("; ") : detail || "Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Company</h1>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Provision a new tenant company</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ color: "#f87171", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Company Name *</label>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Admin Email *</label>
          <input type="email" required value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Admin Password *</label>
          <input type="password" required value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Phone</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Expiry *</label>
          <select value={form.expiry_option} onChange={(e) => setForm({ ...form, expiry_option: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }}>
            {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {form.expiry_option === "custom" && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Custom Expiry Date</label>
            <input type="date" value={form.custom_expiry_date} onChange={(e) => setForm({ ...form, custom_expiry_date: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ background: "#0a0b0f", borderColor: "#1e293b", color: "#e2e8f0" }} />
          </div>
        )}
        <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: "#2563eb", color: "#fff" }}>
          {loading ? "Creating..." : "Create Company"}
        </button>
      </form>
    </div>
  );
}

// ── Permissions Page ───────────────────────────────────────────────────────────

const MODULES_CONFIG: Record<string, string[]> = {
  properties: ["overview", "units", "tenants", "maintenance", "documents"],
  tenants: ["profile", "payments", "complaints", "documents"],
  crm: ["leads", "contacts", "deals"],
  hr: ["employees", "payroll", "attendance"],
  finance: ["income", "expenses", "reports", "invoices"],
  maintenance: ["open", "in_progress", "resolved"],
  reports: [],
  settings: [],
  reminders: [],
};

const MODULE_LABELS: Record<string, string> = {
  properties: "Properties",
  tenants: "Tenants",
  crm: "CRM",
  hr: "HR",
  finance: "Finance",
  maintenance: "Maintenance",
  reports: "Reports",
  settings: "Settings",
  reminders: "Reminders",
};

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  units: "Units",
  tenants: "Tenants",
  maintenance: "Maintenance",
  documents: "Documents",
  profile: "Profile",
  payments: "Payments",
  complaints: "Complaints",
  leads: "Leads",
  contacts: "Contacts",
  deals: "Deals",
  employees: "Employees",
  payroll: "Payroll",
  attendance: "Attendance",
  income: "Income",
  expenses: "Expenses",
  reports: "Reports",
  invoices: "Invoices",
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function buildDefaultPermissions(): Record<string, { enabled: boolean; tabs: Record<string, boolean> }> {
  const perms: Record<string, any> = {};
  for (const [module, tabs] of Object.entries(MODULES_CONFIG)) {
    perms[module] = { enabled: true, tabs: {} };
    for (const tab of tabs) {
      perms[module].tabs[tab] = true;
    }
  }
  return perms;
}

function PermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [perms, setPerms] = useState<Record<string, { enabled: boolean; tabs: Record<string, boolean> }>>({});
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [compRes, permRes] = await Promise.all([
          api.get(`/superadmin/companies`),
          api.get(`/superadmin/companies/${id}/permissions`),
        ]);
        const company = compRes.data.find((c: any) => c.id === id);
        setCompanyName(company?.name || "Unknown");

        const saved = permRes.data.permissions;
        const defaults = buildDefaultPermissions();
        // Merge saved permissions into defaults
        const merged: Record<string, any> = {};
        for (const [mod, def] of Object.entries(defaults)) {
          merged[mod] = {
            enabled: saved?.[mod]?.enabled ?? def.enabled,
            tabs: { ...def.tabs, ...(saved?.[mod]?.tabs || {}) },
          };
        }
        setPerms(merged);
      } catch {
        setToast({ type: "error", message: "Failed to load permissions" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const toggleModule = (module: string) => {
    setPerms((prev) => ({
      ...prev,
      [module]: { ...prev[module], enabled: !prev[module].enabled },
    }));
  };

  const toggleTab = (module: string, tab: string) => {
    setPerms((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        tabs: { ...prev[module].tabs, [tab]: !prev[module].tabs[tab] },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/superadmin/companies/${id}/permissions`, { permissions: perms });
      setToast({ type: "success", message: "Permissions saved successfully" });
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast({ type: "error", message: "Failed to save permissions" });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: "#8b5cf6" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium"
          style={{
            background: toast.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            color: toast.type === "success" ? "#10b981" : "#ef4444",
            border: `1px solid ${toast.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/superadmin/companies" className="text-xs" style={{ color: "#64748b" }}>Companies</Link>
            <span className="text-xs" style={{ color: "#475569" }}>/</span>
            <span className="text-xs" style={{ color: "#94a3b8" }}>Permissions</span>
          </div>
          <h1 className="text-2xl font-bold">Permissions — {companyName}</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>Control which modules and tabs this company can access</p>
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-3">
        {Object.entries(MODULES_CONFIG).map(([module, tabs]) => {
          const isExpanded = expanded[module] ?? (module === "properties" || module === "tenants" || module === "finance");
          const modulePerm = perms[module] || { enabled: true, tabs: {} };
          return (
            <div key={module} className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e293b", background: "#111318" }}>
              {/* Module header */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer select-none"
                style={{ borderBottom: isExpanded ? "1px solid #1e293b" : "none" }}
                onClick={() => setExpanded({ ...expanded, [module]: !isExpanded })}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={16} style={{ color: "#64748b" }} /> : <ChevronRight size={16} style={{ color: "#64748b" }} />}
                  <span className="font-medium text-sm">{MODULE_LABELS[module] || module}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={modulePerm.enabled}
                    onChange={() => toggleModule(module)}
                  />
                  <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                    style={{ background: modulePerm.enabled ? "#8b5cf6" : "#334155" }}
                  />
                </label>
              </div>

              {/* Tabs */}
              {isExpanded && modulePerm.enabled && tabs.length > 0 && (
                <div className="px-5 py-3 space-y-2">
                  {tabs.map((tab) => (
                    <div key={tab} className="flex items-center justify-between py-1">
                      <span className="text-sm" style={{ color: "#cbd5e1" }}>{TAB_LABELS[tab] || tab}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={modulePerm.tabs[tab] ?? true}
                          onChange={() => toggleTab(module, tab)}
                        />
                        <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"
                          style={{ background: (modulePerm.tabs[tab] ?? true) ? "#8b5cf6" : "#334155" }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
              {isExpanded && !modulePerm.enabled && (
                <div className="px-5 py-4 text-xs" style={{ color: "#64748b" }}>Module disabled — tabs hidden</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => navigate("/superadmin/companies")}
          className="px-5 py-2.5 rounded-lg text-sm font-medium border"
          style={{ borderColor: "#1e293b", color: "#94a3b8" }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
          style={{ background: "#7c3aed", color: "#fff" }}
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Permissions"}
        </button>
      </div>
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function SuperAdminApp() {
  return (
    <Routes>
      <Route index element={<Layout><OverviewPage /></Layout>} />
      <Route path="companies" element={<Layout><CompaniesPage /></Layout>} />
      <Route path="companies/:id/permissions" element={<Layout><PermissionsPage /></Layout>} />
      <Route path="create" element={<Layout><CreateCompanyPage /></Layout>} />
    </Routes>
  );
}
