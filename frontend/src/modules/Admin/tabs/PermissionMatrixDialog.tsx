import { useState } from "react";
import { api } from "../../../lib/api";
import AppDialog from "../../../components/ui/AppDialog";
import ToggleSwitch from "../../../components/ui/ToggleSwitch";
import {
  Shield, Save, AlertCircle,
  LayoutDashboard, Building2, MapPin, Users, Home, Wrench, HardHat,
  UserCog, TrendingUp, BarChart, Sparkles, MessageSquare, Bell, Clock,
} from "lucide-react";
import { MODULE_COLORS } from "../../../config/moduleColors";
import { MODULE_TAB_CONFIG, getModuleConfig } from "../../../config/moduleTabConfig";

export interface Permission {
  id: string;
  role_id: string;
  module: string;
  tab: string | null;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
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

interface Props {
  role: Role;
  onClose: () => void;
  onSaved?: () => void;
}

export default function PermissionMatrixDialog({ role, onClose, onSaved }: Props) {
  const initialPerms = (() => {
    const perms = buildEmptyPermissions();
    for (const p of role.permissions) {
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
    return perms;
  })();

  const [permValues, setPermValues] = useState<Record<string, Record<string, boolean>>>(initialPerms);

  const [selectedModule, setSelectedModule] = useState<string>(() => {
    const firstEnabled = MODULE_TAB_CONFIG.find((m) => {
      const { enabled } = moduleCount(m.key, initialPerms);
      return enabled > 0;
    });
    return firstEnabled?.key || MODULE_TAB_CONFIG[0].key;
  });

  type SaveStatus = "idle" | "saving" | "success" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [formErr, setFormErr] = useState("");

  function moduleCount(modKey: string, source?: Record<string, Record<string, boolean>>) {
    const data = source || permValues;
    const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
    if (!mod) return { enabled: 0, total: 0 };
    let on = 0;
    for (const tab of mod.tabs) {
      const key = `${modKey}.${tab}`;
      if (data[key]?.view) on++;
    }
    return { enabled: on, total: mod.tabs.length };
  }

  function moduleEnabled(modKey: string) {
    const mod = MODULE_TAB_CONFIG.find((m) => m.key === modKey);
    if (!mod) return false;
    return mod.tabs.some((tab) => permValues[`${modKey}.${tab}`]?.view);
  }

  function toggleModuleMaster(modKey: string, value: boolean) {
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
  }

  function toggleTabCrud(moduleKey: string, tabLabel: string, action: string) {
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
  }

  function enableAllTabs(modKey: string) {
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
  }

  function disableAllTabs(modKey: string) {
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
  }

  const savePermissions = async () => {
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
      role_id: role.id,
      module: e.module,
      tab: e.tab,
      can_view: e.can_view,
      can_add: e.can_add,
      can_edit: e.can_edit,
      can_delete: e.can_delete,
    }));
    role.permissions = freshPerms;

