import Button from "./Button";

// Shown in place of a list/grid when there's nothing to display yet (e.g.
// "No jobs found", "No applications yet") — an icon/emoji, a title, optional
// description, and up to two action buttons (e.g. "Post a Job" / "Learn more").
export default function EmptyState({ icon, title, description, action, actionLabel, secondaryAction, secondaryLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "3.5rem 1.5rem", color: "var(--color-text-secondary, #6b7280)" }}>
      {icon && <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", lineHeight: 1 }}>{icon}</div>}
      <p style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", fontWeight: 700, color: "var(--color-text-primary, #1e293b)" }}>{title}</p>
      {description && (
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.55, maxWidth: "320px", marginLeft: "auto", marginRight: "auto" }}>
          {description}
        </p>
      )}
      {action && actionLabel && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <Button onClick={action}>{actionLabel}</Button>
          {secondaryAction && secondaryLabel && (
            <Button variant="ghost" size="sm" onClick={secondaryAction}>{secondaryLabel}</Button>
          )}
        </div>
      )}
    </div>
  );
}
