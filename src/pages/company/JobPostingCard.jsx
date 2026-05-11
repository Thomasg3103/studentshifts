import { useState, useEffect, useRef } from "react";

function ConfirmDialog({ title, body, emoji, confirmLabel, onConfirm, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, []);
  return (
    <div onClick={onCancel} role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
      <div ref={ref} onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem 1.5rem", width: "100%", maxWidth: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>{emoji}</p>
        <h3 style={{ margin: "0 0 0.4rem", fontWeight: "700", fontSize: "1.05rem", color: "#0f172a" }}>{title}</h3>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b" }}>{body}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", background: "white", cursor: "pointer", color: "#374151", fontSize: "0.88rem", fontWeight: "600", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "0.6rem 1rem", border: "none", borderRadius: "0.6rem", background: "#dc2626", cursor: "pointer", color: "white", fontSize: "0.88rem", fontWeight: "700", fontFamily: "inherit" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function JobPostingCard({ posting, onViewApplicants, onEdit, onDelete, onToggleStatus }) {
  const isActive  = posting.status === "Active";
  const today     = new Date().toISOString().split("T")[0];
  const isExpired = posting.status === "Closed" && posting.deadline && posting.deadline < today;
  const rawPhoto  = posting.photos?.[0] || null;
  const photo     = rawPhoto ? `${rawPhoto}?width=400&quality=75` : null;
  const crop      = posting.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
  const postedAgo = (() => {
    if (!posting.createdAt) return null;
    const days = Math.floor((Date.now() - new Date(posting.createdAt)) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  })();
  const [hovered,       setHovered]       = useState(false);
  const [confirmClose,  setConfirmClose]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deadlineClose = posting.deadline && posting.deadline > today && (new Date(posting.deadline) - new Date(today)) / 86400000 <= 3;

  const deadlineLabel = posting.deadline
    ? new Date(posting.deadline + "T00:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "short" })
    : null;

  const actionBtn = {
    padding: "0.32rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem",
    background: "white", cursor: "pointer", color: "#374151",
    fontSize: "0.76rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap",
  };

  return (
    <div
      className="job-posting-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "0.85rem", overflow: "hidden",
        backgroundColor: "white",
        border: `1.5px solid ${isExpired ? "#fca5a5" : hovered ? "#cbd5e1" : "#e2e8f0"}`,
        display: "flex", alignItems: "stretch",
        opacity: isActive ? 1 : 0.82,
        boxShadow: hovered ? "0 6px 24px rgba(0,0,0,0.09)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.18s, border-color 0.18s",
      }}>

      {/* Square photo */}
      <div style={{ width: "140px", flexShrink: 0, position: "relative", overflow: "hidden", alignSelf: "stretch" }}>
        {photo ? (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
            <img loading="lazy" src={photo} alt={posting.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "1rem 1.25rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>

        {/* Title + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ fontWeight: "700", fontSize: "1.05rem", margin: 0, color: "#0f172a", lineHeight: 1.3 }}>
            {posting.title}
          </h2>
          <span className={`badge badge-tag ${isActive ? "badge-green" : isExpired ? "badge-red" : "badge-gray"}`} style={{ textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            {isExpired ? "Expired" : posting.status}
          </span>
        </div>

        {/* Location · pay */}
        <p style={{ fontSize: "0.85rem", color: "#64748b", margin: 0 }}>
          {posting.location} · {posting.pay}
        </p>

        {/* Day pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {posting.days.map(day => {
            const isFilled = (posting.filledShifts || []).includes(day);
            return (
              <span key={day} className={`badge badge-tag ${isFilled ? "badge-gray" : "badge-blue"}`} style={{ textDecoration: isFilled ? "line-through" : "none" }} title={isFilled ? "This shift has been filled" : undefined}>
                {day.slice(0, 3)}{posting.times?.[day] ? ` · ${posting.times[day]}` : ""}
                {isFilled ? " ✓" : ""}
              </span>
            );
          })}
          {posting.weekendRequired && <span className="badge badge-tag badge-yellow">Weekend</span>}
        </div>

        {/* Bottom row: View Applicants CTA + deadline + secondary actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "auto", flexWrap: "wrap" }}>
          <button
            onClick={onViewApplicants}
            style={{
              padding: "0.42rem 1rem", borderRadius: "2rem",
              background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
              color: "white", border: "none", cursor: "pointer",
              fontSize: "0.8rem", fontWeight: "700", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            {posting.applicantCount > 0
              ? `View ${posting.applicantCount} applicant${posting.applicantCount !== 1 ? "s" : ""} →`
              : "View applicants →"}
          </button>

          {deadlineLabel && (
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: deadlineClose ? "#d97706" : "#94a3b8", whiteSpace: "nowrap" }}>
              {deadlineClose ? "⚠ " : ""}Closes {deadlineLabel}
            </span>
          )}

          {postedAgo && (
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
              Posted {postedAgo}
            </span>
          )}

          {/* Secondary actions */}
          <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}>
            <button onClick={onEdit} aria-label={`Edit ${posting.title}`} style={actionBtn}>Edit</button>
            <button
              aria-label={isActive ? `Close ${posting.title}` : `Reopen ${posting.title}`}
              onClick={isActive ? () => setConfirmClose(true) : onToggleStatus}
              style={actionBtn}
            >
              {isActive ? "Close" : "Reopen"}
            </button>
            <button
              aria-label={`Delete ${posting.title}`}
              onClick={() => setConfirmDelete(true)}
              style={{ ...actionBtn, border: "1px solid #fca5a5", color: "#dc2626" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Close this job?"
          body="The posting will be hidden from students. You can reopen it at any time."
          emoji="⚠️"
          confirmLabel="Yes, Close"
          onConfirm={() => { onToggleStatus(); setConfirmClose(false); }}
          onCancel={() => setConfirmClose(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this job?"
          body="This will permanently remove the posting and all its applicants. This cannot be undone."
          emoji="🗑️"
          confirmLabel="Yes, Delete"
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
