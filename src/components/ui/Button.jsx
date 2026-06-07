const SIZE = {
  sm: { fontSize: "0.8rem",  padding: "0.4rem 0.9rem"  },
  md: { fontSize: "0.9rem",  padding: "0.65rem 1.4rem" },
  lg: { fontSize: "1rem",    padding: "0.8rem 1.75rem"  },
};

const VARIANT = {
  primary: {
    background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
    color: "white",
    border: "none",
    boxShadow: "var(--shadow-brand)",
  },
  secondary: {
    background: "var(--color-bg-elevated, white)",
    color: "var(--color-text-body, #374151)",
    border: "1.5px solid #e2e8f0",
    boxShadow: "none",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-brand)",
    border: "none",
    boxShadow: "none",
  },
  danger: {
    background: "linear-gradient(135deg, #e11d48, #be123c)",
    color: "white",
    border: "none",
    boxShadow: "0 4px 14px rgba(225,29,72,0.3)",
  },
};

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  onClick,
  type = "button",
  children,
  style = {},
  ...rest
}) {
  const v = VARIANT[variant] || VARIANT.primary;
  const s = SIZE[size] || SIZE.md;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.4rem",
        borderRadius: "var(--radius-pill)",
        fontFamily: "inherit",
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.15s",
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...v,
        ...s,
        ...style,
      }}
      {...rest}
    >
      {loading && (
        <span style={{
          width: "14px", height: "14px",
          border: "2px solid rgba(255,255,255,0.4)",
          borderTopColor: variant === "secondary" ? "var(--color-brand)" : "white",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          display: "inline-block",
          flexShrink: 0,
        }} />
      )}
      {children}
    </button>
  );
}
