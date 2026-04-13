import { useState, useEffect } from "react";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { fetchApplicationStatuses, removeApplication } from "../lib/auth";

const STATUS_STYLE = {
  Pending:  { bg: "#fef3c7", color: "#d97706", icon: "🕐", label: "Pending" },
  Accepted: { bg: "#dcfce7", color: "#16a34a", icon: "✅", label: "Accepted" },
  Rejected: { bg: "#fee2e2", color: "#dc2626", icon: "❌", label: "Declined" },
};

function AppliedJobCard({ job, status, onRemove, setSelectedJob, setPage }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Pending;
  const photo = job.photos?.[0] || null;
  const crop  = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

  return (
    <div className="job-card" style={{ flexDirection: "column", alignItems: "stretch", padding: 0, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ width: "100%", aspectRatio: "16/7", backgroundColor: "#0f172a", overflow: "hidden", position: "relative", flexShrink: 0 }}>
        {photo ? (
          <div style={{
            position: "absolute", inset: 0,
            transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`,
            transformOrigin: "center",
          }}>
            <img src={photo} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "2rem", opacity: 0.3 }}>🏢</span>
          </div>
        )}
      </div>
      <div style={{ padding: "0.85rem 1rem" }}>
        {/* Title + status + view */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.2rem" }}>
          <h2 style={{ fontWeight: "800", fontSize: "1.05rem", margin: 0, color: "#1e293b" }}>{job.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: "700", padding: "0.2rem 0.6rem", borderRadius: "999px", backgroundColor: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {s.icon} {s.label}
            </span>
            <button onClick={() => { setSelectedJob(job); setPage("jobDetails"); }} style={btnBlue}>View</button>
          </div>
        </div>

        <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.15rem" }}>{job.company} · {job.location}</p>
        <p style={{ fontWeight: "700", color: "#111827", marginBottom: "0.35rem", fontSize: "0.9rem" }}>{job.pay}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: status === "Rejected" ? "0.5rem" : 0 }}>
          {job.days.map(day => (
            <span key={day} style={{ fontSize: "0.7rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: "600" }}>
              {day.slice(0, 3)} · {job.times[day]?.join(", ")}
            </span>
          ))}
        </div>

        {status === "Rejected" && (
          <button
            onClick={() => onRemove(job.id)}
            style={{ marginTop: "0.5rem", padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fca5a5", backgroundColor: "white", color: "#dc2626", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppliedJobs({ appliedJobs, setAppliedJobs, setSavedAppliedJobIds, setSelectedJob, setPage, currentUser }) {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    fetchApplicationStatuses(currentUser.id)
      .then(map => { setStatuses(map); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentUser?.id]);

  const handleRemove = async (jobId) => {
    setRemoveError("");
    try {
      await removeApplication(currentUser.id, jobId);
      setAppliedJobs(prev => prev.filter(j => j.id !== jobId));
      setSavedAppliedJobIds(prev => prev.filter(id => id !== jobId));
      setStatuses(prev => { const s = { ...prev }; delete s[jobId]; return s; });
    } catch (e) {
      console.error("Failed to remove application:", e);
      setRemoveError(e.message || "Failed to remove application.");
    }
  };

  return (
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>✅ Applied Jobs</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Track your applications and hear back from employers</p>
      </div>

      {removeError && (
        <p style={{ color: "#ef4444", fontSize: "0.85rem", textAlign: "center", marginBottom: "1rem" }}>{removeError}</p>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1rem", fontWeight: "600" }}>Loading applications…</p>
        </div>
      ) : appliedJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No applications yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Find a job you like and hit Apply to get started.</p>
          <button onClick={() => setPage("studentDashboard")} style={btnGray}>Browse Jobs</button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {appliedJobs.map(job => (
              <AppliedJobCard
                key={job.id}
                job={job}
                status={statuses[job.id] || "Pending"}
                onRemove={handleRemove}
                setSelectedJob={setSelectedJob}
                setPage={setPage}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button onClick={() => setPage("studentDashboard")} style={btnGray}>Back to Jobs</button>
          </div>
        </>
      )}
    </PageWrapper>
  );
}

const btnBase = { padding: "0.4rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" };
const btnGray = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)", padding: "0.75rem 1.75rem", fontSize: "0.9rem" };
