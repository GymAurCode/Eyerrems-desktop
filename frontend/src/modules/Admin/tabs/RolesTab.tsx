import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import AppDialog from "../../../components/ui/AppDialog";
import { useNotifStore } from "../../../store/notifications";
import ToggleSwitch from "../../../components/ui/ToggleSwitch";
import {
  Shield, Plus, Pencil, Trash2, Key, Save, AlertCircle, Users,
  LayoutDashboard, Building2, MapPin, Home, Wrench, HardHat, UserCog,
  TrendingUp, BarChart, Sparkles, MessageSquare, Bell, Clock,
} from "lucide-react";
import { MODULE_COLORS } from "../../../config/moduleColors";
import { MODULE_TAB_CONFIG, getModuleConfig } from "../../../config/moduleTabConfig";

interface Permission {
  id: string;
  role_id: string;
  module: string;
  tab: string | null;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

interface RoleUser {
  id: string;
  full_name: string;
  email: string;
  status: string;
}

const MODULE_ACTIONS = ["view", "add", "edit", "delete"];

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, Building2, MapPin, Users, Home, Wrench, HardHat,
  UserCog, TrendingUp, BarChart, Sparkles, MessageSquare, Bell, Clock, Shield,
};

const MODULE_ICON_MAP: Record<string, string> = {
  dashboard: 'LayoutDashboard',
  properties: 'Building2',
  towns: 'MapPin',
  crm: 'Users',
  tenants: 'Home',
  maintenance: 'Wrench',
  construction: 'HardHat',
  hr: 'UserCog',
  finance: 'TrendingUp',
  reports: 'BarChart',
  ai: 'Sparkles',
  communication: 'MessageSquare',
  reminders: 'Bell',
  admin: 'Shield',
  history: 'Clock',
};

const TEMPLATES = [
  { value: "", label: "Blank (no permissions)" },
  { value: "super_admin", label: "Super Admin (all permissions)" },
  { value: "accountant", label: "Accountant" },
  { value: "sales_agent", label: "Sales Agent" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "property_manager", label: "Property Manager" },
  { value: "viewer", label: "Viewer (read-only)" },
];

function getModuleIcon(moduleKey: string, size: number = 16, color?: string) {
  const iconName = MODULE_ICON_MAP[moduleKey] || 'Shield';
  const Icon = ICON_MAP[iconName] || Shield;
  return <Icon size={size} style={color ? { color } : undefined} />;
}

