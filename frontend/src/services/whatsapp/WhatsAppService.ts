/**
 * WhatsApp Service Abstraction Layer
 *
 * This is a pluggable service layer. Currently runs in DEMO MODE.
 * To activate real integration, populate the config via the Settings panel
 * and replace the stub implementations below with your chosen provider
 * (e.g. Meta Cloud API, Twilio, 360dialog, WATI, etc.)
 *
 * Architecture:
 *   UI → WhatsAppService → (config check) → Provider SDK / REST call
 *
 * No real API calls are made until a valid config is saved.
 */

// ── Config types ──────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  providerName:  string;   // e.g. "Meta Cloud API", "Twilio", "WATI"
  apiKey:        string;
  apiSecret:     string;
  phoneNumberId: string;   // Sender phone number ID
  webhookUrl:    string;   // Inbound webhook (display only)
  enabled:       boolean;
}

const CONFIG_KEY = "rems_whatsapp_config";

export function loadConfig(): WhatsAppConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw) as WhatsAppConfig;
  } catch { /* ignore */ }
  return {
    providerName:  "",
    apiKey:        "",
    apiSecret:     "",
    phoneNumberId: "",
    webhookUrl:    "",
    enabled:       false,
  };
}

export function saveConfig(cfg: WhatsAppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
}

export function isConfigured(cfg: WhatsAppConfig): boolean {
  return !!(cfg.enabled && cfg.apiKey && cfg.phoneNumberId);
}

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

export interface WaMessage {
  id:        string;
  from:      string;   // phone number or "me"
  body:      string;
  timestamp: Date;
  status:    MessageStatus;
  isOutbound: boolean;
}

export interface WaContact {
  id:          string;
  name:        string;
  phone:       string;
  avatar:      string | null;
  lastMessage: string;
  lastTime:    Date;
  unread:      number;
  online:      boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const WhatsAppService = {
  /**
   * Check connection status.
   * Returns "demo" if not configured, "ready" if config is present.
   */
  connect(): "demo" | "ready" | "error" {
    const cfg = loadConfig();
    if (!isConfigured(cfg)) return "demo";
    // TODO: ping provider health endpoint when real integration is added
    return "ready";
  },

  /**
   * Send a message to a phone number.
   * In demo mode: returns a fake success response.
   * In ready mode: TODO — call provider API.
   */
  async sendMessage(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const cfg = loadConfig();
    if (!isConfigured(cfg)) {
      // Demo mode — simulate send
      return { success: true, messageId: `demo_${Date.now()}` };
    }
    // TODO: implement real provider call
    // Example for Meta Cloud API:
    // const res = await fetch(`https://graph.facebook.com/v18.0/${cfg.phoneNumberId}/messages`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
    // });
    return { success: true, messageId: `stub_${Date.now()}` };
  },

  /**
   * Fetch messages for a contact.
   * In demo mode: returns seeded fake messages.
   * In ready mode: TODO — fetch from provider or local DB.
   */
  async getMessages(_contactId: string): Promise<WaMessage[]> {
    // Demo messages are managed in the Zustand store (whatsapp.ts)
    // Real implementation would fetch from backend/provider here
    return [];
  },

  /**
   * Fetch contact list.
   * In demo mode: returns seeded fake contacts.
   * In ready mode: TODO — fetch from CRM or provider.
   */
  async getContacts(): Promise<WaContact[]> {
    return [];
  },
};
