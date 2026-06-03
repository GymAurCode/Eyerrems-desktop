import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, Edit2, Trash2, Pause, Play, Calendar, AlertTriangle } from "lucide-react";
import { DataTable } from "../components/data-table";

interface Company {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: "active" | "suspended";
  plan: string;
  currency_code: string;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
  user_count: number;
  active_user_count: number;
  db_size_bytes: number | null;
  is_expired: boolean;
}

// Simple date formatter without external dependency
function formatExpiryDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) return "Expired";
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  
  return date.toLocaleDateString();
}

export default function SuperAdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Company[]>("/superadmin/companies");
      setCompanies(data);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (companyId: number, newStatus: "active" | "suspended") => {
    try {
      await api.patch(`/superadmin/companies/${companyId}/status`, { status: newStatus });
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, status: newStatus } : c))
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update company status");
    }
  };

  const handleDelete = async (companyId: number) => {
    if (!window.confirm("Are you sure? This will delete the company and all its data.")) return;
    try {
      await api.delete(`/superadmin/companies/${companyId}`);
      setCompanies((prev) => prev.filter((c) => c.id !== companyId));
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete company");
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base p-6 text-primary">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Companies</h1>
            <p className="text-muted mt-2">Manage all tenant companies and their lifecycle</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Create Company
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {showCreateForm && (
          <CompanyCreateModal
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              fetchCompanies();
            }}
          />
        )}

        {/* Companies Table */}
        <DataTable
          data={companies}
          columns={[
            { key: "name", label: "Company", render: (val, row) => (
              <div>
                <p className="font-medium">{val}</p>
                <p className="text-xs text-muted">{row.slug}</p>
              </div>
            )},
            { key: "email", label: "Email", render: (val) => <span className="text-secondary">{val}</span> },
            { key: "active_user_count", label: "Users", render: (val, row) => (
              <div className="text-center">
                <p className="font-medium">{val}</p>
                <p className="text-xs text-muted">of {row.user_count}</p>
              </div>
            )},
            { key: "status", label: "Status", render: (val) => (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                val === "active" ? "bg-green-500/10 text-green-200" : "bg-yellow-500/10 text-yellow-200"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {val}
              </span>
            )},
            { key: "expiry_date", label: "Expires", render: (val, row) => row.is_expired ? (
              <span className="text-red-300 font-medium">Expired</span>
            ) : val ? (
              <span className="text-secondary">{formatExpiryDate(val)}</span>
            ) : (
              <span className="text-muted">—</span>
            )},
            { key: "db_size_bytes", label: "DB Size", render: (val) => <span className="text-muted">{formatBytes(val)}</span> },
          ]}
          rowActions={(row) => [
            {
              label: row.status === "active" ? "Suspend" : "Activate",
              icon: row.status === "active" ? Pause : Play,
              onClick: () => handleStatusChange(row.id, row.status === "active" ? "suspended" : "active"),
              color: row.status === "active" ? "#ef4444" : "#10b981",
            },
            {
              label: "Delete",
              icon: Trash2,
              onClick: () => handleDelete(row.id),
              color: "#ef4444",
            },
          ]}
          variant="bordered"
          searchable={false}
          emptyTitle="No companies found"
        />
      </div>
    </div>
  );
}

interface CompanyCreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CompanyCreateModal({ onClose, onSuccess }: CompanyCreateModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    email: "",
    phone: "",
    plan: "starter",
    currency_code: "USD",
    expiry_days: 365,
    admin_user: {
      email: "",
      name: "",
      password: "",
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      await api.post("/superadmin/companies", formData);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-3xl border border-theme max-w-lg w-full max-h-[90vh] overflow-y-auto p-8">
        <h2 className="text-2xl font-bold mb-6">Create Company</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company Info */}
          <div>
            <label className="block text-sm font-medium mb-2">Company Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="Acme Corp"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
              className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="acme-corp"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                placeholder="info@acme.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                placeholder="+1234567890"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Plan</label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              >
                <option>starter</option>
                <option>professional</option>
                <option>enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              >
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
                <option>AED</option>
                <option>SAR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Expires (days)</label>
              <input
                type="number"
                value={formData.expiry_days}
                onChange={(e) => setFormData({ ...formData, expiry_days: parseInt(e.target.value) })}
                className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                min="1"
                required
              />
            </div>
          </div>

          {/* Admin User Info */}
          <hr className="border-theme" />
          <h3 className="font-semibold text-lg">Admin User</h3>

          <div>
            <label className="block text-sm font-medium mb-2">Admin Email</label>
            <input
              type="email"
              value={formData.admin_user.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  admin_user: { ...formData.admin_user, email: e.target.value },
                })
              }
              className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="admin@acme.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Admin Full Name</label>
            <input
              type="text"
              value={formData.admin_user.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  admin_user: { ...formData.admin_user, name: e.target.value },
                })
              }
              className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="John Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Admin Password</label>
            <input
              type="password"
              value={formData.admin_user.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  admin_user: { ...formData.admin_user, password: e.target.value },
                })
              }
              className="w-full bg-tertiary border border-theme rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-theme hover:bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg font-medium transition-colors"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
