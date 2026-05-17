/**
 * Call System Zustand Store
 *
 * Manages demo-mode state for the Calls tab.
 * All data is local/in-memory until a real provider is configured.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CallConfig, type CallRecord, type CallContact, type CallStatus,
  loadCallConfig, saveCallConfig, isCallConfigured, CallService,
} from "../services/calls/CallService";

// ── Seed demo data ────────────────────────────────────────────────────────────

const DEMO_CONTACTS: CallContact[] = [
  { id: "cc1", name: "Ahmed Raza",    phone: "+92 300 1234567", avatar: null, online: true  },
  { id: "cc2", name: "Sara Khan",     phone: "+92 321 9876543", avatar: null, online: false },
  { id: "cc3", name: "Bilal Malik",   phone: "+92 333 5551234", avatar: null, online: true  },
  { id: "cc4", name: "Fatima Noor",   phone: "+92 345 7778899", avatar: null, online: false },
  { id: "cc5", name: "Usman Ali",     phone: "+92 311 2223344", avatar: null, online: true  },
  { id: "cc6", name: "Zara Sheikh",   phone: "+92 312 4445566", avatar: null, online: false },
];

const now = Date.now();
const DEMO_HISTORY: CallRecord[] = [
  { id: "h1", contactId: "cc1", name: "Ahmed Raza",  phone: "+92 300 1234567", direction: "incoming", status: "ended",   duration: 185, startedAt: new Date(now - 10 * 60_000) },
  { id: "h2", contactId: "cc2", name: "Sara Khan",   phone: "+92 321 9876543", direction: "outgoing", status: "ended",   duration: 62,  startedAt: new Date(now - 35 * 60_000) },
  { id: "h3", contactId: "cc3", name: "Bilal Malik", phone: "+92 333 5551234", direction: "incoming", status: "missed",  duration: 0,   startedAt: new Date(now - 2 * 3600_000) },
  { id: "h4", contactId: "cc4", name: "Fatima Noor", phone: "+92 345 7778899", direction: "outgoing", status: "ended",   duration: 310, startedAt: new Date(now - 5 * 3600_000) },
  { id: "h5", contactId: "cc5", name: "Usman Ali",   phone: "+92 311 2223344", direction: "incoming", status: "missed",  duration: 0,   startedAt: new Date(now - 24 * 3600_000) },
  { id: "h6", contactId: "cc1", name: "Ahmed Raza",  phone: "+92 300 1234567", direction: "outgoing", status: "declined",duration: 0,   startedAt: new Date(now - 2 * 24 * 3600_000) },
];

// ── Active call state ─────────────────────────────────────────────────────────

export interface ActiveCall {
  sessionId:  string;
  contactId:  string;
  name:       string;
  phone:      string;
  direction:  "incoming" | "outgoing";
  status:     CallStatus;
  startedAt:  Date | null;   // null until connected
  muted:      boolean;
  speakerOn:  boolean;
  videoOn:    boolean;
}

// ── Store types ───────────────────────────────────────────────────────────────

type CallState = {
  config:           CallConfig;
  contacts:         CallContact[];
  history:          CallRecord[];
  activeCall:       ActiveCall | null;
  incomingCall:     ActiveCall | null;   // popup overlay
  connectionStatus: "demo" | "ready" | "error";
  callSearch:       string;
  elapsedSeconds:   number;
  _timerHandle:     ReturnType<typeof setInterval> | null;

  // Actions
  loadConfig:       () => void;
  updateConfig:     (cfg: CallConfig) => void;
  startCall:        (contact: CallContact) => Promise<void>;
  answerCall:       () => void;
  declineCall:      () => void;
  endCall:          () => void;
  toggleMute:       () => void;
  toggleSpeaker:    () => void;
  toggleVideo:      () => void;
  simulateIncoming: () => void;
  setCallSearch:    (q: string) => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCallStore = create<CallState>()(
  persist(
    (set, get) => ({
      config:           loadCallConfig(),
      contacts:         DEMO_CONTACTS,
      history:          DEMO_HISTORY,
      activeCall:       null,
      incomingCall:     null,
      connectionStatus: CallService.init(),
      callSearch:       "",
      elapsedSeconds:   0,
      _timerHandle:     null,

      loadConfig: () => {
        const cfg = loadCallConfig();
        set({ config: cfg, connectionStatus: CallService.init() });
      },

      updateConfig: (cfg) => {
        saveCallConfig(cfg);
        set({ config: cfg, connectionStatus: isCallConfigured(cfg) ? "ready" : "demo" });
      },

      startCall: async (contact) => {
        const { _timerHandle } = get();
        if (_timerHandle) clearInterval(_timerHandle);

        const call: ActiveCall = {
          sessionId: `call_${Date.now()}`,
          contactId: contact.id,
          name:      contact.name,
          phone:     contact.phone,
          direction: "outgoing",
          status:    "ringing",
          startedAt: null,
          muted:     false,
          speakerOn: false,
          videoOn:   false,
        };
        set({ activeCall: call, elapsedSeconds: 0 });

        // Simulate ringing → connected after 2s
        setTimeout(() => {
          set(s => ({
            activeCall: s.activeCall
              ? { ...s.activeCall, status: "connected", startedAt: new Date() }
              : null,
          }));
          // Start timer
          const handle = setInterval(() => {
            set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 }));
          }, 1000);
          set({ _timerHandle: handle });
        }, 2000);

        await CallService.startCall(contact.phone, contact.name);
      },

      answerCall: () => {
        const { incomingCall, _timerHandle } = get();
        if (!incomingCall) return;
        if (_timerHandle) clearInterval(_timerHandle);

        const answered: ActiveCall = { ...incomingCall, status: "connected", startedAt: new Date() };
        set({ activeCall: answered, incomingCall: null, elapsedSeconds: 0 });

        const handle = setInterval(() => {
          set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 }));
        }, 1000);
        set({ _timerHandle: handle });
      },

      declineCall: () => {
        const { incomingCall, history } = get();
        if (!incomingCall) return;
        const record: CallRecord = {
          id:        `h_${Date.now()}`,
          contactId: incomingCall.contactId,
          name:      incomingCall.name,
          phone:     incomingCall.phone,
          direction: "incoming",
          status:    "declined",
          duration:  0,
          startedAt: new Date(),
        };
        set({ incomingCall: null, history: [record, ...history] });
      },

      endCall: () => {
        const { activeCall, elapsedSeconds, history, _timerHandle } = get();
        if (_timerHandle) clearInterval(_timerHandle);
        if (!activeCall) return;

        const record: CallRecord = {
          id:        `h_${Date.now()}`,
          contactId: activeCall.contactId,
          name:      activeCall.name,
          phone:     activeCall.phone,
          direction: activeCall.direction,
          status:    "ended",
          duration:  elapsedSeconds,
          startedAt: activeCall.startedAt ?? new Date(),
        };
        set({ activeCall: null, history: [record, ...history], elapsedSeconds: 0, _timerHandle: null });
        void CallService.endCall(activeCall.sessionId);
      },

      toggleMute:    () => set(s => ({ activeCall: s.activeCall ? { ...s.activeCall, muted:     !s.activeCall.muted     } : null })),
      toggleSpeaker: () => set(s => ({ activeCall: s.activeCall ? { ...s.activeCall, speakerOn: !s.activeCall.speakerOn } : null })),
      toggleVideo:   () => set(s => ({ activeCall: s.activeCall ? { ...s.activeCall, videoOn:   !s.activeCall.videoOn   } : null })),

      simulateIncoming: () => {
        const { contacts, activeCall } = get();
        if (activeCall) return;
        const contact = contacts[Math.floor(Math.random() * contacts.length)];
        const incoming: ActiveCall = {
          sessionId: `inc_${Date.now()}`,
          contactId: contact.id,
          name:      contact.name,
          phone:     contact.phone,
          direction: "incoming",
          status:    "ringing",
          startedAt: null,
          muted:     false,
          speakerOn: false,
          videoOn:   false,
        };
        set({ incomingCall: incoming });
        // Auto-dismiss after 30s if not answered
        setTimeout(() => {
          set(s => {
            if (s.incomingCall?.sessionId === incoming.sessionId) {
              const record: CallRecord = {
                id: `h_${Date.now()}`, contactId: contact.id,
                name: contact.name, phone: contact.phone,
                direction: "incoming", status: "missed", duration: 0, startedAt: new Date(),
              };
              return { incomingCall: null, history: [record, ...s.history] };
            }
            return {};
          });
        }, 30_000);
      },

      setCallSearch: (q) => set({ callSearch: q }),
    }),
    {
      name: "rems-calls",
      partialize: (s) => ({ config: s.config }),
    }
  )
);
