/**
 * WhatsApp Zustand Store
 *
 * Manages demo-mode state for the WhatsApp tab.
 * All data is local/in-memory until a real provider is configured.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type WaContact, type WaMessage, type WhatsAppConfig,
  loadConfig, saveConfig, isConfigured, WhatsAppService,
} from "../services/whatsapp/WhatsAppService";

// ── Seed demo contacts ────────────────────────────────────────────────────────

const DEMO_CONTACTS: WaContact[] = [
  {
    id: "c1", name: "Ahmed Raza", phone: "+92 300 1234567",
    avatar: null, lastMessage: "When can I visit the property?",
    lastTime: new Date(Date.now() - 5 * 60_000), unread: 2, online: true,
  },
  {
    id: "c2", name: "Sara Khan", phone: "+92 321 9876543",
    avatar: null, lastMessage: "Please send the lease agreement.",
    lastTime: new Date(Date.now() - 30 * 60_000), unread: 0, online: false,
  },
  {
    id: "c3", name: "Bilal Malik", phone: "+92 333 5551234",
    avatar: null, lastMessage: "Maintenance request submitted.",
    lastTime: new Date(Date.now() - 2 * 3600_000), unread: 1, online: true,
  },
  {
    id: "c4", name: "Fatima Noor", phone: "+92 345 7778899",
    avatar: null, lastMessage: "Thank you for the quick response!",
    lastTime: new Date(Date.now() - 24 * 3600_000), unread: 0, online: false,
  },
  {
    id: "c5", name: "Usman Ali", phone: "+92 311 2223344",
    avatar: null, lastMessage: "Is the 3-bed unit still available?",
    lastTime: new Date(Date.now() - 2 * 24 * 3600_000), unread: 0, online: false,
  },
];

const DEMO_MESSAGES: Record<string, WaMessage[]> = {
  c1: [
    { id: "m1", from: "c1", body: "Hello, I'm interested in the property on Main Boulevard.", timestamp: new Date(Date.now() - 20 * 60_000), status: "read", isOutbound: false },
    { id: "m2", from: "me", body: "Hi Ahmed! Great to hear from you. Which property are you interested in?", timestamp: new Date(Date.now() - 18 * 60_000), status: "read", isOutbound: true },
    { id: "m3", from: "c1", body: "The 4-bedroom house listed at PKR 2.5 crore.", timestamp: new Date(Date.now() - 15 * 60_000), status: "read", isOutbound: false },
    { id: "m4", from: "me", body: "That property is still available. Would you like to schedule a viewing?", timestamp: new Date(Date.now() - 12 * 60_000), status: "delivered", isOutbound: true },
    { id: "m5", from: "c1", body: "When can I visit the property?", timestamp: new Date(Date.now() - 5 * 60_000), status: "read", isOutbound: false },
  ],
  c2: [
    { id: "m6", from: "c2", body: "Hi, I signed the lease last week. Can you send me a copy?", timestamp: new Date(Date.now() - 60 * 60_000), status: "read", isOutbound: false },
    { id: "m7", from: "me", body: "Of course Sara! I'll send it right away.", timestamp: new Date(Date.now() - 55 * 60_000), status: "read", isOutbound: true },
    { id: "m8", from: "c2", body: "Please send the lease agreement.", timestamp: new Date(Date.now() - 30 * 60_000), status: "delivered", isOutbound: false },
  ],
  c3: [
    { id: "m9", from: "c3", body: "The AC in unit 3B is not working.", timestamp: new Date(Date.now() - 3 * 3600_000), status: "read", isOutbound: false },
    { id: "m10", from: "me", body: "We've logged a maintenance request. A technician will visit tomorrow.", timestamp: new Date(Date.now() - 2.5 * 3600_000), status: "read", isOutbound: true },
    { id: "m11", from: "c3", body: "Maintenance request submitted.", timestamp: new Date(Date.now() - 2 * 3600_000), status: "delivered", isOutbound: false },
  ],
};

// ── Store types ───────────────────────────────────────────────────────────────

type WaState = {
  config:          WhatsAppConfig;
  contacts:        WaContact[];
  messages:        Record<string, WaMessage[]>;
  activeContactId: string | null;
  search:          string;
  connectionStatus: "demo" | "ready" | "error";

  // Actions
  loadConfig:        () => void;
  updateConfig:      (cfg: WhatsAppConfig) => void;
  setActiveContact:  (id: string) => void;
  setSearch:         (q: string) => void;
  sendMessage:       (body: string) => Promise<void>;
  markRead:          (contactId: string) => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useWhatsAppStore = create<WaState>()(
  persist(
    (set, get) => ({
      config:           loadConfig(),
      contacts:         DEMO_CONTACTS,
      messages:         DEMO_MESSAGES,
      activeContactId:  null,
      search:           "",
      connectionStatus: WhatsAppService.connect(),

      loadConfig: () => {
        const cfg = loadConfig();
        set({ config: cfg, connectionStatus: WhatsAppService.connect() });
      },

      updateConfig: (cfg) => {
        saveConfig(cfg);
        set({ config: cfg, connectionStatus: isConfigured(cfg) ? "ready" : "demo" });
      },

      setActiveContact: (id) => {
        set({ activeContactId: id });
        get().markRead(id);
      },

      setSearch: (q) => set({ search: q }),

      sendMessage: async (body) => {
        const { activeContactId, contacts, messages } = get();
        if (!activeContactId || !body.trim()) return;

        const newMsg: WaMessage = {
          id:         `msg_${Date.now()}`,
          from:       "me",
          body:       body.trim(),
          timestamp:  new Date(),
          status:     "sent",
          isOutbound: true,
        };

        // Optimistic update
        const updated = [...(messages[activeContactId] ?? []), newMsg];
        set({
          messages: { ...messages, [activeContactId]: updated },
          contacts: contacts.map(c =>
            c.id === activeContactId
              ? { ...c, lastMessage: body.trim(), lastTime: new Date() }
              : c
          ),
        });

        // Simulate delivery tick after 1s
        setTimeout(() => {
          set(s => ({
            messages: {
              ...s.messages,
              [activeContactId]: (s.messages[activeContactId] ?? []).map(m =>
                m.id === newMsg.id ? { ...m, status: "delivered" } : m
              ),
            },
          }));
        }, 1000);

        // Call service (no-op in demo mode)
        const contact = contacts.find(c => c.id === activeContactId);
        if (contact) {
          await WhatsAppService.sendMessage(contact.phone, body.trim());
        }
      },

      markRead: (contactId) => {
        set(s => ({
          contacts: s.contacts.map(c =>
            c.id === contactId ? { ...c, unread: 0 } : c
          ),
        }));
      },
    }),
    {
      name: "rems-whatsapp",
      // Only persist config — contacts/messages reset to demo data on reload
      partialize: (s) => ({ config: s.config }),
    }
  )
);