function buildEmptyPermissions(): Record<string, Record<string, boolean>> {
  const perms: Record<string, Record<string, boolean>> = {};
  for (const mod of MODULE_TAB_CONFIG) {
    for (const tab of mod.tabs) {
      const key = `${mod.key}.${tab}`;
      perms[key] = { view: false, add: false, edit: false, delete: false };
    }
  }
  return perms;
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const pushToast = useNotifStore((s) => s.pushToast);

  type DialogState = "none" | "create" | "edit" | "perms" | "delete";
  const [dialog, setDialog] = useState<DialogState>("none");
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  type SaveStatus = "idle" | "saving" | "success" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formErr, setFormErr] = useState("");
  const [template, setTemplate] = useState("");

  const [permValues, setPermValues] = useState<Record<string, Record<string, boolean>>>(buildEmptyPermissions());

  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);

  const [selectedModule, setSelectedModule] = useState<string>("properties");

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Role[]>("/api/rbac/roles");
      setRoles(Array.isArray(data) ? data : []);
    } catch { setRoles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const closeAll = () => {
    setDialog("none");
    setActiveRole(null);
    setFormErr("");
    setSaving(false);
    setSaveStatus("idle");
    setName("");
    setDesc("");
    setTemplate("");
    setSelectedModule("properties");
  };

  const openCreate = () => {
    setName(""); setDesc(""); setFormErr(""); setTemplate("");
    setPermValues(buildEmptyPermissions());
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
    const perms = buildEmptyPermissions();
    for (const p of r.permissions) {
      const modConfig = getModuleConfig(p.module);
      const tabs = modConfig?.tabs || [];
      if (!p.tab) {
        for (const tab of tabs) {
          const key = `${p.module}.${tab}`;
          if (perms[key]) {
            perms[key].view = p.can_view;
            perms[key].add = p.can_add;
            perms[key].edit = p.can_edit;
            perms[key].delete = p.can_delete;
          }
        }
      } else {
        const key = `${p.module}.${p.tab}`;
        if (perms[key]) {
          perms[key].view = p.can_view;
          perms[key].add = p.can_add;
          perms[key].edit = p.can_edit;
          perms[key].delete = p.can_delete;
        }
      }
    }
    setPermValues(perms);
    const firstEnabled = MODULE_TAB_CONFIG.find((m) => {
      const { enabled } = moduleCount(m.key, perms);
      return enabled > 0;
    });
    setSelectedModule(firstEnabled?.key || MODULE_TAB_CONFIG[0].key);
    setDialog("perms");
  };

  const openDelete = (r: Role) => {
    setActiveRole(r);
    setDialog("delete");
  };

  const loadRoleUsers = async (r: Role) => {
    try {
      const { data } = await api.get(`/api/rbac/roles/${r.id}/users`);
      setRoleUsers(data || []);
    } catch { setRoleUsers([]); }
    setShowUsers(true);
  };

  const handleTemplateChange = (val: string) => {
    setTemplate(val);
    if (!val) {
      setPermValues(buildEmptyPermissions());
      return;
    }
    if (val === "super_admin") {
      const all = buildEmptyPermissions();
      for (const key of Object.keys(all)) {
        all[key] = { view: true, add: true, edit: true, delete: true };
      }
      setPermValues(all);
      return;
    }
    const templatePerms: any = {
      accountant: {
        "finance.Overview": { view: true, add: false, edit: false, delete: false },
        "finance.Invoices": { view: true, add: true, edit: true, delete: false },
        "finance.Payments": { view: true, add: true, edit: true, delete: false },
        "finance.Ledger": { view: true, add: true, edit: true, delete: false },
        "finance.Accounts": { view: true, add: true, edit: true, delete: false },
        "finance.Expenses": { view: true, add: true, edit: true, delete: false },
        "finance.Commissions": { view: true, add: false, edit: false, delete: false },
        "crm.Leads": { view: true, add: false, edit: false, delete: false },
        "crm.Clients": { view: true, add: false, edit: false, delete: false },
        "crm.Deals": { view: true, add: false, edit: false, delete: false },
        "reports.Reports": { view: true, add: false, edit: false, delete: false },
        "reports.Analytics": { view: true, add: false, edit: false, delete: false },
      },
      sales_agent: {
        "crm.Leads": { view: true, add: true, edit: true, delete: false },
        "crm.Clients": { view: true, add: true, edit: true, delete: false },
        "crm.Dealers": { view: true, add: true, edit: true, delete: false },
        "crm.Deals": { view: true, add: true, edit: true, delete: false },
        "crm.Bookings": { view: true, add: true, edit: false, delete: false },
        "crm.Follow-ups": { view: true, add: true, edit: true, delete: false },
        "crm.Site Visits": { view: true, add: true, edit: true, delete: false },
        "crm.Installments": { view: true, add: false, edit: false, delete: false },
        "crm.Payments": { view: true, add: false, edit: false, delete: false },
        "properties.Properties": { view: true, add: false, edit: false, delete: false },
        "properties.Units": { view: true, add: false, edit: false, delete: false },
      },
      hr_manager: {
        "hr.Employees": { view: true, add: true, edit: true, delete: false },
        "hr.Attendance": { view: true, add: true, edit: true, delete: false },
        "hr.Payroll": { view: true, add: false, edit: false, delete: false },
        "hr.Leaves": { view: true, add: true, edit: true, delete: false },
        "hr.Documents": { view: true, add: true, edit: true, delete: true },
        "reports.Reports": { view: true, add: false, edit: false, delete: false },
      },
      property_manager: {
        "properties.Properties": { view: true, add: true, edit: true, delete: false },
        "properties.Units": { view: true, add: true, edit: true, delete: false },
        "properties.Lease": { view: true, add: true, edit: true, delete: false },
        "properties.Sales": { view: true, add: false, edit: false, delete: false },
        "properties.Buyers": { view: true, add: false, edit: false, delete: false },
        "properties.Sellers": { view: true, add: false, edit: false, delete: false },
        "tenants.Profile": { view: true, add: true, edit: true, delete: false },
        "tenants.Payments": { view: true, add: true, edit: false, delete: false },
        "tenants.Leases": { view: true, add: true, edit: true, delete: false },
        "maintenance.Requests": { view: true, add: true, edit: true, delete: false },
        "maintenance.History": { view: true, add: false, edit: false, delete: false },
        "crm.Leads": { view: true, add: false, edit: false, delete: false },
        "communication.Email": { view: true, add: true, edit: false, delete: false },
      },
      viewer: {
        "properties.Properties": { view: true },
        "properties.Units": { view: true },
        "properties.Lease": { view: true },
        "crm.Leads": { view: true },
        "crm.Clients": { view: true },
        "crm.Deals": { view: true },
        "tenants.Profile": { view: true },
        "tenants.Payments": { view: true },
        "finance.Overview": { view: true },
        "reports.Reports": { view: true },
        "reports.Analytics": { view: true },
      },
    };
    const merged = buildEmptyPermissions();
    const templateData = templatePerms[val] || {};
    for (const [key, actions] of Object.entries(templateData)) {
      if (merged[key]) {
        merged[key] = { ...merged[key], ...(actions as any) };
      }
    }
    setPermValues(merged);
  };

  // ── Permission toggle handlers ────────────────────────────────────────────

  const moduleEnabled = (modKey: string) => {
    const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
    if (!mod) return false;
    return mod.tabs.some((tab) => permValues[`${modKey}.${tab}`]?.view);
  };

  const toggleModuleMaster = (modKey: string, value: boolean) => {
    setPermValues((prev) => {
      const updated = { ...prev };
      const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
      if (!mod) return prev;
      for (const tab of mod.tabs) {
        const key = `${modKey}.${tab}`;
        if (updated[key]) {
          updated[key] = value
            ? { view: true, add: false, edit: false, delete: false }
            : { view: false, add: false, edit: false, delete: false };
        }
      }
      return updated;
    });
  };

  const toggleTabCrud = (moduleKey: string, tabLabel: string, action: string) => {
    setPermValues((prev) => {
      const key = `${moduleKey}.${tabLabel}`;
      if (!prev[key]) return prev;
      const updated = { ...prev };
      const tabPerms = { ...updated[key] };

      if (action === "view") {
        const newVal = !tabPerms.view;
        tabPerms.view = newVal;
        if (!newVal) {
          tabPerms.add = false;
          tabPerms.edit = false;
          tabPerms.delete = false;
        }
      } else if (tabPerms.view) {
        tabPerms[action] = !tabPerms[action];
      }
      updated[key] = tabPerms;

      const mod = MODULE_TAB_CONFIG.find((m) => m.key === moduleKey);
      if (mod) {
        const anyEnabled = mod.tabs.some((t) => updated[`${moduleKey}.${t}`]?.view);
        if (!anyEnabled) {
          for (const t of mod.tabs) {
            updated[`${moduleKey}.${t}`] = { view: false, add: false, edit: false, delete: false };
          }
        }
      }
      return updated;
    });
  };

  const enableAllTabs = (modKey: string) => {
    setPermValues((prev) => {
      const updated = { ...prev };
      const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
      if (!mod) return prev;
      for (const tab of mod.tabs) {
        const key = `${modKey}.${tab}`;
        if (updated[key]) {
          updated[key] = { ...updated[key], view: true };
        }
      }
      return updated;
    });
  };

  const disableAllTabs = (modKey: string) => {
    setPermValues((prev) => {
      const updated = { ...prev };
      const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
      if (!mod) return prev;
      for (const tab of mod.tabs) {
        const key = `${modKey}.${tab}`;
        if (updated[key]) {
          updated[key] = { view: false, add: false, edit: false, delete: false };
        }
      }
      return updated;
    });
  };

  const moduleCount = (modKey: string, source?: Record<string, Record<string, boolean>>) => {
    const data = source || permValues;
    const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
    if (!mod) return { enabled: 0, total: 0 };
    let on = 0;
    for (const tab of mod.tabs) {
      const key = `${modKey}.${tab}`;
      if (data[key]?.view) on++;
    }
    return { enabled: on, total: mod.tabs.length };
  };

  const getEnabledModulesForRole = (role: Role) => {
    const enabled: { key: string; label: string; color: string }[] = [];
    for (const mod of MODULE_TAB_CONFIG) {
      const hasAccess = role.permissions.some(
        (p) => p.module === mod.key && p.can_view
      );
      if (hasAccess) {
        enabled.push({
          key: mod.key,
          label: mod.label,
          color: MODULE_COLORS[mod.key]?.primary || '#6366F1',
        });
      }
    }
    return enabled;
  };

  // ── API calls ─────────────────────────────────────────────────────────────

  const createRole = async () => {
    if (!name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.post("/api/rbac/roles", { name: name.trim(), description: desc.trim() });
      await loadRoles(); closeAll();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to create role");
    } finally { setSaving(false); }
  };

  const updateRole = async () => {
    if (!activeRole || !name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.put(`/api/rbac/roles/${activeRole.id}`, { name: name.trim(), description: desc.trim() });
      await loadRoles(); closeAll();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to update role");
    } finally { setSaving(false); }
  };

  const savePermissions = async () => {
    if (!activeRole) return;
    setSaveStatus("saving"); setFormErr("");

    const entries: { module: string; tab: string; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }[] = [];
    for (const [key, actions] of Object.entries(permValues)) {
      const [mod, ...tabParts] = key.split(".");
      const tab = tabParts.join(".");
      if (actions.view || actions.add || actions.edit || actions.delete) {
        entries.push({
          module: mod,
          tab,
          can_view: actions.view || false,
          can_add: actions.add || false,
          can_edit: actions.edit || false,
          can_delete: actions.delete || false,
        });
      }
    }

    // Optimistic update: apply permissions to local state immediately
    const freshPerms: Permission[] = entries.map(e => ({
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role_id: activeRole.id,
      module: e.module,
      tab: e.tab,
      can_view: e.can_view,
      can_add: e.can_add,
      can_edit: e.can_edit,
      can_delete: e.can_delete,
    }));
    setRoles(prev => prev.map(r => r.id === activeRole.id ? { ...r, permissions: freshPerms } : r));

    try {
      await api.put(`/api/rbac/roles/${activeRole.id}/permissions`, { permissions: entries });
      setSaveStatus("success");
      await loadRoles(); closeAll();
    } catch (e: any) {
      setSaveStatus("error");
      setFormErr(e?.response?.data?.detail ?? "Failed to save permissions");
      // Revert optimistic update by re-fetching
      await loadRoles();
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!activeRole) return;
    try {
      await api.delete(`/api/rbac/roles/${activeRole.id}`);
      pushToast({ title: "Success", message: `Role "${activeRole.name}" deleted`, type: "success" });
      await loadRoles(); closeAll();
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail ?? "Cannot delete — role may be assigned to users", type: "error" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 px-4 py-2 text-xs">
          <Plus size={13} /> New Role
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {(Array.isArray(roles) ? roles : []).map((role) => {
            const enabledModules = getEnabledModulesForRole(role);
            return (
              <div
                key={role.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
                style={{ border: "1px solid var(--border)", background: "var(--bg-secondary)" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(99,102,241,0.1)" }}
                  >
                    <Shield size={14} className="text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{role.name}</p>
                    <p className="text-xs text-muted truncate">{role.description || "—"}</p>
                    {enabledModules.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {enabledModules.slice(0, 4).map((m) => (
                          <span
                            key={m.key}
                            className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: `${m.color}18`,
                              color: m.color,
                              border: `1px solid ${m.color}30`,
                            }}
                          >
                            {getModuleIcon(m.key, 10, m.color)}
                            {m.label}
                          </span>
                        ))}
                        {enabledModules.length > 4 && (
                          <span className="text-[9px] text-muted">+{enabledModules.length - 4} more</span>
                        )}
                      </div>
                    )}
                    {enabledModules.length === 0 && role.permissions.length === 0 && (
                      <span className="text-[10px] text-muted mt-0.5 block">No permissions</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
                  >
                    {role.permissions.length} perms
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPerms(role)} className="p-1.5 rounded hover:bg-blue-500/10 text-muted hover:text-blue-400" title="Edit Permissions"><Key size={14} /></button>
                    <button onClick={() => openEdit(role)} className="p-1.5 rounded hover:bg-amber-500/10 text-muted hover:text-amber-400" title="Edit Details"><Pencil size={14} /></button>
                    <button onClick={() => openDelete(role)} className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                    <button onClick={() => loadRoleUsers(role)} className="p-1.5 rounded hover:bg-emerald-500/10 text-muted hover:text-emerald-400" title="View Users"><Users size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {roles.length === 0 && (
            <div className="text-center py-12">
              <Shield size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">No roles found. Create one to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Role Dialog */}
      {dialog === "create" && (
        <AppDialog isOpen title="New Role" onClose={closeAll} size="lg">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Role Name <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
              <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm" placeholder="e.g. HR Manager" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void createRole(); }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Description</label>
              <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={3} placeholder="Describe what this role can do..." value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Start from Template</label>
              <select value={template} onChange={(e) => handleTemplateChange(e.target.value)} className="input-dark w-full px-4 py-2.5 text-sm">
                {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {template && (
                <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}>
                  <p className="text-xs text-muted">
                    Template will pre-configure permissions for <span className="text-primary font-medium">{TEMPLATES.find((t) => t.value === template)?.label}</span>
                  </p>
                </div>
              )}
            </div>
            {formErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {formErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={closeAll} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={createRole} disabled={saving} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={12} />}
                Create Role
              </button>
            </div>
          </div>
        </AppDialog>
      )}

      {/* Edit Role Dialog */}
      {dialog === "edit" && activeRole && (
        <AppDialog isOpen title={`Edit — ${activeRole.name}`} onClose={closeAll} size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Role Name <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span></label>
              <input autoFocus className="input-dark w-full px-4 py-2.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void updateRole(); }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted">Description</label>
              <textarea className="input-dark w-full px-4 py-2.5 text-sm resize-none" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            {formErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <AlertCircle size={12} /> {formErr}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={closeAll} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={updateRole} disabled={saving} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                Save Changes
              </button>
            </div>
          </div>
        </AppDialog>
      )}

      {/* Delete Confirm Dialog */}
      {dialog === "delete" && activeRole && (
        <AppDialog isOpen title="Delete Role" onClose={closeAll} size="md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-secondary">
                Delete role <span className="text-primary font-semibold">"{activeRole.name}"</span>?
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={closeAll} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-xs rounded-lg font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">Delete Role</button>
            </div>
          </div>
        </AppDialog>
      )}

      {/* ── PERMISSION MATRIX DIALOG ─────────────────────────────────────────── */}
      {dialog === "perms" && activeRole && (
        <AppDialog isOpen title={`Edit Permissions — ${activeRole.name}`} onClose={closeAll} size="2xl">
          <p className="text-xs text-muted mb-3 -mt-2">
            Select modules, then configure tab access and actions
          </p>

          <div className="flex" style={{ height: "55vh", minHeight: "400px", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }}>
            {/* ── LEFT COLUMN: Module List ───────────────────────────── */}
            <div
              style={{
                width: "240px",
                minWidth: "240px",
                background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
                borderRight: "1px solid var(--color-border-tertiary, var(--border))",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted, #94a3b8)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                Modules
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {MODULE_TAB_CONFIG.map((mod) => {
                  const { enabled, total } = moduleCount(mod.key);
                  const isActive = selectedModule === mod.key;
                  const isDisabled = enabled === 0 && !moduleEnabled(mod.key);
                  const moduleColor = MODULE_COLORS[mod.key] || MODULE_COLORS.dashboard;

                  return (
                    <div
                      key={mod.key}
                      onClick={() => {
                        if (!isDisabled || enabled > 0) setSelectedModule(mod.key);
                      }}
                      style={{
                        height: "44px",
                        padding: "0 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: isDisabled && enabled === 0 ? "not-allowed" : "pointer",
                        opacity: isDisabled && enabled === 0 ? 0.5 : 1,
                        background: isActive ? `${moduleColor.light}` : "transparent",
                        borderLeft: isActive ? `3px solid ${moduleColor.primary}` : "3px solid transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0" style={{ flex: 1, overflow: "hidden" }}>
                        {getModuleIcon(mod.key, 16, isActive ? moduleColor.primary : undefined)}
                        <div className="min-w-0" style={{ flex: 1, overflow: "hidden" }}>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: isActive ? 600 : 500,
                              color: isActive ? moduleColor.primary : "var(--text-primary, inherit)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "block",
                            }}
                          >
                            {mod.label}
                          </span>
                          {enabled > 0 && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                              {enabled} of {total} tabs enabled
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: "8px" }}>
                        <ToggleSwitch
                          checked={enabled > 0}
                          onChange={(val: boolean) => {
                            toggleModuleMaster(mod.key, val)
                            if (val) setSelectedModule(mod.key)
                          }}
                          color={moduleColor.primary}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT COLUMN: Tab Permissions ──────────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {(() => {
                const selMod = MODULE_TAB_CONFIG.find((m) => m.key === selectedModule);
                if (!selMod) return null;

                const { enabled, total } = moduleCount(selMod.key);
                const isDisabled = enabled === 0 && !moduleEnabled(selMod.key);
                const moduleColor = MODULE_COLORS[selMod.key] || MODULE_COLORS.dashboard;

                const totalEnabled = MODULE_TAB_CONFIG.reduce((sum, m) => {
                  const { enabled: e } = moduleCount(m.key);
                  return sum + e;
                }, 0);

                let addCount = 0, editCount = 0, deleteCount = 0;
                for (const tab of selMod.tabs) {
                  const p = permValues[`${selMod.key}.${tab}`];
                  if (p) {
                    if (p.add) addCount++;
                    if (p.edit) editCount++;
                    if (p.delete) deleteCount++;
                  }
                }

                return (
                  <>
                    {/* Content area */}
                    <div style={{ flex: 1, overflowY: "auto" }}>
                      {total === 0 ? (
                        /* No tabs module */
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center px-8">
                            <Shield size={32} className="mx-auto mb-3 text-muted opacity-40" />
                            <p className="text-sm text-muted">
                              {selMod.label} module has no configurable tabs.
                            </p>
                            <p className="text-xs text-muted mt-1">
                              Module-level access is managed elsewhere.
                            </p>
                          </div>
                        </div>
                      ) : isDisabled ? (
                        /* Module disabled */
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center px-8">
                            <AlertCircle size={28} className="mx-auto mb-3 text-muted opacity-40" />
                            <p className="text-sm text-muted mb-3">
                              {selMod.label} module is disabled. Turn on the toggle to configure tabs.
                            </p>
                            <button
                              onClick={() => toggleModuleMaster(selMod.key, true)}
                              className="px-4 py-2 text-xs rounded-lg font-medium transition-colors"
                              style={{
                                background: moduleColor.primary,
                                color: "#fff",
                              }}
                            >
                              Enable Module
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Module with tabs — show grid */
                        <div>
                          {/* Module header */}
                          <div
                            className="flex items-center gap-3 px-5 py-4"
                            style={{ borderBottom: "1px solid var(--border)" }}
                          >
                            {getModuleIcon(selMod.key, 20, moduleColor.primary)}
                            <div>
                              <span style={{ fontSize: "15px", fontWeight: 700, color: moduleColor.primary }}>
                                {selMod.label}
                              </span>
                              <span className="text-xs text-muted ml-2">
                                Configure which tabs and actions are available
                              </span>
                            </div>
                          </div>

                          {/* Master control buttons */}
                          <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                            <button
                              onClick={() => enableAllTabs(selMod.key)}
                              className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                              style={{ border: `1px solid ${moduleColor.primary}40`, color: moduleColor.primary }}
                            >
                              Enable All Tabs
                            </button>
                            <button
                              onClick={() => disableAllTabs(selMod.key)}
                              className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                              style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                            >
                              Disable All Tabs
                            </button>
                          </div>

                          {/* Table header */}
                          <div
                            className="grid items-center text-[11px] font-semibold uppercase tracking-wider text-muted"
                            style={{
                              gridTemplateColumns: "1fr 64px 64px 64px 64px",
                              padding: "0 16px",
                              height: "36px",
                              background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <span>Tab</span>
                            <span className="text-center">View</span>
                            <span className="text-center">Add</span>
                            <span className="text-center">Edit</span>
                            <span className="text-center">Delete</span>
                          </div>

                          {/* Tab rows */}
                          <div>
                            {selMod.tabs.map((tab) => {
                              const key = `${selMod.key}.${tab}`;
                              const p = permValues[key] || { view: false, add: false, edit: false, delete: false };
                              const viewDisabled = !p.view;

                              return (
                                <div
                                  key={tab}
                                  className="grid items-center transition-colors hover:bg-surface-hover"
                                  style={{
                                    gridTemplateColumns: "1fr 64px 64px 64px 64px",
                                    padding: "0 16px",
                                    height: "52px",
                                    borderBottom: "1px solid var(--color-border-tertiary, var(--border))",
                                  }}
                                >
                                  {/* Tab name */}
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    {getModuleIcon(selMod.key, 15, moduleColor.primary)}
                                    <span className="text-xs font-medium text-primary truncate">{tab}</span>
                                  </div>

                                  {/* View toggle */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <ToggleSwitch
                                      checked={p.view}
                                      onChange={() => toggleTabCrud(selMod.key, tab, "view")}
                                      color={moduleColor.primary}
                                      size="sm"
                                    />
                                    <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>View</span>
                                  </div>

                                  {/* Add toggle */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <ToggleSwitch
                                      checked={p.add}
                                      onChange={() => toggleTabCrud(selMod.key, tab, "add")}
                                      disabled={viewDisabled}
                                      color={moduleColor.primary}
                                      size="sm"
                                    />
                                    <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>Add</span>
                                  </div>

                                  {/* Edit toggle */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <ToggleSwitch
                                      checked={p.edit}
                                      onChange={() => toggleTabCrud(selMod.key, tab, "edit")}
                                      disabled={viewDisabled}
                                      color={moduleColor.primary}
                                      size="sm"
                                    />
                                    <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>Edit</span>
                                  </div>

                                  {/* Delete toggle */}
                                  <div className="flex flex-col items-center gap-0.5">
                                    <ToggleSwitch
                                      checked={p.delete}
                                      onChange={() => toggleTabCrud(selMod.key, tab, "delete")}
                                      disabled={viewDisabled}
                                      color="#EF4444"
                                      size="sm"
                                    />
                                    <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>Delete</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Summary bar */}
                    <div
                      style={{
                        background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
                        borderTop: "1px solid var(--color-border-tertiary, var(--border))",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span className="text-xs text-muted">
                        {totalEnabled} tab{totalEnabled !== 1 ? "s" : ""} enabled with access
                      </span>
                      <div className="flex items-center gap-2">
                        {addCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${moduleColor.primary}15`, color: moduleColor.primary }}>
                            {addCount} can add
                          </span>
                        )}
                        {editCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${moduleColor.primary}15`, color: moduleColor.primary }}>
                            {editCount} can edit
                          </span>
                        )}
                        {deleteCount > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            {deleteCount} can delete
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs text-muted italic">Changes take effect on next login</p>
            <div className="flex gap-2 items-center">
              {formErr && (
                <p className="text-xs text-red-400 flex items-center gap-1 mr-2">
                  <AlertCircle size={11} /> {formErr}
                </p>
              )}
              <button onClick={closeAll} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>
                Cancel
              </button>
              <button
                onClick={savePermissions}
                disabled={saveStatus === "saving"}
                className="px-4 py-2 text-xs rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all duration-200"
                style={{
                  background: saveStatus === "error" ? "#EF4444"
                    : saveStatus === "success" ? "#22C55E"
                    : "var(--color-accent, #6366F1)",
                  color: "#fff",
                  border: "none",
                }}
              >
                {saveStatus === "saving" ? (
                  <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveStatus === "success" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : saveStatus === "error" ? (
                  <AlertCircle size={12} />
                ) : (
                  <Save size={12} />
                )}
                {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved" : saveStatus === "error" ? "Failed" : "Save Permissions"}
              </button>
            </div>
          </div>
        </AppDialog>
      )}

      {/* View Users Dialog */}
      <AppDialog isOpen={showUsers} title="Role Users" onClose={() => setShowUsers(false)} size="md">
        <div className="space-y-3">
          {roleUsers.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No users assigned to this role.</p>
          ) : (
            roleUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)" }}>
                <div>
                  <p className="text-sm text-primary">{u.full_name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  u.status === "active" ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                }`}>{u.status}</span>
              </div>
            ))
          )}
        </div>
      </AppDialog>
    </div>
  );
}
