import { useEffect, useState, useCallback } from "react";
import { Shield, Plus, Pencil, Trash2, X, Check, AlertCircle, Save, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../lib/api";
import { useAuthStore } from "../../../store/auth";
import { addRbacEventListener } from "../../../hooks/useWebSocket";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  fetchRoles,
  fetchPermissions,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
  fetchModuleConfig,
  type Role,
  type PermissionEntry,
  type ModuleConfig,
} from "../../../lib/rbacApi";

const ACTIONS = ["view", "add", "edit", "delete"] as const;
const ACTION_LABELS: Record<string, string> = { view: "View", add: "Add", edit: "Edit", delete: "Delete" };

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [permSaving, setPermSaving] = useState(false);
  const user = useAuthStore((s) => s.user);

  const { refresh: refreshPerms } = usePermissions();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([fetchRoles(), fetchModuleConfig()]);
      setRoles(r);
      setModules(m);
      if (!selectedRoleId && r.length > 0) {
        setSelectedRoleId(r[0].id);
      }
    } catch { } finally { setLoading(false); }
  }, [selectedRoleId]);

  useEffect(() => { loadData(); }, []);

  // Real-time: reload when RBAC events arrive
  useEffect(() => {
    const unsubscribe = addRbacEventListener((event) => {
      if (event.startsWith("rbac.")) {
        loadData();
        refreshPerms();
      }
    });
    return unsubscribe;
  }, [loadData, refreshPerms]);

  useEffect(() => {
    if (selectedRoleId) {
      fetchPermissions(selectedRoleId).then(setPermissions).catch(() => {});
    } else {
      setPermissions([]);
    }
  }, [selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const getPermission = (moduleKey: string, tabKey: string): PermissionEntry => {
    return permissions.find((p) => p.module_key === moduleKey && p.tab_key === tabKey)
      || { module_key: moduleKey, tab_key: tabKey, can_view: false, can_add: false, can_edit: false, can_delete: false };
  };

  const togglePermission = (moduleKey: string, tabKey: string, action: string) => {
    setPermissions((prev) => {
      const existing = prev.find((p) => p.module_key === moduleKey && p.tab_key === tabKey);
      const others = prev.filter((p) => p.module_key !== moduleKey || p.tab_key !== tabKey);
      const newEntry: PermissionEntry = existing
        ? { ...existing, [action === "view" ? "can_view" : action === "add" ? "can_add" : action === "edit" ? "can_edit" : "can_delete"]: !(existing as any)[action === "view" ? "can_view" : action === "add" ? "can_add" : action === "edit" ? "can_edit" : "can_delete"] }
        : { module_key: moduleKey, tab_key: tabKey, can_view: false, can_add: false, can_edit: false, can_delete: false, [action === "view" ? "can_view" : action === "add" ? "can_add" : action === "edit" ? "can_edit" : "can_delete"]: true };
      // If toggling "view" off, also turn off add/edit/delete
      if (action === "view" && (existing as any)?.can_view) {
        newEntry.can_view = false;
        newEntry.can_add = false;
        newEntry.can_edit = false;
        newEntry.can_delete = false;
      }
      return [...others, newEntry];
    });
  };

  const savePermissions = async () => {
    if (!selectedRoleId) return;
    setPermSaving(true); setError(""); setSuccess("");
    try {
      await updatePermissions(selectedRoleId, { permissions });
      setSuccess("Permissions saved");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to save permissions");
    } finally { setPermSaving(false); }
  };

  const handleCreate = async () => {
    if (!formName.trim()) { setError("Role name is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const role = await createRole(formName.trim(), formDesc || undefined);
      setRoles((prev) => [...prev, role]);
      setSelectedRoleId(role.id);
      setShowForm(false);
      setFormName("");
      setFormDesc("");
      setSuccess(`Role "${role.name}" created`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to create role");
    } finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!editRole || !formName.trim()) { setError("Role name is required"); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const updated = await updateRole(editRole.id, { name: formName.trim(), description: formDesc || undefined });
      setRoles((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      setEditRole(null);
      setShowForm(false);
      setSuccess(`Role "${updated.name}" updated`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to update role");
    } finally { setSaving(false); }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    setError(""); setSuccess("");
    try {
      await deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      if (selectedRoleId === role.id) {
        setSelectedRoleId(roles.length > 1 ? roles.find((r) => r.id !== role.id)?.id ?? null : null);
      }
      setSuccess(`Role "${role.name}" deleted`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Failed to delete role");
    }
  };

  const openEditForm = (role: Role) => {
    setEditRole(role);
    setFormName(role.name);
    setFormDesc(role.description || "");
    setShowForm(true);
    setError("");
  };

  const toggleModule = (key: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary">Roles</h2>
          <p className="text-xs text-muted mt-0.5">Define roles and their permissions for your company</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditRole(null); setFormName(""); setFormDesc(""); setError(""); }}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg">
          <Plus size={14} /> New Role
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

      {showForm && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold text-primary">{editRole ? "Edit Role" : "Create Role"}</h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Role Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Accountant, HR Manager"
                className="w-full px-3 py-2 text-sm border rounded-lg"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Description (optional)</label>
              <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Brief description of this role"
                className="w-full px-3 py-2 text-sm border rounded-lg resize-none"
                style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }} rows={3} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg"
                style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button onClick={editRole ? handleUpdate : handleCreate} disabled={saving}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                {saving ? "Saving..." : editRole ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role list */}
        <div className="lg:col-span-1 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="space-y-0.5 p-2">
            {roles.length === 0 && (
              <p className="text-xs text-muted text-center py-8">No roles yet. Create your first role.</p>
            )}
            {roles.map((role) => (
              <div key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: selectedRoleId === role.id ? "rgba(99,102,241,0.08)" : "transparent",
                  border: selectedRoleId === role.id ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-3">
                  <Shield size={16} style={{ color: selectedRoleId === role.id ? "#6366f1" : "var(--text-muted)" }} />
                  <div>
                    <p className="text-sm font-medium text-primary">{role.name}</p>
                    <p className="text-[10px] text-muted">{role.user_count} user{role.user_count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!role.is_system_role && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openEditForm(role); }}
                        className="p-1 rounded hover:bg-white/5 text-muted hover:text-primary">
                        <Pencil size={12} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                        className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions editor */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {selectedRole ? (
            <>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <h3 className="text-sm font-semibold text-primary">{selectedRole.name} Permissions</h3>
                  <p className="text-[10px] text-muted mt-0.5">Toggle permissions per module/tab</p>
                </div>
                <button onClick={savePermissions} disabled={permSaving}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg disabled:opacity-50">
                  {permSaving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                  Save Permissions
                </button>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {modules.map((mod) => {
                  const expanded = expandedModules.has(mod.key);
                  const allTabsDisabled = mod.tabs.every((t) => {
                    const p = getPermission(mod.key, t);
                    return !p.can_view && !p.can_add && !p.can_edit && !p.can_delete;
                  });
                  return (
                    <div key={mod.key} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <div
                        onClick={() => toggleModule(mod.key)}
                        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-white/5 text-sm font-medium text-primary"
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{mod.label}</span>
                        {allTabsDisabled && <span className="text-[10px] text-muted ml-2">(no access)</span>}
                      </div>
                      {expanded && mod.tabs.map((tab) => {
                        const perm = getPermission(mod.key, tab);
                        return (
                          <div key={tab} className="flex items-center gap-3 px-8 py-2 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
                            <span className="w-28 text-secondary shrink-0">{tab}</span>
                            {ACTIONS.map((action) => {
                              const key = `can_${action}` as keyof typeof perm;
                              const enabled = !!perm[key];
                              return (
                                <button
                                  key={action}
                                  onClick={() => togglePermission(mod.key, tab, action)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md transition-all text-[11px] font-medium"
                                  style={{
                                    background: enabled ? "rgba(99,102,241,0.12)" : "transparent",
                                    color: enabled ? "#818cf8" : "var(--text-muted)",
                                    border: enabled ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
                                  }}
                                >
                                  {enabled ? <Check size={10} /> : <X size={10} />}
                                  {ACTION_LABELS[action]}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="text-xs text-muted">Select a role to manage permissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
