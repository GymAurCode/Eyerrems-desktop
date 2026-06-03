import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Users, ScrollText, Shield, CheckCircle, XCircle,
  Plus, Pencil, Trash2, Key, Save, UserCheck, AlertCircle, Settings, DollarSign
} from "lucide-react";
import PortalModal from "../components/Modal";
import { printRecord } from "../components/actions";
import { useCurrencyStore, CURRENCY_OPTIONS, type CurrencyCode } from "../store/currency";
import { DataTable } from "../components/data-table";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";

interface Permission { id: number; name: string; module: string; description: string; }
interface Role { id: number; name: string; description: string; permissions: Permission[]; }
interface UserRow {
  id: number; email: string; full_name: string; status: string;
  is_approved: boolean; roles: string[]; created_at: string;
}
interface AuditRow {
  id: number; user_id: number | null; action: string; module: string | null;
  entity_type: string | null; entity_id: number | null;
  description: string | null; created_at: string;
}

const TABS = [
  { key: "users", label: "Users", icon: Users },
  { key: "roles", label: "Roles", icon: Shield },
  { key: "perms", label: "Permissions", icon: Key },
  { key: "audit", label: "Audit Log", icon: ScrollText },
  { key: "settings", label: "System Settings", icon: Settings },
] as const;
type TabKey = typeof TABS[number]["key"];

