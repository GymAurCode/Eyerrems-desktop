/**
 * ConfirmDialog — lightweight confirmation modal for destructive actions.
 *
 * Uses the existing Modal component so it inherits all portal/focus/escape
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
import Modal from "../Modal";

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
  btnBg: string;
  btnHover: string;
}> = {
  danger: {
    icon: AlertTriangle,
    iconColor: "#f87171",
    iconBg: "rgba(239,68,68,0.12)",
    btnBg: "rgba(239,68,68,0.15)",
    btnHover: "rgba(239,68,68,0.25)",
  },
  warning: {
    icon: AlertCircle,
    iconColor: "#f59e0b",
    iconBg: "rgba(245,158,11,0.12)",
    btnBg: "rgba(245,158,11,0.15)",
    btnHover: "rgba(245,158,11,0.25)",
  },
  success: {
    icon: CheckCircle,
    iconColor: "#10b981",
    iconBg: "rgba(16,185,129,0.12)",
    btnBg: "rgba(16,185,129,0.15)",
    btnHover: "rgba(16,185,129,0.25)",
  },
  info: {
    icon: Info,
    iconColor: "#60a5fa",
    iconBg: "rgba(59,130,246,0.12)",
    btnBg: "rgba(59,130,246,0.15)",
    btnHover: "rgba(59,130,246,0.25)",
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
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-ghost px-4 py-2 text-xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
            style={{
              background: cfg.btnBg,
              color: cfg.iconColor,
              border: `1px solid ${cfg.iconColor}30`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = cfg.btnHover)}
            onMouseLeave={e => (e.currentTarget.style.background = cfg.btnBg)}
          >
            {loading ? (
              <span className="inline-block w-3 h-3 border-2 rounded-full animate-spin"
                style={{ borderColor: `${cfg.iconColor}40`, borderTopColor: cfg.iconColor }} />
            ) : (
              <Icon size={12} />
            )}
            {loading ? "Processing…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: cfg.iconBg }}>
          <Icon size={18} style={{ color: cfg.iconColor }} />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-primary mb-1">{title}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
