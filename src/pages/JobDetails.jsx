import { useState } from "react";
import PageWrapper from "../components/PageWrapper";

const COMPANY_PHOTOS = {
  "Galway Pub":     "https://picsum.photos/seed/galwaypub/800/140",
  "SuperMart":      "https://picsum.photos/seed/supermart/800/140",
  "Campus Library": "https://picsum.photos/seed/campuslibrary/800/140",
  "Galway Bistro":  "https://picsum.photos/seed/galwaybistro/800/140",
  "City Mall":      "https://picsum.photos/seed/citymall/800/140",
  "Coffee Hub":     "https://picsum.photos/seed/coffeehub/800/140",
  "City Hotel":     "https://picsum.photos/seed/cityhotel/800/140",
  "Tech Store":     "https://picsum.photos/seed/techstore/800/140",
  "City Bistro":    "https://picsum.photos/seed/citybistro/800/140",
};

export default function JobDetails({
  job, setPage, currentUser, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs,
}) {
  const [applyModal, setApplyModal] = useState(null);
  const [photoIdx, setPhotoIdx]     = useState(0);

  if (!job) return null;

  const isLiked   = likedJobs.some(j => j.id === job.id);
  const isApplied = appliedJobs.some(j => j.id === job.id);

  const toggleLike = () => {
    if (!currentUser) { setPage("login"); return; }
    if (isApplied) return;
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
  };

  const handleApply = () => {
    if (!currentUser) { setPage("login"); return; }
    if (isApplied) return;
    if (!currentUser.cvName) {
      if (window.confirm("You need to upload a CV before applying. Go to your Account page?")) setPage("account");
      return;
    }
    setApplyModal("confirm");
  };

  const confirmApply = () => {
    setAppliedJobs([...appliedJobs, job]);
    if (isLiked) setLikedJobs(likedJobs.filter(j => j.id !== job.id));
    setApplyModal("success");
  };

  const deadlineStr = job.deadline
    ? new Date(job.deadline).toLocaleDateString("en-IE", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <PageWrapper>
      {/* Banner photo carousel */}
      {(() => {
        const photos = job.photos?.length > 0 ? job.photos : [COMPANY_PHOTOS[job.company] || "https://picsum.photos/seed/default/800/140"];
        const idx = Math.min(photoIdx, photos.length - 1);
        return (
          <div style={{ position: "relative", margin: "-2rem -2.5rem 1.5rem", borderRadius: "1.25rem 1.25rem 0 0", aspectRatio: "16/7", backgroundColor: "#0f172a", overflow: "hidden", display: "block" }}>
            {(() => {
              const crop = job.photoCrops?.[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
              return crop.zoom === 1 && crop.offsetX === 0 && crop.offsetY === 0 ? (
                <img src={photos[idx]} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
              ) : (
                <img src={photos[idx]} alt={job.company} style={{
                  position: "absolute",
                  top: `calc(50% + ${crop.offsetY}%)`,
                  left: `calc(50% + ${crop.offsetX}%)`,
                  transform: `translate(-50%, -50%) scale(${crop.zoom})`,
                  transformOrigin: "center",
                  minWidth: "100%", minHeight: "100%", width: "auto", height: "auto", maxWidth: "none",
                  display: "block",
                }} />
              );
            })()}
            {photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx((idx - 1 + photos.length) % photos.length)} style={arrowBtn("left")}>‹</button>
                <button onClick={() => setPhotoIdx((idx + 1) % photos.length)} style={arrowBtn("right")}>›</button>
                <div style={{ position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "5px" }}>
                  {photos.map((_, i) => <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: i === idx ? "white" : "rgba(255,255,255,0.4)" }} />)}
                </div>
              </>
            )}
          </div>
        );
      })()}
      <h1 style={{ fontWeight: "800", fontSize: "1.75rem", marginBottom: "0.2rem", color: "#1e293b" }}>{job.title}</h1>
      <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "1.5rem", fontWeight: "500" }}>{job.company}</p>

      {/* Description */}
      {job.description && (
        <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <p style={{ fontWeight: "700", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: "0.5rem" }}>About This Role</p>
          <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: "1.65", margin: 0 }}>{job.description}</p>
        </div>
      )}

      {/* Details */}
      <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
        <InfoRow label="Location" value={job.location} />
        <InfoRow label="Pay"      value={job.pay} />
        <InfoRow label="Weekend"  value={job.weekendRequired ? "Required" : "Not required"} />
        {deadlineStr && <InfoRow label="Apply By" value={deadlineStr} highlight={true} />}
      </div>

      {/* Availability */}
      <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.75rem" }}>
        <p style={{ fontWeight: "700", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: "0.75rem" }}>Availability</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {job.days.map(day => (
            <span key={day} style={{ fontSize: "0.8rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.25rem 0.65rem", borderRadius: "999px", fontWeight: "600" }}>
              {day} · {job.times[day]?.join(", ")}
            </span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="job-details-buttons" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {!isApplied && (
          <button onClick={toggleLike} style={{ ...btn, background: isLiked ? "#10b981" : "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}>
            {isLiked ? "✅ Liked" : "❤️ Like"}
          </button>
        )}
        <button onClick={handleApply} style={{ ...btn, background: isApplied ? "#10b981" : "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: isApplied ? "none" : "0 4px 14px rgba(99,102,241,0.35)" }}>
          {isApplied ? "✅ Applied" : "Apply Now"}
        </button>
        <button onClick={() => setPage("studentDashboard")} style={{ ...btn, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}>← Back</button>
      </div>

      {/* Apply modal */}
      {applyModal && (
        <div onClick={() => setApplyModal(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "360px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            {applyModal === "confirm" ? (
              <>
                <div style={{ width: "56px", height: "56px", borderRadius: "1rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem", boxShadow: "0 8px 20px rgba(99,102,241,0.35)" }}>📋</div>
                <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>Apply for {job.title}?</h3>
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>{job.company} — your CV will be shared with the employer.</p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={() => setApplyModal(null)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={confirmApply} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>Apply Now</button>
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
    </PageWrapper>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.95rem" }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: "600", color: highlight ? "#f59e0b" : "#1e293b" }}>{value}</span>
    </div>
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
