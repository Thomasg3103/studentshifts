export default function Input({
  label,
  hint,
  error,
  required = false,
  id,
  style = {},
  inputStyle = {},
  ...inputProps
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", ...style }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}
        >
          {label}
          {required && <span style={{ color: "#f43f5e", marginLeft: "0.2rem" }}>*</span>}
        </label>
      )}
      {hint && !error && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>{hint}</p>
      )}
      <input
        id={inputId}
        style={{
          width: "100%",
          padding: "0.65rem 0.9rem",
          borderRadius: "var(--radius-md)",
          border: error ? "1.5px solid #fca5a5" : "1.5px solid #e2e8f0",
          backgroundColor: error ? "#fff1f2" : "white",
          fontSize: "0.9rem",
          fontFamily: "inherit",
          color: "#1e293b",
          outline: "none",
          boxSizing: "border-box",
          ...inputStyle,
        }}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...inputProps}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" style={{ margin: 0, fontSize: "0.8rem", color: "#e11d48", fontWeight: 500 }}>
          {error}
        </p>
      )}
    </div>
  );
}
