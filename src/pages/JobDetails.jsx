import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { likeJob, unlikeJob, createApplication } from "../lib/auth";


export default function JobDetails({
  job, setPage, currentUser, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs,
}) {
  const [applyModal, setApplyModal] = useState(null);
  const [photoIdx, setPhotoIdx]     = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState(null);

  if (!job) return null;

  const isLiked   = likedJobs.some(j => j.id === job.id);
  const isApplied = appliedJobs.some(j => j.id === job.id);

  const toggleLike = () => {
    if (!currentUser) { setPage("login"); return; }
    if (isApplied) return;
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
    if (isLiked) unlikeJob(currentUser.id, job.id).catch(console.error);
    else likeJob(currentUser.id, job.id).catch(console.error);
  };

  const handleApply = () => {
    if (!currentUser) { setPage("login"); return; }
    if (isApplied) return;
    if (currentUser.verificationStatus !== "verified") {
      setApplyModal("notVerified");
      return;
    }
    if (!currentUser.cvName) {
      setApplyModal("noCV");
      return;
    }
    setApplyModal("confirm");
  };

  const confirmApply = async () => {
    if (submitting) return;
    setSubmitting(true);
    setApplyError(null);
    try {
      await createApplication(currentUser.id, job.id);
      setAppliedJobs([...appliedJobs, job]);
      if (isLiked) {
        setLikedJobs(likedJobs.filter(j => j.id !== job.id));
        unlikeJob(currentUser.id, job.id).catch(console.error);
      }
      setApplyModal("success");
    } catch (e) {
      setApplyError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deadlineStr = job.deadline
    ? new Date(job.deadline).toLocaleDateString("en-IE", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <><BackButton />
    <PageWrapper>

      {/* ── Header: photo + key info ── */}
      {(() => {
        const photos = job.photos?.length > 0 ? job.photos : [];
        const idx    = Math.min(photoIdx, Math.max(0, photos.length - 1));
        const crop   = job.photoCrops?.[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };

        return (
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap" }}>

            {/* Square thumbnail */}
            <div style={{ width: "180px", height: "180px", flexShrink: 0, borderRadius: "0.85rem", overflow: "hidden", backgroundColor: "#0f172a", position: "relative" }}>
              {photos.length > 0 ? (
                <>
                  <div style={{ position: "absolute", inset: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
                    <img src={photos[idx]} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setPhotoIdx((idx - 1 + photos.length) % photos.length)} style={arrowBtn("left")}>‹</button>
                      <button onClick={() => setPhotoIdx((idx + 1) % photos.length)} style={arrowBtn("right")}>›</button>
                      <div style={{ position: "absolute", bottom: "6px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "4px" }}>
                        {photos.map((_, i) => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: i === idx ? "white" : "rgba(255,255,255,0.4)" }} />)}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #312e81 100%)" }}>
                  <span style={{ fontSize: "2.5rem", opacity: 0.25 }}>🏢</span>
                </div>
              )}
            </div>

            {/* Info column */}
            <div style={{ flex: 1, minWidth: "200px" }}>
              <h1 style={{ fontWeight: "800", fontSize: "1.5rem", margin: "0 0 0.15rem", color: "#1e293b", lineHeight: 1.2 }}>{job.title}</h1>
              <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 0.9rem", fontWeight: "500" }}>{job.company}</p>

              {/* Detail pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                <Pill>📍 {job.location}</Pill>
                <Pill accent>💰 {job.pay}</Pill>
                {deadlineStr && <Pill warn>📅 {deadlineStr}</Pill>}
                {job.weekendRequired && <Pill>📆 Weekend required</Pill>}
              </div>

              {/* Availability tags */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "1.1rem" }}>
                {job.days.map(day => (
                  <span key={day} style={{ fontSize: "0.75rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.2rem 0.55rem", borderRadius: "999px", fontWeight: "600" }}>
                    {day} · {job.times[day]?.join(", ")}
                  </span>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                {!isApplied && (
                  <button onClick={toggleLike} style={{ ...btn, background: isLiked ? "#10b981" : "linear-gradient(135deg,#f43f5e,#e11d48)", boxShadow: "0 3px 10px rgba(244,63,94,0.3)" }}>
                    {isLiked ? "✅ Liked" : "❤️ Like"}
                  </button>
                )}
                <button onClick={handleApply} style={{ ...btn, background: isApplied ? "#10b981" : "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: isApplied ? "none" : "0 3px 10px rgba(99,102,241,0.35)" }}>
                  {isApplied ? "✅ Applied" : "Apply Now"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Description */}
      {job.description && (
        <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <p style={{ fontWeight: "700", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: "0.45rem" }}>About This Role</p>
          <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: "1.65", margin: 0 }}>{job.description}</p>
        </div>
      )}

      {/* Apply modal */}
      {applyModal && (
        <div onClick={() => setApplyModal(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "360px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            {applyModal === "noCV" ? (
        <>
          <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fef9c3", border: "2px solid #fde047", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>📄</div>
          <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>No CV uploaded</h3>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            You need to upload a CV before you can apply for jobs. Head to your Account page to add one.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => setApplyModal(null)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={() => { setApplyModal(null); setPage("account"); }} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Upload CV →</button>
          </div>
        </>
      ) : applyModal === "notVerified" ? (
        <>
          <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff7ed", border: "2px solid #fed7aa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>🔒</div>
          <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>Account not yet verified</h3>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            {currentUser?.verificationStatus === "pending_review"
              ? "Your documents are under review. You'll be able to apply once your account is verified."
              : "You need to upload your verification documents before applying for jobs."}
          </p>
          <button onClick={() => setApplyModal(null)} style={{ width: "100%", padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Got it</button>
        </>
      ) : applyModal === "confirm" ? (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem", boxShadow: "0 8px 20px rgba(99,102,241,0.35)" }}>📋</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>Apply for {job.title}?</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>{job.company} — your CV will be shared with the employer.</p>
                {applyError && (
                  <p style={{ fontSize: "0.8rem", color: "#ef4444", marginBottom: "0.75rem" }}>{applyError}</p>
                )}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setApplyModal(null)} disabled={submitting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={confirmApply} disabled={submitting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: submitting ? "#a5b4fc" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: submitting ? "none" : "0 4px 14px rgba(99,102,241,0.35)" }}>{submitting ? "Applying…" : "Apply Now"}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>🎉</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.25rem", color: "#1e293b" }}>Application Sent!</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>
                  You've applied for <strong>{job.title}</strong> at {job.company}. Good luck!
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setApplyModal(null)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>Stay Here</button>
                  <button onClick={() => { setApplyModal(null); setPage("appliedJobs"); }} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: "#10b981", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>View Applications</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageWrapper></>
  );
}

function Pill({ children, accent, warn }) {
  const bg    = accent ? "#f0fdf4" : warn ? "#fffbeb" : "#f1f5f9";
  const color = accent ? "#15803d" : warn ? "#b45309" : "#475569";
  const border= accent ? "#bbf7d0" : warn ? "#fde68a" : "#e2e8f0";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.78rem", fontWeight: "600", padding: "0.25rem 0.65rem", borderRadius: "999px", backgroundColor: bg, color, border: `1.5px solid ${border}` }}>
      {children}
    </span>
  );
}

const btn = { padding: "0.7rem 1.5rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontFamily: "inherit", fontSize: "0.9rem", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" };

const arrowBtn = (side) => ({
  position: "absolute", top: "50%", [side]: "10px",
  transform: "translateY(-50%)",
  background: "rgba(0,0,0,0.45)", border: "none", color: "white",
  borderRadius: "50%", width: "32px", height: "32px",
  fontSize: "1.3rem", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2,
});
