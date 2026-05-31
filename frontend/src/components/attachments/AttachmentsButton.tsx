import { useState } from "react";
import { Paperclip } from "lucide-react";
import FileUploadDialog from "./FileUploadDialog";

interface Props {
  module: string;
  recordId?: string | number | null;
  disabled?: boolean;
}

export default function AttachmentsButton({ module, recordId, disabled }: Props) {
  const [open, setOpen] = useState(false);

  if (!recordId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
        style={{
          background: "var(--bg-surface-hover, #2a2a3a)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        <Paperclip size={14} />
        Attachments
      </button>
      <FileUploadDialog
        open={open}
        onClose={() => setOpen(false)}
        module={module}
        recordId={recordId}
      />
    </>
  );
}
