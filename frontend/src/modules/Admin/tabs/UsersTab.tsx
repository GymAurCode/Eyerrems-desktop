import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertCircle, Check, Search, Mail, Shield } from "lucide-react";
import {
  fetchCompanyUsers,
  fetchRoles,
  createCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  toggleUserStatus,
  type CompanyUser,
  type Role,
} from "../../../lib/rbacApi";

export default function UsersTab() {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<CompanyUser | null>(null);
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState<number | "">("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        fetchCompanyUsers({ search: search || undefined }),
        fetchRoles(),
      ]);
      setUsers(u);
      setRoles(r);
    } catch { } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { loadData(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreate = async () => {
    if (!formEmail.trim() || !formName.trim() || !formPassword.trim()) {
      setError("Email, name, and password are required"); return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      const user = await createCompanyUser({
        email: formEmail.trim(),
        full_name: formName.trim(),
        password: formPassword,
        role_id: formRoleId || null,
        is_active: formActive,
      });
      setUsers((prev) => [user, ...prev]);
      resetForm();
      setSuccess(`User "${user.email}" created`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create user");
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editUser || !formName.trim()) { setError("Name is required"); return; }
    if (!formEmail.trim()) { setError("Email is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await updateCompanyUser(editUser.id, {
        full_name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword || undefined,
        role_id: formRoleId || null,
        is_active: formActive,
      });
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      resetForm();
      setSuccess(`User "${updated.email}" updated`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update user");
    } finally { setSaving(false); }
  };

  const handleDelete = async (user: CompanyUser) => {
    if (!confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setError(""); setSuccess("");
    try {
      await deleteCompanyUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setSuccess(`User "${user.email}" deleted`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to delete user");
    }
  };

  const handleToggleStatus = async (user: CompanyUser) => {
    setError(""); setSuccess("");
    try {
      const result = await toggleUserStatus(user.id);
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: result.is_active, status: result.is_active ? "active" : "suspended" } : u));
      setSuccess(result.message);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to toggle user status");
    }
  };

  const openEditForm = (user: CompanyUser) => {
    setEditUser(user);
    setFormEmail(user.email);
    setFormName(user.full_name);
    setFormPassword("");
    setFormRoleId(user.role_id ?? "");
    setFormActive(user.is_active);
    setShowForm(true);
    setError("");
  };

  const resetForm = () => {
    setShowForm(false);
    setEditUser(null);
    setFormEmail("");
    setFormName("");
    setFormPassword("");
    setFormRoleId("");
    setFormActive(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Users</h2>
          <p className="text-xs text-muted mt-0.5">Manage users in your company</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg">
          <Plus size={14} /> New User
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Check size={12} /> {success}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg"
            style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
        </div>
        <button type="submit" className="px-4 py-2 text-xs font-medium rounded-lg btn-primary">Search</button>
      </form>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold text-primary">{editUser ? "Edit User" : "Create User"}</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Full Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  {editUser ? "New Password (leave blank to keep)" : "Password"}
                </label>
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Role</label>
                <select value={formRoleId} onChange={(e) => setFormRoleId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                  <option value="">No role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formActive} onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span className="text-xs text-primary font-medium">Active</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={resetForm}
                className="px-4 py-2 text-xs font-medium rounded-lg"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={editUser ? handleUpdate : handleCreate} disabled={saving}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={12} />}
                {saving ? "Saving..." : editUser ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted">
            <Users size={32} className="mb-2 opacity-30" />
            <p className="text-xs">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">User</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Created</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff" }}>
                          {user.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-primary">{user.full_name}</p>
                          <p className="text-[11px] text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.role_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{ background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.15)" }}>
                          <Shield size={10} /> {user.role_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                        user.is_active ? "text-emerald-400" : "text-red-400"
                      }`}
                        style={{
                          background: user.is_active ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                          border: user.is_active ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(239,68,68,0.15)",
                        }}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditForm(user)}
                          className="p-1.5 rounded hover:bg-white/5 text-muted hover:text-primary" title="Edit">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleToggleStatus(user)}
                          className="p-1.5 rounded hover:bg-white/5 text-muted hover:text-primary" title={user.is_active ? "Deactivate" : "Activate"}>
                          {user.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                        </button>
                        <button onClick={() => handleDelete(user)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
