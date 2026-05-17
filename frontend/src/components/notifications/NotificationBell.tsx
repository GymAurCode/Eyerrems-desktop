import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";
import { useNotifStore } from "../../store/notifications";
import { useNavigate } from "react-router-dom";

const TYPE_DOT: Record<string, string> = {
  error:   "bg-red-500",
  warning: "bg-orange-400",
  success: "bg-emerald-500",
  info:    "bg-blue-500",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    notifications, unreadCount,
    fetchNotifications, fetchUnreadCount,
    markRead, markAllRead, deleteNotification,
  } = useNotifStore();

  // Fetch unread count ONCE on mount — no polling
  useEffect(() => {
    void fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (open) void fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (n: (typeof notifications)[0]) => {
    if (!n.is_read) void markRead(n.id);
    if (n.module_name && n.record_id) {
      const routes: Record<string, string> = {
        tenant:       `/tenants/${n.record_id}`,
        property:     `/property/${n.record_id}`,
        crm:          `/crm`,
        construction: `/construction/projects/${n.record_id}`,
      };
      const route = routes[n.module_name];
      if (route) { navigate(route); setOpen(false); }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
        style={{ color: "var(--text-secondary)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 rounded-xl border border-theme bg-surface shadow-2xl z-50 overflow-hidden"
          style={{ maxHeight: "480px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme">
            <span className="text-sm font-semibold text-primary">Notifications</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => void markAllRead()}
                  title="Mark all read"
                  className="p-1 rounded text-muted hover:text-primary transition-colors"
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => { navigate("/reminders"); setOpen(false); }}
                className="text-[11px] text-blue-400 hover:text-blue-300 px-2 py-1 rounded transition-colors"
              >
                View all
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded text-muted hover:text-primary">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted">No notifications</div>
            ) : (
              notifications.slice(0, 30).map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-theme cursor-pointer transition-colors
                    ${n.is_read ? "opacity-60" : "bg-blue-500/5 hover:bg-blue-500/10"}`}
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[n.notif_type] ?? TYPE_DOT.info} ${n.is_read ? "opacity-30" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-primary truncate">{n.title}</p>
                    <p className="text-[11px] text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.is_read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void markRead(n.id); }}
                        title="Mark read"
                        className="p-1 rounded text-muted hover:text-emerald-400 transition-colors"
                      >
                        <Check size={12} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteNotification(n.id); }}
                      title="Delete"
                      className="p-1 rounded text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
