import { useState } from "react";

export default function JobPostingCard({ posting, onViewApplicants, onEdit, onDelete, onToggleStatus }) {
  const isActive = posting.status === "Active";
  const today = new Date().toISOString().split("T")[0];
  const isExpired = posting.status === "Closed" && posting.deadline && posting.deadline < today;
  const photo = posting.photos?.[0] || null;
  const crop  = posting.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
  const [hovered, setHovered] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deadlineClose = posting.deadline && posting.deadline > today && (new Date(posting.deadline) - new Date(today)) / 86400000 <= 3;
  return (
    <div
      className="job-posting-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "0.75rem", overflow: "hidden",
        backgroundColor: "white", border: `1px solid ${isExpired ? "#fca5a5" : "#e2e8f0"}`,
        display: "flex", alignItems: "stretch",
        opacity: isActive ? 1 : 0.8,
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.18s",
      }}>
      {/* Square photo */}
      <div style={{ width: "160px", flexShrink: 0, position: "relative", overflow: "hidden", alignSelf: "stretch" }}>
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
      <div style={{ flex: 1, padding: "1rem 1.25rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2
              onClick={onViewApplicants}
              style={{ fontWeight: "700", fontSize: "1.05rem", margin: 0, cursor: "pointer", color: "#0f172a", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--color-brand)"}
              onMouseLeave={e => e.currentTarget.style.color = "#0f172a"}
            >
              {posting.title}
            </h2>
            <span style={{
              fontSize: "0.6rem", fontWeight: "700", padding: "0.15rem 0.5rem",
              borderRadius: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
              backgroundColor: isActive ? "#dcfce7" : isExpired ? "#fee2e2" : "#f3f4f6",
              color: isActive ? "#16a34a" : isExpired ? "#dc2626" : "#6b7280",
            }}>
              {isExpired ? "Expired" : posting.status}
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.6rem", margin: "0 0 0.6rem" }}>
            {posting.location} · {posting.pay}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {posting.days.map(day => {
              const isFilled = (posting.filledShifts || []).includes(day);
              return (
                <span key={day} style={{
                  fontSize: "0.68rem",
                  backgroundColor: isFilled ? "#f1f5f9" : "#f0f9ff",
                  color: isFilled ? "#94a3b8" : "#0369a1",
                  padding: "0.15rem 0.5rem", borderRadius: "0.3rem", fontWeight: "600",
                  textDecoration: isFilled ? "line-through" : "none",
                }}>
                  {day.slice(0, 3)}{posting.times?.[day] ? ` · ${posting.times[day]}` : ""}
                  {isFilled ? " ✓" : ""}
                </span>
              );
            })}
            {posting.weekendRequired && (
              <span style={{ fontSize: "0.68rem", backgroundColor: "#fefce8", color: "#a16207", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", fontWeight: "600" }}>
                Weekend
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#374151", fontWeight: "600", margin: 0 }}>
            {posting.applicantCount} applicant{posting.applicantCount !== 1 ? "s" : ""}
          </p>
          {posting.deadline && (
            <p style={{ fontSize: "0.72rem", fontWeight: "600", margin: 0, color: deadlineClose ? "#d97706" : "#94a3b8" }}>
              {deadlineClose ? "⚠ " : ""}Closes {posting.deadline}
            </p>
          )}
        </div>
      </div>

      {/* Right action column */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "0.85rem 0.85rem 0.85rem 0", gap: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={onEdit}
          title="Edit job"
          style={{ padding: "0.35rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#64748b", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          Edit
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <button
            onClick={isActive ? () => setConfirmClose(true) : onToggleStatus}
            style={{ padding: "0.38rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#374151", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            {isActive ? "Close Job" : "Reopen"}
          </button>
          <button onClick={() => setConfirmDelete(true)} style={{ padding: "0.38rem 0.7rem", border: "1px solid #fca5a5", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#dc2626", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Delete
          </button>
        </div>
        {confirmClose && (
          <div onClick={() => setConfirmClose(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem 1.5rem", width: "100%", maxWidth: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
              <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>⚠️</p>
              <h3 style={{ margin: "0 0 0.4rem", fontWeight: "700", fontSize: "1.05rem", color: "#0f172a" }}>Close this job?</h3>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                The posting will be hidden from students. You can reopen it at any time.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button onClick={() => setConfirmClose(false)} style={{ flex: 1, padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", background: "white", cursor: "pointer", color: "#374151", fontSize: "0.88rem", fontWeight: "600", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button onClick={() => { onToggleStatus(); setConfirmClose(false); }} style={{ flex: 1, padding: "0.6rem 1rem", border: "none", borderRadius: "0.6rem", background: "#dc2626", cursor: "pointer", color: "white", fontSize: "0.88rem", fontWeight: "700", fontFamily: "inherit" }}>
                  Yes, Close
                </button>
              </div>
            </div>
          </div>
        )}
        {confirmDelete && (
          <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem 1.5rem", width: "100%", maxWidth: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
              <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🗑️</p>
              <h3 style={{ margin: "0 0 0.4rem", fontWeight: "700", fontSize: "1.05rem", color: "#0f172a" }}>Delete this job?</h3>
              <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                This will permanently remove the posting and all its applicants. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "0.6rem 1rem", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", background: "white", cursor: "pointer", color: "#374151", fontSize: "0.88rem", fontWeight: "600", fontFamily: "inherit" }}>
                  Cancel
                </button>
                <button onClick={() => { onDelete(); setConfirmDelete(false); }} style={{ flex: 1, padding: "0.6rem 1rem", border: "none", borderRadius: "0.6rem", background: "#dc2626", cursor: "pointer", color: "white", fontSize: "0.88rem", fontWeight: "700", fontFamily: "inherit" }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
