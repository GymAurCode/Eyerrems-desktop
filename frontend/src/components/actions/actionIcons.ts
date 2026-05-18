/**
 * Centralized icon registry for the actions system.
 * Maps icon name strings → Lucide icon components.
 *
 * Using a registry (rather than dynamic imports) keeps the bundle
 * tree-shakeable and avoids any runtime import() overhead.
 */
import {
  Eye,
  Pencil,
  Trash2,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  Copy,
  Archive,
  RotateCcw,
  Zap,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export const ACTION_ICONS: Record<string, LucideIcon> = {
  Eye,
  Pencil,
  Trash2,
  Printer,
  Download,
  CheckCircle,
  XCircle,
  Copy,
  Archive,
  RotateCcw,
  Zap,
  MoreHorizontal,
};

export type { LucideIcon };
