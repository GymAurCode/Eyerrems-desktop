/**
 * ConfirmDialog — lightweight confirmation modal for destructive actions.
 *
 * Uses the existing Dialog component so it inherits all portal/focus/escape
 * behaviour already built into the app's modal system.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     title="Delete Invoice"
 *     message="This cannot be undone."
 *     confirmLabel="Delete"
 *     variant="danger"
 *     onConfirm={handleDelete}
 *     onCancel={() => setOpen(false)}
 *   />
 */
import { useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle, Info } from "lucide-react";
import AppDialog from "../ui/AppDialog";
import { DialogCancelButton, DialogSubmitButton } from "../ui/DialogButtons";

type Variant = "danger" | "warning" | "success" | "info";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Visual variant that controls icon and button color. */
  variant?: Variant;
  /** Called when the user confirms. Can be async. */
  onConfirm: () => void | Promise<void>;
  /** Called when the user cancels or closes. */
  onCancel: () => void;
}

const VARIANT_CONFIG: Record<Variant, {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  btnVariant: "primary" | "danger";
}> = {
  danger: {
    icon: AlertTriangle,
    iconColor: "#f87171",
    iconBg: "rgba(239,68,68,0.12)",
    btnVariant: "danger",
  },
  warning: {
    icon: AlertCircle,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    btnVariant: "primary",
  },
  success: {
    icon: CheckCircle,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    btnVariant: "primary",
  },
  info: {
    icon: Info,
    iconColor: "#60a5fa",
    iconBg: "rgba(59,130,246,0.12)",
    btnVariant: "primary",
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);
  const cfg = VARIANT_CONFIG[variant];
  const Icon = cfg.icon;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppDialog
      isOpen={open}
      title={title}
      onClose={onCancel}
      size="sm"
      icon={<Icon size={18} />}
      footer={
        <>
          <DialogCancelButton onClick={onCancel} label={cancelLabel} disabled={loading} />
          <DialogSubmitButton onClick={handleConfirm} label={confirmLabel}
            loading={loading} variant={cfg.btnVariant} />
        </>
      }
    >
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>
    </AppDialog>
  );
}
