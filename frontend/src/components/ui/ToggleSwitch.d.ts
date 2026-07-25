interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  color?: string | null;
  size?: "sm" | "md";
}

export default function ToggleSwitch(props: ToggleSwitchProps): JSX.Element;
