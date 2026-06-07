import { FormEvent, useState } from "react";
import { StickyNote } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { FormField } from "../ui/DialogForm";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void>;
};

export default function AddNoteModal({ open, onClose, onSubmit }: Props) {
  const [note, setNote]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const reset = () => { setNote(""); setErr(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!note.trim()) { setErr("Note cannot be empty."); return; }
    setSaving(true); setErr("");
    try {
      await onSubmit(note.trim());
      reset();
      onClose();
    } catch {
      setErr("Failed to save note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppDialog isOpen={open} onClose={handleClose} title="Add Note"
      icon={<StickyNote size={18} />}
      subtitle="Add a note linked to this lead/client"
      size="sm"
      footer={
        <>
          <DialogCancelButton onClick={handleClose} />
          <DialogSubmitButton onClick={handleSubmit} label="Save Note" loading={saving} />
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FormField label="Note" required>
          <textarea className="dialog-textarea w-full" rows={5} value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write your note here…" autoFocus />
        </FormField>

        {err && <p className="text-xs text-red-400">{err}</p>}
      </form>
    </AppDialog>
  );
}
