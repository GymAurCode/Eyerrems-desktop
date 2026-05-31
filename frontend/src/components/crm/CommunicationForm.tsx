import { FormEvent, useEffect, useId, useState } from "react";
import Modal from "../Modal";
import { FormField } from "./FormField";
import { crmApi, Client, Communication } from "../../lib/crmApi";

const COMM_TYPES: Record<string, { label: string; color: string; icon: string }> = {
  call:    { label: "Call",    color: "#3b82f6", icon: "📞" },
  sms:     { label: "SMS",     color: "#8b5cf6", icon: "💬" },
  email:   { label: "Email",   color: "#f59e0b", icon: "✉️" },
  meeting: { label: "Meeting", color: "#10b981", icon: "🤝" },
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (c: Communication) => void;
  preselectedClient?: Client | null;
};

export default function CommunicationForm({ open, onClose, onSaved, preselectedClient }: Props) {
  const formId = useId();

  const [clients, setClients]       = useState<Client[]>([]);
  const [clientId, setClientId]     = useState<number | "">("");
  const [trackingId, setTrackingId] = useState("");
  const [type, setType]             = useState("call");
  const [subject, setSubject]       = useState("");
  const [message, setMessage]       = useState("");
  const [commDate, setCommDate]     = useState(new Date().toISOString().split("T")[0]);
  const [errors, setErrors]         = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!open) return;
    crmApi.getClients().then((res) => {
      setClients(res);
      if (preselectedClient) {
        setClientId(preselectedClient.id);
        setTrackingId(preselectedClient.tracking_id);
      } else {
        setClientId(""); setTrackingId("");
      }
    }).catch(() => {
      setClients([]);
    });
    setType("call"); setSubject(""); setMessage("");
    setCommDate(new Date().toISOString().split("T")[0]);
    setErrors({});
  }, [open, preselectedClient]);

  const onClientChange = (cid: number | "") => {
    setClientId(cid);
    setTrackingId(cid ? (clients.find((x) => x.id === cid)?.tracking_id ?? "") : "");
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!clientId)       e.client  = "Required";
    if (!subject.trim()) e.subject = "Required";
    if (!message.trim()) e.message = "Required";
    if (!commDate)       e.date    = "Required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await crmApi.createCommunication({
        tracking_id: trackingId,
        type: type as Communication["type"], subject: subject.trim(),
        description: message.trim(), comm_date: commDate,
      } as any);
      onSaved(res);
      onClose();
    } catch (err: any) {
      setErrors({ form: err?.response?.data?.detail ?? "Save failed" });
    } finally { setSaving(false); }
  };

  const meta = COMM_TYPES[type] ?? COMM_TYPES.call;

  const footer = (
    <>
      {/* Type indicator on the left */}
      <span className="text-xs mr-auto flex items-center gap-1.5"
        style={{ color: meta.color }}>
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: meta.color }} />
        Logging as {meta.label}
      </span>
      <button type="button" onClick={onClose}
        className="px-5 py-2 text-sm rounded-lg transition-colors"
        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
        Cancel
      </button>
      <button type="submit" form={formId} disabled={saving}
        className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
        {saving ? "Saving…" : "Log Communication"}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Log Communication" size="lg" footer={footer}>
      <form id={formId} onSubmit={submit}>
        {errors.form && (
          <div className="mb-3 px-3 py-2 rounded-lg text-xs text-red-400"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            {errors.form}
          </div>
        )}

        {/* Type chip selector — full width, prominent */}
        <div className="mb-4">
          <label className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
            Communication Type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(COMM_TYPES).map(([key, m]) => (
              <button key={key} type="button" onClick={() => setType(key)}
                className="py-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center gap-1"
                style={{
                  background: type === key ? `${m.color}18` : "var(--bg-base)",
                  border: `1.5px solid ${type === key ? m.color : "var(--border)"}`,
                  color: type === key ? m.color : "var(--text-muted)",
                }}>
                <span className="text-base leading-none">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2-column grid */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">

          {/* Client row */}
          <FormField label="Client" required error={errors.client}>
            <select className="select-dark w-full px-3 py-2 text-sm" value={clientId}
              onChange={(e) => onClientChange(e.target.value ? Number(e.target.value) : "")}
              disabled={!!preselectedClient}>
              <option value="">— Select Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.client_id})</option>
              ))}
            </select>
          </FormField>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Tracking ID
            </label>
            <div className="px-3 py-2 rounded-lg text-sm font-mono"
              style={{
                background: trackingId ? "rgba(59,130,246,0.06)" : "var(--bg-base)",
                border: `1px solid ${trackingId ? "rgba(59,130,246,0.2)" : "var(--border)"}`,
                color: trackingId ? "#60a5fa" : "var(--text-muted)",
                minHeight: "36px", display: "flex", alignItems: "center",
              }}>
              {trackingId || "Auto-filled on select"}
            </div>
          </div>

          <FormField label="Subject" required error={errors.subject}>
            <input className="input-dark w-full px-3 py-2 text-sm" value={subject}
              onChange={(e) => setSubject(e.target.value)} placeholder="Communication subject" />
          </FormField>

          <FormField label="Date" required error={errors.date}>
            <input className="input-dark w-full px-3 py-2 text-sm" type="date"
              value={commDate} onChange={(e) => setCommDate(e.target.value)} />
          </FormField>

          <FormField label="Message" required error={errors.message} span="full">
            <textarea className="input-dark w-full px-3 py-2 text-sm resize-none" rows={4}
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Detailed message, notes, or outcome…" />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
