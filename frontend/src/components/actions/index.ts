/**
 * Public API for the actions system.
 *
 * Import from here in all modules:
 *   import { RowActions, QuickRowActions, ConfirmDialog } from "../components/actions";
 *   import type { ActionConfig, ActionType } from "../components/actions";
 */

// Components
export { default as RowActions, QuickRowActions } from "./RowActions";
export { default as ConfirmDialog } from "./ConfirmDialog";
export { default as ActionButton } from "./ActionButton";
export { default as ActionDropdown } from "./ActionDropdown";

// Types
export type {
  ActionType,
  ActionVariant,
  ActionConfig,
  RowActionsProps,
  QuickRowActionsProps,
} from "./types";

// Config & icons (for custom extensions)
export { ACTION_DEFAULTS } from "./actionConfig";
export { ACTION_ICONS } from "./actionIcons";
