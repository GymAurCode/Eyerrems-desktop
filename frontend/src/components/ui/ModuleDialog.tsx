import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  sm: "max-w-[480px]",
  md: "max-w-[520px]",
  lg: "max-w-[680px]",
  xl: "max-w-[900px]",
};

export default function ModuleDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
}: ModuleDialogProps) {

  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        onClick={(e) => e.preventDefault()}
        style={{ background: "rgba(0,0,0,0.6)" }}
      />

      <div
        className={`relative flex flex-col w-full ${SIZE_MAP[size]} max-h-[85vh] animate-modal-in`}
        style={{
          background: "var(--bg-surface, #1E2128)",
          border: "1px solid var(--border, #2E3340)",
          borderRadius: "16px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 shrink-0 rounded-t-[16px]"
          style={{
            borderBottom: "1px solid var(--border, #2E3340)",
            background: "var(--bg-surface, #1E2128)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "var(--property-accent-soft, rgba(52,211,153,0.12))" }}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate" style={{ color: "var(--text-primary, #E8ECF0)" }}>
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm mt-0.5 truncate" style={{ color: "var(--text-muted, #6B7280)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-colors"
            style={{ color: "var(--text-muted, #6B7280)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, #2C3140)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border, #2E3340) transparent",
          }}
        >
          {children}
        </div>

        {/* ── Footer ── */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 rounded-b-[16px]"
            style={{
              borderTop: "1px solid var(--border, #2E3340)",
              background: "var(--bg-surface, #1E2128)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
