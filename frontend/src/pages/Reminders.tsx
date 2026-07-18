import { useEffect, useState } from "react";
import { Bell, BellOff, Calendar, LayoutGrid, List, Plus, BarChart3, FileText, BookOpen } from "lucide-react";
import { remindersApi } from "../lib/remindersApi";
import type { Reminder } from "../lib/remindersApi";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import { useUIStore } from "../store/ui";
import ReminderDashboard from "../components/reminders/ReminderDashboard";
import ReminderCard from "../components/reminders/ReminderCard";
import ReminderForm from "../components/reminders/ReminderForm";
import ReminderCalendar from "../components/reminders/ReminderCalendar";
import ReminderStats from "../components/reminders/ReminderStats";
import MyRemindersTable from "../components/reminders/MyRemindersTable";
import NotificationLogs from "../components/reminders/NotificationLogs";
import TemplatesTab from "../components/reminders/TemplatesTab";
import ConfirmDialog from "../components/actions/ConfirmDialog";
import { useNotifStore } from "../store/notifications";

const TEAL = "#14B8A6";
const YELLOW = "#f6ce3a";

type Tab = "dashboard" | "my" | "calendar" | "stats" | "templates" | "logs";

const TAB_ITEMS = [
  { label: "Dashboard", value: "dashboard", icon: LayoutGrid },
  { label: "My Reminders", value: "my", icon: List },
  { label: "Calendar", value: "calendar", icon: Calendar },
  { label: "Stats", value: "stats", icon: BarChart3 },
  { label: "Templates", value: "templates", icon: BookOpen },
  { label: "Logs", value: "logs", icon: FileText },
];

export default function RemindersPage() {
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === "dark";
  const accent = isDark ? YELLOW : TEAL;
  const accentBg = isDark ? "rgba(246,206,58,0.12)" : "rgba(20,184,166,0.12)";
  const accentBorder = isDark ? "rgba(246,206,58,0.4)" : "rgba(20,184,166,0.4)";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [filterBy, setFilterBy] = useState("");
  const [sortBy, setSortBy] = useState("remind_at");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ item: any; type?: string } | null>(null);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterBy) params.filter_by = filterBy;
      if (sortBy) params.sort_by = sortBy;
      if (sortDir) params.sort_dir = sortDir;
      if (search) params.search = search;
      const data = await remindersApi.getReminders(params);
      setReminders(data);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "my" || tab === "calendar" || tab === "stats") {
      loadReminders();
    }
  }, [tab, filterBy, sortBy, sortDir]);

  const handleComplete = async (id: number) => {
    await remindersApi.completeReminder(id);
    loadReminders();
  };

  const handleSnooze = async (id: number, minutes: number) => {
    await remindersApi.snoozeReminder(id, minutes);
    loadReminders();
  };

  const handleDelete = (id: number) => {
    setDeleteTarget({ item: id, type: "reminder" });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await remindersApi.deleteReminder(deleteTarget.item as number);
    pushToast({ title: "Reminder deleted", message: "Reminder has been deleted successfully", type: "success" });
    loadReminders();
    setDeleteTarget(null);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} style={{ color: accent }} />
          <h1 className="text-base font-semibold text-primary">Reminders</h1>
        </div>
        <button
          onClick={() => { setEditReminder(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all duration-150"
          style={{
            background: isDark ? "rgba(246,206,58,0.15)" : accent,
            color: isDark ? YELLOW : "#fff",
            border: isDark ? "1px solid rgba(246,206,58,0.3)" : "none",
            backdropFilter: isDark ? "blur(6px)" : "none",
          }}
        >
          <Plus size={13} /> New Reminder
        </button>
      </div>

      <ModuleTabs
        tabs={TAB_ITEMS}
        activeTab={tab}
        onChange={setTab}
        moduleColor={accent}
      />

      {tab === "dashboard" && (
        <ReminderDashboard onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />
      )}

      {tab === "my" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { value: "", label: "All" },
              { value: "today", label: "Today" },
              { value: "upcoming", label: "Upcoming" },
              { value: "completed", label: "Completed" },
              { value: "overdue", label: "Overdue" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterBy(f.value)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  filterBy === f.value
                    ? ""
                    : "border-theme text-secondary hover:text-primary"
                }`}
                style={filterBy === f.value ? {
                  borderColor: accentBorder,
                  background: accentBg,
                  color: accent,
                } : undefined}
              >
                {f.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input
                className="input-field text-xs px-3 py-1.5 w-48"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadReminders()}
              />
              <select
                className="input-field text-xs px-3 py-1.5"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="remind_at">Sort by Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="title">Sort by Title</option>
                <option value="created_at">Sort by Created</option>
              </select>
              <button
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="text-[11px] px-2 py-1.5 rounded border border-theme text-secondary hover:text-primary"
              >
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-muted">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: `${accent}33`, borderTopColor: accent }} />
              Loading...
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-theme rounded-xl">
              <BellOff size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted">No reminders found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders
                .filter((r) => r.status !== "completed")
                .map((r) => (
                  <ReminderCard
                    key={r.id}
                    reminder={r}
                    onComplete={handleComplete}
                    onSnooze={handleSnooze}
                    onEdit={(r) => { setEditReminder(r); setFormOpen(true); }}
                    onDelete={handleDelete}
                  />
                ))}
              {reminders.filter((r) => r.status === "completed").length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs text-muted cursor-pointer hover:text-primary py-2">
                    Completed ({reminders.filter((r) => r.status === "completed").length})
                  </summary>
                  <div className="space-y-2 mt-2">
                    {reminders
                      .filter((r) => r.status === "completed")
                      .map((r) => (
                        <ReminderCard
                          key={r.id}
                          reminder={r}
                          onDelete={handleDelete}
                          onEdit={(r) => { setEditReminder(r); setFormOpen(true); }}
                        />
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "calendar" && (
        <ReminderCalendar reminders={reminders} onEdit={(r) => { setEditReminder(r); setFormOpen(true); }} />
      )}

      {tab === "stats" && <ReminderStats reminders={reminders} />}

      {tab === "templates" && <TemplatesTab />}

      {tab === "logs" && <NotificationLogs />}

      <ReminderForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditReminder(null); }}
        onSaved={() => {
          pushToast({ title: editReminder ? "Reminder updated" : "Reminder created", message: editReminder ? "Reminder has been updated successfully" : "Reminder has been created successfully", type: "success" });
          loadReminders();
        }}
        editReminder={editReminder}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Reminder"
        message="Are you sure you want to delete this reminder?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
