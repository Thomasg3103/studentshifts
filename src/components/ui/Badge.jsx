// variant matches existing CSS classes: brand, green, yellow, red, blue, gray
// size: sm | md | lg
export default function Badge({ variant = "gray", size = "md", children, style = {} }) {
  const sizeClass = size === "sm" ? " badge-sm" : size === "lg" ? " badge-lg" : "";
  return (
    <span
      className={`badge badge-${variant}${sizeClass}`}
      style={style}
    >
      {children}
    </span>
  );
}
