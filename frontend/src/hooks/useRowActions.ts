/**
 * useRowActions — hook for managing row-level action state.
 *
 * Handles the common pattern of:
 *   - Tracking which row is selected for view/edit/delete/print
 *   - Opening/closing dialogs
 *   - Executing async actions with loading state
 *   - Showing toast notifications on success/error
 *
 * Usage:
 *   const { selected, dialogs, actions, loading } = useRowActions({
 *     onDelete: async (row) => { await api.delete(row.id); await reload(); },
 *     onEdit:   (row) => setEditTarget(row),
 *     onView:   (row) => navigate(`/invoices/${row.id}`),
 *     onPrint:  (row) => printRow(row),
 *     successMessage: "Invoice deleted successfully",
 *   });
 *
 *   // In JSX:
 *   <RowActions row={inv} actions={actions(inv)} />
 */
import { useState, useCallback } from "react";
import { useNotifStore } from "../store/notifications";
import type { ActionConfig } from "../components/actions/types";

interface UseRowActionsOptions<T> {
  /** Called when user confirms delete */
  onDelete?: (row: T) => Promise<void> | void;
  /** Called when user clicks edit */
  onEdit?: (row: T) => void;
  /** Called when user clicks view */
  onView?: (row: T) => void;
  /** Called when user clicks print */
  onPrint?: (row: T) => void;
  /** Toast message shown on successful delete */
  successMessage?: string;
  /** Toast message shown on delete error */
  errorMessage?: string;
  /** Permission required for edit actions */
  editPermission?: string;
  /** Permission required for delete actions */
  deletePermission?: string;
  /** Conditionally hide delete per row */
  canDelete?: (row: T) => boolean;
  /** Custom delete confirmation message */
  deleteConfirmMessage?: string;
}

interface UseRowActionsReturn<T> {
  /** Currently selected row (for dialogs) */
  selected: T | null;
  /** Set the selected row */
  setSelected: (row: T | null) => void;
  /** Whether an async action is in progress */
  loading: boolean;
  /** Build the actions array for a given row */
  buildActions: (row: T) => ActionConfig<T>[];
}

export function useRowActions<T>({
  onDelete,
  onEdit,
  onView,
  onPrint,
  successMessage = "Record deleted successfully",
  errorMessage = "Failed to delete record",
  editPermission,
  deletePermission,
  canDelete,
  deleteConfirmMessage,
}: UseRowActionsOptions<T> = {}): UseRowActionsReturn<T> {
  const [selected, setSelected] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const pushToast = useNotifStore(s => s.pushToast);

  const handleDelete = useCallback(async (row: T) => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete(row);
      pushToast({
        title: "Success",
        message: successMessage,
        priority: "medium",
      });
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? errorMessage;
      pushToast({
        title: "Error",
        message: detail,
        priority: "urgent",
      });
      throw e; // Re-throw so ConfirmDialog can handle loading state
    } finally {
      setLoading(false);
    }
  }, [onDelete, successMessage, errorMessage, pushToast]);

  const buildActions = useCallback((row: T): ActionConfig<T>[] => {
    const actions: ActionConfig<T>[] = [];

    if (onView) {
      actions.push({ type: "view", handler: onView });
    }
    if (onEdit) {
      actions.push({
        type: "edit",
        handler: onEdit,
        permission: editPermission,
      });
    }
    if (onDelete) {
      actions.push({
        type: "delete",
        handler: handleDelete,
        permission: deletePermission,
        visible: canDelete,
        confirmMessage: deleteConfirmMessage,
      });
    }
    if (onPrint) {
      actions.push({ type: "print", handler: onPrint });
    }

    return actions;
  }, [onView, onEdit, handleDelete, onPrint, editPermission, deletePermission, canDelete, deleteConfirmMessage]);

  return {
    selected,
    setSelected,
    loading,
    buildActions,
  };
}
