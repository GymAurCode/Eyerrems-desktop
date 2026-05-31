/**
 * QuickActionsPanel — production-grade Quick Actions tab for Lead/Client detail views.
 *
 * Features:
 *  - Call: triggers tel: link + logs activity
 *  - WhatsApp: opens wa.me with pre-filled message + logs activity
 *  - Schedule Follow-up: modal with date/time/note picker + backend persistence
 *  - Add Note: modal with text area + backend persistence
 *  - Send Email: opens mailto: with pre-filled subject/body + logs activity
 *  - Activity Timeline: chronological log with filter chips + status updates
 *  - Last Contacted: auto-updated on any action
 */
import { useEffect, useState } from "react";
import {
  Phone, MessageCircle, Calendar, StickyNote, Mail,
  RefreshCw, Clock,
} from "lucide-react";
import { Activity, ActivityType, crmApi } from "../../lib/crmApi";
import ActivityTimeline from "./ActivityTimeline";
import FollowUpModal from "./FollowUpModal";
import AddNoteModal from "./AddNoteModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type EntityInfo = {
  entityType: "lead" | "client";
  entityId: number;
  name: string;
  phone: string | null;
  email: string | null;
};

type Props = EntityInfo;

// ── Action Button ─────────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  color,
  bg,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: bg, border: `1px solid ${color}30`, minWidth: 90 }}
      title={disabled ? "No contact info available" : label}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}20` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </button>
  );
}

// ── Last Contacted Badge ──────────────────────────────────────────────────────

function LastContacted({ activities }: { activities: Activity[] }) {
  const contactTypes: ActivityType[] = ["call", "whatsapp", "email"];
  const last = activities.find(a => contactTypes.includes(a.type));
  if (!last) return null;

  const d = new Date(last.created_at);
  const label = d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const typeEmoji: Record<string, string> = {
    call: "📞", whatsapp: "💬", email: "✉️",
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
      style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}
    >
      <Clock size={12} />
      <span>Last contacted: {typeEmoji[last.type] ?? ""} {label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function QuickActionsPanel({
  entityType, entityId, name, phone, email,
}: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading]       = useState(true);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteOpen, setNoteOpen]         = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getActivities(entityType, entityId);
      setActivities(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [entityType, entityId]);

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleCall = async () => {
    if (!phone) return;
    // Trigger native dialer
    window.location.href = `tel:${phone}`;
    // Log activity
    await crmApi.createActivity({
      entity_type: entityType,
      entity_id: entityId,
      type: "call",
      message: `Called ${name} at ${phone}`,
      status: "initiated",
    });
    void load();
  };

  const handleWhatsApp = async () => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const prefilledMsg = encodeURIComponent(
      `Hi ${name}, I'm reaching out regarding your inquiry. How can I assist you today?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${prefilledMsg}`, "_blank");
    await crmApi.createActivity({
      entity_type: entityType,
      entity_id: entityId,
      type: "whatsapp",
      message: `WhatsApp message sent to ${name} at ${phone}`,
      status: "initiated",
    });
    void load();
  };

  const handleEmail = async () => {
    if (!email) return;
    const subject = encodeURIComponent(`Following up — ${name}`);
    const body = encodeURIComponent(
      `Dear ${name},\n\nI hope this message finds you well. I wanted to follow up regarding your inquiry.\n\nPlease feel free to reach out if you have any questions.\n\nBest regards`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    await crmApi.createActivity({
      entity_type: entityType,
      entity_id: entityId,
      type: "email",
      message: `Email initiated to ${name} at ${email}`,
      status: "initiated",
    });
    void load();
  };

  const handleFollowUpSubmit = async (dateTime: string, note: string) => {
    await crmApi.createActivity({
      entity_type: entityType,
      entity_id: entityId,
      type: "followup",
      message: note || `Follow-up scheduled with ${name}`,
      scheduled_at: dateTime,
      status: "pending",
    });
    void load();
  };

  const handleNoteSubmit = async (note: string) => {
    await crmApi.createActivity({
      entity_type: entityType,
      entity_id: entityId,
      type: "note",
      message: note,
      status: "done",
    });
    void load();
  };

  // ── Pending follow-ups count ─────────────────────────────────────────────

  const pendingFollowUps = activities.filter(
    a => a.type === "followup" && a.status === "pending"
  );

  return (
    <div className="space-y-6">
      {/* ── Action Buttons ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
          style={{ color: "var(--text-muted)" }}>Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            icon={Phone}
            label="Call"
            color="#3b82f6"
            bg="rgba(59,130,246,0.06)"
            onClick={handleCall}
            disabled={!phone}
          />
          <ActionButton
            icon={MessageCircle}
            label="WhatsApp"
            color="#25d366"
            bg="rgba(37,211,102,0.06)"
            onClick={handleWhatsApp}
            disabled={!phone}
          />
          <ActionButton
            icon={Calendar}
            label="Follow-up"
            color="#f59e0b"
            bg="rgba(245,158,11,0.06)"
            onClick={() => setFollowUpOpen(true)}
          />
          <ActionButton
            icon={StickyNote}
            label="Add Note"
            color="#10b981"
            bg="rgba(16,185,129,0.06)"
            onClick={() => setNoteOpen(true)}
          />
          <ActionButton
            icon={Mail}
            label="Email"
            color="#8b5cf6"
            bg="rgba(139,92,246,0.06)"
            onClick={handleEmail}
            disabled={!email}
          />
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <LastContacted activities={activities} />
        {pendingFollowUps.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}
          >
            <Calendar size={12} />
            <span>{pendingFollowUps.length} pending follow-up{pendingFollowUps.length > 1 ? "s" : ""}</span>
          </div>
        )}
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Activity Timeline ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4"
          style={{ color: "var(--text-muted)" }}>Activity Timeline</p>
        {loading ? (
          <p className="text-xs py-6 text-center" style={{ color: "var(--text-muted)" }}>
            Loading activities…
          </p>
        ) : (
          <ActivityTimeline activities={activities} onRefresh={load} />
        )}
      </div>

      {/* ── Modals ── */}
      <FollowUpModal
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        onSubmit={handleFollowUpSubmit}
      />
      <AddNoteModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        onSubmit={handleNoteSubmit}
      />
    </div>
  );
}
