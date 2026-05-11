import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import "../StudentShiftWeb.css";
import { removeApplication } from "../lib/auth";
import { useApp } from "../context/AppContext";

const STATUS_STYLE = {
  Pending:  { cls: "badge-yellow", icon: "🕐", label: "Pending" },
  Accepted: { cls: "badge-green",  icon: "✅", label: "Accepted" },
  Rejected: { cls: "badge-red",    icon: "❌", label: "Declined" },
};

function AppliedJobCard({ job, status, onRemove }) {
  const { setSelectedJob, setPage } = useApp();
  const s = STATUS_STYLE[status] || STATUS_STYLE.Pending;
  const photo = job.photos?.[0] || null;
  const crop  = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

  return (
    <div role="listitem" className="job-card" style={{ display: "flex", alignItems: "flex-start", padding: 0, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ width: "120px", height: "120px", flexShrink: 0, position: "relative", overflow: "hidden", borderRadius: "1rem 0 0 0" }}>
        {photo ? (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
            <img loading="lazy" src={photo} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" }}>
            <span style={{ fontSize: "2rem", opacity: 0.5 }}>🏢</span>
          </div>
        )}
      </div>
      <div style={{ flex: 1, padding: "0.85rem 1rem", minWidth: 0 }}>
        {/* Title + status + view */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.2rem" }}>
          <h2 style={{ fontWeight: "800", fontSize: "1.05rem", margin: 0, color: "#1e293b" }}>{job.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
            <span className={`badge badge-sm ${s.cls}`} style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {s.icon} {s.label}
            </span>
            <button aria-label={`View ${job.title}`} onClick={() => { setSelectedJob(job); setPage("jobDetails"); }} style={btnBlue}>View</button>
          </div>
        </div>

        <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.15rem" }}>{job.company} · {job.location}</p>
        <p style={{ fontWeight: "700", color: "#111827", marginBottom: "0.35rem", fontSize: "0.9rem" }}>{job.pay}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: status === "Rejected" ? "0.5rem" : 0 }}>
          {job.days.map(day => (
            <span key={day} className="badge badge-brand badge-sm">
              {day.slice(0, 3)} · {job.times[day]?.join(", ")}
            </span>
          ))}
        </div>

        {status === "Rejected" && (
          <button
            aria-label={`Remove application to ${job.title}`}
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

export default function AppliedJobs() {
  const { appliedJobs, setAppliedJobs, setSavedAppliedJobIds, currentUser, appStatuses: statuses = {} } = useApp();
  const handleRemove = async (jobId) => {
    try {
      await removeApplication(currentUser.id, jobId);
      setAppliedJobs(prev => prev.filter(j => j.id !== jobId));
      setSavedAppliedJobIds(prev => prev.filter(id => id !== jobId));
      toast.success("Application removed");
    } catch (e) {
      Sentry.captureException(e);
      console.error("Failed to remove application:", e);
      toast.error(e.message || "Failed to remove application.");
    }
  };

  return (
    <><BackButton />
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>✅ Applied Jobs</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Track your applications and hear back from employers</p>
      </div>

      {appliedJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No applications yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Find a job you like and hit Apply to get started.</p>
          <button onClick={() => setPage("studentDashboard")} style={btnGray}>Browse Jobs</button>
        </div>
      ) : (
        <>
          <div role="list" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {appliedJobs.map(job => (
              <AppliedJobCard
                key={job.id}
                job={job}
                status={statuses[job.id] || "Pending"}
                onRemove={handleRemove}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button onClick={() => setPage("studentDashboard")} style={btnGray}>Back to Jobs</button>
          </div>
        </>
      )}
    </PageWrapper></>
  );
}

const btnBase = { padding: "0.4rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 2px 8px rgba(162,29,84,0.3)" };
const btnGray = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)", padding: "0.75rem 1.75rem", fontSize: "0.9rem" };
