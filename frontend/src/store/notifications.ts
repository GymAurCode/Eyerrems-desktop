import { create } from "zustand";
import { api } from "../lib/api";

export type Notification = {
  id: number;
  user_id: number;
  reminder_id: number | null;
  title: string;
  message: string;
  channel: string;
  is_read: boolean;
  notif_type: string;
  module_name: string | null;
  record_id: number | null;
  created_at: string;
  read_at: string | null;
};

export type Reminder = {
  id: number;
  title: string;
  description: string | null;
  module_name: string | null;
  record_id: number | null;
  due_time: string;
  recurrence: string;
  cron_expr: string | null;
  priority: string;
  status: string;
  pre_alert_minutes: number;
  template_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  snoozed_until: string | null;
  next_fire_at: string | null;
  assigned_users: { id: number; full_name: string; email: string }[];
};

type Toast = {
  id: string;
  title: string;
  message: string;
  priority: string;
  reminder_id?: number;
};

type NotifState = {
  notifications: Notification[];
  unreadCount: number;
  toasts: Toast[];
  soundEnabled: boolean;

  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
  setSoundEnabled: (v: boolean) => void;
};

export const useNotifStore = create<NotifState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],
  soundEnabled: true,

  fetchNotifications: async () => {
    try {
      const { data } = await api.get<Notification[]>("/reminders/notifications/me");
      set({ notifications: Array.isArray(data) ? data : [] });
    } catch {
      set({ notifications: [] });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get<{ count: number }>("/reminders/notifications/unread-count");
      set({ unreadCount: data?.count ?? 0 });
    } catch {
      // backend unavailable, keep existing count
    }
  },

  markRead: async (id) => {
    await api.post(`/reminders/notifications/${id}/read`);
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  markAllRead: async () => {
    await api.post("/reminders/notifications/mark-all-read");
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }));
  },

  deleteNotification: async (id) => {
    await api.delete(`/reminders/notifications/${id}`);
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    }));
  },

  pushToast: (toast) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    // Auto-dismiss after 8s
    setTimeout(() => get().dismissToast(id), 8000);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setSoundEnabled: (v) => set({ soundEnabled: v }),
}));
