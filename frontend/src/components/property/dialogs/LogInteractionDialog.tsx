import { useState, useEffect } from "react";
import AppDialog from "../../ui/AppDialog";
import { propApi } from "../../../lib/propertyApi";

const INTERACTION_TYPES = ["call", "email", "meeting", "note"];

interface LogInteractionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: number;
  onSaved?: () => void;
}

export default function LogInteractionDialog({ isOpen, onClose, contactId, onSaved }: LogInteractionDialogProps) {
  const [type, setType] = useState("note");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setType("note");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
    }
  }, [isOpen]);

  const submit = async () => {
    if (!date || !notes) return;
    await propApi.logContactInteraction(contactId, {
      type, notes, interaction_date: date,
    });
    onSaved?.();
    onClose();
  };

  return (
    <AppDialog isOpen={isOpen} onClose={onClose} title="Log Interaction" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <select className="dialog-select" value={type}
            onChange={(e) => setType(e.target.value)}>
            {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Date</label>
          <input className="dialog-input" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Notes</label>
          <textarea className="dialog-textarea" rows={3} value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Interaction details" />
        </div>
        <button className="btn-property w-full py-3 text-sm" type="button" onClick={() => void submit()}>
          Log Interaction
        </button>
      </div>
    </AppDialog>
  );
}
