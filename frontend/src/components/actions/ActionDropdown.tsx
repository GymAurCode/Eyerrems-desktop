/**
 * ActionDropdown — a "⋯" button that opens a floating dropdown menu.
 *
 * Used when:
 * - variant="dropdown" is set on RowActions
 * - Screen is narrow and icon-buttons would overflow
 *
 * The dropdown closes on:
 * - Clicking any action
 * - Clicking outside
 * - Pressing Escape
 */
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { ActionConfig } from "./types";
import { ACTION_DEFAULTS } from "./actionConfig";
import { ACTION_ICONS } from "./actionIcons";
import { useAuthStore } from "../../store/auth";

interface ActionDropdownProps<T> {
  row: T;
  actions: ActionConfig<T>[];
  compact?: boolean;
  onDeleteRequest: (action: ActionConfig<T>) => void;
}

export default function ActionDropdown<T>({
  row,
  actions,
  compact = false,
  onDeleteRequest,
}: ActionDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Filter visible actions
  const visibleActions = actions.filter(action => {
    if (action.permission && !isSuperAdmin && !isAdmin() && !hasPermission(action.permission)) {
      return false;
    }
    if (action.visible && !action.visible(row)) return false;
    return true;
  });

  if (visibleActions.length === 0) return null;

  const handleAction = (action: ActionConfig<T>) => {
    setOpen(false);
    const defaults = ACTION_DEFAULTS[action.type];
    if (defaults.requiresConfirm) {
      onDeleteRequest(action);
    } else {
      action.handler(row);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className={`
          inline-flex items-center justify-center rounded-lg transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50
          ${compact ? "w-6 h-6" : "w-7 h-7"}
        `}
        style={{
          color: "var(--text-muted)",
          background: open ? "var(--hover-bg)" : "transparent",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg)")}
        onMouseLeave={e => (e.currentTarget.style.background = open ? "var(--hover-bg)" : "transparent")}
      >
        <MoreHorizontal size={compact ? 14 : 15} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: "modalFadeIn 0.12s ease-out both",
          }}
          role="menu"
        >
          {visibleActions.map((action, idx) => {
            const defaults = ACTION_DEFAULTS[action.type];
            const label = action.label ?? defaults.label;
            const color = action.color ?? defaults.color;
            const hoverBg = defaults.hoverBg;
            const iconName = defaults.iconName;
            const IconComponent = action.icon ?? ACTION_ICONS[iconName];
            const isDisabled = action.disabled?.(row) ?? false;

            return (
              <button
                key={`${action.type}-${idx}`}
                type="button"
                role="menuitem"
                disabled={isDisabled}
                onClick={() => !isDisabled && handleAction(action)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors text-left"
                style={{
                  color: isDisabled ? "var(--text-muted)" : color,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.5 : 1,
                  borderBottom: idx < visibleActions.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
                onMouseEnter={e => {
                  if (!isDisabled) (e.currentTarget as HTMLElement).style.background = hoverBg;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {IconComponent && <IconComponent size={13} />}
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
