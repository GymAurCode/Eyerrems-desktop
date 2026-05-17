import { create } from "zustand";
import { api } from "../lib/api";

export type EmailAccount = {
  id: number;
  user_id: number;
  display_name: string;
  email_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  imap_host: string;
  imap_port: number;
  imap_use_ssl: boolean;
  username: string;
  is_active: boolean;
  is_verified: boolean;
  last_sync_at: string | null;
  created_at: string;
};

export type EmailListItem = {
  id: number;
  account_id: number;
  thread_id: number | null;
  folder: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string; // JSON string
  subject: string;
  body_text: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  date: string;
  attachment_count: number;
};

export type EmailDetail = EmailListItem & {
  cc_addresses: string | null;
  bcc_addresses: string | null;
  body_html: string | null;
  attachments: { id: number; filename: string; content_type: string | null; size_bytes: number | null }[];
};

export type MailboxStats = {
  inbox_unread: number;
  drafts_count: number;
  sent_count: number;
  trash_count: number;
};

type MailState = {
  accounts: EmailAccount[];
  activeAccountId: number | null;
  activeFolder: string;
  emails: EmailListItem[];
  selectedEmail: EmailDetail | null;
  stats: MailboxStats | null;
  loading: boolean;
  syncing: boolean;

  fetchAccounts: () => Promise<void>;
  setActiveAccount: (id: number) => void;
  setActiveFolder: (folder: string) => void;
  fetchEmails: (accountId: number, folder: string, search?: string) => Promise<void>;
  fetchEmail: (accountId: number, emailId: number) => Promise<void>;
  fetchStats: (accountId: number) => Promise<void>;
  syncInbox: (accountId: number) => Promise<number>;
  markRead: (accountId: number, emailIds: number[], isRead: boolean) => Promise<void>;
  moveToTrash: (accountId: number, emailIds: number[]) => Promise<void>;
  deleteEmail: (accountId: number, emailId: number) => Promise<void>;
  clearSelectedEmail: () => void;
};

export const useMailStore = create<MailState>((set, get) => ({
  accounts: [],
  activeAccountId: null,
  activeFolder: "inbox",
  emails: [],
  selectedEmail: null,
  stats: null,
  loading: false,
  syncing: false,

  fetchAccounts: async () => {
    try {
      const { data } = await api.get("/mail/accounts");
      const list: EmailAccount[] = Array.isArray(data) ? data : [];
      const currentId = get().activeAccountId;

      // If the currently active account no longer exists in the refreshed list,
      // reset to the first available account (or null if none).
      const idStillValid = currentId !== null && list.some((a) => a.id === currentId);
      const nextActiveId = idStillValid
        ? currentId
        : list.length > 0
        ? list[0].id
        : null;

      set({
        accounts: list,
        activeAccountId: nextActiveId,
        // Clear stale email/stats data if the active account changed
        ...(nextActiveId !== currentId
          ? { emails: [], selectedEmail: null, stats: null }
          : {}),
      });
    } catch (err: unknown) {
      // Silently keep accounts as empty array — 401 means not yet authed,
      // 500 means backend issue; both are handled gracefully in the UI.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 401 && status !== 500) {
        console.error("[mail] fetchAccounts failed:", err);
      }
      set({ accounts: [] });
    }
  },

  setActiveAccount: (id) => {
    set({ activeAccountId: id, selectedEmail: null, emails: [] });
  },

  setActiveFolder: (folder) => {
    set({ activeFolder: folder, selectedEmail: null, emails: [] });
  },

  fetchEmails: async (accountId, folder, search) => {
    set({ loading: true });
    try {
      const params: Record<string, string> = { folder };
      if (search) params.search = search;
      const { data } = await api.get(`/mail/accounts/${accountId}/emails`, { params });
      set({ emails: data });
    } finally {
      set({ loading: false });
    }
  },

  fetchEmail: async (accountId, emailId) => {
    const { data } = await api.get(`/mail/accounts/${accountId}/emails/${emailId}`);
    set({ selectedEmail: data });
    // Update is_read in list
    set((state) => ({
      emails: state.emails.map((e) => (e.id === emailId ? { ...e, is_read: true } : e)),
    }));
  },

  fetchStats: async (accountId) => {
    const { data } = await api.get(`/mail/accounts/${accountId}/stats`);
    set({ stats: data });
  },

  syncInbox: async (accountId) => {
    set({ syncing: true });
    try {
      const { data } = await api.post(`/mail/accounts/${accountId}/sync`);
      return data.synced as number;
    } finally {
      set({ syncing: false });
    }
  },

  markRead: async (accountId, emailIds, isRead) => {
    await api.post(`/mail/accounts/${accountId}/mark-read`, { email_ids: emailIds, is_read: isRead });
    set((state) => ({
      emails: state.emails.map((e) =>
        emailIds.includes(e.id) ? { ...e, is_read: isRead } : e
      ),
    }));
  },

  moveToTrash: async (accountId, emailIds) => {
    await api.post(`/mail/accounts/${accountId}/trash`, { email_ids: emailIds });
    set((state) => ({
      emails: state.emails.filter((e) => !emailIds.includes(e.id)),
      selectedEmail:
        state.selectedEmail && emailIds.includes(state.selectedEmail.id)
          ? null
          : state.selectedEmail,
    }));
  },

  deleteEmail: async (accountId, emailId) => {
    await api.delete(`/mail/accounts/${accountId}/emails/${emailId}`);
    set((state) => ({
      emails: state.emails.filter((e) => e.id !== emailId),
      selectedEmail: state.selectedEmail?.id === emailId ? null : state.selectedEmail,
    }));
  },

  clearSelectedEmail: () => set({ selectedEmail: null }),
}));
