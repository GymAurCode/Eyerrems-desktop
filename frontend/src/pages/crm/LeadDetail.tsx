import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, UserCheck, Phone, Mail, MapPin, DollarSign, Target,
  Tag, Calendar, Clock, Paperclip, Download, CheckCircle2, Circle,
  ArrowRight, Loader2, Building2, X, ChevronDown, Upload,
} from "lucide-react";
import { crmApi, Lead, TimelineEntry, Activity } from "../../lib/crmApi";
import { attachmentApi, AttachmentItem } from "../../lib/attachmentApi";
import ConfirmDialog from "../../components/actions/ConfirmDialog";
import ActivityTimeline from "../../components/crm/ActivityTimeline";
import { MODULE_COLORS } from "../../config/moduleColors";

const STATUS_FLOW = [
  { key: "new", label: "New", color: "#3b82f6" },
  { key: "contacted", label: "Contacted", color: "#8b5cf6" },
  { key: "site_visit_scheduled", label: "Site Visit", color: "#6366f1" },
  { key: "negotiation", label: "Negotiation", color: "#f59e0b" },
  { key: "converted", label: "Converted", color: "#10b981" },
];

const CRM_ACCENT = MODULE_COLORS.crm.primary;

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6", contacted: "#8b5cf6", interested: "#f59e0b",
  site_visit_scheduled: "#6366f1", site_visit_completed: "#06b4d4",
  negotiation: "#ec4899", converted: "#10b981", lost: "#ef4444",
};

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Confirm stage change
  const [confirmStage, setConfirmStage] = useState<string | null>(null);

  // Convert modal state
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertDone, setConvertDone] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const leadData = await crmApi.getLead(id);
      setLead(leadData);
      const nid = leadData.id;
      try {
        const [tlRes, attRes, actRes] = await Promise.all([
          crmApi.getTimeline("lead", nid, 50),
          attachmentApi.list("lead", nid),
          crmApi.getActivities("lead", nid),
        ]);
        setTimeline(tlRes ?? []);
        setAttachments(attRes.data ?? []);
        setActivities(actRes ?? []);
      } catch {
        console.error("Failed to load lead secondary data");
      }
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const updateLeadStatus = async (status: string) => {
    if (!lead) return;
    await crmApi.updateLead(lead.id, { status });
    void load();
  };

  const handleConvert = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      const client = await crmApi.convertLead(lead.id, {
        lead_id: lead.id,
        name: lead.name,
        phone: lead.phone ?? "",
        email: lead.email,
        notes: lead.notes,
      });
      setClientId(client.client_id);
      setConvertDone(true);
      await load();
    } catch {
      // error handled by UI state
    } finally {
      setConverting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!lead || !e.target.files?.length) return;
    setUploading(true);
    try {
      await Promise.allSettled(
        Array.from(e.target.files!).map((f) =>
          attachmentApi.upload("lead", lead.id, f, "", "PENDING"),
        ),
      );
      const attRes = await attachmentApi.list("lead", lead.id);
      setAttachments(attRes.data ?? []);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Loading / Error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Loading lead…
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm">Lead not found.</p>
        <button onClick={() => navigate("/crm")} className="btn-primary mt-4 px-4 py-2 text-xs">
          Back to CRM
        </button>
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === lead.status);

  return (
    <div className="p-4 md:p-6 space-y-4 animate-slide-up max-w-7xl mx-auto">
      {/* ── Header Bar ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-3 px-5 py-4 rounded-2xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/crm")}
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--hover-bg)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-primary truncate">{lead.name}</h1>
              <StatusPill status={lead.status} />
              {lead.investor_type && <TagPill type={lead.investor_type} />}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="font-mono text-blue-400">{lead.lead_id}</span>
              <span>Created {new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {lead.status !== "converted" && lead.status !== "lost" && (
            <>
              {lead.status !== "lost" && (
                <button
                  onClick={() => updateLeadStatus("lost")}
                  className="px-3 py-2 text-xs rounded-xl transition-colors"
                  style={{ border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  Mark Lost
                </button>
              )}
              <button
                onClick={() => setConvertOpen(true)}
                className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs"
              >
                <UserCheck size={13} />
                Convert to Client
              </button>
            </>
          )}
          {lead.status === "converted" && (
            <span className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl font-semibold"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
              <CheckCircle2 size={13} /> Converted
            </span>
          )}
        </div>
      </div>

      {/* ── Stepper ──────────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4 rounded-2xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between">
          {STATUS_FLOW.map((stage, idx) => {
            const isActive = idx <= currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <div key={stage.key} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => setConfirmStage(stage.key)}
                  disabled={lead.status === "converted" || lead.status === "lost"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 whitespace-nowrap"
                  style={{
                    background: isCurrent ? `${CRM_ACCENT}18` : "transparent",
                    color: isActive ? (isCurrent ? CRM_ACCENT : stage.color) : "var(--text-muted)",
                    border: isCurrent ? `1px solid ${CRM_ACCENT}35` : "1px solid transparent",
                  }}
                >
                  {isActive ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                  {stage.label}
                </button>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className="flex-1 h-px mx-2" style={{ background: idx < currentIdx ? stage.color : "var(--border)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Two-Column Body ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Left Column (60%) ─────────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Profile Info Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <SectionHeader title="Personal Information" />
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                <InfoRow label="Name" value={lead.name} />
                <InfoRow label="Lead ID" value={<span className="font-mono text-blue-400">{lead.lead_id}</span>} />
                <InfoRow label="Phone" value={lead.phone ?? "—"} icon={<Phone size={12} />} />
                <InfoRow label="Email" value={lead.email ?? "—"} icon={<Mail size={12} />} />
                <InfoRow label="Source" value={lead.source ?? "—"} />
                <InfoRow label="Status" value={<StatusPill status={lead.status} />} />
                <InfoRow label="Type" value={lead.investor_type ? <TagPill type={lead.investor_type} /> : "—"} />
                <InfoRow label="Created" value={new Date(lead.created_at).toLocaleDateString()} icon={<Calendar size={12} />} />
              </div>
              {lead.notes && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Notes
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{lead.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Preferences Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <SectionHeader title="Property Requirements" icon={<Target size={13} />} />
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
                <InfoRow label="Budget Min" value={lead.budget_min ? `PKR ${Number(lead.budget_min).toLocaleString()}` : "—"} icon={<DollarSign size={12} />} />
                <InfoRow label="Budget Max" value={lead.budget_max ? `PKR ${Number(lead.budget_max).toLocaleString()}` : "—"} icon={<DollarSign size={12} />} />
                <InfoRow label="Preferred Town" value={lead.preferred_town ?? "—"} icon={<MapPin size={12} />} />
                <InfoRow label="Property Type" value={lead.preferred_property_type ?? "—"} />
                <InfoRow label="Unit Preference" value={lead.unit_preference ?? "—"} />
              </div>
            </div>
          </div>

          {/* Attachments Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <SectionHeader
              title="Attachments"
              icon={<Paperclip size={13} />}
              action={
                <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: "#60a5fa" }}>
                  <Upload size={12} />
                  Upload
                  <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />
                </label>
              }
            />
            <div className="p-5">
              {uploading && (
                <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Loader2 size={12} className="animate-spin" /> Uploading…
                </div>
              )}
              {attachments.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No attachments yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att) => (
                    <a
                      key={att.id}
                      href={attachmentApi.downloadUrl(att.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs transition-colors group"
                      style={{ background: "var(--bg-surface2)", border: "1px solid var(--border-subtle)" }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(59,130,246,0.12)" }}>
                        <Paperclip size={13} style={{ color: "#60a5fa" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium" style={{ color: "var(--text-primary)" }}>{att.document_name}</p>
                        <p style={{ color: "var(--text-muted)" }} className="text-[10px]">
                          {att.file_size_kb.toFixed(1)} KB
                        </p>
                      </div>
                      <Download size={13} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-muted)" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column (40%) ────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline / Activity Feed */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <SectionHeader title="Activity Feed" icon={<Clock size={13} />} />
            <div className="p-0">
              {timeline.length === 0 && activities.length === 0 ? (
                <div className="p-5 text-center">
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
                </div>
              ) : (
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {/* Timeline entries */}
                  {timeline.length > 0 && (
                    <div className="relative mb-4">
                      <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: "var(--border)" }} />
                      <div className="space-y-3">
                        {timeline.map((entry) => {
                          const color = STATUS_COLORS[entry.action] ?? "#94a3b8";
                          return (
                            <div key={entry.id} className="flex gap-3 relative pl-1">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10"
                                style={{ background: `${color}15` }}
                              >
                                <Clock size={10} style={{ color }} />
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-semibold capitalize" style={{ color }}>
                                    {entry.action.replace(/_/g, " ")}
                                  </span>
                                  {entry.performed_by_name && (
                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                      by {entry.performed_by_name}
                                    </span>
                                  )}
                                </div>
                                {entry.description && (
                                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                    {entry.description}
                                  </p>
                                )}
                                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                  {formatTimeAgo(entry.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Activity feed from CRM activities */}
                  {activities.length > 0 && (
                    <ActivityTimeline activities={activities} onRefresh={load} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage Change Confirmation Dialog ────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmStage}
        title="Update Lead Status"
        message={`Move ${lead.name} to ${STATUS_FLOW.find(s => s.key === confirmStage)?.label ?? ""}?`}
        confirmLabel="Yes"
        variant="info"
        onConfirm={async () => {
          if (confirmStage) {
            await updateLeadStatus(confirmStage);
            setConfirmStage(null);
          }
        }}
        onCancel={() => setConfirmStage(null)}
      />

      {/* ── Convert to Client Confirmation Dialog ────────────────────────── */}
      <ConfirmDialog
        open={convertOpen}
        title={convertDone ? "Lead Converted" : "Convert to Client"}
        message={
          convertDone
            ? `Lead "${lead.name}" has been securely migrated into Clients with Tracking ID ${lead.lead_id}.`
            : `This will migrate "${lead.name}" into the Clients table under a unified Tracking ID (TRX). All follow-ups, communications, and attachments will be preserved.`
        }
        confirmLabel={convertDone ? "View Client" : "Convert to Client"}
        variant="success"
        onConfirm={async () => {
          if (convertDone && clientId) {
            navigate(`/crm/clients/${clientId}`);
          } else {
            await handleConvert();
          }
        }}
        onCancel={() => {
          setConvertOpen(false);
        }}
      />
    </div>
  );
}

// ── Helper Sub-Components ────────────────────────────────────────────────────

function SectionHeader({ title, icon, action }: { title: string; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3"
      style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface2)" }}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--text-muted)" }}>{icon}</span>}
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {title}
        </span>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between py-2.5 gap-2"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      <span className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
        {icon} {label}
      </span>
      <span className="text-xs font-medium text-right text-primary flex-1 min-w-0 truncate">{value ?? "—"}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#94a3b8";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: `${color}15`, color }}
    >
      <Circle size={5} fill={color} stroke="none" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TagPill({ type }: { type: string }) {
  const color = type === "investor" ? "#f59e0b" : "#6366f1";
  const bg = type === "investor" ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase"
      style={{ background: bg, color }}
    >
      <Tag size={10} />
      {type.replace(/_/g, " ")}
    </span>
  );
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
