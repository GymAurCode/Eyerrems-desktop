import { FormEvent, useState } from "react";
import { Calendar } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormField, FormRow } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";

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

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!date || !time) { setErr("Date and time are required."); return; }
    setSaving(true); setErr("");
    try {
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
    <AppDialog isOpen={open} onClose={handleClose} title="Schedule Follow-up"
      icon={<Calendar size={18} />}
      subtitle="Set a date and time for the follow-up reminder"
      size="sm"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} />
          <DialogSubmitButton onClick={handleSubmit} label="Schedule Follow-up" loading={saving} />
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormRow cols={2}>
          <FormField label="Date" required>
            <input type="date" className="dialog-input w-full" value={date}
              onChange={e => setDate(e.target.value)} required />
          </FormField>
          <FormField label="Time" required>
            <input type="time" className="dialog-input w-full" value={time}
              onChange={e => setTime(e.target.value)} required />
          </FormField>
        </FormRow>

        <FormField label="Note (optional)">
          <textarea className="dialog-textarea w-full" rows={3} value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What should be discussed or done?" />
        </FormField>

        {err && <p className="text-xs text-red-400">{err}</p>}
      </form>
    </AppDialog>
  );
}
