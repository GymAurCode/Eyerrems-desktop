/**
 * Centralized action type definitions for the reusable RowActions system.
 *
 * Architecture:
 *   ActionConfig      — describes a single action (type, handler, guards)
 *   RowActionsProps   — props for the <RowActions> component
 *   ActionType        — union of all built-in action identifiers
 *   ActionVariant     — visual rendering mode
 */

// ── Built-in action identifiers ───────────────────────────────────────────────
export type ActionType =
  | "view"
  | "edit"
  | "delete"
  | "print"
  | "download"
  | "approve"
  | "reject"
  | "duplicate"
  | "archive"
  | "restore"
  | "custom";

// ── How the action group renders ──────────────────────────────────────────────
export type ActionVariant =
  | "icon-buttons"   // Default: compact icon buttons in a row
  | "icon-only"      // Icons only, no labels (ultra-compact)
  | "dropdown"       // Single "⋯" button that opens a dropdown menu
  | "text-buttons";  // Text labels with icons (wider rows)

// ── Single action configuration ───────────────────────────────────────────────
export interface ActionConfig<T = unknown> {
  /** Built-in type or "custom" for arbitrary actions */
  type: ActionType;

  /** Display label — auto-derived from type if omitted */
  label?: string;

  /** Click handler — receives the row data */
  handler: (row: T) => void | Promise<void>;

  /**
   * Permission string required to show this action.
   * If omitted, action is always visible.
   * Example: "finance:manage", "hr:delete"
   */
  permission?: string;

  /**
   * Conditionally hide this action based on row data.
   * Return true to show, false to hide.
   */
  visible?: (row: T) => boolean;

  /**
   * Conditionally disable this action based on row data.
   * Return true to disable.
   */
  disabled?: (row: T) => boolean;

  /**
   * Tooltip text — auto-derived from label/type if omitted.
   */
  tooltip?: string;

  /**
   * For "delete" type: override the confirmation message.
   */
  confirmMessage?: string;

  /**
   * For "delete" type: override the confirmation title.
   */
  confirmTitle?: string;

  /**
   * Custom icon component (Lucide icon or any React element).
   * Overrides the default icon for this action type.
   */
  icon?: React.ElementType;

  /**
   * Custom color override.
   * Overrides the default color for this action type.
   */
  color?: string;
}

// ── RowActions component props ────────────────────────────────────────────────
export interface RowActionsProps<T = unknown> {
  /** The data row this action group belongs to */
  row: T;

  /** Action configurations */
  actions: ActionConfig<T>[];

  /**
   * Rendering variant.
   * @default "icon-buttons"
   */
  variant?: ActionVariant;

  /**
   * Compact mode — reduces padding/size further.
   * @default false
   */
  compact?: boolean;

  /**
   * Stop click event propagation to prevent row-click handlers from firing.
   * @default true
   */
  stopPropagation?: boolean;

  /** Additional CSS class on the wrapper */
  className?: string;
}

// ── Shorthand props for the most common pattern ───────────────────────────────
export interface QuickRowActionsProps<T = unknown> {
  row: T;
  onView?: (row: T) => void;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onPrint?: (row: T) => void;
  /** Permission required to show edit/delete */
  editPermission?: string;
  deletePermission?: string;
  /** Conditionally hide delete */
  canDelete?: (row: T) => boolean;
  variant?: ActionVariant;
  compact?: boolean;
  stopPropagation?: boolean;
  className?: string;
  /** Custom delete confirmation message */
  deleteConfirmMessage?: string;
}
