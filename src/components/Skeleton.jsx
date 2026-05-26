/** Primitive shimmer block — use className="skeleton" or this component */
export function Skeleton({ width = "100%", height = "1rem", borderRadius = "0.5rem", style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

/** 3-column grid of job cards — matches StudentDashboard layout */
export function JobCardsSkeleton({ count = 6 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid #e2e8f0", overflow: "hidden", padding: "1rem" }}>
          <Skeleton height="140px" borderRadius="0.75rem" style={{ marginBottom: "0.85rem" }} />
          <Skeleton height="1.1rem" width="70%" style={{ marginBottom: "0.5rem" }} />
          <Skeleton height="0.85rem" width="50%" style={{ marginBottom: "0.75rem" }} />
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <Skeleton height="1.4rem" width="4rem" borderRadius="999px" />
            <Skeleton height="1.4rem" width="4rem" borderRadius="999px" />
          </div>
          <Skeleton height="2.2rem" borderRadius="999px" />
        </div>
      ))}
    </div>
  );
}

/** Single wide job row — matches AppliedJobs / LikedJobs list */
export function JobRowsSkeleton({ count = 5 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid #e2e8f0", padding: "1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "center" }}>
          <Skeleton width="52px" height="52px" borderRadius="0.75rem" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton height="1rem" width="55%" style={{ marginBottom: "0.45rem" }} />
            <Skeleton height="0.8rem" width="35%" />
          </div>
          <Skeleton width="80px" height="1.6rem" borderRadius="999px" />
        </div>
      ))}
    </div>
  );
}

/** Company job postings list */
export function PostingsSkeleton({ count = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid #e2e8f0", padding: "1.1rem 1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
            <Skeleton height="1.1rem" width="45%" />
            <Skeleton height="1.4rem" width="70px" borderRadius="999px" />
          </div>
          <Skeleton height="0.8rem" width="30%" style={{ marginBottom: "0.5rem" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Skeleton height="0.8rem" width="60px" />
            <Skeleton height="0.8rem" width="60px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full page skeleton — replaces the Suspense spinner on lazy-loaded routes */
export function PageSkeleton() {
  return (
    <div style={{ minHeight: "60vh", padding: "2rem 1.5rem", maxWidth: "800px", margin: "0 auto" }}>
      <Skeleton height="2rem" width="40%" style={{ marginBottom: "1rem" }} />
      <Skeleton height="1rem" width="65%" style={{ marginBottom: "0.5rem" }} />
      <Skeleton height="1rem" width="50%" style={{ marginBottom: "2rem" }} />
      <JobRowsSkeleton count={4} />
    </div>
  );
}
