/** Primitive shimmer block — use className="skeleton" or this component */
export function Skeleton({ width = "100%", height = "1rem", borderRadius = "0.5rem", style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

/** Job card matching the horizontal layout (110px photo left, content right) */
export function JobCardsSkeleton({ count = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid #e2e8f0", overflow: "hidden", display: "flex", minHeight: "110px" }}>
          {/* Photo placeholder */}
          <div className="skeleton" style={{ width: "110px", flexShrink: 0, borderRadius: 0, minHeight: "110px", alignSelf: "stretch" }} />
          {/* Content placeholder */}
          <div style={{ flex: 1, padding: "0.45rem 0.6rem", display: "flex", flexDirection: "column", gap: "0.18rem", justifyContent: "space-between" }}>
            <div>
              <Skeleton height="0.88rem" width="72%" style={{ marginBottom: "0.18rem" }} />
              <Skeleton height="0.7rem" width="55%" style={{ marginBottom: "0.18rem" }} />
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.1rem" }}>
                <Skeleton height="1.15rem" width="3.5rem" borderRadius="999px" />
                <Skeleton height="1.15rem" width="3.5rem" borderRadius="999px" />
              </div>
            </div>
            <Skeleton height="0.95rem" width="35%" />
          </div>
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
