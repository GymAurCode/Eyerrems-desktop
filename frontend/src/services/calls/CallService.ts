/**
 * Call Service Abstraction Layer
 *
 * Pluggable VoIP integration layer. Currently runs in DEMO MODE.
 * To activate real calling, populate the config via the Settings panel
 * and replace the stub implementations with your chosen provider
 * (e.g. Twilio Voice, Agora, Daily.co, custom SIP/WebRTC, etc.)
 *
 * Architecture:
 *   UI → CallService → (config check) → Provider SDK / REST call
 *
 * No real calls are made until a valid config is saved.
 */

// ── Config ────────────────────────────────────────────────────────────────────

export interface CallConfig {
  providerName: string;   // e.g. "Twilio", "Agora", "Custom SIP"
  apiKey:       string;
  apiSecret:    string;
  callerId:     string;   // Caller ID / phone number
  webhookUrl:   string;   // Inbound webhook (display only)
  enabled:      boolean;
}

const CONFIG_KEY = "rems_call_config";

export function loadCallConfig(): CallConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as CallConfig;
  } catch { /* ignore */ }
  return { providerName: "", apiKey: "", apiSecret: "", callerId: "", webhookUrl: "", enabled: false };
}

export function saveCallConfig(cfg: CallConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function isCallConfigured(cfg: CallConfig): boolean {
  return !!(cfg.enabled && cfg.apiKey && cfg.callerId);
}

// ── Call types ────────────────────────────────────────────────────────────────

export type CallDirection = "incoming" | "outgoing";
export type CallStatus    = "ringing" | "connected" | "ended" | "missed" | "declined";

export interface CallRecord {
  id:        string;
  contactId: string;
  name:      string;
  phone:     string;
  direction: CallDirection;
  status:    CallStatus;
  duration:  number;   // seconds
  startedAt: Date;
}

export interface CallContact {
  id:     string;
  name:   string;
  phone:  string;
  avatar: string | null;
  online: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const CallService = {
  /** Check provider connection status. */
  init(): "demo" | "ready" | "error" {
    const cfg = loadCallConfig();
    if (!isCallConfigured(cfg)) return "demo";
    // TODO: ping provider health endpoint
    return "ready";
  },

  /**
   * Start an outgoing call.
   * Demo mode: returns a fake call session.
   * Ready mode: TODO — initialise provider SDK session.
   */
  async startCall(
    to: string,
    _contactName: string,
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const cfg = loadCallConfig();
    if (!isCallConfigured(cfg)) {
      return { success: true, sessionId: `demo_call_${Date.now()}` };
    }
    // TODO: implement real provider call
    // Example for Twilio:
    // const res = await fetch("/api/calls/start", {
    //   method: "POST",
    //   body: JSON.stringify({ to, from: cfg.callerId }),
    // });
    return { success: true, sessionId: `stub_call_${Date.now()}` };
  },

  /** End an active call. */
  async endCall(_sessionId: string): Promise<void> {
    // TODO: terminate provider session
  },

  /** Fetch call history (demo: returns empty — store manages demo data). */
  async getCallHistory(): Promise<CallRecord[]> {
    return [];
  },

  /** Connect to provider (called on config save). */
  async connectProvider(_cfg: CallConfig): Promise<"ready" | "error"> {
    // TODO: authenticate with provider
    return "ready";
  },
};