    try {
      await api.put(`/api/rbac/roles/${role.id}/permissions`, { permissions: entries });
      setSaveStatus("success");
      await onSaved?.();
      onClose();
    } catch (e: any) {
      setSaveStatus("error");
      setFormErr(e?.response?.data?.detail ?? "Failed to save permissions");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppDialog isOpen title={`Edit Permissions — ${role.name}`} onClose={onClose} size="2xl">
      <p className="text-xs text-muted mb-3 -mt-2">
        Select modules, then configure tab access and actions
      </p>

      <div className="flex" style={{ height: "55vh", minHeight: "400px", border: "1px solid var(--border)", borderRadius: "0.75rem", overflow: "hidden" }}>
        {/* ── LEFT COLUMN: Module List ───────────────────────────── */}
        <div
          style={{
            width: "240px", minWidth: "240px",
            background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
            borderRight: "1px solid var(--color-border-tertiary, var(--border))",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px", fontSize: "11px", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.05em",
              color: "var(--text-muted, #94a3b8)", borderBottom: "1px solid var(--border)",
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
                    height: "44px", padding: "0 14px",
                    display: "flex", alignItems: "center",
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
                          fontSize: "13px", fontWeight: isActive ? 600 : 500,
                          color: isActive ? moduleColor.primary : "var(--text-primary, inherit)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
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
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center px-8">
                        <Shield size={32} className="mx-auto mb-3 text-muted opacity-40" />
                        <p className="text-sm text-muted">{selMod.label} module has no configurable tabs.</p>
                        <p className="text-xs text-muted mt-1">Module-level access is managed elsewhere.</p>
                      </div>
                    </div>
                  ) : isDisabled ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center px-8">
                        <AlertCircle size={28} className="mx-auto mb-3 text-muted opacity-40" />
                        <p className="text-sm text-muted mb-3">{selMod.label} module is disabled. Turn on the toggle to configure tabs.</p>
                        <button
                          onClick={() => toggleModuleMaster(selMod.key, true)}
                          className="px-4 py-2 text-xs rounded-lg font-medium transition-colors"
                          style={{ background: moduleColor.primary, color: "#fff" }}
                        >
                          Enable Module
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Module header */}
                      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                        {getModuleIcon(selMod.key, 20, moduleColor.primary)}
                        <div>
                          <span style={{ fontSize: "15px", fontWeight: 700, color: moduleColor.primary }}>{selMod.label}</span>
                          <span className="text-xs text-muted ml-2">Configure which tabs and actions are available</span>
                        </div>
                      </div>

                      {/* Master control buttons */}
                      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                        <button onClick={() => enableAllTabs(selMod.key)} className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                          style={{ border: `1px solid ${moduleColor.primary}40`, color: moduleColor.primary }}>
                          Enable All Tabs
                        </button>
                        <button onClick={() => disableAllTabs(selMod.key)} className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                          Disable All Tabs
                        </button>
                      </div>

                      {/* Table header */}
                      <div className="grid items-center text-[11px] font-semibold uppercase tracking-wider text-muted"
                        style={{
                          gridTemplateColumns: "1fr 64px 64px 64px 64px",
                          padding: "0 16px", height: "36px",
                          background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
                          borderBottom: "1px solid var(--border)",
                        }}>
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
                            <div key={tab}
                              className="grid items-center transition-colors hover:bg-surface-hover"
                              style={{
                                gridTemplateColumns: "1fr 64px 64px 64px 64px",
                                padding: "0 16px", height: "52px",
                                borderBottom: "1px solid var(--color-border-tertiary, var(--border))",
                              }}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getModuleIcon(selMod.key, 15, moduleColor.primary)}
                                <span className="text-xs font-medium text-primary truncate">{tab}</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <ToggleSwitch checked={p.view} onChange={() => toggleTabCrud(selMod.key, tab, "view")}
                                  color={moduleColor.primary} size="sm" />
                                <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>View</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <ToggleSwitch checked={p.add} onChange={() => toggleTabCrud(selMod.key, tab, "add")}
                                  disabled={viewDisabled} color={moduleColor.primary} size="sm" />
                                <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>Add</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <ToggleSwitch checked={p.edit} onChange={() => toggleTabCrud(selMod.key, tab, "edit")}
                                  disabled={viewDisabled} color={moduleColor.primary} size="sm" />
                                <span style={{ fontSize: "9px", color: "var(--text-muted, #94a3b8)", lineHeight: 1 }}>Edit</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5">
                                <ToggleSwitch checked={p.delete} onChange={() => toggleTabCrud(selMod.key, tab, "delete")}
                                  disabled={viewDisabled} color="#EF4444" size="sm" />
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
                <div style={{
                  background: "var(--color-background-secondary, var(--bg-tertiary, #f8fafc))",
                  borderTop: "1px solid var(--color-border-tertiary, var(--border))",
                  padding: "10px 16px", display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                }}>
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
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg text-secondary hover:text-primary transition-colors"
            style={{ border: "1px solid var(--border)" }}>
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
              color: "#fff", border: "none",
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
  );
}
