/**
 * Default configuration for each built-in action type.
 * Maps ActionType → { label, color, iconName }
 *
 * Colors use the app's CSS variable palette so they work in both
 * dark and light mode without any extra logic.
 */
import type { ActionType } from "./types";

export interface ActionDefaults {
  label: string;
  /** Hex or rgba color for the icon and hover state */
  color: string;
  /** Background color for the button hover state */
  hoverBg: string;
  /** Lucide icon name (resolved in actionIcons.ts) */
  iconName: string;
  /** Whether this action requires a confirmation step */
  requiresConfirm: boolean;
  /** Default confirmation title */
  confirmTitle: string;
  /** Default confirmation message (use {label} as placeholder) */
  confirmMessage: string;
}

export const ACTION_DEFAULTS: Record<ActionType, ActionDefaults> = {
  view: {
    label: "View",
    color: "#60a5fa",
    hoverBg: "rgba(59,130,246,0.15)",
    iconName: "Eye",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  edit: {
    label: "Edit",
    color: "#a78bfa",
    hoverBg: "rgba(139,92,246,0.15)",
    iconName: "Pencil",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  delete: {
    label: "Delete",
    color: "#f87171",
    hoverBg: "rgba(239,68,68,0.15)",
    iconName: "Trash2",
    requiresConfirm: true,
    confirmTitle: "Confirm Delete",
    confirmMessage: "Are you sure you want to delete this record? This action cannot be undone.",
  },
  print: {
    label: "Print",
    color: "#34d399",
    hoverBg: "rgba(16,185,129,0.15)",
    iconName: "Printer",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  download: {
    label: "Download",
    color: "#34d399",
    hoverBg: "rgba(16,185,129,0.15)",
    iconName: "Download",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  approve: {
    label: "Approve",
    color: "#10b981",
    hoverBg: "rgba(16,185,129,0.15)",
    iconName: "CheckCircle",
    requiresConfirm: true,
    confirmTitle: "Confirm Approval",
    confirmMessage: "Are you sure you want to approve this record?",
  },
  reject: {
    label: "Reject",
    color: "#f59e0b",
    hoverBg: "rgba(245,158,11,0.15)",
    iconName: "XCircle",
    requiresConfirm: true,
    confirmTitle: "Confirm Rejection",
    confirmMessage: "Are you sure you want to reject this record?",
  },
  duplicate: {
    label: "Duplicate",
    color: "#94a3b8",
    hoverBg: "rgba(148,163,184,0.15)",
    iconName: "Copy",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  archive: {
    label: "Archive",
    color: "#94a3b8",
    hoverBg: "rgba(148,163,184,0.15)",
    iconName: "Archive",
    requiresConfirm: true,
    confirmTitle: "Confirm Archive",
    confirmMessage: "Are you sure you want to archive this record?",
  },
  restore: {
    label: "Restore",
    color: "#60a5fa",
    hoverBg: "rgba(59,130,246,0.15)",
    iconName: "RotateCcw",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
  custom: {
    label: "Action",
    color: "#94a3b8",
    hoverBg: "rgba(148,163,184,0.15)",
    iconName: "Zap",
    requiresConfirm: false,
    confirmTitle: "",
    confirmMessage: "",
  },
};
