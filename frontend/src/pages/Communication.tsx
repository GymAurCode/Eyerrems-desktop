/**
 * Communication Hub — Email + WhatsApp + Calls unified module.
 *
 * Email tab:    wraps the existing MailPage (no duplication).
 * WhatsApp tab: full demo UI with pluggable config layer.
 * Calls tab:    call management UI with pluggable VoIP config layer.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mail, MessageCircle, Settings, Send, Paperclip, Search,
  Check, CheckCheck, Wifi, WifiOff, AlertCircle, Save, Eye, EyeOff, X,
  Phone, Circle, PhoneCall, PhoneIncoming, PhoneOff, PhoneMissed,
  Mic, MicOff, Volume2, VolumeX, Video, VideoOff, PhoneOutgoing,
} from "lucide-react";
import MailPage from "./Mail";
import { useWhatsAppStore } from "../store/whatsapp";
import { useCallStore, type ActiveCall } from "../store/calls";
import type { WaContact, WaMessage } from "../services/whatsapp/WhatsAppService";
import type { CallContact, CallRecord, CallConfig } from "../services/calls/CallService";
import { loadCallConfig, saveCallConfig, isCallConfigured } from "../services/calls/CallService";
import type { WhatsAppConfig } from "../services/whatsapp/WhatsAppService";
import { useChatStore } from "../store/chat";
import { useAuthStore } from "../store/auth";
import { chatApi } from "../lib/chatApi";
import type { ChatChannel, ChatMessage } from "../services/chat/ChatService";
import { MessageSquare, Bell, Filter, Hash, Users, Lock, Shield } from "lucide-react";

// ── Tab bar ───────────────────────────────────────────────────────────────────

type CommTab = "email" | "whatsapp" | "calls" | "chat";

// Each tab has its own identity color — instantly brain-mappable
const TABS: {
  id:          CommTab;
  label:       string;
  icon:        React.ElementType;
  color:       string;   // inactive icon color
  badgeColor:  string;   // notification badge bg
}[] = [
  { id: "email",    label: "Email",    icon: Mail,          color: "#3b82f6", badgeColor: "#64748b" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "#25D366", badgeColor: "#64748b" },
  { id: "calls",    label: "Calls",    icon: Phone,         color: "#ef4444", badgeColor: "#64748b" },
  { id: "chat",     label: "Chat",     icon: MessageSquare, color: "#8b5cf6", badgeColor: "#64748b" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatTime(d: Date): string {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Status icon ───────────────────────────────────────────────────────────────

function MsgStatus({ status }: { status: WaMessage["status"] }) {
  if (status === "sent")      return <Check size={12} className="text-muted" />;
  if (status === "delivered") return <CheckCheck size={12} className="text-muted" />;
  if (status === "read")      return <CheckCheck size={12} style={{ color: "#25D366" }} />;
  return <AlertCircle size={12} className="text-red-400" />;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, online, size = 36 }: { name: string; online?: boolean; size?: number }) {
  const colors = ["#25D366","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899"];
  const color  = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold"
        style={{ background: color, fontSize: size * 0.35 }}>
        {initials(name)}
      </div>
      {online !== undefined && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: online ? "#25D366" : "#64748b",
            borderColor: "var(--bg-surface, #1e2030)",
          }} />
      )}
    </div>
  );
}

// ── WhatsApp Config Panel ─────────────────────────────────────────────────────

function WhatsAppConfigPanel({ onClose }: { onClose: () => void }) {
  const { config, updateConfig } = useWhatsAppStore();
  const [form, setForm] = useState<WhatsAppConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof WhatsAppConfig, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    updateConfig(form);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.15)" }}>
            <Settings size={14} style={{ color: "#25D366" }} />
          </div>
          <p className="text-sm font-semibold text-primary">WhatsApp API Configuration</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-primary transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Status banner */}
        <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
          style={{
            background: form.enabled && form.apiKey ? "rgba(37,211,102,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${form.enabled && form.apiKey ? "rgba(37,211,102,0.25)" : "rgba(245,158,11,0.25)"}`,
            color: form.enabled && form.apiKey ? "#25D366" : "#f59e0b",
          }}>
          {form.enabled && form.apiKey
            ? <><Wifi size={12} /> Ready for Integration — API key configured</>
            : <><WifiOff size={12} /> Demo Mode Active — configure API key to enable real messaging</>}
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "var(--bg-surface2, rgba(255,255,255,0.03))", border: "1px solid var(--border)" }}>
          <div>
            <p className="text-xs font-semibold text-primary">Enable WhatsApp Integration</p>
            <p className="text-[10px] text-muted mt-0.5">Activate real API calls when key is configured</p>
          </div>
          <button onClick={() => set("enabled", !form.enabled)}
            className="w-10 h-5 rounded-full transition-all relative"
            style={{ background: form.enabled ? "#25D366" : "var(--border)" }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
              style={{ left: form.enabled ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        {[
          { key: "providerName",  label: "API Provider Name",     placeholder: "e.g. Meta Cloud API, Twilio, WATI", type: "text",     secure: false },
          { key: "apiKey",        label: "API Key *",              placeholder: "Your API key or access token",      type: "password", secure: true  },
          { key: "apiSecret",     label: "API Secret (optional)",  placeholder: "API secret if required",            type: "password", secure: true  },
          { key: "phoneNumberId", label: "Phone Number ID / Sender ID", placeholder: "e.g. 1234567890",             type: "text",     secure: false },
          { key: "webhookUrl",    label: "Webhook URL (display only)", placeholder: "https://your-domain.com/webhook", type: "text",  secure: false },
        ].map(({ key, label, placeholder, type, secure }) => {
          const labelText = label.replace(/ \*$/, "");
          const isReq = label.endsWith(" *");
          return (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">{labelText}{isReq && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>}</label>
            <div className="relative">
              <input
                type={secure && !showKey ? "password" : "text"}
                className="input-dark w-full px-3 py-2 text-sm pr-8"
                placeholder={placeholder}
                value={(form as any)[key] as string}
                onChange={e => set(key as keyof WhatsAppConfig, e.target.value)}
                readOnly={key === "webhookUrl"}
              />
              {secure && (
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors">
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
          </div>
          );
        })}

        <div className="px-3 py-2.5 rounded-xl text-[10px] text-muted"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <p className="font-semibold text-blue-400 mb-1">Integration Note</p>
          <p>This configuration is stored locally. When you add a real API key, the system will be ready for integration. No actual API calls are made until the service layer is implemented.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 shrink-0 flex justify-end gap-2"
        style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button onClick={handleSave}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? "Saved!" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
// ── Contact list item ─────────────────────────────────────────────────────────

function ContactItem({ contact, active, onClick }: {
  contact: WaContact; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background: active ? "rgba(37,211,102,0.08)" : "transparent",
        borderLeft: active ? "3px solid #25D366" : "3px solid transparent",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      <Avatar name={contact.name} online={contact.online} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-primary truncate">{contact.name}</p>
          <span className="text-[10px] text-muted shrink-0 ml-2">{timeAgo(contact.lastTime)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted truncate">{contact.lastMessage}</p>
          {contact.unread > 0 && (
            <span className="ml-2 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 text-white"
              style={{ background: "#25D366" }}>
              {contact.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: WaMessage }) {
  const out = msg.isOutbound;
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"} mb-1`}>
      <div className="max-w-[72%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
        style={{
          background:   out ? "#25D366" : "var(--bg-surface2, rgba(255,255,255,0.06))",
          color:        out ? "#fff"    : "var(--text-primary)",
          borderRadius: out ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        }}>
        <p className="break-words">{msg.body}</p>
        <div className={`flex items-center gap-1 mt-1 ${out ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px]" style={{ opacity: 0.7 }}>{formatTime(msg.timestamp)}</span>
          {out && <MsgStatus status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp Tab ──────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const {
    contacts, messages, activeContactId, search, connectionStatus,
    setActiveContact, setSearch, sendMessage,
  } = useWhatsAppStore();

  const [input,      setInput]      = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeContact = contacts.find(c => c.id === activeContactId) ?? null;
  const activeMessages: WaMessage[] = activeContactId ? (messages[activeContactId] ?? []) : [];

  const filteredContacts = contacts.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const totalUnread = contacts.reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  if (showConfig) {
    return (
      <div className="flex h-full">
        <div className="w-full max-w-lg mx-auto flex flex-col" style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <WhatsAppConfigPanel onClose={() => setShowConfig(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Contact list ── */}
      <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.15)" }}>
              <MessageCircle size={14} style={{ color: "#25D366" }} />
            </div>
            <p className="text-sm font-bold text-primary">WhatsApp</p>
            {totalUnread > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: "#25D366" }}>{totalUnread}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Connection status */}
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: connectionStatus === "ready" ? "rgba(37,211,102,0.12)" : "rgba(245,158,11,0.12)",
                color:      connectionStatus === "ready" ? "#25D366" : "#f59e0b",
              }}>
              {connectionStatus === "ready" ? <Wifi size={9} /> : <WifiOff size={9} />}
              {connectionStatus === "ready" ? "Ready" : "Demo"}
            </div>
            <button onClick={() => setShowConfig(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary transition-colors"
              title="WhatsApp Settings">
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--bg-surface2, rgba(255,255,255,0.05))", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            />
          </div>
        </div>

        {/* Demo mode notice */}
        {connectionStatus === "demo" && (
          <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg text-[10px] flex items-start gap-1.5 shrink-0"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>Demo Mode — showing sample data. Configure API key to enable real messaging.</span>
          </div>
        )}

        {/* Contact list */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted">No contacts found</div>
          ) : (
            filteredContacts.map(c => (
              <ContactItem key={c.id} contact={c} active={c.id === activeContactId}
                onClick={() => setActiveContact(c.id)} />
            ))
          )}
        </div>
      </div>

      {/* ── Middle/Right: Chat window ── */}
      {!activeContact ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.10)", border: "2px dashed rgba(37,211,102,0.3)" }}>
            <MessageCircle size={32} style={{ color: "#25D366", opacity: 0.6 }} />
          </div>
          <div>
            <p className="text-base font-semibold text-primary">Select a conversation</p>
            <p className="text-xs text-muted mt-1">Choose a contact from the left to start chatting</p>
          </div>
          {connectionStatus === "demo" && (
            <button onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs rounded-xl font-medium transition-colors"
              style={{ background: "rgba(37,211,102,0.12)", color: "#25D366", border: "1px solid rgba(37,211,102,0.3)" }}>
              <Settings size={12} /> Configure WhatsApp API
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <Avatar name={activeContact.name} online={activeContact.online} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">{activeContact.name}</p>
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <Phone size={9} />
                <span>{activeContact.phone}</span>
                <span>·</span>
                <Circle size={7} style={{ fill: activeContact.online ? "#25D366" : "#64748b", color: activeContact.online ? "#25D366" : "#64748b" }} />
                <span>{activeContact.online ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4"
            style={{ background: "var(--bg-base)" }}>
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <p className="text-xs text-muted">No messages yet. Say hello!</p>
              </div>
            ) : (
              <>
                {activeMessages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <div className="px-4 py-3 flex items-end gap-2 shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}>
            <button className="p-2 rounded-xl text-muted hover:text-primary transition-colors shrink-0"
              title="Attach file (UI only)">
              <Paperclip size={16} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 px-3 py-2 text-sm rounded-xl resize-none"
              style={{
                background: "var(--bg-surface2, rgba(255,255,255,0.05))",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
                maxHeight: "120px",
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="p-2.5 rounded-xl text-white transition-all disabled:opacity-40 shrink-0"
              style={{ background: input.trim() ? "#25D366" : "var(--border)" }}>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CALLS TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (secs === 0) return "—";
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function callTimeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function callInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function CallAvatar({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) {
  const colors = ["#25D366","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899"];
  const color  = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full flex items-center justify-center text-white font-bold"
        style={{ background: color, fontSize: size * 0.35 }}>
        {callInitials(name)}
      </div>
      {online !== undefined && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
          style={{ background: online ? "#25D366" : "#64748b", borderColor: "var(--bg-surface, #1e2030)" }} />
      )}
    </div>
  );
}

// ── Call history row ──────────────────────────────────────────────────────────

function CallHistoryRow({ record, onCall }: { record: CallRecord; onCall: () => void }) {
  const Icon =
    record.status === "missed"   ? PhoneMissed   :
    record.direction === "incoming" ? PhoneIncoming : PhoneOutgoing;
  const iconColor =
    record.status === "missed"   ? "#ef4444" :
    record.direction === "incoming" ? "#25D366"  : "#3b82f6";

  return (
    <div className="flex items-center gap-3 px-4 py-3 transition-colors group"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <CallAvatar name={record.name} size={36} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary truncate">{record.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon size={11} style={{ color: iconColor }} />
          <span className="text-[10px] text-muted capitalize">{record.direction}</span>
          {record.duration > 0 && (
            <><span className="text-[10px] text-muted">·</span>
            <span className="text-[10px] text-muted">{fmtDuration(record.duration)}</span></>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted">{callTimeAgo(record.startedAt)}</span>
        <button onClick={onCall}
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          style={{ background: "rgba(37,211,102,0.12)", color: "#25D366" }}
          title="Call back">
          <Phone size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Active call screen ────────────────────────────────────────────────────────

function ActiveCallScreen({ call, elapsed }: { call: ActiveCall; elapsed: number }) {
  const { endCall, toggleMute, toggleSpeaker, toggleVideo } = useCallStore();

  const statusLabel =
    call.status === "ringing"   ? "Ringing..." :
    call.status === "connected" ? fmtDuration(elapsed) :
    call.status === "ended"     ? "Call ended" : call.status;

  const statusColor =
    call.status === "ringing"   ? "#f59e0b" :
    call.status === "connected" ? "#25D366"  : "#64748b";

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
      {/* Pulse ring when ringing */}
      <div className="relative">
        {call.status === "ringing" && (
          <>
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(37,211,102,0.2)", animationDuration: "1.5s" }} />
            <div className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(37,211,102,0.1)", animationDuration: "2s", animationDelay: "0.5s" }} />
          </>
        )}
        <CallAvatar name={call.name} size={96} />
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold text-primary">{call.name}</p>
        <p className="text-sm text-muted mt-1">{call.phone}</p>
        <p className="text-sm font-semibold mt-2 font-mono" style={{ color: statusColor }}>
          {statusLabel}
        </p>
        <p className="text-[10px] text-muted mt-1 capitalize">
          {call.direction === "outgoing" ? "Outgoing call" : "Incoming call"}
        </p>
      </div>

      {/* Call controls */}
      <div className="flex items-center gap-4">
        {/* Mute */}
        <button onClick={toggleMute}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={{
            background: call.muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
            color:      call.muted ? "#ef4444" : "var(--text-secondary)",
            border:     `1px solid ${call.muted ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
          }}
          title={call.muted ? "Unmute" : "Mute"}>
          {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* End call */}
        <button onClick={endCall}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg"
          style={{ background: "#ff3b30", color: "#fff" }}
          title="End call">
          <PhoneOff size={24} />
        </button>

        {/* Speaker */}
        <button onClick={toggleSpeaker}
          className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
          style={{
            background: call.speakerOn ? "rgba(37,211,102,0.15)" : "rgba(255,255,255,0.08)",
            color:      call.speakerOn ? "#25D366" : "var(--text-secondary)",
            border:     `1px solid ${call.speakerOn ? "rgba(37,211,102,0.3)" : "var(--border)"}`,
          }}
          title={call.speakerOn ? "Speaker off" : "Speaker on"}>
          {call.speakerOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center gap-3">
        <button onClick={toggleVideo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
          style={{
            background: call.videoOn ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.05)",
            color:      call.videoOn ? "#60a5fa" : "var(--text-muted)",
            border:     `1px solid ${call.videoOn ? "rgba(59,130,246,0.3)" : "var(--border)"}`,
          }}>
          {call.videoOn ? <Video size={12} /> : <VideoOff size={12} />}
          {call.videoOn ? "Video on" : "Video off"}
        </button>
      </div>
    </div>
  );
}

// ── Incoming call overlay ─────────────────────────────────────────────────────

function IncomingCallOverlay({ call }: { call: ActiveCall }) {
  const { answerCall, declineCall } = useCallStore();
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="flex flex-col items-center gap-5 p-8 rounded-3xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", minWidth: 280 }}>
        <div className="relative">
          <div className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(37,211,102,0.25)", animationDuration: "1.2s" }} />
          <CallAvatar name={call.name} size={72} />
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted uppercase tracking-widest mb-1">Incoming Call</p>
          <p className="text-xl font-bold text-primary">{call.name}</p>
          <p className="text-sm text-muted mt-0.5">{call.phone}</p>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={declineCall}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{ background: "#ff3b30" }} title="Decline">
            <PhoneOff size={22} />
          </button>
          <button onClick={answerCall}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg"
            style={{ background: "#25D366" }} title="Answer">
            <Phone size={22} />
          </button>
        </div>
        <p className="text-[10px] text-muted">Tap to answer or decline</p>
      </div>
    </div>
  );
}

// ── Call Config Panel ─────────────────────────────────────────────────────────

function CallConfigPanel({ onClose }: { onClose: () => void }) {
  const { config, updateConfig } = useCallStore();
  const [form, setForm] = useState<CallConfig>({ ...config });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof CallConfig, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    updateConfig(form);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.15)" }}>
            <Settings size={14} style={{ color: "#25D366" }} />
          </div>
          <p className="text-sm font-semibold text-primary">Call Provider Configuration</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted hover:text-primary transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Status banner */}
        <div className="px-3 py-2.5 rounded-xl text-xs flex items-center gap-2"
          style={{
            background: form.enabled && form.apiKey ? "rgba(37,211,102,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${form.enabled && form.apiKey ? "rgba(37,211,102,0.25)" : "rgba(245,158,11,0.25)"}`,
            color: form.enabled && form.apiKey ? "#25D366" : "#f59e0b",
          }}>
          {form.enabled && form.apiKey
            ? <><Wifi size={12} /> Ready for Integration — provider configured</>
            : <><WifiOff size={12} /> Demo Mode — configure provider to enable real calls</>}
        </div>

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "var(--bg-surface2, rgba(255,255,255,0.03))", border: "1px solid var(--border)" }}>
          <div>
            <p className="text-xs font-semibold text-primary">Enable Call Integration</p>
            <p className="text-[10px] text-muted mt-0.5">Activate real VoIP calls when provider is configured</p>
          </div>
          <button onClick={() => set("enabled", !form.enabled)}
            className="w-10 h-5 rounded-full transition-all relative"
            style={{ background: form.enabled ? "#25D366" : "var(--border)" }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
              style={{ left: form.enabled ? "calc(100% - 18px)" : "2px" }} />
          </button>
        </div>

        {[
          { key: "providerName", label: "Provider Name",          placeholder: "e.g. Twilio, Agora, Custom SIP", type: "text",     secure: false },
          { key: "apiKey",       label: "API Key *",               placeholder: "Your API key or access token",   type: "password", secure: true  },
          { key: "apiSecret",    label: "API Secret (optional)",   placeholder: "API secret if required",         type: "password", secure: true  },
          { key: "callerId",     label: "Caller ID / Number",      placeholder: "e.g. +1 555 000 0000",           type: "text",     secure: false },
          { key: "webhookUrl",   label: "Webhook URL (display only)", placeholder: "https://your-domain.com/calls/webhook", type: "text", secure: false },
        ].map(({ key, label, placeholder, type, secure }) => {
          const labelText = label.replace(/ \*$/, "");
          const isReq = label.endsWith(" *");
          return (
          <div key={key} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wider">{labelText}{isReq && <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>}</label>
            <div className="relative">
              <input
                type={secure && !showKey ? "password" : "text"}
                className="input-dark w-full px-3 py-2 text-sm pr-8"
                placeholder={placeholder}
                value={(form as any)[key] as string}
                onChange={e => set(key as keyof CallConfig, e.target.value)}
                readOnly={key === "webhookUrl"}
              />
              {secure && (
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors">
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
          </div>
          );
        })}

        <div className="px-3 py-2.5 rounded-xl text-[10px] text-muted"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
          <p className="font-semibold text-blue-400 mb-1">Integration Note</p>
          <p>Supports Twilio Voice, Agora, Daily.co, or any custom SIP/WebRTC provider. Configuration is stored locally. No real calls are made until the CallService layer is implemented.</p>
        </div>
      </div>

      <div className="px-5 py-4 shrink-0 flex justify-end gap-2"
        style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-xl transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          Cancel
        </button>
        <button onClick={handleSave}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? "Saved!" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}

// ── Calls Tab ─────────────────────────────────────────────────────────────────

function CallsTab() {
  const {
    contacts, history, activeCall, incomingCall, connectionStatus,
    callSearch, elapsedSeconds,
    startCall, setCallSearch, simulateIncoming,
  } = useCallStore();

  const [showConfig,    setShowConfig]    = useState(false);
  const [selectedContact, setSelectedContact] = useState<CallContact | null>(null);

  const missedCount = history.filter(h => h.status === "missed").length;

  const filteredContacts = contacts.filter(c =>
    !callSearch ||
    c.name.toLowerCase().includes(callSearch.toLowerCase()) ||
    c.phone.includes(callSearch)
  );

  const handleStartCall = async (contact: CallContact) => {
    setSelectedContact(null);
    await startCall(contact);
  };

  if (showConfig) {
    return (
      <div className="flex h-full">
        <div className="w-full max-w-lg mx-auto flex flex-col"
          style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <CallConfigPanel onClose={() => setShowConfig(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Incoming call overlay */}
      {incomingCall && <IncomingCallOverlay call={incomingCall} />}

      {/* ── Left: Call history ── */}
      <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.15)" }}>
              <Phone size={14} style={{ color: "#25D366" }} />
            </div>
            <p className="text-sm font-bold text-primary">Calls</p>
            {missedCount > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: "#ef4444" }}>{missedCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: connectionStatus === "ready" ? "rgba(37,211,102,0.12)" : "rgba(245,158,11,0.12)",
                color:      connectionStatus === "ready" ? "#25D366" : "#f59e0b",
              }}>
              {connectionStatus === "ready" ? <Wifi size={9} /> : <WifiOff size={9} />}
              {connectionStatus === "ready" ? "Ready" : "Demo"}
            </div>
            <button onClick={() => setShowConfig(true)}
              className="p-1.5 rounded-lg text-muted hover:text-primary transition-colors" title="Call Settings">
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* Demo notice */}
        {connectionStatus === "demo" && (
          <div className="mx-3 mt-2 px-2.5 py-2 rounded-lg text-[10px] flex items-start gap-1.5 shrink-0"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}>
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            <span>Demo Mode — calls are simulated. Configure a provider to enable real calling.</span>
          </div>
        )}

        {/* Simulate incoming (demo only) */}
        {connectionStatus === "demo" && !activeCall && !incomingCall && (
          <div className="px-3 pt-2 shrink-0">
            <button onClick={simulateIncoming}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] transition-colors"
              style={{ background: "rgba(37,211,102,0.08)", color: "#25D366", border: "1px solid rgba(37,211,102,0.2)" }}>
              <PhoneIncoming size={11} /> Simulate Incoming Call
            </button>
          </div>
        )}

        {/* Recent calls */}
        <div className="px-4 py-2 shrink-0">
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Recent</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted text-center">No call history</p>
          ) : (
            history.slice(0, 20).map(record => {
              const contact = contacts.find(c => c.id === record.contactId) ?? {
                id: record.contactId, name: record.name, phone: record.phone, avatar: null, online: false,
              };
              return (
                <CallHistoryRow key={record.id} record={record}
                  onCall={() => void handleStartCall(contact)} />
              );
            })
          )}
        </div>
      </div>

      {/* ── Middle: Active call or empty state ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeCall ? (
          <ActiveCallScreen call={activeCall} elapsed={elapsedSeconds} />
        ) : selectedContact ? (
          /* Contact preview — click to call */
          <div className="flex flex-col items-center justify-center h-full gap-5 px-8">
            <CallAvatar name={selectedContact.name} size={80} online={selectedContact.online} />
            <div className="text-center">
              <p className="text-xl font-bold text-primary">{selectedContact.name}</p>
              <p className="text-sm text-muted mt-1">{selectedContact.phone}</p>
              <div className="flex items-center justify-center gap-1.5 mt-1">
                <Circle size={7} style={{ fill: selectedContact.online ? "#25D366" : "#64748b", color: selectedContact.online ? "#25D366" : "#64748b" }} />
                <span className="text-[10px] text-muted">{selectedContact.online ? "Online" : "Offline"}</span>
              </div>
            </div>
            <button onClick={() => void handleStartCall(selectedContact)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-semibold text-white transition-all"
              style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.35)" }}>
              <Phone size={16} /> Start Call
            </button>
            <button onClick={() => setSelectedContact(null)}
              className="text-xs text-muted hover:text-primary transition-colors">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.10)", border: "2px dashed rgba(37,211,102,0.3)" }}>
              <Phone size={32} style={{ color: "#25D366", opacity: 0.6 }} />
            </div>
            <div>
              <p className="text-base font-semibold text-primary">Select a contact to call</p>
              <p className="text-xs text-muted mt-1">Choose from the contact list on the right</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Contact list ── */}
      <div className="w-64 shrink-0 flex flex-col" style={{ borderLeft: "1px solid var(--border)" }}>
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Contacts</p>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={callSearch} onChange={e => setCallSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--bg-surface2, rgba(255,255,255,0.05))", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.map(c => (
            <button key={c.id} onClick={() => setSelectedContact(c)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              <CallAvatar name={c.name} size={34} online={c.online} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-muted truncate">{c.phone}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); void handleStartCall(c); }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                style={{ background: "rgba(37,211,102,0.12)", color: "#25D366" }}>
                <Phone size={11} />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════════════════════

// ── Chat helpers ──────────────────────────────────────────────────────────────

function chatTimeAgo(d: Date): string {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function chatInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function ChatAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ["#25D366","#3b82f6","#8b5cf6","#f59e0b","#ef4444","#06b6d4","#ec4899"];
  const color  = name === "System" ? "#64748b" : colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}>
      {name === "System" ? "⚙️" : chatInitials(name)}
    </div>
  );
}

