import { useState, useEffect } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import DOMPurify from "dompurify";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { likeJob, unlikeJob, createApplication } from "../lib/auth";
import { haversineDistance, formatDistance } from "../utils/geo";
import { useApp } from "../context/AppContext";

function DetailCard({ label, children }) {
  return (
    <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderLeft: "3px solid var(--color-brand)", borderRadius: "0.65rem", padding: "0.55rem 0.75rem", marginBottom: "0.4rem" }}>
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-brand)" }}>{label}</p>
      <div style={{ fontSize: "0.88rem", color: "#1e293b", fontWeight: 600 }}>{children}</div>
    </div>
  );
}


export default function JobDetails({ job }) {
  const { setPage, currentUser, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs,
    setSavedLikedJobIds, setSavedAppliedJobIds, studentLocation } = useApp();
  const [applyModal, setApplyModal]       = useState(null);
  const [photoIdx, setPhotoIdx]           = useState(0);
  const [submitting, setSubmitting]       = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(null);
  const [selectedDay, setSelectedDay]     = useState(null);
  const [reportOpen, setReportOpen]       = useState(false);
  const [reportReason, setReportReason]   = useState("");
  const [windowWidth, setWindowWidth]     = useState(window.innerWidth);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  if (!job) return null;

  const isLiked   = likedJobs.some(j => j.id === job.id);
  const isApplied = appliedJobs.some(j => j.id === job.id);

  const needsSlotPick = (job.days?.length ?? 0) > 1;

  const toggleLike = () => {
    if (!currentUser) { setPage("login"); return; }
    if (isApplied) return;
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
    setSavedLikedJobIds?.(prev => isLiked ? prev.filter(id => id !== job.id) : [...new Set([...prev, job.id])]);
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
    if (needsSlotPick) {
      setSelectedDay(null);
      setApplyModal("shifts");
      return;
    }
    setApplyModal("confirm");
  };

  const confirmApply = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const preferredShift = selectedDay ? (() => {
        const t = job.times?.[selectedDay];
        const timeStr = Array.isArray(t) ? t.join(", ") : (t || "");
        return timeStr ? `${selectedDay} · ${timeStr}` : selectedDay;
      })() : null;
      await createApplication(currentUser.id, job.id, preferredShift);
      setAppliedJobs(prev => prev.some(j => j.id === job.id) ? prev : [...prev, job]);
      setSavedAppliedJobIds?.(prev => [...new Set([...prev, job.id])]);
      if (isLiked) {
        setLikedJobs(prev => prev.filter(j => j.id !== job.id));
        setSavedLikedJobIds?.(prev => prev.filter(id => id !== job.id));
        unlikeJob(currentUser.id, job.id).catch(console.error);
      }
      setApplyModal(null);
      toast.success("Application submitted!");
    } catch (e) {
      Sentry.captureException(e);
      console.error("Apply error:", e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const photos    = job.photos?.length > 0 ? job.photos : [];

  const deadlineStr = job.deadline
    ? new Date(job.deadline).toLocaleDateString("en-IE", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const isNarrow = windowWidth < 768;

  const idx  = Math.min(photoIdx, Math.max(0, photos.length - 1));
  const crop = job.photoCrops?.[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };

  const loc = studentLocation || currentUser?.savedLocation || null;
  const distanceKm = (loc?.lat && job.lat && job.lng)
    ? haversineDistance(loc.lat, loc.lng, job.lat, job.lng)
    : null;

  const Sidebar = () => (
    <div>
      <DetailCard label="📍 Location">{job.location}</DetailCard>
      <DetailCard label="💰 Pay">{job.pay}</DetailCard>
      <DetailCard label="🗓️ Shifts">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.15rem" }}>
          {job.days.map(day => {
            const isFilled = (job.filledShifts || []).includes(day);
            const t = job.times?.[day];
            const timeStr = Array.isArray(t) ? t.join(", ") : (t || "");
            return (
              <span key={day} style={{ fontSize: "0.73rem", backgroundColor: isFilled ? "#f1f5f9" : "#fce7f3", color: isFilled ? "#94a3b8" : "var(--color-brand)", padding: "0.2rem 0.5rem", borderRadius: "999px", fontWeight: 600, textDecoration: isFilled ? "line-through" : "none" }}>
                {day}{timeStr ? ` · ${timeStr}` : ""}{isFilled ? " ✓" : ""}
              </span>
            );
          })}
        </div>
      </DetailCard>
      {job.category && <DetailCard label="🏷️ Job Type">{job.category}</DetailCard>}
      <DetailCard label="📏 Distance">
        {distanceKm !== null
          ? formatDistance(distanceKm)
          : !loc
          ? <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.82rem" }}>Set your location in Account</span>
          : <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.82rem" }}>Not available for this job</span>}
      </DetailCard>
      {job.sickPay !== undefined && <DetailCard label="🏥 Sick Pay">{job.sickPay ? "Yes" : "No"}</DetailCard>}
      <DetailCard label="🏖️ Holidays">{job.holidays || <span style={{ color: "#94a3b8", fontWeight: 500, fontSize: "0.82rem" }}>Not specified</span>}</DetailCard>
      {job.weekendRequired && <DetailCard label="📆 Schedule">Weekend availability required</DetailCard>}
      {deadlineStr && <DetailCard label="⏰ Apply By">{deadlineStr}</DetailCard>}
    </div>
  );

  return (
    <>
      <BackButton />
      <div style={{ backgroundColor: "#fafafa", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "1.5rem 1.25rem", boxSizing: "border-box" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

          {/* LEFT: sticky details sidebar — desktop only */}
          {!isNarrow && (
            <aside style={{ width: "240px", flexShrink: 0, position: "sticky", top: "88px" }}>
              <Sidebar />
            </aside>
          )}

          {/* RIGHT: main white card */}
          <div style={{ flex: 1, minWidth: 0, backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 2rem", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>

            {/* Single header row: image · title/company · buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
              {/* Square image with dot nav when multiple photos */}
              <div style={{ width: "144px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                <div style={{ width: "144px", height: "144px", borderRadius: "0.85rem", overflow: "hidden", position: "relative", cursor: photos.length > 0 ? "zoom-in" : "default" }} onClick={() => photos.length > 0 && setFullscreenIdx(idx)}>
                  {photos.length > 0 ? (
                    <div style={{ position: "absolute", inset: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
                      <img loading="lazy" src={photos[idx]} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </div>
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" }}>
                      <span style={{ fontSize: "1.5rem", opacity: 0.4 }}>🏢</span>
                    </div>
                  )}
                  {/* Prev / Next arrows overlaid on image */}
                  {photos.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setPhotoIdx((idx - 1 + photos.length) % photos.length); }} style={{ position: "absolute", left: "4px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "white", borderRadius: "50%", width: "24px", height: "24px", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>‹</button>
                      <button onClick={e => { e.stopPropagation(); setPhotoIdx((idx + 1) % photos.length); }} style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.45)", border: "none", color: "white", borderRadius: "50%", width: "24px", height: "24px", fontSize: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>›</button>
                    </>
                  )}
                </div>
                {/* Dot indicators */}
                {photos.length > 1 && (
                  <div style={{ display: "flex", gap: "5px" }}>
                    {photos.map((_, i) => (
                      <div key={i} onClick={() => setPhotoIdx(i)} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: i === idx ? "var(--color-brand)" : "#d1d5db", cursor: "pointer", transition: "background-color 0.15s" }} />
                    ))}
                  </div>
                )}
              </div>
              {/* Title + company — centred */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <h1 style={{ fontWeight: 800, fontSize: "2.7rem", margin: "0 0 0.2rem", color: "#1e293b", lineHeight: 1.1 }}>{job.title}</h1>
                <p style={{ color: "#64748b", fontSize: "1.8rem", margin: 0, fontWeight: 500 }}>{job.company}</p>
              </div>
              {/* Right: heart + apply, or single green tick when applied */}
              {isApplied ? (
                <div style={{ width: "48px", height: "48px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.65rem" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <button
                    onClick={toggleLike}
                    title={isLiked ? "Unlike" : "Like"}
                    style={{ width: "48px", height: "48px", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1.5px solid #e2e8f0", borderRadius: "0.65rem", cursor: "pointer", padding: 0 }}
                  >
                    {isLiked ? (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    ) : (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    )}
                  </button>
                  <button onClick={handleApply} style={{ ...btn, background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))", boxShadow: "0 3px 10px rgba(162,29,84,0.35)" }}>
                    Apply Now
                  </button>
                </div>
              )}
            </div>

            {/* Mobile: sidebar details inline */}
            {isNarrow && <div style={{ marginBottom: "1.25rem" }}><Sidebar /></div>}

            {/* About This Role */}
            {job.description && (
              <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.1rem", marginBottom: "1.5rem" }}>
                <p style={{ fontWeight: 700, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 0.45rem" }}>About This Role</p>
                {/<[a-z]/i.test(job.description)
                  ? <div className="rte-content" style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.65, margin: 0 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(job.description) }} />
                  : <p style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{job.description}</p>
                }
              </div>
            )}

            {/* Report Job */}
            <button
              onClick={() => setReportOpen(true)}
              style={{ width: "100%", padding: "0.85rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
            >
              ⚑ Report this job
            </button>
          </div>
        </div>
      </div>

      {/* Report modal */}
      {reportOpen && (
        <div onClick={() => setReportOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "360px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.25rem", color: "#1e293b" }}>Report Job</h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "1rem", lineHeight: 1.5 }}>Let us know what's wrong with this listing and we'll look into it.</p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Describe the issue…"
              rows={4}
              style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginBottom: "1.25rem", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setReportOpen(false)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Job Report: ${job.title} at ${job.company}`);
                  const body = encodeURIComponent(`Job ID: ${job.id}\nTitle: ${job.title}\nCompany: ${job.company}\n\nReason:\n${reportReason}`);
                  window.open(`mailto:hello@studentshifts.ie?subject=${subject}&body=${body}`);
                  setReportOpen(false);
                  setReportReason("");
                }}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >Send Report</button>
            </div>
          </div>
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
            <button onClick={() => { setApplyModal(null); setPage("account"); }} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Upload CV →</button>
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
          <button onClick={() => setApplyModal(null)} style={{ width: "100%", padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Got it</button>
        </>
      ) : applyModal === "shifts" ? (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#f5f3ff", border: "2px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>🗓️</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.25rem", color: "#1e293b" }}>Available Shifts</h3>
                <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "1.25rem" }}>This job has {job.days.length} shifts available. You can apply to all of them, or pick a specific shift you prefer.</p>
                <div style={{ display: "flex", gap: "0.6rem", flexDirection: "column" }}>
                  <button onClick={() => setApplyModal("confirm")} style={{ width: "100%", padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Apply to All Shifts</button>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button onClick={() => setApplyModal(null)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    <button onClick={() => { setSelectedDay(null); setApplyModal("pickShift"); }} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-brand)", backgroundColor: "white", color: "var(--color-brand)", fontWeight: "700", cursor: "pointer", fontFamily: "inherit" }}>Pick a Shift</button>
                  </div>
                </div>
              </>
            ) : applyModal === "pickShift" ? (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#f5f3ff", border: "2px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>🗓️</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.25rem", color: "#1e293b" }}>Pick a Shift</h3>
                <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "1rem" }}>Select the shift that works for you.</p>
                <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem" }}>
                  {job.days.map(day => {
                    const t = job.times?.[day];
                    const timeStr = Array.isArray(t) ? t.join(", ") : (t || "");
                    const sel = selectedDay === day;
                    const isFilled = (job.filledShifts || []).includes(day);
                    return (
                      <button key={day} onClick={() => !isFilled && setSelectedDay(sel ? null : day)}
                        style={{ padding: "0.6rem 0.9rem", borderRadius: "0.65rem", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, cursor: isFilled ? "not-allowed" : "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", border: isFilled ? "1.5px solid #e2e8f0" : sel ? "2px solid var(--color-brand)" : "1.5px solid #e2e8f0", background: isFilled ? "#f1f5f9" : sel ? "#fce7f3" : "#fafafa", color: isFilled ? "#94a3b8" : sel ? "var(--color-brand)" : "#374151", textDecoration: isFilled ? "line-through" : "none", opacity: isFilled ? 0.7 : 1 }}>
                        <span>{day}{timeStr ? (<span style={{ fontWeight: 500, color: isFilled ? "#94a3b8" : sel ? "var(--color-brand-dark)" : "#64748b" }}> · {timeStr}</span>) : null}</span>
                        {isFilled ? <span style={{ fontSize: "0.72rem", fontWeight: 700, textDecoration: "none" }}>Filled</span> : sel ? <span style={{ fontSize: "0.72rem", fontWeight: 700 }}>✓</span> : null}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setApplyModal("shifts")} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
                  <button onClick={() => { if (selectedDay) setApplyModal("confirm"); }} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: selectedDay ? "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))" : "#e2e8f0", color: selectedDay ? "white" : "#94a3b8", fontWeight: "700", cursor: selectedDay ? "pointer" : "default", fontFamily: "inherit" }}>Apply →</button>
                </div>
              </>
            ) : applyModal === "confirm" ? (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem", boxShadow: "0 8px 20px rgba(162,29,84,0.35)" }}>📋</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>Apply for {job.title}?</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: selectedDay ? "0.6rem" : "1.5rem" }}>{job.company} — your CV will be shared with the employer.</p>
                {selectedDay && (
                  <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.65rem", padding: "0.65rem 0.9rem", marginBottom: "1.25rem", textAlign: "left" }}>
                    <p style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.25rem" }}>Preferred shift</p>
                    <p style={{ fontSize: "0.88rem", color: "#374151", fontWeight: "600", margin: 0 }}>
                      {selectedDay}{(() => { const t = job.times?.[selectedDay]; const s = Array.isArray(t) ? t.join(", ") : t; return s ? ` · ${s}` : ""; })()}
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setApplyModal(null)} disabled={submitting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={confirmApply} disabled={submitting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: submitting ? "#f48fb1" : "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: submitting ? "none" : "0 4px 14px rgba(162,29,84,0.35)" }}>{submitting ? "Applying…" : "Apply Now"}</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Fullscreen photo lightbox */}
      {fullscreenIdx !== null && (
        <div
          onClick={() => setFullscreenIdx(null)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.92)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          {/* Close */}
          <button onClick={() => setFullscreenIdx(null)} style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "50%", width: "40px", height: "40px", fontSize: "1.3rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>✕</button>

          {/* Cropped image — same transform as thumbnail */}
          {(() => {
            const fsCrop = job.photoCrops?.[fullscreenIdx] || { zoom: 1, offsetX: 0, offsetY: 0 };
            return (
              <div
                onClick={e => e.stopPropagation()}
                style={{ width: "min(90vw, 90vh)", height: "min(90vw, 90vh)", position: "relative", overflow: "hidden", borderRadius: "0.5rem", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", flexShrink: 0 }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${fsCrop.offsetX}%, ${fsCrop.offsetY}%) scale(${fsCrop.zoom})`, transformOrigin: "center" }}>
                  <img loading="lazy" src={photos[fullscreenIdx]} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              </div>
            );
          })()}

          {/* Arrows */}
          {photos.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setFullscreenIdx((fullscreenIdx - 1 + photos.length) % photos.length); }} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "50%", width: "44px", height: "44px", fontSize: "1.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
              <button onClick={e => { e.stopPropagation(); setFullscreenIdx((fullscreenIdx + 1) % photos.length); }} style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: "50%", width: "44px", height: "44px", fontSize: "1.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
              <div style={{ position: "absolute", bottom: "1.25rem", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
                {photos.map((_, i) => <div key={i} onClick={e => { e.stopPropagation(); setFullscreenIdx(i); }} style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: i === fullscreenIdx ? "white" : "rgba(255,255,255,0.35)", cursor: "pointer" }} />)}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Pill({ children, accent, warn }) {
  const bg    = accent ? "#f0fdf4" : warn ? "#fffbeb" : "#fafafa";
  const color = accent ? "#15803d" : warn ? "#b45309" : "#475569";
  const border= accent ? "#bbf7d0" : warn ? "#fde68a" : "#e2e8f0";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.78rem", fontWeight: 600, padding: "0.25rem 0.65rem", borderRadius: "999px", backgroundColor: bg, color, border: `1.5px solid ${border}` }}>
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
