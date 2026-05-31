/**
 * ActionButton — a single icon button used inside RowActions.
 *
 * Renders a compact icon button with:
 * - Tooltip on hover
 * - Keyboard accessibility (Enter/Space triggers handler)
 * - Smooth hover color transition
 * - Optional disabled state
 */
import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  /** Icon component */
  icon: LucideIcon | React.ElementType;
  /** Tooltip text */
  tooltip: string;
  /** Click handler */
  onClick: () => void;
  /** Icon/text color */
  color: string;
  /** Background on hover */
  hoverBg: string;
  /** Whether to show a text label next to the icon */
  showLabel?: boolean;
  /** Label text (used when showLabel=true) */
  label?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Extra CSS class */
  className?: string;
  /** Compact mode — smaller padding */
  compact?: boolean;
}

export default function ActionButton({
  icon: Icon,
  tooltip,
  onClick,
  color,
  hoverBg,
  showLabel = false,
  label,
  disabled = false,
  className = "",
  compact = false,
}: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    setHovered(true);
    // Delay tooltip slightly to avoid flicker on fast mouse movements
    tooltipTimer.current = setTimeout(() => setTooltipVisible(true), 300);
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setTooltipVisible(false);
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
  };

  const pad = compact ? "p-1" : "p-1.5";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        aria-label={tooltip}
        title={tooltip}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className={`
          inline-flex items-center gap-1 rounded-lg transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
          ${pad} ${className}
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
        style={{
          color: disabled ? "var(--text-muted)" : color,
          background: hovered && !disabled ? hoverBg : "transparent",
          // Focus ring color matches the action color
          "--tw-ring-color": color,
        } as React.CSSProperties}
      >
        <Icon size={compact ? 13 : 14} />
        {showLabel && label && (
          <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
        )}
      </button>

      {/* Tooltip */}
      {tooltipVisible && !disabled && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap pointer-events-none z-50"
          style={{
            background: "var(--bg-sidebar)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {tooltip}
          {/* Arrow */}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: "4px solid var(--border)",
            }}
          />
        </div>
      )}
    </div>
  );
}
