import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function FormSection({ title, children, className = "" }: FormSectionProps) {
  return (
    <div className={className ? `mb-6 ${className}` : "mb-6"}>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--dialog-section-label, #94A3B8)",
          paddingBottom: "8px",
          borderBottom: "0.5px solid var(--dialog-section-border, #F1F5F9)",
          marginBottom: "12px",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {children}
      </div>
    </div>
  );
}
