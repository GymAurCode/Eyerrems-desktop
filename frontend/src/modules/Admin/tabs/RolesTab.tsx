import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import AppDialog from "../../../components/ui/AppDialog";
import {
  Shield, Plus, Pencil, Trash2, Key, Save, AlertCircle, Users, CheckCircle, XCircle, Search,
} from "lucide-react";
import { usePermissions } from "../../../hooks/usePermissions";

interface Permission {
  id: number;
  name: string;
  module: string;
  description: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}

interface RoleUser {
  id: number;
  full_name: string;
  email: string;
  status: string;
}

const MODULE_STRUCTURE: Record<string, string[]> = {
  properties: ["Properties", "Units", "Lease", "Sales", "Buyers", "Sellers"],
  towns: ["Overview"],
  crm: ["Dashboard", "Leads", "Clients", "Dealers", "Deals", "Bookings", "Follow-ups", "Site Visits", "Installments", "Payments"],
  tenants: ["Profile", "Payments", "Documents", "Leases"],
  maintenance: ["Requests", "History"],
  construction: ["Dashboard", "Projects", "Drawings", "Batches", "Reports"],
  hr: ["Employees", "Attendance", "Payroll", "Leaves", "Documents"],
  finance: ["Overview", "Invoices", "Payments", "Ledger", "Accounts", "Expenses", "Commissions"],
  reports: ["Reports", "Analytics"],
  ai: ["Assistant", "Chat"],
  communication: ["Email", "WhatsApp"],
  reminders: ["Reminders"],
  admin: ["Settings"],
  history: ["Activity"],
};

const MODULE_ACTIONS = ["view", "add", "edit", "delete"];

const TEMPLATES = [
  { value: "", label: "Blank (no permissions)" },
  { value: "accountant", label: "Accountant" },
  { value: "sales_agent", label: "Sales Agent" },
  { value: "hr_manager", label: "HR Manager" },
  { value: "property_manager", label: "Property Manager" },
  { value: "viewer", label: "Viewer (read-only)" },
];

function buildEmptyPermissions(): Record<string, Record<string, boolean>> {
  const perms: Record<string, Record<string, boolean>> = {};
  for (const [mod, tabs] of Object.entries(MODULE_STRUCTURE)) {
    for (const tab of tabs) {
      const key = `${mod}.${tab}`;
      perms[key] = { view: false, add: false, edit: false, delete: false };
    }
  }
  return perms;
}

function getModulesWithTabs(): { module: string; tabs: string[] }[] {
  return Object.entries(MODULE_STRUCTURE).map(([module, tabs]) => ({ module, tabs }));
}