// ── Channel list item ─────────────────────────────────────────────────────────

function ChannelItem({ channel, active, onClick }: {
  channel: ChatChannel; active: boolean; onClick: () => void;
}) {
  const typeIcon =
    channel.type === "system"  ? <Bell size={11} style={{ color: "#f59e0b" }} /> :
    channel.type === "role"    ? <Shield size={11} style={{ color: "#8b5cf6" }} /> :
    channel.type === "group"   ? <Hash size={11} className="text-muted" /> :
    <Lock size={11} className="text-muted" />;

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background:  active ? "rgba(37,211,102,0.08)" : "transparent",
        borderLeft:  active ? "3px solid #25D366" : "3px solid transparent",
        borderBottom: "1px solid var(--border-subtle)",
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
      {channel.type === "system"
        ? <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base"
            style={{ background: "rgba(245,158,11,0.15)" }}>⚙️</div>
        : channel.type === "role"
        ? <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>#</div>
        : <ChatAvatar name={channel.name} size={36} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {typeIcon}
            <p className="text-xs font-semibold text-primary truncate">{channel.name}</p>
            {channel.pinned && <span className="text-[9px] text-yellow-400">📌</span>}
          </div>
          <span className="text-[10px] text-muted shrink-0 ml-1">{chatTimeAgo(channel.lastTime)}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-muted truncate">{channel.lastMessage}</p>
          {channel.unread > 0 && (
            <span className="ml-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white shrink-0"
              style={{ background: channel.type === "system" ? "#f59e0b" : "#25D366" }}>
              {channel.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function ChatBubble({ msg, isMe }: { msg: ChatMessage; isMe: boolean }) {
  // System / event messages — centered full-width
  if (msg.isSystem) {
    return (
      <div className="flex justify-center my-2 px-4">
        <div className="flex items-start gap-2 max-w-[85%] px-4 py-2.5 rounded-2xl text-xs"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            color: "var(--text-secondary)",
          }}>
          <span className="text-sm shrink-0 mt-0.5">⚙️</span>
          <div>
            <p className="leading-relaxed">{msg.body}</p>
            <p className="text-[10px] text-muted mt-1">
              {new Date(msg.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User messages — WhatsApp style
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 px-4`}>
      {!isMe && (
        <div className="mr-2 mt-1 shrink-0">
          <ChatAvatar name={msg.senderName} size={28} />
        </div>
      )}
      <div className="max-w-[68%]">
        {!isMe && (
          <p className="text-[10px] font-semibold mb-0.5 ml-1" style={{ color: "#25D366" }}>
            {msg.senderName}
            <span className="text-muted font-normal ml-1">· {msg.senderRole}</span>
          </p>
        )}
        <div className="px-3 py-2 rounded-2xl text-sm leading-relaxed"
          style={{
            background:   isMe ? "#25D366" : "var(--bg-surface2, rgba(255,255,255,0.06))",
            color:        isMe ? "#fff"    : "var(--text-primary)",
            borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          }}>
          <p className="break-words">{msg.body}</p>
          <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px]" style={{ opacity: 0.7 }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {isMe && (
              msg.status === "read"      ? <CheckCheck size={11} style={{ color: "#fff", opacity: 0.9 }} /> :
              msg.status === "delivered" ? <CheckCheck size={11} style={{ opacity: 0.7 }} /> :
              <Check size={11} style={{ opacity: 0.7 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat Tab ──────────────────────────────────────────────────────────────────

function ChatTab() {
  const {
    channels, messages, activeChannelId, search, filter,
    currentUserId, currentUserName, currentUserRole,
    setActiveChannel, setSearch, setFilter, sendMessage,
    setCurrentUser, triggerSystemEvent, syncFromBootstrap, onlineUsers,
  } = useChatStore();

  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (user) {
      const role = user.roles?.[0] ?? user.role ?? "Staff";
      setCurrentUser(String(user.id), user.full_name, role);
    }
    chatApi.bootstrap()
      .then(syncFromBootstrap)
      .catch(() => { /* keep seeded demo channels if API unavailable */ });
  }, [user?.id, syncFromBootstrap, setCurrentUser]);

  const [input,       setInput]       = useState("");
  const [showDemo,    setShowDemo]     = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId) ?? null;
  const activeMessages: ChatMessage[] = activeChannelId ? (messages[activeChannelId] ?? []) : [];

  // Filter channels
  const filteredChannels = channels.filter(c => {
    if (filter === "system") return c.type === "system";
    if (filter === "roles") return c.type === "role";
    if (filter === "direct") return c.type === "direct";
    return c.type !== "system";
  }).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: pinned first, then by lastTime
  const sortedChannels = [...filteredChannels].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
  });

  const totalUnread = channels.reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Demo: trigger a sample system event
  const demoEvents: Array<{ label: string; type: Parameters<typeof triggerSystemEvent>[0]; payload: Record<string,string> }> = [
    { label: "New User",     type: "USER_CREATED",    payload: { name: "Test User", role: "Dealer" } },
    { label: "New Property", type: "PROPERTY_ADDED",  payload: { name: "Gulberg Residencia Block A" } },
    { label: "Finance Entry",type: "FINANCE_ENTRY",   payload: { by: "Admin", description: "Expense: Office Supplies" } },
    { label: "Role Updated", type: "ROLE_UPDATED",    payload: { name: "Sara Khan", newRole: "Accountant" } },
    { label: "New Booking",  type: "BOOKING_CREATED", payload: { bookingId: "BK-0099", client: "Usman Ali" } },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Channel list ── */}
      <div className="w-72 shrink-0 flex flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(37,211,102,0.15)" }}>
              <MessageSquare size={14} style={{ color: "#25D366" }} />
            </div>
            <p className="text-sm font-bold text-primary">Chat</p>
            {totalUnread > 0 && (
              <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                style={{ background: "#25D366" }}>{totalUnread}</span>
            )}
          </div>
          <button onClick={() => setShowDemo(v => !v)}
            className="p-1.5 rounded-lg text-muted hover:text-primary transition-colors" title="Demo events">
            <Bell size={14} />
          </button>
        </div>

        {/* Demo event triggers */}
        {showDemo && (
          <div className="px-3 py-2 shrink-0 space-y-1.5"
            style={{ borderBottom: "1px solid var(--border)", background: "rgba(245,158,11,0.04)" }}>
            <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wider">Trigger Demo Event</p>
            <div className="flex flex-wrap gap-1">
              {demoEvents.map(e => (
                <button key={e.label} onClick={() => triggerSystemEvent(e.type, e.payload)}
                  className="text-[9px] px-2 py-0.5 rounded-full transition-colors"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div className="px-3 py-2 space-y-2 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg"
              style={{ background: "var(--bg-surface2, rgba(255,255,255,0.05))", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }} />
          </div>
          <div className="flex gap-1">
            {([
              ["all", "All"],
              ["roles", "Roles"],
              ["direct", "DMs"],
              ["system", "System"],
            ] as const).map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className="flex-1 py-1 text-[10px] font-medium rounded-lg transition-all"
                style={{
                  background: filter === f ? "rgba(37,211,102,0.12)" : "transparent",
                  color:      filter === f ? "#25D366" : "var(--text-muted)",
                  border:     `1px solid ${filter === f ? "rgba(37,211,102,0.3)" : "var(--border)"}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {sortedChannels.map(c => (
            <ChannelItem key={c.id} channel={c} active={c.id === activeChannelId}
              onClick={() => setActiveChannel(c.id)} />
          ))}
        </div>
      </div>

      {/* ── Middle: Chat window ── */}
      {!activeChannel ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.10)", border: "2px dashed rgba(37,211,102,0.3)" }}>
            <MessageSquare size={32} style={{ color: "#25D366", opacity: 0.6 }} />
          </div>
          <div>
            <p className="text-base font-semibold text-primary">Select a channel</p>
            <p className="text-xs text-muted mt-1">Choose a chat or the System Updates feed</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 flex items-center gap-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            {activeChannel.type === "system"
              ? <div className="w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{ background: "rgba(245,158,11,0.15)" }}>⚙️</div>
              : activeChannel.type === "role"
              ? <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>#</div>
              : <ChatAvatar name={activeChannel.name} size={32} />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                {activeChannel.name}
                {activeChannel.roleName && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    {activeChannel.roleName}
                  </span>
                )}
              </p>
              <p className="text-[10px] text-muted">
                {activeChannel.type === "system"
                  ? "Auto-generated system events · Read-only"
                  : activeChannel.type === "role"
                  ? `Role channel · ${activeChannel.members.length} members`
                  : activeChannel.type === "group"
                  ? `${activeChannel.members.length} members`
                  : "Direct message"}
              </p>
            </div>
            {activeChannel.type === "system" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                📌 Pinned
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3" style={{ background: "var(--bg-base)" }}>
            {activeMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-xs text-muted">No messages yet</p>
              </div>
            ) : (
              <>
                {activeMessages.map(msg => (
                  <ChatBubble key={msg.id} msg={msg} isMe={msg.senderId === currentUserId} />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input — hidden for system channel */}
          {activeChannel.type !== "system" ? (
            <div className="px-4 py-3 flex items-end gap-2 shrink-0"
              style={{ borderTop: "1px solid var(--border)" }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 px-3 py-2 text-sm rounded-xl resize-none"
                style={{
                  background: "var(--bg-surface2, rgba(255,255,255,0.05))",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  outline: "none",
                  maxHeight: "120px",
                }}
              />
              <button onClick={handleSend} disabled={!input.trim()}
                className="p-2.5 rounded-xl text-white transition-all disabled:opacity-40 shrink-0"
                style={{ background: input.trim() ? "#25D366" : "var(--border)" }}>
                <Send size={15} />
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 shrink-0 flex items-center gap-2"
              style={{ borderTop: "1px solid var(--border)", background: "rgba(245,158,11,0.04)" }}>
              <Lock size={12} className="text-muted" />
              <p className="text-[10px] text-muted">System channel is read-only — events are auto-generated</p>
            </div>
          )}
        </div>
      )}

      {/* ── Right: Channel info ── */}
      {activeChannel && (
        <div className="w-56 shrink-0 flex flex-col" style={{ borderLeft: "1px solid var(--border)" }}>
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Info</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Channel type */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-muted uppercase tracking-wider">Type</p>
              <p className="text-xs text-primary capitalize">{activeChannel.type}</p>
            </div>

            {/* Members */}
            {activeChannel.type !== "system" && (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] text-muted uppercase tracking-wider">Members</p>
                <p className="text-xs text-primary">{activeChannel.members.length} participants</p>
              </div>
            )}

            {/* Message count */}
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-muted uppercase tracking-wider">Messages</p>
              <p className="text-xs text-primary">{(messages[activeChannel.id] ?? []).length}</p>
            </div>

            {/* System channel stats */}
            {activeChannel.type === "system" && (
              <>
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-muted uppercase tracking-wider">Events Today</p>
                  <p className="text-xs text-primary">
                    {(messages[activeChannel.id] ?? []).filter(m =>
                      Date.now() - new Date(m.timestamp).getTime() < 24 * 3600_000
                    ).length}
                  </p>
                </div>
                <div className="pt-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Event Types</p>
                  {["USER_CREATED","PROPERTY_ADDED","FINANCE_ENTRY","ROLE_UPDATED"].map(et => {
                    const count = (messages[activeChannel.id] ?? []).filter(m => m.eventType === et).length;
                    return count > 0 ? (
                      <div key={et} className="flex items-center justify-between py-0.5">
                        <span className="text-[10px] text-muted capitalize">{et.replace(/_/g," ").toLowerCase()}</span>
                        <span className="text-[10px] font-semibold text-primary">{count}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ── Main Communication Page ───────────────────────────────────────────────────

export default function CommunicationPage() {
  const [tab, setTab] = useState<CommTab>("email");
  const { contacts } = useWhatsAppStore();
  const waUnread = contacts.reduce((s, c) => s + c.unread, 0);
  const { history: callHistory } = useCallStore();
  const missedCalls = callHistory.filter(h => h.status === "missed").length;
  const { channels } = useChatStore();
  const chatUnread = channels.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-surface, var(--bg-base))" }}>
        {TABS.map(({ id, label, icon: Icon, color, badgeColor }) => {
          const active = tab === id;
          const badge =
            id === "whatsapp" ? waUnread :
            id === "calls"    ? missedCalls :
            id === "chat"     ? chatUnread : 0;

          const activeColor = "var(--tab-active-color)";

          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="relative flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all duration-150 whitespace-nowrap my-1.5"
              style={{
                color: active ? activeColor : "#9ca3af",
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon
                size={14}
                style={{ color: active ? activeColor : "#9ca3af", transition: "color 0.15s" }}
              />
              {label}
              {active && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: activeColor, borderRadius: "2px" }} />
              )}
              {badge > 0 && (
                <span
                  className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                  style={{ background: badgeColor }}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content — full height */}
      <div className="flex-1 overflow-hidden">
        {tab === "email"    && <MailPage />}
        {tab === "whatsapp" && <WhatsAppTab />}
        {tab === "calls"    && <CallsTab />}
        {tab === "chat"     && <ChatTab />}
      </div>
    </div>
  );
}