// Small reusable pill/tag — e.g. job category tags, status labels
// ("Verified", "Pending"). Renders a <span> with CSS classes that pick up
// the actual colors/sizing from the app's global stylesheet.
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
