import type { ReactNode, ReactElement } from "react";

export interface AppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactElement;
  accentColor?: string;
  accentRgb?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  children?: ReactNode;
  footer?: ReactNode;
}

export default function AppDialog(props: AppDialogProps): ReactElement;
