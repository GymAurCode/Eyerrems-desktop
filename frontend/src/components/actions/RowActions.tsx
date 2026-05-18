/**
 * RowActions — the main reusable action component for table rows.
 *
 * Supports four rendering variants:
 *   "icon-buttons"  — compact icon buttons in a row (default)
 *   "icon-only"     — icons only, no labels, ultra-compact
 *   "dropdown"      — single ⋯ button with a floating menu
 *   "text-buttons"  — icon + text label buttons
 *
 * Features:
 *   ✓ Permission-aware (hides actions the user can't perform)
 *   ✓ Conditional visibility per row (visible prop)
 *   ✓ Conditional disabled state per row (disabled prop)
 *   ✓ Delete confirmation modal (built-in, no extra state needed)
 *   ✓ Stops click propagation by default (won't trigger row-click)
 *   ✓ Keyboard accessible (focus ring, Enter/Space)
 *   ✓ Tooltip on hover
 *   ✓ Dark/light mode compatible via CSS variables
 *   ✓ Zero unnecessary re-renders (stable refs)
 *
 * Usage — full config:
 *   <RowActions
 *     row={invoice}
 *     actions={[
 *       { type: "view",   handler: (r) => openDetail(r) },
 *       { type: "edit",   handler: (r) => openEdit(r),   permission: "finance:manage" },
 *       { type: "delete", handler: (r) => deleteInv(r),  permission: "finance:manage" },
 *       { type: "print",  handler: (r) => printInv(r) },
 *     ]}
 *   />
 *
 * Usage — shorthand via <QuickRowActions>:
 *   <QuickRowActions
 *     row={invoice}
 *     onView={openDetail}
 *     onEdit={openEdit}
 *     onDelete={deleteInv}
 *     onPrint={printInv}
 *     editPermission="finance:manage"
 *     deletePermission="finance:manage"
 *   />
 */
import { useState, useCallback } from "react";
import type { ActionConfig, RowActionsProps, QuickRowActionsProps } from "./types";
import { ACTION_DEFAULTS } from "./actionConfig";
import { ACTION_ICONS } from "./actionIcons";
import { useAuthStore } from "../../store/auth";
import ActionButton from "./ActionButton";
import ActionDropdown from "./ActionDropdown";
import ConfirmDialog from "./ConfirmDialog";

// ── Main RowActions component ─────────────────────────────────────────────────

export default function RowActions<T>({
  row,
  actions,
  variant = "icon-buttons",
  compact = false,
  stopPropagation = true,
  className = "",
}: RowActionsProps<T>) {
  const [pendingAction, setPendingAction] = useState<ActionConfig<T> | null>(null);
  const hasPermission = useAuthStore(s => s.hasPermission);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin);

  // Filter actions by permission and visibility
  const visibleActions = actions.filter(action => {
    // Permission check — super-admin and admin always pass
    if (action.permission && !isSuperAdmin && !isAdmin() && !hasPermission(action.permission)) {
      return false;
    }
    // Row-level visibility check
    if (action.visible && !action.visible(row)) return false;
    return true;
  });

  const handleActionClick = useCallback((action: ActionConfig<T>) => {
    const defaults = ACTION_DEFAULTS[action.type];
    if (defaults.requiresConfirm) {
      setPendingAction(action);
    } else {
      action.handler(row);
    }
  }, [row]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    await pendingAction.handler(row);
    setPendingAction(null);
  }, [pendingAction, row]);

  const handleCancel = useCallback(() => {
    setPendingAction(null);
  }, []);

  if (visibleActions.length === 0) return null;

  const wrapperClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  // ── Dropdown variant ──────────────────────────────────────────────────────
  if (variant === "dropdown") {
    return (
      <div
        className={`inline-flex items-center ${className}`}
        onClick={wrapperClick}
      >
        <ActionDropdown
          row={row}
          actions={visibleActions}
          compact={compact}
          onDeleteRequest={setPendingAction}
        />
        {pendingAction && (
          <ConfirmDialog
            open={true}
            title={pendingAction.confirmTitle ?? ACTION_DEFAULTS[pendingAction.type].confirmTitle}
            message={pendingAction.confirmMessage ?? ACTION_DEFAULTS[pendingAction.type].confirmMessage}
            confirmLabel={pendingAction.label ?? ACTION_DEFAULTS[pendingAction.type].label}
            variant={pendingAction.type === "delete" ? "danger" : pendingAction.type === "approve" ? "success" : "warning"}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </div>
    );
  }

  // ── Icon-buttons / icon-only / text-buttons variants ──────────────────────
  const showLabel = variant === "text-buttons";

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      onClick={wrapperClick}
      role="group"
      aria-label="Row actions"
    >
      {visibleActions.map((action, idx) => {
        const defaults = ACTION_DEFAULTS[action.type];
        const label = action.label ?? defaults.label;
        const color = action.color ?? defaults.color;
        const hoverBg = defaults.hoverBg;
        const iconName = defaults.iconName;
        const IconComponent = action.icon ?? ACTION_ICONS[iconName];
        const tooltip = action.tooltip ?? label;
        const isDisabled = action.disabled?.(row) ?? false;

        return (
          <ActionButton
            key={`${action.type}-${idx}`}
            icon={IconComponent}
            tooltip={tooltip}
            label={label}
            showLabel={showLabel}
            onClick={() => !isDisabled && handleActionClick(action)}
            color={color}
            hoverBg={hoverBg}
            disabled={isDisabled}
            compact={compact || variant === "icon-only"}
          />
        );
      })}

      {/* Confirmation dialog — rendered once, controlled by pendingAction */}
      {pendingAction && (
        <ConfirmDialog
          open={true}
          title={pendingAction.confirmTitle ?? ACTION_DEFAULTS[pendingAction.type].confirmTitle}
          message={pendingAction.confirmMessage ?? ACTION_DEFAULTS[pendingAction.type].confirmMessage}
          confirmLabel={pendingAction.label ?? ACTION_DEFAULTS[pendingAction.type].label}
          variant={
            pendingAction.type === "delete"  ? "danger"  :
            pendingAction.type === "approve" ? "success" :
            pendingAction.type === "reject"  ? "warning" :
            pendingAction.type === "archive" ? "warning" : "info"
          }
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

// ── QuickRowActions — shorthand for the most common 4-action pattern ──────────

export function QuickRowActions<T>({
  row,
  onView,
  onEdit,
  onDelete,
  onPrint,
  editPermission,
  deletePermission,
  canDelete,
  variant = "icon-buttons",
  compact = false,
  stopPropagation = true,
  className,
  deleteConfirmMessage,
  hiddenActions = [],
}: QuickRowActionsProps<T>) {
  const hidden = new Set(hiddenActions);
  const actions: ActionConfig<T>[] = [];

  if (onView && !hidden.has("view")) {
    actions.push({ type: "view", handler: onView });
  }
  if (onEdit && !hidden.has("edit")) {
    actions.push({
      type: "edit",
      handler: onEdit,
      permission: editPermission,
    });
  }
  if (onDelete && !hidden.has("delete")) {
    actions.push({
      type: "delete",
      handler: onDelete,
      permission: deletePermission,
      visible: canDelete,
      confirmMessage: deleteConfirmMessage,
    });
  }
  if (onPrint && !hidden.has("print")) {
    actions.push({ type: "print", handler: onPrint });
  }

  return (
    <RowActions
      row={row}
      actions={actions}
      variant={variant}
      compact={compact}
      stopPropagation={stopPropagation}
      className={className}
    />
  );
}
