import { useEffect, useState } from "react";
import {
  Bell, Plus, Calendar, Clock, AlertTriangle,
  CheckCircle2, RotateCcw, Trash2, Edit2, AlarmClock,
  LayoutList, LayoutGrid, Settings, FileText, BookOpen,
} from "lucide-react";
import { remindersApi, type ReminderDashboard, type Template, type NotifLog, type ReminderSettings } from "../lib/remindersApi";
import type { Reminder } from "../store/notifications";
import { useNotifStore } from "../store/notifications";
import ReminderForm from "../components/reminders/ReminderForm";
import { QuickRowActions, ActionsTh, ActionsCell, printRecord } from "../components/actions";

// ── Priority badge ────────────────────────────────────────────────────────────
const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
  high:   "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  low:    "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  snoozed:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
  cancelled: "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

type Tab = "dashboard" | "my" | "notifications" | "templates" | "logs" | "settings";

export default function RemindersPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [dashboard, setDashboard] = useState<ReminderDashboard | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const { notifications, fetchNotifications, markRead, markAllRead, deleteNotification } = useNotifStore();

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "dashboard") {
        const d = await remindersApi.dashboard();
        setDashboard({
          today_count: d?.today_count ?? 0,
          upcoming_count: d?.upcoming_count ?? 0,
          overdue_count: d?.overdue_count ?? 0,
          unread_notifications: d?.unread_notifications ?? 0,
          today: Array.isArray(d?.today) ? d.today : [],
          overdue: Array.isArray(d?.overdue) ? d.overdue : [],
          upcoming: Array.isArray(d?.upcoming) ? d.upcoming : [],
        });
      } else if (tab === "my") {
        const params: Record<string, string> = {};
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;
        const list = await remindersApi.list(params);
        setReminders(Array.isArray(list) ? list : []);
      } else if (tab === "notifications") {
        await fetchNotifications().catch(() => {});
      } else if (tab === "templates") {
        const tmpls = await remindersApi.templates();
        setTemplates(Array.isArray(tmpls) ? tmpls : []);
      } else if (tab === "logs") {
        const logData = await remindersApi.logs();
        setLogs(Array.isArray(logData) ? logData : []);
      } else if (tab === "settings") {
        const s = await remindersApi.getSettings();
        if (s?.user_id) setSettings(s);
      }
    } catch {
      // backend unavailable — keep existing state, don't crash
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tab, statusFilter, priorityFilter]);

  const handleComplete = async (id: number) => {
    await remindersApi.complete(id);
    void load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this reminder?")) return;
    await remindersApi.delete(id);
    void load();
  };

  const handleSnooze = async (id: number) => {
    const until = new Date(Date.now() + 30 * 60_000).toISOString();
    await remindersApi.snooze(id, until);
    void load();
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    await remindersApi.updateSettings(settings);
    alert("Settings saved.");
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard",     label: "Dashboard",     icon: <LayoutGrid size={14} /> },
    { id: "my",            label: "My Reminders",  icon: <Bell size={14} /> },
    { id: "notifications", label: "Notifications", icon: <AlarmClock size={14} /> },
    { id: "templates",     label: "Templates",     icon: <BookOpen size={14} /> },
    { id: "logs",          label: "Logs",          icon: <FileText size={14} /> },
    { id: "settings",      label: "Settings",      icon: <Settings size={14} /> },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-blue-400" />
          <h1 className="text-base font-semibold text-primary">Reminders & Notifications</h1>
        </div>
        <button
          onClick={() => { setEditReminder(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <Plus size={13} /> New Reminder
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-theme pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-t-lg border-b-2 transition-all
              ${tab === t.id
                ? "border-blue-500 text-blue-400 bg-blue-500/5"
                : "border-transparent text-secondary hover:text-primary"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-xs text-muted py-4 text-center">Loading…</div>}

      {/* ── Dashboard ── */}
      {tab === "dashboard" && !dashboard && !loading && (
        <EmptyState message="Could not load dashboard. Check backend connection." />
      )}
      {tab === "dashboard" && dashboard && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: "Today",    count: dashboard.today_count,           color: "text-blue-400",    icon: <Calendar size={16} /> },
              { label: "Upcoming", count: dashboard.upcoming_count,        color: "text-emerald-400", icon: <Clock size={16} /> },
              { label: "Overdue",  count: dashboard.overdue_count,         color: "text-red-400",     icon: <AlertTriangle size={16} /> },
              { label: "Unread",   count: dashboard.unread_notifications,  color: "text-orange-400",  icon: <Bell size={16} /> },
            ] as { label: string; count: number; color: string; icon: React.ReactNode }[]).map((s) => (
              <div key={s.label} className="rounded-xl border border-theme bg-surface p-4 flex items-center gap-3">
                <span className={s.color}>{s.icon}</span>
                <div>
                  <p className="text-xl font-bold text-primary">{s.count}</p>
                  <p className="text-xs text-muted">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {(dashboard.today ?? []).length > 0 && (
            <Section title="Today's Reminders" color="text-blue-400">
              {(dashboard.today ?? []).map((r) => <ReminderCard key={r.id} r={r} onComplete={handleComplete} onDelete={handleDelete} onSnooze={handleSnooze} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />)}
            </Section>
          )}

          {(dashboard.overdue ?? []).length > 0 && (
            <Section title="Overdue" color="text-red-400">
              {(dashboard.overdue ?? []).map((r) => <ReminderCard key={r.id} r={r} onComplete={handleComplete} onDelete={handleDelete} onSnooze={handleSnooze} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />)}
            </Section>
          )}

          {(dashboard.upcoming ?? []).length > 0 && (
            <Section title="Upcoming (7 days)" color="text-emerald-400">
              {(dashboard.upcoming ?? []).map((r) => <ReminderCard key={r.id} r={r} onComplete={handleComplete} onDelete={handleDelete} onSnooze={handleSnooze} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />)}
            </Section>
          )}

          {(dashboard.today ?? []).length === 0 && (dashboard.overdue ?? []).length === 0 && (dashboard.upcoming ?? []).length === 0 && (
            <EmptyState message="No reminders scheduled. Create one to get started." />
          )}
        </div>
      )}

      {/* ── My Reminders ── */}
      {tab === "my" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="input-field text-xs px-3 py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {["pending","completed","snoozed","cancelled"].map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select
              className="input-field text-xs px-3 py-1.5"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All Priorities</option>
              {["low","medium","high","urgent"].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "text-blue-400" : "text-muted"}`}><LayoutList size={15} /></button>
              <button onClick={() => setViewMode("kanban")} className={`p-1.5 rounded ${viewMode === "kanban" ? "text-blue-400" : "text-muted"}`}><LayoutGrid size={15} /></button>
            </div>
          </div>

          {viewMode === "list" ? (
            <div className="space-y-2">
              {reminders.length === 0 && <EmptyState message="No reminders found." />}
              {reminders.map((r) => (
                <ReminderCard key={r.id} r={r} onComplete={handleComplete} onDelete={handleDelete} onSnooze={handleSnooze} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />
              ))}
            </div>
          ) : (
            <KanbanView reminders={reminders} onComplete={handleComplete} onDelete={handleDelete} onSnooze={handleSnooze} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />
          )}
        </div>
      )}

      {/* ── Notifications ── */}
      {tab === "notifications" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => void markAllRead()} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
              Mark all read
            </button>
          </div>
          {(notifications ?? []).length === 0 && <EmptyState message="No notifications." />}
          {(notifications ?? []).map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border border-theme bg-surface transition-opacity ${n.is_read ? "opacity-60" : ""}`}>
              <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-gray-500" : "bg-blue-500"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{n.title}</p>
                <p className="text-xs text-secondary mt-0.5">{n.message}</p>
                <p className="text-[11px] text-muted mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!n.is_read && (
                  <button onClick={() => void markRead(n.id)} className="p-1.5 rounded text-muted hover:text-emerald-400 transition-colors" title="Mark read">
                    <CheckCircle2 size={14} />
                  </button>
                )}
                <button onClick={() => void deleteNotification(n.id)} className="p-1.5 rounded text-muted hover:text-red-400 transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Templates ── */}
      {tab === "templates" && (
        <TemplatesTab templates={templates} onRefresh={load} />
      )}

      {/* ── Logs ── */}
      {tab === "logs" && (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-theme bg-surface">
                {["ID","Reminder","User","Triggered","Delivered","Read","Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-muted font-medium">{h}</th>
                ))}
                <ActionsTh className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No logs yet.</td></tr>
              )}
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-theme hover:bg-hover transition-colors">
                  <td className="px-4 py-2.5 text-primary">{l.id}</td>
                  <td className="px-4 py-2.5 text-secondary">{l.reminder_id ?? "—"}</td>
                  <td className="px-4 py-2.5 text-secondary">{l.user_id}</td>
                  <td className="px-4 py-2.5 text-secondary">{new Date(l.triggered_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-secondary">{l.delivered_at ? new Date(l.delivered_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5 text-secondary">{l.read_at ? new Date(l.read_at).toLocaleString() : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${STATUS_BADGE[l.status] ?? STATUS_BADGE.pending}`}>
                      {l.status}
                    </span>
                  </td>
                  <ActionsCell className="px-4 py-2.5">
                    <QuickRowActions
                      row={l}
                      compact
                      onPrint={(row) => printRecord(`Reminder Log #${row.id}`, [
                        { label: "Reminder ID", value: String(row.reminder_id ?? "—") },
                        { label: "User", value: String(row.user_id) },
                        { label: "Status", value: row.status },
                        { label: "Triggered", value: new Date(row.triggered_at).toLocaleString() },
                      ])}
                      hiddenActions={["view", "edit", "delete"]}
                    />
                  </ActionsCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Settings ── */}
      {tab === "settings" && settings && (
        <div className="max-w-md space-y-5">
          <div className="rounded-xl border border-theme bg-surface p-5 space-y-4">
            <p className="text-sm font-semibold text-primary">User Preferences</p>

            <label className="flex items-center justify-between">
              <span className="text-sm text-secondary">Sound alerts</span>
              <input
                type="checkbox"
                checked={settings.sound_enabled}
                onChange={(e) => setSettings((s) => s ? { ...s, sound_enabled: e.target.checked } : s)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm text-secondary">In-app notifications</span>
              <input
                type="checkbox"
                checked={settings.in_app_enabled}
                onChange={(e) => setSettings((s) => s ? { ...s, in_app_enabled: e.target.checked } : s)}
                className="w-4 h-4 accent-blue-500"
              />
            </label>

            <div>
              <label className="block text-xs text-muted mb-1">Default pre-alert (minutes)</label>
              <input
                type="number"
                min={0}
                className="input-field w-full text-sm"
                value={settings.default_pre_alert_mins}
                onChange={(e) => setSettings((s) => s ? { ...s, default_pre_alert_mins: Number(e.target.value) } : s)}
              />
            </div>

            <button onClick={handleSaveSettings} className="btn-primary text-sm px-4 py-2 w-full">
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Reminder Form Modal */}
      <ReminderForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditReminder(null); }}
        onSaved={load}
        editId={editReminder?.id}
        prefill={editReminder ? {
          title: editReminder.title,
          description: editReminder.description ?? undefined,
          module_name: editReminder.module_name ?? undefined,
          record_id: editReminder.record_id ?? undefined,
          due_time: editReminder.due_time.slice(0, 16),
          recurrence: editReminder.recurrence,
          priority: editReminder.priority,
          pre_alert_minutes: editReminder.pre_alert_minutes,
        } : undefined}
      />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted border border-dashed border-theme rounded-xl">
      {message}
    </div>
  );
}

