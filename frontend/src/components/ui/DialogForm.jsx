export function FormSection({ title, children, spaced = true }) {
  return (
    <div style={{ marginBottom: spaced ? "20px" : 0 }}>
      {title && (
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
      )}
      {children}
    </div>
  );
}

export function FormRow({ children, cols = 2 }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "12px",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}

export function FormField({ label, required, error, hint, children, fullWidth = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
    >
      {label && (
        <label
          style={{
            fontSize: "12px",
            fontWeight: 500,
            color: "var(--dialog-field-label, #475569)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {label}
          {required && (
            <span style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1, marginLeft: "2px" }} aria-hidden="true">*</span>
          )}
        </label>
      )}
      {children}
      {hint && !error && (
        <span style={{ fontSize: "11px", color: "var(--dialog-section-label, #94A3B8)" }}>
          {hint}
        </span>
      )}
      {error && (
        <span style={{ fontSize: "11px", color: "#EF4444" }}>{error}</span>
      )}
    </div>
  );
}

export function DialogDivider() {
  return (
    <div
      style={{
        height: "0.5px",
        background: "var(--dialog-section-border, #F1F5F9)",
        margin: "4px 0 16px",
      }}
    />
  );
}
