import { useState } from "react";
import { Bell } from "lucide-react";
import ReminderForm from "./ReminderForm";

type Props = {
  moduleName: string;
  recordId: number;
  label?: string;
  onSaved?: () => void;
};

/**
 * Drop this button into any module detail page.
 * Pre-fills module_name + record_id automatically.
 */
export default function AddReminderButton({ moduleName, recordId, label = "Add Reminder", onSaved }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-theme
          text-secondary hover:text-primary hover:bg-hover transition-all duration-150"
      >
        <Bell size={13} />
        {label}
      </button>

      <ReminderForm
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => { onSaved?.(); }}
        prefill={{ module_name: moduleName, record_id: recordId }}
      />
    </>
  );
}
