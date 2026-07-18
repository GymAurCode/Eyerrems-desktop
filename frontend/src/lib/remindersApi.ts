import { api } from "./api";

export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  category: string | null;
  remind_at: string;
  priority: string;
  repeat: string;
  status: string;
  reminder_before: number;
  notification_sent: boolean;
  snoozed_until: string | null;
  completed_at: string | null;
  template_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  upcoming_24h: Reminder[];
  overdue: Reminder[];
  today_total: number;
  today_completed: number;
  today_pending: number;
}

export interface RecoveryData {
  missed_count: number;
  missed: { id: number; title: string; remind_at: string; priority: string }[];
}

export interface SchedulerStatus {
  running: boolean;
  loop_alive: boolean;
}

export interface Template {
  id: number;
  user_id: number;
  name: string;
  title_template: string;
  description_template: string | null;
  priority: string;
  repeat: string;
  reminder_before: number;
  created_at: string;
}

export interface NotificationLogEntry {
  id: number;
  reminder_id: number;
  reminder_title: string | null;
  reminder_priority: string | null;
  reminder_category: string | null;
  triggered_at: string;
  status: string;
  user_action: string | null;
  snooze_minutes: number | null;
}

export const remindersApi = {
  getReminders: async (params?: Record<string, string>): Promise<Reminder[]> => {
    const { data } = await api.get("/reminders", { params });
    return Array.isArray(data) ? data : [];
  },
  getReminder: async (id: number): Promise<Reminder> => {
    const { data } = await api.get(`/reminders/${id}`);
    return data;
  },
  createReminder: async (payload: any): Promise<Reminder> => {
    const { data } = await api.post("/reminders", payload);
    return data;
  },
  updateReminder: async (id: number, payload: any): Promise<Reminder> => {
    const { data } = await api.put(`/reminders/${id}`, payload);
    return data;
  },
  deleteReminder: async (id: number): Promise<void> => {
    await api.delete(`/reminders/${id}`);
  },
  snoozeReminder: async (id: number, minutes: number): Promise<Reminder> => {
    const { data } = await api.post(`/reminders/${id}/snooze`, { minutes });
    return data;
  },
  completeReminder: async (id: number): Promise<Reminder> => {
    const { data } = await api.post(`/reminders/${id}/complete`);
    return data;
  },
  cancelReminder: async (id: number): Promise<Reminder> => {
    const { data } = await api.post(`/reminders/${id}/cancel`);
    return data;
  },
  bulkAction: async (ids: number[], action: "complete" | "delete"): Promise<{ affected: number }> => {
    const { data } = await api.post("/reminders/bulk", { ids, action });
    return data;
  },
  getDashboard: async (): Promise<DashboardData> => {
    const { data } = await api.get("/reminders/dashboard");
    return data;
  },
  getRecovery: async (): Promise<RecoveryData> => {
    const { data } = await api.get("/reminders/recovery");
    return data;
  },
  getSchedulerStatus: async (): Promise<SchedulerStatus> => {
    const { data } = await api.get("/reminders/scheduler-status");
    return data;
  },
  getTemplates: async (): Promise<Template[]> => {
    const { data } = await api.get("/reminders/templates/list");
    return Array.isArray(data) ? data : [];
  },
  createTemplate: async (payload: any): Promise<Template> => {
    const { data } = await api.post("/reminders/templates", payload);
    return data;
  },
  deleteTemplate: async (id: number): Promise<void> => {
    await api.delete(`/reminders/templates/${id}`);
  },
  applyTemplate: async (id: number, payload: { remind_at: string; variables: Record<string, string> }): Promise<Reminder> => {
    const { data } = await api.post(`/reminders/templates/${id}/apply`, payload);
    return data;
  },
  getLogs: async (params?: Record<string, string | number>): Promise<NotificationLogEntry[]> => {
    const { data } = await api.get("/reminders/notifications/logs", { params });
    return Array.isArray(data) ? data : [];
  },
  exportLogsCsv: async (): Promise<Blob> => {
    const { data } = await api.get("/reminders/notifications/logs/export", { responseType: "blob" });
    return data;
  },
};