// ── Reusable Checkbox Component ───────────────────────────────────────────────
function Checkbox({ checked, onChange, indeterminate = false, label, description }: {
  checked: boolean;
  onChange: () => void;
  indeterminate?: boolean;
  label?: string;
  description?: string;
}) {
  return (
    <label className="permission-row">
      <div className="permission-row-checkbox-wrapper">
        <div
          onClick={onChange}
          className="permission-checkbox"
          style={{
            background: checked
              ? "linear-gradient(135deg,#3b82f6,#6366f1)"
              : indeterminate
              ? "rgba(99,102,241,0.25)"
              : "transparent",
            borderColor: checked || indeterminate ? "#6366f1" : "var(--border)",
          }}
        >
          {checked && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {indeterminate && !checked && (
            <div className="w-2 h-0.5 rounded-full" style={{ background: "#818cf8" }} />
          )}
        </div>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={onChange}
        />
      </div>
      {label && (
        <div className="permission-row-content">
          <span className={`permission-row-label ${checked ? "text-primary" : "text-secondary"}`}>
            {label}
          </span>
          {description && (
            <span className="permission-row-description">{description}</span>
          )}
        </div>
      )}
    </label>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    active: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
    pending: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b" },
    suspended: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  };
  const s = map[status] ?? { bg: "rgba(100,116,139,0.1)", color: "#64748b" };
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
      {status}
    </span>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ roles }: { roles: Role[] }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "suspended">("all");
  const [assignUser, setAssignUser] = useState<UserRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const url = filter === "pending" ? "/auth/users/pending" : "/auth/users";
      const params = filter !== "all" && filter !== "pending" ? { status_filter: filter } : {};
      const { data } = await api.get<UserRow[]>(url, { params });
      setUsers(data);
    } catch { setUsers([]); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const approve = async (id: number, approved: boolean) => {
    try { await api.post(`/auth/users/${id}/approve`, { approved }); await load(); }
    catch { /* ignore */ }
  };

  const suspend = async (id: number, status: string) => {
    try { await api.patch(`/auth/users/${id}/status`, { status }); await load(); }
    catch { /* ignore */ }
  };

  const assignRole = async () => {
    if (!assignUser || selectedRoleId === "") return;
    setSaving(true); setErr("");
    try {
      await api.post(`/auth/users/${assignUser.id}/roles`, { role_ids: [Number(selectedRoleId)] });
      setAssignUser(null); setSelectedRoleId(""); await load();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to assign role");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--border)" }}>
        {(["all", "pending", "active", "suspended"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? "text-white" : "text-secondary hover:text-primary"}`}
            style={filter === f ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : {}}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <DataTable
        data={users}
        columns={[
          { key: "full_name", label: "Name / Email", render: (val, row) => (
            <div><p className="text-sm font-medium text-primary">{val}</p><p className="text-muted mt-0.5">{row.email}</p></div>
          )},
          { key: "status", label: "Status", render: (val) => <Badge status={val} /> },
          { key: "roles", label: "Roles", render: (val) => <span className="text-secondary">{val.join(", ") || "—"}</span> },
          { key: "actions", label: "Actions", render: (val, row) => (
            <div className="flex items-center gap-1">
              {row.status === "pending" && (
                <>
                  <button onClick={() => approve(row.id, true)} className="p-1.5 rounded hover:bg-green-500/10 text-muted hover:text-green-400" title="Approve"><CheckCircle size={14} /></button>
                  <button onClick={() => approve(row.id, false)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Reject"><XCircle size={14} /></button>
                </>
              )}
              {row.status === "active" && (
                <button onClick={() => suspend(row.id, "suspended")} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Suspend"><XCircle size={14} /></button>
              )}
              {row.status === "suspended" && (
                <button onClick={() => suspend(row.id, "active")} className="p-1.5 rounded hover:bg-green-500/10 text-muted hover:text-green-400" title="Activate"><CheckCircle size={14} /></button>
              )}
              <button onClick={() => { setAssignUser(row); setSelectedRoleId(""); setErr(""); }} className="p-1.5 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400" title="Assign Role"><UserCheck size={14} /></button>
              <button onClick={() => printRecord(`User ${row.email}`, [
                { label: "Name", value: row.full_name },
                { label: "Email", value: row.email },
                { label: "Status", value: row.status },
                { label: "Roles", value: row.roles.join(", ") || "—" },
              ])} className="p-1.5 rounded hover:bg-emerald-500/10 text-muted hover:text-emerald-400" title="Print"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg></button>
            </div>
          )},
        ]}
        variant="bordered"
        searchable={false}
        emptyTitle="No users found"
        emptyIcon={Users}
      />

      {assignUser && (
        <PortalModal
          open={!!assignUser}
          title={`Assign Role — ${assignUser.full_name}`}
          onClose={() => setAssignUser(null)}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-secondary">
              Current roles: <span className="text-primary">{assignUser.roles.join(", ") || "None"}</span>
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Select Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value === "" ? "" : Number(e.target.value))}
                className="input-dark w-full px-4 py-2.5 text-sm">
                <option value="">— Choose a role —</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAssignUser(null)}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={assignRole} disabled={saving || selectedRoleId === ""}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                Assign
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────────────
function RolesTab({ roles, permissions, onReload }: {
  roles: Role[]; permissions: Permission[]; onReload: () => void;
}) {
  // Single dialog discriminator — prevents multiple modals fighting each other
  type Dialog = "none" | "create" | "edit" | "perms" | "delete";
  const [dialog, setDialog] = useState<Dialog>("none");
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  // Shared form fields for create/edit
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Permission checkbox state — plain number[] so React always re-renders on change
  const [checkedIds, setCheckedIds] = useState<number[]>([]);

  // ── open helpers ────────────────────────────────────────────────────────────
  const closeAll = () => {
    setDialog("none");
    setActiveRole(null);
    setFormErr("");
    setSaving(false);
  };

  const openCreate = () => {
    setName(""); setDesc(""); setFormErr("");
    setDialog("create");
  };

  const openEdit = (r: Role) => {
    setActiveRole(r);
    setName(r.name);
    setDesc(r.description ?? "");
    setFormErr("");
    setDialog("edit");
  };

  const openPerms = (r: Role) => {
    setActiveRole(r);
    // Seed from the role's current permissions — fresh array every time
    setCheckedIds(r.permissions.map((p) => p.id));
    setFormErr("");
    setDialog("perms");
  };

  const openDelete = (r: Role) => {
    setActiveRole(r);
    setDialog("delete");
  };

  // ── checkbox helpers ────────────────────────────────────────────────────────
  const togglePerm = (id: number) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleModule = (modulePerms: Permission[]) => {
    const ids = modulePerms.map((p) => p.id);
    const allOn = ids.every((id) => checkedIds.includes(id));
    setCheckedIds((prev) =>
      allOn
        ? prev.filter((id) => !ids.includes(id))
        : [...new Set([...prev, ...ids])]
    );
  };

  // ── API calls ───────────────────────────────────────────────────────────────
  const createRole = async () => {
    if (!name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.post("/admin/roles", {
        name: name.trim(),
        description: desc.trim(),
        permission_ids: [],
      });
      closeAll(); onReload();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to create role");
    } finally { setSaving(false); }
  };

  const updateRole = async () => {
    if (!activeRole || !name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.patch(`/admin/roles/${activeRole.id}`, {
        name: name.trim(),
        description: desc.trim(),
      });
      closeAll(); onReload();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to update role");
    } finally { setSaving(false); }
  };

  const savePermissions = async () => {
    if (!activeRole) return;
    setSaving(true); setFormErr("");
    try {
      await api.patch(`/admin/roles/${activeRole.id}`, {
        permission_ids: checkedIds,
      });
      closeAll(); onReload();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to save permissions");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!activeRole) return;
    try {
      await api.delete(`/admin/roles/${activeRole.id}`);
      closeAll(); onReload();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Cannot delete — role may be assigned to users");
    }
  };

  // Group all permissions by module for the checkbox panel
  const byModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p); return acc;
  }, {});

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-xs">
          <Plus size={13} /> Create Role
        </button>
      </div>

      {/* Roles table */}
      <DataTable
        data={roles}
        columns={[
          { key: "name", label: "Role", render: (val) => <span className="font-semibold text-primary">{val}</span> },
          { key: "description", label: "Description", render: (val) => <span className="text-secondary max-w-xs truncate">{val || "—"}</span> },
          { key: "permissions", label: "Permissions", render: (val) => (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
              {val.length} permissions
            </span>
          )},
          { key: "actions", label: "Actions", render: (val, row) => (
            <div className="flex items-center gap-1">
              <button onClick={() => openPerms(row)} className="p-1.5 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400" title="Permissions"><Key size={14} /></button>
              <button onClick={() => openEdit(row)} className="p-1.5 rounded hover:bg-amber-500/10 text-muted hover:text-amber-400" title="Edit"><Pencil size={14} /></button>
              <button onClick={() => openDelete(row)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
            </div>
          )},
        ]}
        variant="bordered"
        searchable={false}
        emptyTitle="No roles found"
        emptyDescription="Create one to get started."
        emptyIcon={Shield}
      />

      {/* ── Create Role Modal ──────────────────────────────────────────────── */}
      {dialog === "create" && (
        <PortalModal open title="Create Role" onClose={closeAll} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                Role Name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                className="input-dark w-full px-4 py-2.5 text-sm"
                placeholder="e.g. HR Manager"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void createRole(); }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Description</label>
              <textarea
                className="input-dark w-full px-4 py-2.5 text-sm resize-none"
                rows={3}
                placeholder="Describe what this role can do..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            {formErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {formErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={closeAll}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={createRole} disabled={saving}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving
                  ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <Plus size={12} />}
                Create Role
              </button>
            </div>
          </div>
        </PortalModal>
      )}

      {/* ── Edit Role Modal ────────────────────────────────────────────────── */}
      {dialog === "edit" && activeRole && (
        <PortalModal open title={`Edit — ${activeRole.name}`} onClose={closeAll} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                Role Name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                className="input-dark w-full px-4 py-2.5 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void updateRole(); }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Description</label>
              <textarea
                className="input-dark w-full px-4 py-2.5 text-sm resize-none"
                rows={3}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            {formErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {formErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={closeAll}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={updateRole} disabled={saving}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving
                  ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={12} />}
                Save Changes
              </button>
            </div>
          </div>
        </PortalModal>
      )}

      {/* ── Delete Confirm Modal ───────────────────────────────────────────── */}
      {dialog === "delete" && activeRole && (
        <PortalModal open title="Delete Role" onClose={closeAll} size="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-secondary">
                Delete role <span className="text-primary font-semibold">"{activeRole.name}"</span>?
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={closeAll}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="px-4 py-2 text-xs rounded-lg font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                Delete Role
              </button>
            </div>
          </div>
        </PortalModal>
      )}

      {/* ── Assign Permissions Modal ───────────────────────────────────────── */}
      {dialog === "perms" && activeRole && (
        <PortalModal open title={`Permissions — ${activeRole.name}`} onClose={closeAll} size="lg">
          {/* Summary bar */}
          <div className="permission-summary-bar">
            <span className="text-xs text-muted">
              <span className="text-primary font-semibold">{checkedIds.length}</span>
              {" "}of {permissions.length} selected
              {checkedIds.length > 0 && (
                <button
                  onClick={() => setCheckedIds([])}
                  className="ml-3 text-muted hover:text-red-400 transition-colors underline text-[10px]">
                  Clear all
                </button>
              )}
            </span>
            <button
              onClick={() => setCheckedIds(permissions.map((p) => p.id))}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors underline">
              Select all
            </button>
          </div>

          {/* Module groups */}
          <div className="permission-modules-container">
            {Object.entries(byModule)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([mod, perms]) => {
                const allOn = perms.every((p) => checkedIds.includes(p.id));
                const someOn = perms.some((p) => checkedIds.includes(p.id));
                const countOn = perms.filter((p) => checkedIds.includes(p.id)).length;

                return (
                  <div key={mod} className="permission-module-card">
                    {/* Module header — click toggles entire module */}
                    <button
                      type="button"
                      onClick={() => toggleModule(perms)}
                      className="permission-module-header"
                    >
                      <Checkbox
                        checked={allOn}
                        indeterminate={someOn && !allOn}
                        onChange={() => toggleModule(perms)}
                      />
                      <span className="permission-module-title">{mod}</span>
                      <span className="permission-module-count">
                        {countOn}/{perms.length}
                      </span>
                    </button>

                    {/* Individual permission rows */}
                    <div className="permission-list">
                      {perms.map((p) => {
                        const on = checkedIds.includes(p.id);
                        return (
                          <Checkbox
                            key={p.id}
                            checked={on}
                            onChange={() => togglePerm(p.id)}
                            label={p.name}
                            description={p.description}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Sticky footer */}
          <div className="flex items-center justify-between mt-5 pt-4"
            style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              {formErr && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {formErr}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={closeAll}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={savePermissions} disabled={saving}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving
                  ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save size={12} />}
                Save Permissions
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}

// ── Permissions Tab ───────────────────────────────────────────────────────────
function PermissionsTab({ permissions, onReload }: { permissions: Permission[]; onReload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [module, setModule] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const modules = [...new Set(permissions.map((p) => p.module))].sort();

  const createPerm = async () => {
    if (!name.trim() || !module.trim()) { setErr("Name and module are required"); return; }
    setSaving(true); setErr("");
    try {
      await api.post("/admin/permissions", { name: name.trim(), module: module.trim(), description: desc.trim() });
      setShowCreate(false); setName(""); setModule(""); setDesc("");
      onReload();
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to create permission");
    } finally { setSaving(false); }
  };

  const deletePerm = async (id: number, permName: string) => {
    if (!confirm(`Delete permission "${permName}"?`)) return;
    try { await api.delete(`/admin/permissions/${id}`); onReload(); }
    catch (e: any) { alert(e?.response?.data?.detail ?? "Cannot delete permission"); }
  };

  const byModule = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p); return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { setShowCreate(true); setName(""); setModule(""); setDesc(""); setErr(""); }}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-xs">
          <Plus size={13} /> Add Permission
        </button>
      </div>

      <div className="space-y-3">
        {Object.entries(byModule).sort(([a], [b]) => a.localeCompare(b)).map(([mod, perms]) => (
          <div key={mod} className="card-dark overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <Key size={13} className="text-blue-400" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">{mod}</span>
              <span className="text-[10px] text-muted ml-auto">{perms.length} permissions</span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
              {perms.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-2.5 transition-colors row-hover">
                  <div>
                    <span className="text-xs font-mono text-primary">{p.name}</span>
                    {p.description && <span className="text-[10px] text-muted ml-3">{p.description}</span>}
                  </div>
                  <button onClick={() => void deletePerm(p.id, p.name)}
                    className="text-muted hover:text-red-400 transition-colors p-1 rounded">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <PortalModal open title="Add Permission" onClose={() => setShowCreate(false)} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                Permission Name <span className="text-red-400">*</span>
              </label>
              <input
                autoFocus
                className="input-dark w-full px-4 py-2.5 text-sm font-mono"
                placeholder="e.g. hr.create"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-[10px] text-muted mt-1">Format: module.action (e.g. hr.view, finance.create)</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>
                Module <span className="text-red-400">*</span>
              </label>
              <input
                className="input-dark w-full px-4 py-2.5 text-sm"
                placeholder="e.g. HR, Finance, CRM"
                value={module}
                onChange={(e) => setModule(e.target.value)}
                list="module-list"
              />
              <datalist id="module-list">
                {modules.map((m) => <option key={m} value={m} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#94a3b8" }}>Description</label>
              <input
                className="input-dark w-full px-4 py-2.5 text-sm"
                placeholder="What does this permission allow?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            {err && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {err}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={createPerm} disabled={saving}
                className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving
                  ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  : <Plus size={12} />}
                Add
              </button>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
}

// ── System Settings Tab ───────────────────────────────────────────────────────
function SystemSettingsTab() {
  const { currencyCode, saveCurrency } = useCurrencyStore();
  const [selected, setSelected] = useState<CurrencyCode>(currencyCode);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // Keep local selection in sync if store changes externally
  useEffect(() => { setSelected(currencyCode); }, [currencyCode]);

  const handleSave = async () => {
    setSaving(true); setErr(""); setSaved(false);
    try {
      await saveCurrency(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "Failed to save currency settings");
    } finally {
      setSaving(false);
    }
  };

  // Preview amount for the selected currency
  const previewAmount = 1250000;
  const previewCfg = CURRENCY_OPTIONS.find((c) => c.code === selected)!;
  const previewFormatted = `${previewCfg.symbol} ${new Intl.NumberFormat(previewCfg.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(previewAmount)}`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
          <DollarSign size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-primary">Currency Settings</h2>
          <p className="text-xs text-muted mt-0.5">
            Choose the currency symbol displayed across the entire application.
            This only affects display formatting — no values are converted.
          </p>
        </div>
      </div>

      {/* Currency selector card */}
      <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Select Currency</p>
        </div>

        <div className="p-5 space-y-3">
          {CURRENCY_OPTIONS.map((opt) => {
            const isActive = selected === opt.code;
            return (
              <label
                key={opt.code}
                onClick={() => setSelected(opt.code)}
                className="flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200"
                style={{
                  border: isActive
                    ? "1px solid rgba(99,102,241,0.5)"
                    : "1px solid var(--border)",
                  background: isActive
                    ? "rgba(99,102,241,0.08)"
                    : "transparent",
                }}
              >
                {/* Radio button */}
                <div className="relative flex-shrink-0">
                  <input
                    type="radio"
                    name="currency"
                    value={opt.code}
                    checked={isActive}
                    onChange={() => setSelected(opt.code)}
                    className="sr-only"
                  />
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{
                      borderColor: isActive ? "#6366f1" : "var(--border)",
                      background: isActive ? "#6366f1" : "transparent",
                    }}
                  >
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>

                {/* Symbol badge */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg,#3b82f6,#6366f1)"
                      : "var(--border)",
                    color: isActive ? "#fff" : "var(--text-secondary)",
                  }}
                >
                  {opt.symbol}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isActive ? "text-primary" : "text-secondary"}`}>
                    {opt.code} — {opt.code === "PKR" ? "Pakistani Rupee" : "US Dollar"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Symbol: <span className="font-mono">{opt.symbol}</span>
                    &nbsp;·&nbsp;
                    Example: <span className="font-mono">{opt.symbol} 1,250,000</span>
                  </p>
                </div>

                {/* Active badge */}
                {isActive && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{
                      background: "rgba(99,102,241,0.15)",
                      color: "#818cf8",
                      border: "1px solid rgba(99,102,241,0.3)",
                    }}
                  >
                    Selected
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Live preview */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(59,130,246,0.15)" }}
        >
          <DollarSign size={14} className="text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-muted">Preview</p>
          <p className="text-sm font-semibold text-primary font-mono mt-0.5">{previewFormatted}</p>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div
          className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
        >
          <AlertCircle size={12} /> {err}
        </div>
      )}

      {/* Success */}
      {saved && (
        <div
          className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-2 rounded-lg"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <CheckCircle size={12} /> Currency settings saved successfully.
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || selected === currencyCode}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ── Audit Tab ─────────────────────────────────────────────────────────────────
function AuditTab() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  useEffect(() => {
    api.get<AuditRow[]>("/admin/audit-logs").then(({ data }) => setAudit(data)).catch(() => {});
  }, []);

  return (
    <DataTable
      data={audit}
      columns={[
        { key: "created_at", label: "Time", render: (val) => <span className="text-secondary whitespace-nowrap">{new Date(val).toLocaleString()}</span> },
        { key: "action", label: "Action", render: (val) => <span className="font-medium text-primary">{val}</span> },
        { key: "module", label: "Module", render: (val) => <span className="text-secondary">{val ?? "—"}</span> },
        { key: "entity_type", label: "Entity", render: (val, row) => <span className="text-secondary">{val ?? "—"}{row.entity_id != null ? ` #${row.entity_id}` : ""}</span> },
        { key: "description", label: "Description", render: (val) => <span className="text-muted max-w-xs truncate">{val ?? "—"}</span> },
      ]}
      variant="bordered"
      searchable={false}
      emptyTitle="No audit logs found"
      onPrint={(row) => printRecord(`Audit #${row.id}`, [
        { label: "Action", value: row.action },
        { label: "Module", value: row.module ?? "—" },
        { label: "Entity", value: `${row.entity_type ?? "—"}${row.entity_id != null ? ` #${row.entity_id}` : ""}` },
        { label: "Description", value: row.description ?? "—" },
        { label: "Time", value: new Date(row.created_at).toLocaleString() },
      ])}
    />
  );
}

// ── Main AdminPage ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<TabKey>("users");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const loadRoles = useCallback(async () => {
    try { const { data } = await api.get<Role[]>("/auth/roles"); setRoles(data); }
    catch { setRoles([]); }
  }, []);

  const loadPermissions = useCallback(async () => {
    try { const { data } = await api.get<Permission[]>("/auth/permissions"); setPermissions(data); }
    catch { setPermissions([]); }
  }, []);

  const reloadAll = useCallback(() => {
    void loadRoles(); void loadPermissions();
  }, [loadRoles, loadPermissions]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold text-primary">Administration</h1>
        <p className="text-xs text-muted mt-0.5">Manage users, roles, permissions and system settings</p>
      </div>

      {/* Tab bar */}
      <ModuleTabs
        tabs={TABS.map((t) => ({ label: t.label, value: t.key, icon: t.icon }))}
        activeTab={tab}
        onChange={(v) => setTab(v as TabKey)}
        moduleColor={MODULE_COLORS.admin}
      />

      {tab === "users" && <UsersTab roles={roles} />}
      {tab === "roles" && <RolesTab roles={roles} permissions={permissions} onReload={reloadAll} />}
      {tab === "perms" && <PermissionsTab permissions={permissions} onReload={reloadAll} />}
      {tab === "audit" && <AuditTab />}
      {tab === "settings" && <SystemSettingsTab />}
    </div>
  );
}