type CardProps = {
  r: Reminder;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onSnooze: (id: number) => void;
  onEdit: (r: Reminder) => void;
};

function ReminderCard({ r, onComplete, onDelete, onSnooze, onEdit }: CardProps) {
  const isOverdue = new Date(r.due_time) < new Date() && r.status === "pending";
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border bg-surface transition-all
      ${isOverdue ? "border-red-500/40" : "border-theme"}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-primary truncate">{r.title}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${PRIORITY_BADGE[r.priority] ?? PRIORITY_BADGE.medium}`}>
            {r.priority}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>
            {r.status}
          </span>
          {r.recurrence !== "none" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400">
              ↻ {r.recurrence}
            </span>
          )}
        </div>
        {r.description && <p className="text-xs text-secondary mt-1 line-clamp-1">{r.description}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted">
          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(r.due_time).toLocaleString()}</span>
          {r.module_name && <span className="capitalize">{r.module_name} #{r.record_id}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {r.status === "pending" && (
          <>
            <button onClick={() => onComplete(r.id)} title="Complete" className="p-1.5 rounded text-muted hover:text-emerald-400 transition-colors"><CheckCircle2 size={14} /></button>
            <button onClick={() => onSnooze(r.id)} title="Snooze 30m" className="p-1.5 rounded text-muted hover:text-purple-400 transition-colors"><RotateCcw size={14} /></button>
          </>
        )}
        <button onClick={() => onEdit(r)} title="Edit" className="p-1.5 rounded text-muted hover:text-blue-400 transition-colors"><Edit2 size={14} /></button>
        <button onClick={() => onDelete(r.id)} title="Delete" className="p-1.5 rounded text-muted hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function KanbanView({ reminders, onComplete, onDelete, onSnooze, onEdit }: {
  reminders: Reminder[];
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onSnooze: (id: number) => void;
  onEdit: (r: Reminder) => void;
}) {
  const cols = ["pending", "snoozed", "completed", "cancelled"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cols.map((col) => (
        <div key={col} className="rounded-xl border border-theme bg-surface p-3 space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${STATUS_BADGE[col]?.split(" ")[1] ?? "text-muted"}`}>
            {col} ({reminders.filter((r) => r.status === col).length})
          </p>
          {reminders.filter((r) => r.status === col).map((r) => (
            <ReminderCard key={r.id} r={r} onComplete={onComplete} onDelete={onDelete} onSnooze={onSnooze} onEdit={onEdit} />
          ))}
        </div>
      ))}
    </div>
  );
}

