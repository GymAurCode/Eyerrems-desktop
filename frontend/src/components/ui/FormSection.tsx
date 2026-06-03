import type { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function FormSection({ title, children, className = "" }: FormSectionProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-xs font-semibold uppercase tracking-widest shrink-0"
          style={{ color: "var(--text-muted, #6B7280)" }}
        >
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border-subtle, #252932)" }} />
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
