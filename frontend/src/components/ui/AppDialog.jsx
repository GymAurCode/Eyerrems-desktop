import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModuleColor } from "../../contexts/ModuleColorContext";

const DIALOG_MAX_WIDTHS = {
  sm: "480px",
  md: "560px",
  lg: "680px",
  xl: "900px",
  "2xl": "1060px",
};

export default function AppDialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  accentColor,
  accentRgb,
  size = "md",
  children,
  footer,
}) {
  const moduleColor = useModuleColor();
  const maxWidth = DIALOG_MAX_WIDTHS[size] || DIALOG_MAX_WIDTHS.md;
  const accent = accentColor || moduleColor.accent;
  const rgb = accentRgb || moduleColor.rgb;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const [hoveredClose, setHoveredClose] = useState(false);

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--dialog-backdrop, rgba(100,116,139,0.25))",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "20px",
        animation: "overlayIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--dialog-bg, #FFFFFF)",
          border: "0.5px solid var(--dialog-border, #E2E8F0)",
          borderRadius: "16px",
          boxShadow: "var(--dialog-shadow, 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04))",
          overflow: "hidden",
          animation: "dialogIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
          "--accent-color": accent,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            padding: "20px 24px 16px",
            borderBottom: "0.5px solid var(--dialog-header-border, #F1F5F9)",
            background: "var(--dialog-header-bg, #FFFFFF)",
            position: "sticky",
            top: 0,
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            {icon && (
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: `rgba(${rgb}, 0.12)`,
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: accent,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--dialog-title-color, #0F172A)",
                  margin: 0,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--dialog-subtitle-color, #94A3B8)",
                    margin: "2px 0 0",
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
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
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "0.5px solid var(--dialog-close-border, #E2E8F0)",
              background: hoveredClose ? "var(--dialog-close-hover-bg, #F8FAFC)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: hoveredClose ? "var(--dialog-close-hover-color, #0F172A)" : "var(--dialog-close-color, #94A3B8)",
              flexShrink: 0,
              transition: "all 0.12s ease",
              padding: 0,
            }}
            onMouseEnter={() => setHoveredClose(true)}
            onMouseLeave={() => setHoveredClose(false)}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "20px 24px",
            background: "var(--dialog-body-bg, #FFFFFF)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,0,0,0.12) transparent",
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: "14px 24px",
              borderTop: "0.5px solid var(--dialog-footer-border, #F1F5F9)",
              background: "var(--dialog-footer-bg, #FAFBFC)",
              position: "sticky",
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: footer === true ? "flex-end" : "space-between",
              flexShrink: 0,
              gap: "10px",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
