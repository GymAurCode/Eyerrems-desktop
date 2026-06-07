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
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const DIALOG_SIZES: Record<string, { width: string; height: string }> = {
  sm:   { width: "420px",  height: "320px"  },
  md:   { width: "560px",  height: "480px"  },
  lg:   { width: "720px",  height: "620px"  },
  xl:   { width: "900px",  height: "700px"  },
  "2xl":{ width: "1060px", height: "780px"  },
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
  const dims = DIALOG_SIZES[size] || DIALOG_SIZES.md;

  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, [isOpen]);

  if (!isOpen) return null;

  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--property-accent")
    .trim() || "#34D399";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "20px",
        animation: "overlayIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: dims.width,
          height: dims.height,
          maxWidth: "95vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--dialog-bg, #1C1C1E)",
          border: "1px solid var(--dialog-border, #2D2D2F)",
          borderRadius: "16px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
          animation: "dialogIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          position: "relative",
        }}
      >
        {/* Top color accent line */}
        <div style={{
          height: "3px",
          width: "100%",
          background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)`,
          flexShrink: 0,
        }} />

        {/* Header */}
        <div
          style={{
            padding: "18px 24px 16px",
            borderBottom: "1px solid var(--dialog-border, #2D2D2F)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
            background: "var(--dialog-header-bg, #161618)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            {icon && (
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: `${accentColor}18`,
                  border: `1px solid ${accentColor}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accentColor,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text-primary, #E8ECF0)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary, #9BA3AF)",
                    margin: "2px 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "1px solid var(--dialog-border, #2D2D2F)",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary, #9BA3AF)",
              flexShrink: 0,
              marginLeft: "12px",
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#FEE2E2";
              e.currentTarget.style.borderColor = "#FECACA";
              e.currentTarget.style.color = "#DC2626";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--dialog-border, #2D2D2F)";
              e.currentTarget.style.color = "var(--text-secondary, #9BA3AF)";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "20px 24px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.1) transparent",
            }}
          >
            {children}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--dialog-border, #2D2D2F)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "10px",
              flexShrink: 0,
              background: "var(--dialog-header-bg, #161618)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
