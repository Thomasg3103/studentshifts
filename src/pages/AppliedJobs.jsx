import { useState } from "react";
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

const STAGE_LABEL = {
  applied:     null,
  shortlisted: "Shortlisted",
  interview:   "Interview",
  trial:       "Trial Shift",
  decision:    "Final Decision",
};

// Sort order: Accepted first, Rejected second, Pending last
const STATUS_ORDER = { Accepted: 0, Rejected: 1, Pending: 2 };

function ConfirmDialog({ title, message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "1.75rem 1.5rem", maxWidth: "360px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
      >
        <h3 style={{ fontWeight: 800, fontSize: "1.1rem", margin: "0 0 0.4rem", color: "#1e293b" }}>{title}</h3>
        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.5rem", lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}
          >
            Keep it
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem", color: "white", ...confirmStyle }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppliedJobCard({ job, status, pipelineStage, preferredShift, onRemove, onMessage }) {
  const { setSelectedJob, setPage } = useApp();
  const s = STATUS_STYLE[status] || STATUS_STYLE.Pending;
  const stageLabel = status === "Pending" ? (STAGE_LABEL[pipelineStage] ?? null) : null;
  const photo = job.photos?.[0] || null;
  const crop  = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

  const showMessage = status === "Accepted";
  const showWithdraw = status === "Pending";
  const showRemove = status === "Rejected";

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

        {stageLabel && (
          <span className="badge badge-sm badge-blue" style={{ marginBottom: "0.3rem", display: "inline-block" }}>
            {stageLabel}
          </span>
        )}
        {preferredShift && status === "Pending" && (
          <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0 0 0.2rem" }}>
            Applied for: <strong>{preferredShift}</strong>
          </p>
        )}

        <p style={{ color: "#6b7280", fontSize: "0.85rem", marginBottom: "0.15rem" }}>{job.company} · {job.location}</p>
        <p style={{ fontWeight: "700", color: "#111827", marginBottom: "0.35rem", fontSize: "0.9rem" }}>{job.pay}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: (showMessage || showWithdraw || showRemove) ? "0.5rem" : 0 }}>
          {(job.days || []).map(day => (
            <span key={day} className="badge badge-brand badge-sm">
              {day.slice(0, 3)} · {(job.times || {})[day]?.join(", ")}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {showMessage && (
            <button
              aria-label={`Message ${job.company} about ${job.title}`}
              onClick={() => onMessage()}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}
            >
              💬 Message Company
            </button>
          )}
          {showWithdraw && (
            <button
              aria-label={`Withdraw application to ${job.title}`}
              onClick={() => onRemove(job.id, "withdraw")}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fca5a5", backgroundColor: "white", color: "#dc2626", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              Withdraw
            </button>
          )}
          {showRemove && (
            <button
              aria-label={`Remove application to ${job.title}`}
              onClick={() => onRemove(job.id, "remove")}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fca5a5", backgroundColor: "white", color: "#dc2626", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppliedJobs() {
  const { appliedJobs, setAppliedJobs, setSavedAppliedJobIds, currentUser, appStatuses: statuses = {}, setPage } = useApp();
  const [confirm, setConfirm] = useState(null); // { jobId, type: "withdraw"|"remove" }

  const handleRemoveRequest = (jobId, type) => {
    setConfirm({ jobId, type });
  };

  const handleRemoveConfirm = async () => {
    if (!confirm) return;
    const { jobId, type } = confirm;
    setConfirm(null);
    try {
      await removeApplication(currentUser.id, jobId);
      setAppliedJobs(prev => prev.filter(j => j.id !== jobId));
      setSavedAppliedJobIds(prev => prev.filter(id => id !== jobId));
      toast.success(type === "withdraw" ? "Application withdrawn" : "Application removed");
    } catch (e) {
      Sentry.captureException(e);
      console.error("Failed to remove application:", e);
      toast.error(e.message || "Failed to remove application.");
    }
  };

  const handleMessage = () => {
    setPage("messages");
  };

  const getStatus = (jobId) => statuses[jobId]?.status || "Pending";
  const getStage  = (jobId) => statuses[jobId]?.pipeline_stage || "applied";
  const getShift  = (jobId) => statuses[jobId]?.preferred_shift || null;

  // Sort: Accepted → Rejected → Pending; ties keep original order
  const sorted = [...appliedJobs].sort((a, b) => {
    const sa = STATUS_ORDER[getStatus(a.id)] ?? 2;
    const sb = STATUS_ORDER[getStatus(b.id)] ?? 2;
    return sa - sb;
  });

  const confirmingJob = confirm ? appliedJobs.find(j => j.id === confirm.jobId) : null;

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
            {sorted.map(job => (
              <AppliedJobCard
                key={job.id}
                job={job}
                status={getStatus(job.id)}
                pipelineStage={getStage(job.id)}
                preferredShift={getShift(job.id)}
                onRemove={handleRemoveRequest}
                onMessage={handleMessage}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button onClick={() => setPage("studentDashboard")} style={btnGray}>Back to Jobs</button>
          </div>
        </>
      )}
    </PageWrapper>

    {confirm && confirmingJob && (
      <ConfirmDialog
        title={confirm.type === "withdraw" ? "Withdraw application?" : "Remove application?"}
        message={
          confirm.type === "withdraw"
            ? `Your application to ${confirmingJob.title} at ${confirmingJob.company} will be cancelled. This cannot be undone.`
            : `Remove your declined application to ${confirmingJob.title} at ${confirmingJob.company} from your list?`
        }
        confirmLabel={confirm.type === "withdraw" ? "Yes, withdraw" : "Remove"}
        confirmStyle={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  );
}

const btnBase = { padding: "0.4rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 2px 8px rgba(162,29,84,0.3)" };
const btnGray = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)", padding: "0.75rem 1.75rem", fontSize: "0.9rem" };
