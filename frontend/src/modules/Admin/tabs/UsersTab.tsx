import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import AppDialog from "../../../components/ui/AppDialog";
import {
  Users, Plus, Pencil, Trash2, Save, AlertCircle, Key, Copy, CheckCircle, Eye, EyeOff, RefreshCw,
} from "lucide-react";

interface Role {
  id: number;
  name: string;
  description: string;
}

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  status: string;
  role: string;
  company_slug: string;
  last_login: string;
  is_active: boolean;
  slug_locked: boolean;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  pwd += "#" + new Date().getFullYear();
  return pwd;
}

function StatusBadge({ user }: { user: UserRow }) {
  if (!user.slug_locked) {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
        style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
        Pending Setup
      </span>
    );
  }
  if (user.status === "active") {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
        style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
        Active
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
      Inactive
    </span>
  );
}

export default function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [activeUser, setActiveUser] = useState<UserRow | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");
  const [tempPassword, setTempPassword] = useState(generatePassword());
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [createdUser, setCreatedUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<UserRow[]>("/admin/users");
      setUsers(data || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const { data } = await api.get<Role[]>("/auth/roles");
      setRoles(data);
    } catch { setRoles([]); }
  }, []);

  useEffect(() => { void loadUsers(); void loadRoles(); }, [loadUsers, loadRoles]);

  const resetForm = () => {
    setFullName(""); setEmail(""); setSelectedRoleId("");
    setTempPassword(generatePassword()); setFormErr("");
    setCreatedUser(null); setCopied(false);
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (u: UserRow) => {
    setActiveUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setSelectedRoleId("");
    setFormErr("");
    setShowEdit(true);
  };

  const createUser = async () => {
    if (!fullName.trim() || !email.trim() || selectedRoleId === "") {
      setFormErr("Full Name, Email, and Role are required");
      return;
    }
    setSaving(true); setFormErr("");
    try {
      const { data } = await api.post("/api/rbac/admin/users", {
        full_name: fullName.trim(),
        email: email.trim(),
        role_id: Number(selectedRoleId),
        password: tempPassword,
      });
      setCreatedUser(data);
      await loadUsers();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to create user");
    } finally { setSaving(false); }
  };

  const updateUser = async () => {
    if (!activeUser || !fullName.trim()) { setFormErr("Name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.patch(`/admin/users/${activeUser.id}`, { full_name: fullName.trim() });
      setShowEdit(false); setActiveUser(null);
      await loadUsers();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to update user");
    } finally { setSaving(false); }
  };

  const resetPassword = async (u: UserRow) => {
    const newPwd = generatePassword();
    if (!confirm(`Reset password for ${u.full_name}? New temporary password will be shown.`)) return;
    try {
      await api.post(`/api/rbac/admin/users/${u.id}/reset-password`, { password: newPwd });
      alert(`Temporary password: ${newPwd}\n\nShare this securely with the user.`);
    } catch { alert("Failed to reset password"); }
  };

  const toggleActivate = async (u: UserRow) => {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status: u.is_active ? "suspended" : "active" });
      await loadUsers();
    } catch { /* ignore */ }
  };

  const forceLogout = async (u: UserRow) => {
    if (!confirm(`Force logout ${u.full_name}?`)) return;
    try { await api.post(`/api/rbac/admin/users/${u.id}/force-logout`); }
    catch { /* ignore */ }
  };

  const copyCreds = async () => {
    if (!createdUser) return;
    const text = `Email: ${createdUser.email}\nPassword: ${tempPassword}\nCompany Slug: ${createdUser.company_slug || "—"}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-xs">
          <Plus size={13} /> New User
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--bg-tertiary)" }}>
                <th className="text-left px-4 py-3 font-semibold text-muted">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Slug</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Last Login</th>
                <th className="text-right px-4 py-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-primary font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-secondary">{u.email}</td>
                  <td className="px-4 py-3 text-secondary">{u.role || "—"}</td>
                  <td className="px-4 py-3"><code className="text-[10px] text-muted">{u.company_slug || "—"}</code></td>
                  <td className="px-4 py-3"><StatusBadge user={u} /></td>
                  <td className="px-4 py-3 text-muted">{u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-amber-500/10 text-muted hover:text-amber-400" title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => resetPassword(u)} className="p-1.5 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400" title="Reset Password"><Key size={13} /></button>
                      <button onClick={() => toggleActivate(u)} className="p-1.5 rounded text-muted hover:text-emerald-400" title={u.is_active ? "Deactivate" : "Activate"}>
                        {u.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => forceLogout(u)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Force Logout"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted">
                    <Users size={24} className="mx-auto mb-2 opacity-50" />
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Dialog */}
      <AppDialog isOpen={showCreate} title="New Role User" onClose={() => setShowCreate(false)} size="lg">
        {createdUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-2">
              <CheckCircle size={16} /> User created successfully
            </div>

            <div className="p-4 rounded-xl" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <p className="text-xs font-semibold text-primary mb-3">Share these credentials:</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted w-20">Email:</span>
                  <span className="text-primary font-mono">{createdUser.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted w-20">Password:</span>
                  <span className="text-primary font-mono">{showPass ? tempPassword : "•".repeat(tempPassword.length)}</span>
                  <button onClick={() => setShowPass((v) => !v)} className="text-muted hover:text-primary">
                    {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted w-20">Company Slug:</span>
                  <span className="text-primary font-mono">{createdUser.company_slug || "—"}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={copyCreds} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {copied ? <CheckCircle size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy All"}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  Send via WhatsApp
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setShowCreate(false); setCreatedUser(null); resetForm(); }}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>Close</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Full Name <span className="text-red-400">*</span></label>
              <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Email <span className="text-red-400">*</span></label>
              <input className="input-dark w-full px-4 py-2.5 text-sm" type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Role <span className="text-red-400">*</span></label>
              <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value === "" ? "" : Number(e.target.value))} className="input-dark w-full px-4 py-2.5 text-sm">
                <option value="">— Choose a role —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Temporary Password</label>
              <div className="flex gap-2">
                <input className="input-dark flex-1 px-4 py-2.5 text-sm font-mono" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
                <button onClick={() => setTempPassword(generatePassword())} className="px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-1"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  <RefreshCw size={12} /> Generate
                </button>
              </div>
            </div>
            {formErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {formErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={createUser} disabled={saving} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={12} />}
                Create User
              </button>
            </div>
          </div>
        )}
      </AppDialog>

      {/* Edit User Dialog */}
      <AppDialog isOpen={showEdit} title={`Edit — ${activeUser?.full_name || ""}`} onClose={() => setShowEdit(false)} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Full Name</label>
            <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Email</label>
            <input className="input-dark w-full px-4 py-2.5 text-sm" value={email} disabled style={{ opacity: 0.6 }} />
          </div>
          {formErr && (
            <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={12} /> {formErr}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
            <button onClick={updateUser} disabled={saving} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
              {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      </AppDialog>
    </div>
  );
}
