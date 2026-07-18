import type { ReactElement, ButtonHTMLAttributes, MouseEventHandler } from "react";

interface DialogCancelButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  label?: string;
  disabled?: boolean;
}

interface DialogSubmitButtonProps {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "danger";
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
}

export function DialogCancelButton(props: DialogCancelButtonProps): ReactElement;
export function DialogSubmitButton(props: DialogSubmitButtonProps): ReactElement;
