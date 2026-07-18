import { useEffect, useState } from "react";
import {
  Bell, CheckCheck, AlertTriangle, Info, Clock,
  ShoppingCart, CheckCircle, XCircle, Users,
} from "lucide-react";
import { constructionApi, Notification } from "../../../lib/constructionApi";

const TYPE_ICONS: Record<string, any> = {
  task_assigned: Users, task_completed: CheckCircle, task_delayed: AlertTriangle,
  budget_exceeded: AlertTriangle, purchase_approval: ShoppingCart,
  material_delivered: CheckCircle, inspection_failed: XCircle,
  payment_due: Clock, project_completed: CheckCircle, milestone_reached: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  task_assigned: "#6366f1", task_completed: "#10b981", task_delayed: "#ef4444",
  budget_exceeded: "#ef4444", purchase_approval: "#f59e0b",
  material_delivered: "#22c55e", inspection_failed: "#ef4444",
  payment_due: "#f59e0b", project_completed: "#3b82f6", milestone_reached: "#8b5cf6",
};

function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="card-dark rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function NotificationsTab({ projectId }: { projectId: number }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await constructionApi.listNotifications(projectId, filter === "unread" || undefined);
      setNotifications(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [projectId, filter]);

  const handleMarkRead = async (id: number) => {
    await constructionApi.markNotificationRead(id);
    load();
  };

  const handleMarkAllRead = async () => {
    await constructionApi.markAllNotificationsRead(projectId);
    load();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionCard title="Project Alerts & Notifications"
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(["all", "unread"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-[10px] px-2 py-1 rounded-lg capitalize ${
                    filter === f ? "text-white bg-blue-600" : "text-muted hover:text-primary"
                  }`}>
                  {f}{f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-muted hover:text-primary border border-white/10 hover:border-white/20">
                <CheckCheck size={10} /> Mark All Read
              </button>
            )}
          </div>
        }>
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <Bell size={24} className="mx-auto mb-2 text-muted" />
            <p className="text-xs text-muted">No notifications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map(n => {
              const Icon = TYPE_ICONS[n.notification_type] ?? Bell;
              const color = TYPE_COLORS[n.notification_type] ?? "#6366f1";
              return (
                <div key={n.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-white/5 ${
                    !n.is_read ? "bg-white/5" : ""
                  }`}
                  onClick={() => { if (!n.is_read) handleMarkRead(n.id); }}>
                  <div className="p-1.5 rounded-lg shrink-0"
                    style={{ background: `${color}20` }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${!n.is_read ? "font-semibold text-primary" : "text-muted"}`}>
                        {n.title}
                      </span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    {n.message && (
                      <p className="text-[10px] text-muted mt-0.5">{n.message}</p>
                    )}
                    <p className="text-[9px] text-muted mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {n.notification_type && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted capitalize shrink-0 self-start">
                      {n.notification_type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
