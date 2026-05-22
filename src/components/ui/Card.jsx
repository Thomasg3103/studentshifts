export default function Card({
  children,
  elevated = false,
  padding = "1.25rem",
  radius = "var(--radius-lg)",
  onClick,
  style = {},
  className = "",
  ...rest
}) {
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? e => (e.key === "Enter" || e.key === " ") && onClick(e) : undefined}
      className={`card${elevated ? " card-shadow" : ""} ${className}`.trim()}
      style={{
        padding,
        borderRadius: radius,
        cursor: interactive ? "pointer" : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
