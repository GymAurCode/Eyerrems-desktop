import { useEffect, useState } from "react";
import AppDialog from "../ui/AppDialog";
import AttachmentsButton from "../attachments/AttachmentsButton";
import { remindersApi, type Template } from "../../lib/remindersApi";
import type { Reminder } from "../../store/notifications";
type ReminderCreate = Reminder;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  prefill?: Partial<ReminderCreate>;
  editId?: number;
};

const PRIORITIES = ["low", "medium", "high", "urgent"];
const RECURRENCES = ["none", "daily", "weekly", "monthly", "custom"];

export default function ReminderForm({ open, onClose, onSaved, prefill, editId }: Props) {
  const [form, setForm] = useState<ReminderCreate>({
    title: "",
    description: "",
    module_name: prefill?.module_name ?? "",
    record_id: prefill?.record_id ?? null,
    due_time: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
    recurrence: "none",
    priority: "medium",
    pre_alert_minutes: 0,
    assigned_user_ids: [],
    ...prefill,
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    remindersApi.templates()
      .then((r) => {
        const data = Array.isArray(r) ? r : [];
        setTemplates(data);
      })
      .catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (prefill) setForm((f) => ({ ...f, ...prefill }));
  }, [prefill]);

  const applyTemplate = (id: number) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setForm((f) => ({
      ...f,
      template_id: t.id,
      title: t.title_tpl,
      description: t.message_tpl,
      pre_alert_minutes: t.default_pre_alert_minutes,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        due_time: new Date(form.due_time).toISOString(),
      };
      if (editId) {
        await remindersApi.update(editId, payload);
      } else {
        await remindersApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError("Failed to save reminder.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog isOpen={open} onClose={onClose} title={editId ? "Edit Reminder" : "New Reminder"}
      subtitle="Set up task reminders and alerts"
      size="md" accentColor="#F43F5E" accentRgb="244,63,94"
      footer={
        <>
          <button type="button" onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              border: "0.5px solid var(--dialog-cancel-border, #CBD5E1)",
              background: "var(--dialog-cancel-bg, #FFFFFF)",
              color: "var(--dialog-cancel-color, #64748B)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--dialog-cancel-hover-bg, #F1F5F9)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--dialog-cancel-bg, #FFFFFF)"}
          >Cancel</button>
          <button type="submit" form="reminder-form" disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
              border: "none", background: "#F43F5E", color: "#FFFFFF",
              opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer",
            }}
          >{saving ? "Saving..." : editId ? "Update" : "Create"}</button>
        </>
      }
    >
      <form id="reminder-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Template picker */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs text-muted mb-1">Use Template</label>
              <select
                className="input-field w-full text-sm"
                onChange={(e) => applyTemplate(Number(e.target.value))}
                defaultValue=""
              >
                <option value="">— Select template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted mb-1">Title *</label>
            <input
              required
              className="input-field w-full text-sm"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <textarea
              rows={2}
              className="input-field w-full text-sm resize-none"
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Due Date & Time *</label>
              <input
                required
                type="datetime-local"
                className="input-field w-full text-sm"
                value={form.due_time as string}
                onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Pre-alert (mins)</label>
              <input
                type="number"
                min={0}
                className="input-field w-full text-sm"
                value={form.pre_alert_minutes ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, pre_alert_minutes: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Priority</label>
              <select
                className="input-field w-full text-sm"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Recurrence</label>
              <select
                className="input-field w-full text-sm"
                value={form.recurrence}
                onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
              >
                {RECURRENCES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {form.recurrence === "custom" && (
            <div>
              <label className="block text-xs text-muted mb-1">Cron Expression</label>
              <input
                className="input-field w-full text-sm font-mono"
                placeholder="e.g. 0 9 * * 1"
                value={form.cron_expr ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cron_expr: e.target.value }))}
              />
            </div>
          )}

          {(form.module_name || form.record_id) && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-muted mb-1">Module</label>
                <input readOnly className="input-field w-full text-sm opacity-60" value={form.module_name ?? ""} />
              </div>
              <div className="w-24">
                <label className="block text-xs text-muted mb-1">Record ID</label>
                <input readOnly className="input-field w-full text-sm opacity-60" value={form.record_id ?? ""} />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <AttachmentsButton module="reminder" recordId={editId} />
          </div>
        </form>
      </AppDialog>
  );
}
