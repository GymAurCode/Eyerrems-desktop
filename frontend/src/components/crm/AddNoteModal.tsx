import { FormEvent, useState } from "react";
import { StickyNote } from "lucide-react";
import Modal from "../Modal";

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    <Modal open={open} onClose={handleClose} title="Add Note">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <StickyNote size={14} style={{ color: "#10b981" }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Add a note linked to this lead/client.
          </span>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5"
            style={{ color: "var(--text-muted)" }}>Note *</label>
          <textarea
            className="input-dark w-full px-3 py-2 text-sm resize-none"
            rows={5}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write your note here…"
            autoFocus
          />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={handleClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !note.trim()}
            className="flex-1 btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
