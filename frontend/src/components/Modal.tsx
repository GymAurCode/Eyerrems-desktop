/**
 * Modal — Portal-based dialog component.
 *
 * ROOT CAUSE FIX for input focus loss:
 * The previous implementation used `if (!open) return null`, which caused the
 * entire modal DOM subtree (including focused <input> elements) to be UNMOUNTED
 * on every state change that toggled `open`. React would then remount it fresh,
 * destroying the focused element and resetting cursor position.
 *
 * FIX: The modal is ALWAYS mounted in the DOM. Visibility is controlled via CSS
 * (pointer-events, opacity, visibility) rather than conditional rendering.
 * This keeps all <input> elements alive in the DOM so focus is never lost
 * between keystrokes.
 *
 * The `useEffect` dependency on `onClose` is also removed — it only needs to
 * run when `open` changes, not when the parent re-renders with a new callback
 * reference (which happened on every keystroke due to inline arrow functions).
 */
import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** "md" = 512px, "lg" = 800px, "xl" = 1000px, "2xl" = 1200px */
  size?: "md" | "lg" | "xl" | "2xl";
};

const MAX_W = { md: "512px", lg: "800px", xl: "1000px", "2xl": "1200px" };

// Single portal root that inherits the app-shell theme variables.
function getPortalRoot(): HTMLElement {
  let el = document.getElementById("modal-portal-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "modal-portal-root";
    el.className = "app-shell";
    document.body.appendChild(el);
  }
  return el;
}

export default function Modal({ open, title, onClose, children, footer, size = "md" }: Props) {
  // Use a ref for onClose so the keydown effect never needs to re-register
  // when the parent passes a new inline arrow function on each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Escape key handler — reads from ref so it's always current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // Only re-run when `open` changes — NOT when onClose reference changes.
    // This prevents the effect from tearing down/re-adding the listener on
    // every keystroke (which happened when onClose was an inline arrow fn).
  }, [open]);

  // Always render into the portal — never return null.
  // Visibility is controlled by CSS so the DOM (and focused inputs) stay alive.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        // CSS-only show/hide — no unmounting, no focus loss
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        visibility: open ? "visible" : "hidden",
        animation: open ? "modalFadeIn 0.18s ease-out both" : "none",
      }}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        className="relative w-full max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          maxWidth: `min(${MAX_W[size]}, 90vw)`,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
          animation: open ? "modalSlideUp 0.2s ease-out both" : "none",
          // Prevent clicks inside the dialog from closing it via the overlay
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — scrollable, header/footer are fixed */}
        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {/* Optional footer */}
        {footer && (
          <div
            className="px-5 py-3 flex items-center justify-end gap-2 shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    getPortalRoot()
  );
}
