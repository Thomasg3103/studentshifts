import { useState } from "react";
import { supabaseImg } from "../../utils/img";


export default function JobPostingCard({ posting, onViewApplicants, onEdit, onRequestDelete, onToggleStatus, onDuplicate, onSaveTemplate, onNotifyStudents, notifying, notified, matchesData, onLoadMatches, onRequestClose }) {
  const isActive  = posting.status === "Active";
  const today     = new Date().toISOString().split("T")[0];
  const isExpired = posting.status === "Expired";
  const rawPhoto  = posting.photos?.[0] || null;
  const photo     = supabaseImg(rawPhoto, 400);
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
  const [hovered,           setHovered]           = useState(false);
  const [templateSaved,     setTemplateSaved]     = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [showTemplateInput, setShowTemplateInput] = useState(false);
  const [showMatches,       setShowMatches]       = useState(false);
  const deadlineClose = posting.deadline && posting.deadline > today && (new Date(posting.deadline) - new Date(today)) / 86400000 <= 3;

  const deadlineLabel = posting.deadline
    ? new Date(posting.deadline + "T00:00:00").toLocaleDateString("en-IE", { day: "numeric", month: "short" })
    : null;

  const actionBtn = {
    padding: "0.32rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem",
    background: "var(--color-bg-elevated, white)", cursor: "pointer", color: "var(--color-text-body, #374151)",
    fontSize: "0.76rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap",
  };

  return (
    <>
    <div
      className="job-posting-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "0.85rem", overflow: "hidden",
        backgroundColor: "var(--color-bg-elevated, white)",
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
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-bg-surface, #f1f5f9)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "1rem 1.25rem", minWidth: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>

        {/* Title + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 style={{ fontWeight: "700", fontSize: "1.05rem", margin: 0, color: "var(--color-text-primary, #0f172a)", lineHeight: 1.3 }}>
            {posting.title}
          </h2>
          <span className={`badge badge-tag ${isActive ? "badge-green" : isExpired ? "badge-red" : "badge-gray"}`} style={{ textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
            {isExpired ? "Expired" : posting.status}
          </span>
        </div>

        {/* Location · pay */}
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)", margin: 0 }}>
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
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: deadlineClose ? "#d97706" : "#64748b", whiteSpace: "nowrap" }}>
              {deadlineClose ? "⚠ " : ""}Closes {deadlineLabel}
            </span>
          )}

          {postedAgo && (
            <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)", whiteSpace: "nowrap" }}>
              Posted {postedAgo}
            </span>
          )}

          {/* Secondary actions */}
          <div style={{ display: "flex", gap: "0.35rem", marginLeft: "auto" }}>
            {onLoadMatches && isActive && posting.days?.length > 0 && (
              <button
                onClick={() => {
                  setShowMatches(v => !v);
                  if (!matchesData?.loaded && !matchesData?.loading) onLoadMatches();
                }}
                style={{ ...actionBtn, color: showMatches ? "var(--color-brand)" : "#374151", borderColor: showMatches ? "var(--color-brand)" : "#e2e8f0", backgroundColor: showMatches ? "#fce7f3" : "var(--color-bg-elevated, white)" }}
                title="See which verified students are available for these shifts"
              >🎯 Matches</button>
            )}
            {onNotifyStudents && isActive && (
              notified ? (
                <span style={{ ...actionBtn, color: "#16a34a", cursor: "default" }}>✓ Notified</span>
              ) : (
                <button
                  onClick={onNotifyStudents}
                  disabled={notifying}
                  aria-label={`Notify available students for ${posting.title}`}
                  title="Email verified students whose availability matches this job's shift days"
                  style={{ ...actionBtn, color: notifying ? "#94a3b8" : "var(--color-brand)", borderColor: notifying ? "#e2e8f0" : "var(--color-brand)", cursor: notifying ? "default" : "pointer" }}
                >{notifying ? "Notifying…" : "📣 Notify"}</button>
              )
            )}
            <button onClick={onEdit} aria-label={`Edit ${posting.title}`} style={actionBtn}>Edit</button>
            <button onClick={onDuplicate} aria-label={`Duplicate ${posting.title}`} style={actionBtn} title="Create a new job based on this one">Duplicate</button>
            {onSaveTemplate && (
              templateSaved ? (
                <span style={{ ...actionBtn, color: "#16a34a", cursor: "default" }}>✓ Saved</span>
              ) : showTemplateInput ? (
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  <input
                    autoFocus
                    value={templateNameInput}
                    onChange={e => setTemplateNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && templateNameInput.trim()) {
                        onSaveTemplate(templateNameInput.trim());
                        setTemplateSaved(true); setShowTemplateInput(false); setTemplateNameInput("");
                        setTimeout(() => setTemplateSaved(false), 3000);
                      }
                      if (e.key === "Escape") { setShowTemplateInput(false); setTemplateNameInput(""); }
                    }}
                    placeholder="Template name…"
                    style={{ padding: "0.25rem 0.5rem", borderRadius: "0.4rem", border: "1.5px solid #d1d5db", fontSize: "0.75rem", fontFamily: "inherit", width: "130px" }}
                  />
                  <button onClick={() => { onSaveTemplate(templateNameInput.trim() || posting.title); setTemplateSaved(true); setShowTemplateInput(false); setTemplateNameInput(""); setTimeout(() => setTemplateSaved(false), 3000); }} disabled={!templateNameInput.trim()} style={{ ...actionBtn, backgroundColor: "#f0fdf4", borderColor: "#86efac", color: "#15803d" }}>Save</button>
                </div>
              ) : (
                <button onClick={() => { setTemplateNameInput(posting.title); setShowTemplateInput(true); }} style={actionBtn} title="Save as a reusable template">Template</button>
              )
            )}
            <button
              aria-label={isActive ? `Close ${posting.title}` : `Reopen ${posting.title}`}
              onClick={isActive ? onRequestClose : onToggleStatus}
              style={actionBtn}
            >
              {isActive ? "Close" : "Reopen"}
            </button>
            <button
              aria-label={`Delete ${posting.title}`}
              onClick={onRequestDelete}
              style={{ ...actionBtn, border: "1px solid #fca5a5", color: "#dc2626" }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

    </div>

    {/* Smart Matches panel */}
    {showMatches && (
      <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
        <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          🎯 Available Students for {posting.title}
        </p>
        {matchesData?.loading && (
          <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--color-text-secondary, #64748b)" }}>Finding matches…</p>
        )}
        {matchesData?.loaded && matchesData.students.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.75rem 1rem", backgroundColor: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "0.6rem" }}>
            <span>⚠️</span>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#92400e" }}>No verified students have matching availability right now. Try the <strong>📣 Notify</strong> button to alert students as soon as they mark availability.</p>
          </div>
        )}
        {matchesData?.loaded && matchesData.students.length > 0 && (
          <>
            {matchesData.students.map((s, i) => {
              const isExact = s.match_score === posting.days?.length;
              return (
                <div key={s.student_id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.55rem 0", borderBottom: i < matchesData.students.length - 1 ? "1px solid var(--color-border-light, #e2e8f0)" : "none" }}>
                  {s.profile_photo ? (
                    <img src={s.profile_photo} alt={s.student_name} style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} loading="lazy" />
                  ) : (
                    <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: "700", fontSize: "0.85rem", color: "var(--color-brand)" }}>
                      {s.student_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "0.85rem", color: "var(--color-text-primary, #0f172a)" }}>{s.student_name}</p>
                    {s.bio && <p style={{ margin: 0, fontSize: "0.73rem", color: "var(--color-text-secondary, #64748b)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.bio}</p>}
                  </div>
                  <span style={{ fontSize: "0.72rem", fontWeight: "700", whiteSpace: "nowrap", padding: "0.18rem 0.5rem", borderRadius: "999px", backgroundColor: isExact ? "#fce7f3" : "#f8fafc", color: isExact ? "var(--color-brand)" : "#64748b", border: `1px solid ${isExact ? "var(--color-brand)" : "#e2e8f0"}` }}>
                    {s.match_score}/{posting.days?.length} shifts
                  </span>
                </div>
              );
            })}
            {matchesData.students.length === 5 && (
              <p style={{ margin: "0.65rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", textAlign: "center" }}>Showing top 5 — use <strong>Browse Students → Match to Job</strong> to see all.</p>
            )}
          </>
        )}
      </div>
    )}
    </>
  );
}
