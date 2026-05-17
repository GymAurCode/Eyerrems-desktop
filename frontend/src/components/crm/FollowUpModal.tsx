import { FormEvent, useState } from "react";
import { Calendar } from "lucide-react";
import Modal from "../Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (dateTime: string, note: string) => Promise<void>;
};

export default function FollowUpModal({ open, onClose, onSubmit }: Props) {
  const today = new Date();
  const defaultDate = today.toISOString().split("T")[0];
  const defaultTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

  const [date, setDate]   = useState(defaultDate);
  const [time, setTime]   = useState(defaultTime);
  const [note, setNote]   = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  const reset = () => {
    setDate(defaultDate);
    setTime(defaultTime);
    setNote("");
    setErr("");
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time) { setErr("Date and time are required."); return; }
    setSaving(true); setErr("");
    try {
      // Combine date + time into ISO datetime string
      const isoDateTime = `${date}T${time}:00`;
      await onSubmit(isoDateTime, note.trim());
      reset();
      onClose();
    } catch {
      setErr("Failed to schedule follow-up. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Schedule Follow-up">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Calendar size={14} style={{ color: "#f59e0b" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Set a date and time for the follow-up reminder.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: "var(--text-muted)" }}>Date *</label>
            <input
              type="date"
              className="input-dark w-full px-3 py-2 text-sm"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
              style={{ color: "var(--text-muted)" }}>Time *</label>
            <input
              type="time"
              className="input-dark w-full px-3 py-2 text-sm"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: "var(--text-muted)" }}>Note (optional)</label>
          <textarea
            className="input-dark w-full px-3 py-2 text-sm resize-none"
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What should be discussed or done?"
          />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Scheduling…" : "Schedule Follow-up"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
