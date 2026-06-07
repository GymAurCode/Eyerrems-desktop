import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import { useAuthStore } from "../../../store/auth";
import ModuleTabs from "../../../components/ui/ModuleTabs";
import { Clock, Activity, Bell, CheckCheck, LogIn, AlertTriangle, Info, Download, Eye, EyeOff } from "lucide-react";

interface LoginEntry {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string | null;
  status: string;
  login_at: string;
}

interface ActivityEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  module: string;
  record_type: string;
  record_label: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  timestamp: string;
}

interface NotificationEntry {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const ACTION_BADGES: Record<string, { bg: string; color: string }> = {
  create: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
  update: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  delete: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
  view: { bg: "rgba(100,116,139,0.1)", color: "#64748b" },
  export: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_BADGES[action] || ACTION_BADGES.view;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
      {action.charAt(0).toUpperCase() + action.slice(1)}
    </span>
  );
}

function LoginHistoryTab() {
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get<{ items: LoginEntry[] }>("/api/rbac/login-history", { params });
      setEntries(data?.items || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const rows = entries.map((e) => `${e.user_email},${e.status},${e.ip_address},${e.user_agent || ""},${e.login_at}`);
    const csv = "User,Status,IP,Device,Time\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "login-history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["", "success", "failed"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "text-white" : "text-secondary hover:text-primary"}`}
              style={statusFilter === s ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : { border: "1px solid var(--border)" }}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <Download size={12} /> Export
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--bg-tertiary)" }}>
                <th className="text-left px-4 py-3 font-semibold text-muted">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Date & Time</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">IP Address</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Device</th>
                <th className="text-left px-4 py-3 font-semibold text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {entries.map((e) => (
                <tr key={e.id} className={e.status === "failed" ? "bg-red-500/5" : "transition-colors hover:bg-surface-hover"}>
                  <td className="px-4 py-3">
                    <p className="text-primary font-medium">{e.user_email}</p>
                    <p className="text-muted">{e.user_email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(e.login_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><code className="text-[10px] text-secondary">{e.ip_address}</code></td>
                  <td className="px-4 py-3 text-secondary">{e.user_agent || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      e.status === "success" ? "text-emerald-400 bg-emerald-500/10" :
                      e.status === "failed" ? "text-red-400 bg-red-500/10" : "text-muted bg-surface-hover"
                    }`}>{e.status}</span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-muted">No login history found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActivityLogTab() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (moduleFilter) params.module = moduleFilter;
      if (actionFilter) params.action = actionFilter;
      const { data } = await api.get<{ items: ActivityEntry[] }>("/api/rbac/activity-logs", { params });
      setEntries(data?.items || []);
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, [moduleFilter, actionFilter]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const rows = entries.map((e) => `${e.user_email},${e.action},${e.module},${e.record_type},${e.timestamp}`);
    const csv = "User,Action,Module,Record,Time\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "activity-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const modules = ["crm", "property", "tenancy", "finance", "hr", "construction", "admin", "maintenance"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
            <option value="">All Modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-dark px-3 py-1.5 text-xs rounded-lg">
            <option value="">All Actions</option>
            {["create", "update", "delete", "view", "export"].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <Download size={12} /> Export
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id}>
              <button
                onClick={() => setExpandedRow(expandedRow === e.id ? null : e.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors hover:bg-surface-hover text-left"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-primary">{e.user_name || e.user_email}</span>
                    <ActionBadge action={e.action} />
                    <span className="text-xs text-muted">{e.module}</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 truncate">{e.record_label || `${e.record_type} #${e.record_id || ""}`}</p>
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap">{new Date(e.timestamp).toLocaleString()}</span>
                {expandedRow === e.id ? <EyeOff size={12} className="text-muted" /> : <Eye size={12} className="text-muted" />}
              </button>
              {expandedRow === e.id && (
                <div className="mx-4 mb-2 p-3 rounded-lg text-xs font-mono" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)" }}>
                  <p className="text-muted font-semibold mb-1">Old Values:</p>
                  <pre className="text-secondary whitespace-pre-wrap break-all mb-2">{JSON.stringify(e.old_values, null, 2) || "—"}</pre>
                  <p className="text-muted font-semibold mb-1">New Values:</p>
                  <pre className="text-secondary whitespace-pre-wrap break-all">{JSON.stringify(e.new_values, null, 2) || "—"}</pre>
                </div>
              )}
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-center py-12 text-muted">No activity logs found</div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsTab() {
  const [notifs, setNotifs] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filter) params.type = filter;
      const { data } = await api.get<NotificationEntry[]>("/api/rbac/notifications", { params });
      setNotifs(data || []);
    } catch { setNotifs([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const markAllRead = async () => {
    try { await api.post("/api/rbac/notifications/read-all"); await load(); } catch {}
  };

  const markRead = async (id: string) => {
    try { await api.put(`/api/rbac/notifications/${id}/read`); await load(); } catch {}
  };

  const unread = notifs.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["", "login", "failed_login", "action"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? "text-white" : "text-secondary hover:text-primary"}`}
              style={filter === f ? { background: "linear-gradient(135deg,#3b82f6,#6366f1)" } : { border: "1px solid var(--border)" }}>
              {f ? f.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All"}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <CheckCheck size={12} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-1">
          {notifs.map((n) => {
            const Icon = n.type === "login" ? LogIn : n.type === "failed_login" ? AlertTriangle : Info;
            const iconColor = n.type === "failed_login" ? "text-red-400" : n.type === "login" ? "text-blue-400" : "text-muted";
            return (
              <div key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
                className="flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors hover:bg-surface-hover"
                style={{
                  border: "1px solid var(--border)",
                  opacity: n.is_read ? 0.6 : 1,
                }}
              >
                <Icon size={14} className={`mt-0.5 shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary">{n.title}</p>
                  <p className="text-[11px] text-muted mt-0.5">{n.message}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted whitespace-nowrap">{new Date(n.created_at).toLocaleString()}</span>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                </div>
              </div>
            );
          })}
          {notifs.length === 0 && (
            <div className="text-center py-12 text-muted">
              <Bell size={24} className="mx-auto mb-2 opacity-50" />
              No notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MonitoringTab() {
  const subTabs = [
    { label: "Login History", value: "login", icon: Clock },
    { label: "Activity Log", value: "activity", icon: Activity },
    { label: "Notifications", value: "notifications", icon: Bell },
  ];
  const [activeSub, setActiveSub] = useState("login");
  const unreadCount = useAuthStore((s: any) => s.notificationCount || 0);

  return (
    <div className="space-y-4">
      <ModuleTabs tabs={subTabs.map((t) => ({
        ...t,
        badge: t.value === "notifications" ? unreadCount : undefined,
      }))} activeTab={activeSub} onChange={(v) => setActiveSub(v)} />

      {activeSub === "login" && <LoginHistoryTab />}
      {activeSub === "activity" && <ActivityLogTab />}
      {activeSub === "notifications" && <NotificationsTab />}
    </div>
  );
}