function TemplatesTab({ templates, onRefresh }: { templates: Template[]; onRefresh: () => void }) {
  const [form, setForm] = useState({ name: "", title_tpl: "", message_tpl: "", module: "", default_pre_alert_minutes: 30 });
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await remindersApi.createTemplate({ ...form, is_active: true });
      setForm({ name: "", title_tpl: "", message_tpl: "", module: "", default_pre_alert_minutes: 30 });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete template?")) return;
    await remindersApi.deleteTemplate(id);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* Create form */}
      <div className="rounded-xl border border-theme bg-surface p-5">
        <p className="text-sm font-semibold text-primary mb-4">New Template</p>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Name *</label>
              <input required className="input-field w-full text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Module hint</label>
              <input className="input-field w-full text-sm" placeholder="tenant, crm, property…" value={form.module} onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Title template *</label>
            <input required className="input-field w-full text-sm" placeholder="e.g. Rent Due for {tenant_name}" value={form.title_tpl} onChange={(e) => setForm((f) => ({ ...f, title_tpl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Message template *</label>
            <textarea required rows={2} className="input-field w-full text-sm resize-none" placeholder="e.g. Rent of {amount} is due on {due_date}" value={form.message_tpl} onChange={(e) => setForm((f) => ({ ...f, message_tpl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Default pre-alert (mins)</label>
            <input type="number" min={0} className="input-field w-32 text-sm" value={form.default_pre_alert_minutes} onChange={(e) => setForm((f) => ({ ...f, default_pre_alert_minutes: Number(e.target.value) }))} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary text-sm px-4 py-2">
            {saving ? "Saving…" : "Create Template"}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="space-y-2">
        {templates.length === 0 && <p className="text-xs text-muted text-center py-6">No templates yet.</p>}
        {templates.map((t) => (
          <div key={t.id} className="flex items-start gap-3 p-4 rounded-xl border border-theme bg-surface">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">{t.name}</p>
              <p className="text-xs text-secondary mt-0.5 font-mono">{t.title_tpl}</p>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{t.message_tpl}</p>
              <div className="flex gap-3 mt-1 text-[11px] text-muted">
                {t.module && <span>Module: {t.module}</span>}
                <span>Pre-alert: {t.default_pre_alert_minutes}m</span>
              </div>
            </div>
            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded text-muted hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
