export function DialogCancelButton({ onClick, label = "Cancel", disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "8px 18px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 500,
        border: "1px solid var(--btn-glass-secondary-border, rgba(246,206,58,0.2))",
        background: "var(--btn-glass-secondary-bg, rgba(246,206,58,0.06))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "var(--btn-glass-secondary-text, #D4A017)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--btn-glass-secondary-hover-bg, rgba(246,206,58,0.12))";
          e.currentTarget.style.borderColor = "var(--btn-glass-secondary-hover-border, rgba(246,206,58,0.4))";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--btn-glass-secondary-bg, rgba(246,206,58,0.06))";
          e.currentTarget.style.borderColor = "var(--btn-glass-secondary-border, rgba(246,206,58,0.2))";
        }
      }}
    >
      {label}
    </button>
  );
}

export function DialogSubmitButton({
  onClick,
  label = "Save",
  loading,
  disabled,
  variant = "primary",
  type = "button",
}) {
  const isDanger = variant === "danger";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: "8px 20px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 500,
        border: isDanger
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid var(--btn-glass-primary-border, rgba(246,206,58,0.25))",
        background: disabled || loading
          ? "rgba(148,163,184,0.1)"
          : isDanger
            ? "rgba(239,68,68,0.12)"
            : "var(--btn-glass-primary-bg, rgba(246,206,58,0.12))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: disabled || loading
          ? "#94A3B8"
          : isDanger
            ? "#f87171"
            : "var(--btn-glass-primary-text, #D4A017)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        transition: "all 0.15s ease",
        minWidth: "90px",
        justifyContent: "center",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = isDanger
            ? "rgba(239,68,68,0.2)"
            : "var(--btn-glass-primary-hover-bg, rgba(246,206,58,0.2))";
          e.currentTarget.style.borderColor = isDanger
            ? "rgba(239,68,68,0.5)"
            : "var(--btn-glass-primary-hover-border, rgba(246,206,58,0.5))";
          if (!isDanger) {
            e.currentTarget.style.boxShadow = "0 0 24px rgba(246,206,58,0.1)";
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = isDanger
            ? "rgba(239,68,68,0.12)"
            : "var(--btn-glass-primary-bg, rgba(246,206,58,0.12))";
          e.currentTarget.style.borderColor = isDanger
            ? "rgba(239,68,68,0.25)"
            : "var(--btn-glass-primary-border, rgba(246,206,58,0.25))";
          if (!isDanger) {
            e.currentTarget.style.boxShadow = "none";
          }
        }
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: "14px",
              height: "14px",
              border: "2px solid rgba(212,160,23,0.2)",
              borderTopColor: "#D4A017",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              flexShrink: 0,
            }}
          />
          Saving...
        </>
      ) : (
        label
      )}
    </button>
  );
}
