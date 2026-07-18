import { useState } from "react";
import { Bell } from "lucide-react";
import ReminderForm from "./ReminderForm";

type Props = {
  moduleName?: string;
  recordId?: number;
  label?: string;
  onSaved?: () => void;
};

export default function AddReminderButton({ label = "Add Reminder", onSaved }: Props) {
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
      />
    </>
  );
}
