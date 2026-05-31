import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Plus, Edit2, Trash2, Pause, Play, Calendar, AlertTriangle } from "lucide-react";

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
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Companies</h1>
            <p className="text-slate-400 mt-2">Manage all tenant companies and their lifecycle</p>
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
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="px-6 py-3 text-left font-semibold">Company</th>
                  <th className="px-6 py-3 text-left font-semibold">Email</th>
                  <th className="px-6 py-3 text-left font-semibold">Users</th>
                  <th className="px-6 py-3 text-left font-semibold">Status</th>
                  <th className="px-6 py-3 text-left font-semibold">Expires</th>
                  <th className="px-6 py-3 text-left font-semibold">DB Size</th>
                  <th className="px-6 py-3 text-left font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-xs text-slate-400">{company.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{company.email}</td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <p className="font-medium">{company.active_user_count}</p>
                        <p className="text-xs text-slate-400">of {company.user_count}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          company.status === "active"
                            ? "bg-green-500/10 text-green-200"
                            : "bg-yellow-500/10 text-yellow-200"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {company.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {company.is_expired ? (
                        <span className="text-red-300 font-medium">Expired</span>
                      ) : company.expiry_date ? (
                        <span className="text-slate-300">
                          {formatExpiryDate(company.expiry_date)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400">{formatBytes(company.db_size_bytes)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleStatusChange(company.id, company.status === "active" ? "suspended" : "active")
                          }
                          className={`p-2 rounded-lg transition-colors ${
                            company.status === "active"
                              ? "hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                              : "hover:bg-green-500/10 text-slate-400 hover:text-green-400"
                          }`}
                          title={company.status === "active" ? "Suspend" : "Activate"}
                        >
                          {company.status === "active" ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          onClick={() => handleDelete(company.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {companies.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-slate-400">No companies found</p>
            </div>
          )}
        </div>
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
      <div className="bg-slate-900 rounded-3xl border border-slate-800 max-w-lg w-full max-h-[90vh] overflow-y-auto p-8">
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
                min="1"
                required
              />
            </div>
          </div>

          {/* Admin User Info */}
          <hr className="border-slate-700" />
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
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
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:border-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition-colors"
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
