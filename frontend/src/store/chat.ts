/**
 * Internal Chat Store
 *
 * Manages channels, messages, and system events.
 * Demo mode: all data is local/in-memory with seeded content.
 * Real mode: WebSocket events are dispatched into this store via receiveWsEvent().
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ChatMessage, type ChatChannel, type SystemEventType,
  formatSystemEvent, ChatService,
} from "../services/chat/ChatService";

// ── Seed data ─────────────────────────────────────────────────────────────────

const SYSTEM_CHANNEL_ID = "system_updates";
const now = Date.now();

const SEED_CHANNELS: ChatChannel[] = [
  {
    id: SYSTEM_CHANNEL_ID, name: "System Updates", type: "system",
    members: [], unread: 3, lastMessage: "New property registered: DHA Phase 6",
    lastTime: new Date(now - 5 * 60_000), pinned: true, icon: "⚙️",
  },
  {
    id: "ch_general", name: "General", type: "group",
    members: ["u1","u2","u3"], unread: 2, lastMessage: "Meeting at 3pm today",
    lastTime: new Date(now - 12 * 60_000), pinned: false,
  },
  {
    id: "ch_finance", name: "Finance Team", type: "group",
    members: ["u1","u4"], unread: 0, lastMessage: "Q1 report submitted",
    lastTime: new Date(now - 2 * 3600_000), pinned: false,
  },
  {
    id: "dm_ahmed", name: "Ahmed Raza", type: "direct",
    members: ["u1","u2"], unread: 1, lastMessage: "Can you check the lease?",
    lastTime: new Date(now - 30 * 60_000), pinned: false,
  },
  {
    id: "dm_sara", name: "Sara Khan", type: "direct",
    members: ["u1","u3"], unread: 0, lastMessage: "Thanks!",
    lastTime: new Date(now - 4 * 3600_000), pinned: false,
  },
];

function sysMsg(
  id: string, channelId: string, body: string,
  eventType: SystemEventType, minsAgo: number,
  metadata?: Record<string, string>,
): ChatMessage {
  return {
    id, channelId, type: "event_message",
    senderId: null, senderName: "System", senderRole: "system",
    body, timestamp: new Date(now - minsAgo * 60_000),
    status: "read", eventType, isSystem: true, metadata,
  };
}

function userMsg(
  id: string, channelId: string, senderId: string,
  senderName: string, senderRole: string, body: string, minsAgo: number,
): ChatMessage {
  return {
    id, channelId, type: "user_message",
    senderId, senderName, senderRole,
    body, timestamp: new Date(now - minsAgo * 60_000),
    status: "read", isSystem: false,
  };
}

const SEED_MESSAGES: Record<string, ChatMessage[]> = {
  [SYSTEM_CHANNEL_ID]: [
    sysMsg("s1", SYSTEM_CHANNEL_ID, "👤 New user added: Ali Hassan as Accountant",          "USER_CREATED",    120, { name: "Ali Hassan", role: "Accountant" }),
    sysMsg("s2", SYSTEM_CHANNEL_ID, "🏠 New property registered: DHA Phase 6 — Block C",    "PROPERTY_ADDED",   90, { name: "DHA Phase 6 — Block C" }),
    sysMsg("s3", SYSTEM_CHANNEL_ID, "💰 New financial record created by Admin: Rent Income", "FINANCE_ENTRY",    60, { by: "Admin", description: "Rent Income" }),
    sysMsg("s4", SYSTEM_CHANNEL_ID, "🔄 User role updated: Bilal Malik → Accountant",        "ROLE_UPDATED",     30, { name: "Bilal Malik", newRole: "Accountant" }),
    sysMsg("s5", SYSTEM_CHANNEL_ID, "🏘️ New tenant added: Fatima Noor",                      "TENANT_ADDED",     15, { name: "Fatima Noor" }),
    sysMsg("s6", SYSTEM_CHANNEL_ID, "📋 New booking created: BK-0042 — Ahmed Raza",          "BOOKING_CREATED",   5, { bookingId: "BK-0042", client: "Ahmed Raza" }),
  ],
  ch_general: [
    userMsg("g1", "ch_general", "u2", "Ahmed Raza",  "Dealer",     "Good morning everyone!", 60),
    userMsg("g2", "ch_general", "u1", "Admin",        "Admin",      "Morning! Don't forget the property inspection at 11am.", 55),
    userMsg("g3", "ch_general", "u3", "Sara Khan",    "Staff",      "I'll be there. Should I bring the lease documents?", 50),
    userMsg("g4", "ch_general", "u1", "Admin",        "Admin",      "Yes please, bring the full file.", 45),
    userMsg("g5", "ch_general", "u2", "Ahmed Raza",  "Dealer",     "Meeting at 3pm today", 12),
  ],
  ch_finance: [
    userMsg("f1", "ch_finance", "u4", "Ali Hassan",   "Accountant", "Monthly reconciliation done.", 180),
    userMsg("f2", "ch_finance", "u1", "Admin",        "Admin",      "Great. Please share the summary report.", 170),
    userMsg("f3", "ch_finance", "u4", "Ali Hassan",   "Accountant", "Q1 report submitted", 120),
  ],
  dm_ahmed: [
    userMsg("a1", "dm_ahmed", "u2", "Ahmed Raza", "Dealer", "Hi, I have a client interested in the DHA property.", 90),
    userMsg("a2", "dm_ahmed", "u1", "Admin",      "Admin",  "Great! Schedule a viewing for tomorrow.", 85),
    userMsg("a3", "dm_ahmed", "u2", "Ahmed Raza", "Dealer", "Can you check the lease?", 30),
  ],
  dm_sara: [
    userMsg("sa1", "dm_sara", "u3", "Sara Khan", "Staff", "The maintenance request has been submitted.", 240),
    userMsg("sa2", "dm_sara", "u1", "Admin",     "Admin", "Thanks for the update!", 235),
    userMsg("sa3", "dm_sara", "u3", "Sara Khan", "Staff", "Thanks!", 230),
  ],
};

// ── Store types ───────────────────────────────────────────────────────────────

type ChatFilter = "all" | "chats" | "system";

type ChatState = {
  channels:          ChatChannel[];
  messages:          Record<string, ChatMessage[]>;
  activeChannelId:   string | null;
  search:            string;
  filter:            ChatFilter;
  currentUserId:     string;
  currentUserName:   string;
  currentUserRole:   string;

  // Actions
  setActiveChannel:  (id: string) => void;
  setSearch:         (q: string) => void;
  setFilter:         (f: ChatFilter) => void;
  setCurrentUser:    (id: string, name: string, role: string) => void;
  sendMessage:       (body: string) => void;
  receiveWsEvent:    (eventType: SystemEventType, payload: Record<string, string>) => void;
  markChannelRead:   (id: string) => void;
  triggerSystemEvent:(eventType: SystemEventType, payload: Record<string, string>) => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      channels:        SEED_CHANNELS,
      messages:        SEED_MESSAGES,
      activeChannelId: null,
      search:          "",
      filter:          "all",
      currentUserId:   "u1",
      currentUserName: "Admin",
      currentUserRole: "Admin",

      setActiveChannel: (id) => {
        set({ activeChannelId: id });
        get().markChannelRead(id);
      },

      setSearch:  (q) => set({ search: q }),
      setFilter:  (f) => set({ filter: f }),

      setCurrentUser: (id, name, role) =>
        set({ currentUserId: id, currentUserName: name, currentUserRole: role }),

      sendMessage: (body) => {
        const { activeChannelId, currentUserId, currentUserName, currentUserRole, messages, channels } = get();
        if (!activeChannelId || !body.trim()) return;

        const msg: ChatMessage = {
          id:         `msg_${Date.now()}`,
          channelId:  activeChannelId,
          type:       "user_message",
          senderId:   currentUserId,
          senderName: currentUserName,
          senderRole: currentUserRole,
          body:       body.trim(),
          timestamp:  new Date(),
          status:     "sent",
          isSystem:   false,
        };

        const updated = [...(messages[activeChannelId] ?? []), msg];
        set({
          messages: { ...messages, [activeChannelId]: updated },
          channels: channels.map(c =>
            c.id === activeChannelId
              ? { ...c, lastMessage: body.trim(), lastTime: new Date() }
              : c
          ),
        });

        // Simulate delivery tick
        setTimeout(() => {
          set(s => ({
            messages: {
              ...s.messages,
              [activeChannelId]: (s.messages[activeChannelId] ?? []).map(m =>
                m.id === msg.id ? { ...m, status: "delivered" } : m
              ),
            },
          }));
        }, 800);

        void ChatService.sendMessage(activeChannelId, body.trim(), currentUserId);
      },

      receiveWsEvent: (eventType, payload) => {
        get().triggerSystemEvent(eventType, payload);
      },

      triggerSystemEvent: (eventType, payload) => {
        const { messages, channels } = get();
        const body = formatSystemEvent(eventType, payload);

        const msg: ChatMessage = {
          id:         `sys_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          channelId:  SYSTEM_CHANNEL_ID,
          type:       "event_message",
          senderId:   null,
          senderName: "System",
          senderRole: "system",
          body,
          timestamp:  new Date(),
          status:     "delivered",
          eventType,
          metadata:   payload,
          isSystem:   true,
        };

        const updated = [...(messages[SYSTEM_CHANNEL_ID] ?? []), msg];
        set({
          messages: { ...messages, [SYSTEM_CHANNEL_ID]: updated },
          channels: channels.map(c =>
            c.id === SYSTEM_CHANNEL_ID
              ? { ...c, lastMessage: body, lastTime: new Date(), unread: c.unread + 1 }
              : c
          ),
        });

        void ChatService.sendSystemMessage(eventType, payload);
      },

      markChannelRead: (id) => {
        set(s => ({
          channels: s.channels.map(c => c.id === id ? { ...c, unread: 0 } : c),
        }));
      },
    }),
    {
      name: "rems-chat",
      // Only persist messages and channels — reset demo seed on first load
      partialize: (s) => ({
        messages: s.messages,
        channels: s.channels,
      }),
    }
  )
);

// ── Public helper — trigger system event from anywhere in the app ─────────────
export function triggerChatEvent(
  eventType: SystemEventType,
  payload: Record<string, string>,
): void {
  useChatStore.getState().triggerSystemEvent(eventType, payload);
}
