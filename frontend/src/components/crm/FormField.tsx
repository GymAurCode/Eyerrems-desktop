import { FormLabel } from "../ui/FormLabel";

/** Reusable labeled form field wrapper. */
export function FormField({
  label, required, error, children, span,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  /** "full" = col-span-full, "2" = col-span-2, "3" = col-span-3 */
  span?: "full" | "2" | "3";
}) {
  const spanClass = span === "full" ? "col-span-full" : span === "2" ? "col-span-2" : span === "3" ? "col-span-3" : "";
  return (
    <div className={`flex flex-col gap-1 ${spanClass}`}>
      <FormLabel className="text-xs font-medium" required={required}
        style={{ color: "var(--text-secondary)" }}>
        {label}
      </FormLabel>
      {children}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

export function ReadOnlyField({
  label, value, span,
}: {
  label: string;
  value: string;
  span?: "full" | "2" | "3";
}) {
  const spanClass = span === "full" ? "col-span-full" : span === "2" ? "col-span-2" : span === "3" ? "col-span-3" : "";
  return (
    <div className={`flex flex-col gap-1 ${spanClass}`}>
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </label>
      <div
        className="px-3 py-2.5 rounded-lg text-sm font-mono select-all"
        style={{
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.2)",
          color: "#60a5fa",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Section divider with title for grouping form fields */
export function FormSection({
  title, children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="col-span-full space-y-0">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}>
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>
      {children}
    </div>
  );
}
