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
        border: "0.5px solid var(--dialog-cancel-border, #CBD5E1)",
        background: "var(--dialog-cancel-bg, #FFFFFF)",
        color: "var(--dialog-cancel-color, #64748B)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.12s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--dialog-cancel-hover-bg, #F1F5F9)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = "var(--dialog-cancel-bg, #FFFFFF)";
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
  const accentColor = isDanger
    ? "#EF4444"
    : "var(--accent-color, var(--module-primary, #6366F1))";

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
        border: "none",
        background: disabled || loading ? "#94A3B8" : accentColor,
        color: "#FFFFFF",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        transition: "all 0.12s ease",
        minWidth: "90px",
        justifyContent: "center",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.opacity = "0.9";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.opacity = "1";
        }
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: "14px",
              height: "14px",
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "white",
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
