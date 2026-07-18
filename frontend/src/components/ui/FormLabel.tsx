import React from "react";

interface FormLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  htmlFor?: string;
}

const ASTERISK = (
  <span
    style={{
      color: "#EF4444",
      fontSize: "13px",
      lineHeight: 1,
      marginLeft: "2px",
    }}
    aria-hidden="true"
  >
    *
  </span>
);

export function FormLabel({
  children,
  required,
  className = "",
  style,
  htmlFor,
}: FormLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        ...style,
      }}
    >
      {children}
      {required && ASTERISK}
    </label>
  );
}