export default function RolesTab() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  type DialogState = "none" | "create" | "edit" | "perms" | "delete";
  const [dialog, setDialog] = useState<DialogState>("none");
  const [activeRole, setActiveRole] = useState<Role | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [template, setTemplate] = useState("");

  const [permValues, setPermValues] = useState<Record<string, Record<string, boolean>>>(buildEmptyPermissions());
  const [selectedModule, setSelectedModule] = useState("properties");

  const [roleUsers, setRoleUsers] = useState<RoleUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Role[]>("/auth/roles");
      setRoles(data);
    } catch { setRoles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  const closeAll = () => {
    setDialog("none");
    setActiveRole(null);
    setFormErr("");
    setSaving(false);
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
      const parts = p.name.split(".");
      const mod = parts[0];
      const action = parts[1];
      for (const [m, tabs] of Object.entries(MODULE_STRUCTURE)) {
        if (m === mod || mod.startsWith(m)) {
          for (const tab of tabs) {
            const key = `${m}.${tab}`;
            if (action && perms[key]) {
              perms[key][action] = true;
            }
          }
        }
      }
    }
    setPermValues(perms);
    setSelectedModule("properties");
    setDialog("perms");
  };

  const openDelete = (r: Role) => {
    setActiveRole(r);
    setDialog("delete");
  };

  const loadRoleUsers = async (r: Role) => {
    try {
      const { data } = await api.get(`/admin/roles/${r.id}/users`);
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

  const togglePerm = (key: string, action: string) => {
    setPermValues((prev) => {
      const updated = { ...prev };
      if (!updated[key]) updated[key] = { view: false, add: false, edit: false, delete: false };
      updated[key] = { ...updated[key] };

      if (action === "view") {
        const newVal = !updated[key].view;
        updated[key].view = newVal;
        if (!newVal) {
          updated[key].add = false;
          updated[key].edit = false;
          updated[key].delete = false;
        }
      } else if (updated[key].view) {
        updated[key][action] = !updated[key][action];
      }
      return updated;
    });
  };

  const toggleAllActions = (key: string, checked: boolean) => {
    setPermValues((prev) => {
      const updated = { ...prev };
      if (!updated[key]) updated[key] = { view: false, add: false, edit: false, delete: false };
      updated[key] = checked
        ? { view: true, add: true, edit: true, delete: true }
        : { view: false, add: false, edit: false, delete: false };
      return updated;
    });
  };

  const moduleCount = (mod: string) => {
    const tabs = MODULE_STRUCTURE[mod] || [];
    let on = 0;
    for (const tab of tabs) {
      const key = `${mod}.${tab}`;
      if (permValues[key]?.view) on++;
    }
    return { enabled: on, total: tabs.length };
  };

  const createRole = async () => {
    if (!name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.post("/admin/roles", { name: name.trim(), description: desc.trim(), permission_ids: [] });
      closeAll(); await loadRoles();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to create role");
    } finally { setSaving(false); }
  };

  const updateRole = async () => {
    if (!activeRole || !name.trim()) { setFormErr("Role name is required"); return; }
    setSaving(true); setFormErr("");
    try {
      await api.patch(`/admin/roles/${activeRole.id}`, { name: name.trim(), description: desc.trim() });
      closeAll(); await loadRoles();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to update role");
    } finally { setSaving(false); }
  };

  const savePermissions = async () => {
    if (!activeRole) return;
    setSaving(true); setFormErr("");
    const permissionNames: string[] = [];
    for (const [key, actions] of Object.entries(permValues)) {
      for (const [action, val] of Object.entries(actions)) {
        if (val) {
          const [mod, tab] = key.split(".");
          permissionNames.push(`${mod}.${tab}.${action}`);
        }
      }
    }
    try {
      await api.patch(`/admin/roles/${activeRole.id}`, { permission_ids: [] });
      try { await api.post(`/api/rbac/admin/roles/${activeRole.id}/permissions`, { permissions: permissionNames }); } catch {}
      closeAll(); await loadRoles();
    } catch (e: any) {
      setFormErr(e?.response?.data?.detail ?? "Failed to save permissions");
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!activeRole) return;
    try {
      await api.delete(`/admin/roles/${activeRole.id}`);
      closeAll(); await loadRoles();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Cannot delete — role may be assigned to users");
    }
  };

  const modules = getModulesWithTabs();
  const selectedTabs = MODULE_STRUCTURE[selectedModule] || [];

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
          {roles.map((role) => (
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
          ))}
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
              <label className="block text-xs font-medium mb-1.5 text-muted">Role Name <span className="text-red-400">*</span></label>
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
              <label className="block text-xs font-medium mb-1.5 text-muted">Role Name <span className="text-red-400">*</span></label>
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

      {/* Permission Matrix Dialog */}
      {dialog === "perms" && activeRole && (
        <AppDialog isOpen title={`Edit Permissions — ${activeRole.name}`} onClose={closeAll} size="2xl">
          <div className="flex gap-0" style={{ minHeight: "400px" }}>
            {/* Left: Module list */}
            <div className="w-[30%] shrink-0 overflow-y-auto pr-3" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="space-y-1">
                {modules.map(({ module }) => {
                  const { enabled, total } = moduleCount(module);
                  return (
                    <button
                      key={module}
                      onClick={() => setSelectedModule(module)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-left"
                      style={{
                        background: selectedModule === module ? "rgba(99,102,241,0.1)" : "transparent",
                        color: selectedModule === module ? "#818cf8" : "var(--text-secondary)",
                      }}
                    >
                      <span className="font-medium capitalize">{module}</span>
                      <span className="text-[10px] text-muted">{enabled}/{total} tabs</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Permission grid */}
            <div className="flex-1 pl-4 overflow-y-auto">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-primary capitalize">{selectedModule}</span>
                  <span className="text-[10px] text-muted">— {selectedTabs.length} tabs</span>
                </div>

                {/* Grid header */}
                <div className="grid grid-cols-[1fr_repeat(4,48px)] gap-1 px-2 py-1.5 text-[10px] font-medium text-muted uppercase tracking-wider">
                  <span>Tab</span>
                  <span className="text-center">View</span>
                  <span className="text-center">Add</span>
                  <span className="text-center">Edit</span>
                  <span className="text-center">Delete</span>
                </div>

                {/* All tabs master row */}
                <div className="grid grid-cols-[1fr_repeat(4,48px)] gap-1 items-center px-2 py-2 rounded-lg" style={{ background: "rgba(99,102,241,0.06)" }}>
                  <span className="text-xs font-semibold text-primary">All tabs</span>
                  {MODULE_ACTIONS.map((action) => {
                    const allOn = selectedTabs.length > 0 && selectedTabs.every((tab) => permValues[`${selectedModule}.${tab}`]?.[action]);
                    const someOn = selectedTabs.some((tab) => permValues[`${selectedModule}.${tab}`]?.[action]);
                    return (
                      <div key={action} className="flex justify-center">
                        <button
                          onClick={() => {
                            const newVal = !allOn;
                            for (const tab of selectedTabs) {
                              const key = `${selectedModule}.${tab}`;
                              if (!permValues[key]) {
                                setPermValues((prev) => ({ ...prev, [key]: { view: false, add: false, edit: false, delete: false } }));
                              }
                              if (action === "view" || permValues[key]?.view || newVal) {
                                setPermValues((prev) => {
                                  const updated = { ...prev };
                                  if (!updated[key]) updated[key] = { view: false, add: false, edit: false, delete: false };
                                  updated[key] = { ...updated[key], [action]: newVal };
                                  if (!newVal && action === "view") {
                                    updated[key].add = false;
                                    updated[key].edit = false;
                                    updated[key].delete = false;
                                  }
                                  return updated;
                                });
                              }
                            }
                          }}
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                          style={{
                            background: allOn ? "rgba(99,102,241,0.15)" : someOn ? "rgba(99,102,241,0.08)" : "transparent",
                          }}
                        >
                          {allOn ? (
                            <CheckCircle size={13} className="text-indigo-400" />
                          ) : someOn ? (
                            <div className="w-3 h-0.5 rounded-full bg-indigo-400/60" />
                          ) : (
                            <XCircle size={13} className="text-muted/40" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Tab rows */}
                {selectedTabs.map((tab) => {
                  const key = `${selectedModule}.${tab}`;
                  const p = permValues[key] || { view: false, add: false, edit: false, delete: false };
                  return (
                    <div key={tab} className="grid grid-cols-[1fr_repeat(4,48px)] gap-1 items-center px-2 py-2 rounded-lg transition-colors hover:bg-surface-hover">
                      <span className="text-xs text-primary">{tab}</span>
                      {MODULE_ACTIONS.map((action) => {
                        const isOn = p[action] || false;
                        const disabled = action !== "view" && !p.view;
                        return (
                          <div key={action} className="flex justify-center">
                            <button
                              onClick={() => togglePerm(key, action)}
                              disabled={disabled}
                              className="w-6 h-6 rounded flex items-center justify-center transition-colors disabled:opacity-30"
                              style={{
                                background: isOn ? "rgba(99,102,241,0.15)" : "transparent",
                              }}
                            >
                              {isOn ? (
                                <CheckCircle size={13} className="text-indigo-400" />
                              ) : (
                                <XCircle size={13} className="text-muted/30" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              {formErr && (
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={11} /> {formErr}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={closeAll} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors" style={{ border: "1px solid var(--border)" }}>Cancel</button>
              <button onClick={savePermissions} disabled={saving} className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={12} />}
                Save Permissions
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
