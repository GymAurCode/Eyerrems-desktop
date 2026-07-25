import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { usePermissions } from "../../hooks/usePermissions";
import ModuleTabs from "../../components/ui/ModuleTabs";
import AppDialog from "../../components/ui/AppDialog";
import { Users as UsersIcon, UserCheck, UserX, CheckCircle, XCircle, AlertCircle, Plus, Pencil, Search, RefreshCw, Eye, EyeOff, Trash2 } from "lucide-react";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import { useNotifStore } from "../../store/notifications";

const TABS = [
  { value: "list", label: "User List", icon: UsersIcon },
  { value: "pending", label: "Pending Approvals", icon: UserCheck },
];

interface Role {
  id: number; name: string; description?: string;
}

interface UserRow {
  id: number; email: string; full_name: string; status: string;
  is_active: boolean; is_approved: boolean; created_at: string;
  roles: { id: number; name: string }[];
  created_by?: { id: number; name: string; email: string } | null;
}

export default function UsersPage() {
  const [tab, setTab] = useState("list");
  const user = useAuthStore((s) => s.user);
  const { isAdmin } = usePermissions();

  const canApprove = isAdmin || user?.role === "Admin" || user?.roles?.includes("Admin");

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Users</h1>
        <p className="text-xs text-muted mt-0.5">Manage user accounts and approve pending registrations</p>
      </div>

      <ModuleTabs
        tabs={TABS}
        activeTab={tab}
        onChange={(v) => setTab(v)}
        moduleColor="#6366f1"
      />

      {tab === "list" && <UserListTab />}
      {tab === "pending" && (canApprove ? <PendingApprovalsTab /> : (
        <div className="flex items-center justify-center h-32 text-sm text-muted">
          You don't have permission to approve users
        </div>
      ))}
    </div>
  );
}

// ── User List Tab ──────────────────────────────────────────────────────────────

function UserListTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<boolean>(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleIds, setFormRoleIds] = useState<number[]>([]);
  const [formSendInvite, setFormSendInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const { data } = await api.get(`/users?${params.toString()}`);
      setUsers(data || []);
    } catch { setUsers([]); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  const loadRoles = useCallback(async () => {
    try {
      const { data } = await api.get("/api/v3/rbac/roles");
      setRoles(data || []);
    } catch { setRoles([]); }
  }, []);

  useEffect(() => { loadUsers(); loadRoles(); }, [loadUsers, loadRoles]);

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormPassword(""); setFormRoleIds([]);
    setFormSendInvite(false); setFormErr(""); setSaving(false);
  };

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setFormName(u.full_name);
    setFormEmail(u.email);
    setFormRoleIds(u.roles?.map((r) => r.id) || []);
    setFormErr("");
    setShowEdit(true);
  };

  const createUser = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      setFormErr("Name and email are required"); return;
    }
    if (!formPassword && !formSendInvite) {
      setFormErr("Password is required (or enable 'Send invite link')"); return;
    }
    setSaving(true); setFormErr("");
    try {
      await api.post("/users", {
        full_name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword || undefined,
        role_ids: formRoleIds,
        send_invite: formSendInvite,
      });
      setShowCreate(false);
      resetForm();
      await loadUsers();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail || "Failed to create user");
    } finally { setSaving(false); }
  };

  const updateUser = async () => {
    if (!editUser) return;
    setSaving(true); setFormErr("");
    try {
      await api.put(`/users/${editUser.id}`, {
        full_name: formName.trim(),
        role_ids: formRoleIds,
      });
      setShowEdit(false); setEditUser(null);
      await loadUsers();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail || "Failed to update user");
    } finally { setSaving(false); }
  };

  const toggleSuspend = async (u: UserRow) => {
    try {
      if (u.status === "suspended") {
        await api.put(`/users/${u.id}/reactivate`);
      } else {
        await api.put(`/users/${u.id}/suspend`);
      }
      await loadUsers();
    } catch {}
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      pushToast({ title: "Deleted", message: `User "${deleteTarget.full_name}" has been deleted`, type: "success" });
      setDeleteTarget(null);
      await loadUsers();
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail || "Failed to delete user", priority: "urgent" });
      setDeleteTarget(null);
    }
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    if (statusFilter) list = list.filter((u) => u.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return list;
  }, [users, statusFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text" placeholder="Search users..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
            />
          </div>
          <select
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
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
                <th className="text-left px-4 py-3 font-semibold text-muted">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Role(s)</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Created</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Created By</th>
                <th className="text-right px-4 py-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-primary font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-secondary">{u.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                  <td className="px-4 py-3">
                    {u.roles?.map((r) => r.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.created_by?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-amber-500/10 text-muted hover:text-amber-400" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggleSuspend(u)} className="p-1.5 rounded text-muted hover:text-red-400" title={u.status === "suspended" ? "Reactivate" : "Suspend"}>
                        {u.status === "suspended" ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-500" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted text-sm">
                    <UsersIcon size={24} className="mx-auto mb-2 opacity-50" />
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      <AppDialog isOpen={showCreate} title="New User" onClose={() => setShowCreate(false)} size="md"
        icon={<Plus size={18} />}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Full Name <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm" placeholder="John Doe"
              value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Email <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
            <input type="email" className="input-dark w-full px-4 py-2.5 text-sm" placeholder="john@company.com"
              value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Roles</label>
            <select multiple className="input-dark w-full px-4 py-2.5 text-sm min-h-[80px]"
              value={formRoleIds.map(String)} onChange={(e) => setFormRoleIds(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="text-[10px] text-muted mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Password</label>
            <div className="flex gap-2">
              <input className="input-dark flex-1 px-4 py-2.5 text-sm font-mono" placeholder="Leave blank to send invite"
                value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
              <button onClick={() => setFormPassword(generatePassword())}
                className="px-3 py-2 text-xs rounded-lg transition-colors flex items-center gap-1"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <RefreshCw size={12} /> Generate
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input type="checkbox" checked={formSendInvite} onChange={(e) => setFormSendInvite(e.target.checked)}
              className="rounded" style={{ accentColor: "#6366f1" }} />
            Send invite link (no password needed)
          </label>
          {formErr && (
            <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={12} /> {formErr}
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={() => setShowCreate(false)}
            className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
            style={{ border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={createUser} disabled={saving}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={12} />}
            Create User
          </button>
        </div>
      </AppDialog>

      {/* Edit User Modal */}
      <AppDialog isOpen={showEdit && !!editUser} title={`Edit — ${editUser?.full_name ?? ""}`} onClose={() => setShowEdit(false)} size="md"
        icon={<Pencil size={18} />}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Full Name</label>
            <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm"
              value={formName} onChange={(e) => setFormName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Email</label>
            <input className="input-dark w-full px-4 py-2.5 text-sm opacity-60 cursor-not-allowed" value={formEmail} disabled />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted">Roles</label>
            <select multiple className="input-dark w-full px-4 py-2.5 text-sm min-h-[80px]"
              value={formRoleIds.map(String)} onChange={(e) => setFormRoleIds(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {formErr && (
            <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={12} /> {formErr}
            </div>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={() => setShowEdit(false)}
            className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
            style={{ border: "1px solid var(--border)" }}>Cancel</button>
          <button onClick={updateUser} disabled={saving}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
            {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Pencil size={12} />}
            Save Changes
          </button>
        </div>
      </AppDialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.full_name}?`}
        message="This action cannot be undone. Are you sure you want to delete this user?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Pending Approvals Tab ─────────────────────────────────────────────────────

function PendingApprovalsTab() {
  const [pending, setPending] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/users/pending");
      setPending(data || []);
    } catch { setPending([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const approve = async (userId: number) => {
    setActionLoading(userId);
    try {
      await api.post(`/users/${userId}/approve`);
      setPending((prev) => prev.filter((u) => u.id !== userId));
    } catch {}
    finally { setActionLoading(null); }
  };

  const reject = async (userId: number) => {
    setActionLoading(userId);
    try {
      await api.post(`/users/${userId}/reject`, { reason: rejectReason || undefined });
      setPending((prev) => prev.filter((u) => u.id !== userId));
      setRejectingId(null); setRejectReason("");
    } catch {}
    finally { setActionLoading(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          {pending.length} user(s) waiting for approval
        </p>
        <button onClick={loadPending} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border"
          style={{ borderColor: "var(--border)" }}>
          <RefreshCw size={12} /> Refresh
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
                <th className="text-left px-4 py-3 font-semibold text-muted">Requested Role(s)</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Created By</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {pending.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3 text-primary font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-secondary">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.roles?.map((r) => (
                      <span key={r.id} className="inline-block px-2 py-0.5 mr-1 mb-0.5 text-[10px] rounded-full font-medium"
                        style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {r.name}
                      </span>
                    )) || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{u.created_by?.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {rejectingId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text" placeholder="Reason (optional)"
                            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                            className="w-32 px-2 py-1 text-[10px] border rounded"
                            style={{ borderColor: "var(--border)" }}
                            onKeyDown={(e) => { if (e.key === "Enter") reject(u.id); if (e.key === "Escape") setRejectingId(null); }}
                          />
                          <button onClick={() => reject(u.id)}
                            className="px-2 py-1 text-[10px] rounded bg-red-500 text-white disabled:opacity-50"
                            disabled={actionLoading === u.id}>
                            {actionLoading === u.id ? "..." : "Confirm"}
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            className="px-2 py-1 text-[10px] rounded border" style={{ borderColor: "var(--border)" }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => approve(u.id)} disabled={actionLoading === u.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors"
                            style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <CheckCircle size={11} /> Approve
                          </button>
                          <button onClick={() => setRejectingId(u.id)} disabled={actionLoading === u.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium rounded-lg transition-colors"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                            <XCircle size={11} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted text-sm">
                    <UserCheck size={24} className="mx-auto mb-2 opacity-50" />
                    No pending approvals
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    pending: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "rgba(245,158,11,0.2)", label: "Pending" },
    active: { bg: "rgba(16,185,129,0.1)", color: "#10b981", border: "rgba(16,185,129,0.2)", label: "Active" },
    suspended: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)", label: "Suspended" },
    rejected: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", border: "rgba(239,68,68,0.2)", label: "Rejected" },
  };
  const s = styles[status] || styles.pending;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  pwd += "#" + new Date().getFullYear();
  return pwd;
}
