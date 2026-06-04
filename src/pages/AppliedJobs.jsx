import { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useFocusTrap } from "../hooks/useFocusTrap";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import "../StudentShiftWeb.css";
import { removeApplication } from "../lib/auth";
import { fetchInterviewSlots, selectInterviewSlot } from "../lib/applications";
import { useApp } from "../context/AppContext";
import { supabaseImg } from "../utils/img";

const STATUS_STYLE = {
  Pending:  { cls: "badge-yellow", icon: "🕐", label: "Pending" },
  Accepted: { cls: "badge-green",  icon: "✅", label: "Accepted" },
  Rejected: { cls: "badge-red",    icon: "❌", label: "Declined" },
};

const PIPELINE_STEPS = [
  { key: "applied",     short: "Applied",     long: "Applied" },
  { key: "shortlisted", short: "Shortlisted", long: "Shortlisted" },
  { key: "interview",   short: "Interview",   long: "Interview" },
  { key: "trial",       short: "Trial",       long: "Trial Shift" },
  { key: "decision",    short: "Decision",    long: "Final Decision" },
];

function PipelineStrip({ stage, status }) {
  const currentIdx = PIPELINE_STEPS.findIndex(s => s.key === stage);
  const isRejected = status === "Rejected";
  const isAccepted = status === "Accepted";
  return (
    <div style={{ marginTop: "0.5rem", marginBottom: "0.35rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const isPast    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const dotColor  = isAccepted ? "#16a34a"
            : isRejected && isCurrent ? "#dc2626"
            : isRejected && isPast    ? "#dc2626"
            : isCurrent ? "var(--color-brand)"
            : isPast    ? "#94a3b8"
            : "#e2e8f0";
          const lineColor = (isPast || (isCurrent && isAccepted)) ? (isRejected ? "#dc2626" : isAccepted ? "#16a34a" : "#94a3b8") : "#e2e8f0";
          return (
            <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < PIPELINE_STEPS.length - 1 ? "1" : "0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: dotColor, flexShrink: 0, border: isCurrent && !isAccepted && !isRejected ? "2px solid var(--color-brand)" : "none", boxSizing: "border-box" }} />
                <span style={{ fontSize: "0.55rem", fontWeight: isCurrent ? "800" : "500", color: isCurrent && !isRejected ? "var(--color-brand)" : "#94a3b8", marginTop: "0.2rem", whiteSpace: "nowrap", lineHeight: 1 }}>
                  {step.short}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{ flex: 1, height: "2px", backgroundColor: lineColor, margin: "0 2px", marginBottom: "0.9rem" }} />
              )}
            </div>
          );
        })}
      </div>
      {(isAccepted || isRejected || currentIdx > 0) && (
        <p style={{ margin: "0.2rem 0 0", fontSize: "0.7rem", fontWeight: "600", color: isAccepted ? "#16a34a" : isRejected ? "#dc2626" : "var(--color-brand)" }}>
          {isAccepted ? "Hired — congratulations!" : isRejected ? "Application declined" : `At ${PIPELINE_STEPS[currentIdx]?.long}`}
        </p>
      )}
    </div>
  );
}

// Sort order: Accepted first, Rejected second, Pending last
const STATUS_ORDER = { Accepted: 0, Rejected: 1, Pending: 2 };

function formatSlot(slotTime) {
  // Parse without timezone conversion — company entered local date/time
  const [datePart, timePart = ""] = slotTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, min = 0] = timePart.split(":").map(Number);
  const d = new Date(year, month - 1, day, hour, min);
  const weekday = d.toLocaleDateString("en-IE", { weekday: "short" });
  const dayStr  = d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  return `${weekday} ${dayStr} at ${timeStr}`;
}

function InterviewSlotPicker({ applicationId }) {
  const [slots, setSlots]       = useState(null); // null = loading
  const [selecting, setSelecting] = useState(null); // slotId being confirmed

  useEffect(() => {
    if (!applicationId) return;
    fetchInterviewSlots(applicationId)
      .then(data => setSlots(data))
      .catch(() => setSlots([]));
  }, [applicationId]);

  if (!applicationId || slots === null) return null;
  if (!slots.length) return null; // no slots offered — fall through to default nudge

  const selectedSlot = slots.find(s => s.selected);

  const handleSelect = async (slotId) => {
    if (selecting) return;
    setSelecting(slotId);
    try {
      await selectInterviewSlot(slotId, applicationId);
      setSlots(prev => prev.map(s => ({ ...s, selected: s.id === slotId })));
      toast.success("Interview time confirmed!");
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Could not confirm your time — please try again.");
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div style={{ margin: "0 1rem 0.65rem", padding: "0.75rem", backgroundColor: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: "0.75rem" }}>
      <p style={{ margin: "0 0 0.55rem", fontSize: "0.78rem", fontWeight: "800", color: "#7c3aed" }}>
        {selectedSlot ? "✓ Interview time confirmed" : "Pick your interview time"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {slots.map(slot => {
          const isSelected = slot.selected;
          const isLoading  = selecting === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => !isSelected && handleSelect(slot.id)}
              disabled={!!selecting}
              style={{
                padding: "0.55rem 0.8rem",
                borderRadius: "0.5rem",
                border: `1.5px solid ${isSelected ? "#7c3aed" : "#ddd6fe"}`,
                backgroundColor: isSelected ? "#7c3aed" : "white",
                color: isSelected ? "white" : "#374151",
                fontWeight: isSelected ? "700" : "500",
                fontSize: "0.82rem",
                cursor: isSelected || selecting ? "default" : "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "Confirming…" : `${isSelected ? "✓ " : ""}${formatSlot(slot.slot_time)}`}
            </button>
          );
        })}
      </div>
      {!selectedSlot && (
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.7rem", color: "#7c3aed", fontWeight: "500" }}>
          Tap a time to confirm your attendance.
        </p>
      )}
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, confirmStyle, onConfirm, onCancel }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, onCancel);
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "1.75rem 1.5rem", maxWidth: "360px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
      >
        <h3 id="confirm-dialog-title" style={{ fontWeight: 800, fontSize: "1.1rem", margin: "0 0 0.4rem", color: "#1e293b" }}>{title}</h3>
        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.5rem", lineHeight: 1.55 }}>{message}</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}
          >
            Keep Application
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

function AppliedJobCard({ job, status, pipelineStage, preferredShift, applicationId, onRemove, onMessage }) {
  const { setSelectedJob, setPage } = useApp();
  const s = STATUS_STYLE[status] || STATUS_STYLE.Pending;
  const photo = supabaseImg(job.photos?.[0] || null, 240);
  const crop  = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

  const showMessage  = status === "Accepted";
  const showWithdraw = status === "Pending";
  const showRemove   = status === "Rejected";
  const advancedStage = status === "Pending" && (pipelineStage === "shortlisted" || pipelineStage === "interview" || pipelineStage === "trial");

  return (
    <div role="listitem" className="job-card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Photo */}
        <div style={{ width: "120px", flexShrink: 0, position: "relative", overflow: "hidden", borderRadius: "1rem 0 0 1rem", alignSelf: "stretch", minHeight: "110px" }}>
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
          {/* Title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.15rem" }}>
            <h2 style={{ fontWeight: "800", fontSize: "1.05rem", margin: 0, color: "#1e293b" }}>{job.title}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
              <span className={`badge badge-sm ${s.cls}`} style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.icon} {s.label}
              </span>
              <button aria-label={`View ${job.title}`} onClick={() => { setSelectedJob(job); setPage("jobDetails"); }} style={btnBlue}>View</button>
            </div>
          </div>

          <p style={{ color: "#6b7280", fontSize: "0.82rem", margin: "0 0 0.1rem" }}>{job.company} · {job.location}</p>
          <p style={{ fontWeight: "700", color: "#111827", margin: "0 0 0.3rem", fontSize: "0.88rem" }}>{job.pay}</p>

          {preferredShift && status === "Pending" && (
            <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "0 0 0.3rem" }}>
              Shift: <strong>{preferredShift}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Pipeline progress strip — always show for pending */}
      {status === "Pending" && (
        <div style={{ padding: "0 1rem 0.6rem 1rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.6rem" }}>
          <PipelineStrip stage={pipelineStage} status={status} />
        </div>
      )}

      {/* Outcome strip for accepted/rejected */}
      {(status === "Accepted" || status === "Rejected") && (
        <div style={{ padding: "0.5rem 1rem 0.6rem", borderTop: "1px solid #f1f5f9", backgroundColor: status === "Accepted" ? "#f0fdf4" : "#fff1f2" }}>
          <PipelineStrip stage={pipelineStage} status={status} />
        </div>
      )}

      {/* Interview slot picker — only when interview stage has offered slots */}
      {pipelineStage === "interview" && status === "Pending" && (
        <InterviewSlotPicker applicationId={applicationId} />
      )}

      {/* Contextual message nudge — shortlisted / trial (interview handled above) */}
      {advancedStage && pipelineStage !== "interview" && (
        <div style={{ margin: "0 1rem 0.65rem", padding: "0.5rem 0.75rem", backgroundColor: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: "0.6rem", display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "#0369a1", fontWeight: 600 }}>
            {pipelineStage === "shortlisted" ? "You've been shortlisted! The company may reach out soon." : "Trial shift scheduled — check your messages for details."}
          </p>
          <button onClick={() => onMessage()} style={{ padding: "0.35rem 0.75rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "white", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}>
            Messages
          </button>
        </div>
      )}

      {/* Action buttons */}
      {(showMessage || showWithdraw || showRemove) && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0 1rem 0.85rem" }}>
          {showMessage && (
            <button aria-label={`Message ${job.company} about ${job.title}`} onClick={() => onMessage()}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}>
              💬 Message Company
            </button>
          )}
          {showMessage && (
            <button disabled title="Coming soon" style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "var(--color-bg-elevated, white)", color: "#94a3b8", fontWeight: "700", fontSize: "0.78rem", cursor: "default", fontFamily: "inherit" }}>
              📄 Offer Letter <span style={{ fontSize: "0.65rem" }}>· Soon</span>
            </button>
          )}
          {showMessage && (
            <button disabled title="Coming soon" style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "var(--color-bg-elevated, white)", color: "#94a3b8", fontWeight: "700", fontSize: "0.78rem", cursor: "default", fontFamily: "inherit" }}>
              ⭐ Review Company <span style={{ fontSize: "0.65rem" }}>· Soon</span>
            </button>
          )}
          {showWithdraw && (
            <button aria-label={`Withdraw application to ${job.title}`} onClick={() => onRemove(job.id, "withdraw")}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fca5a5", backgroundColor: "var(--color-bg-elevated, white)", color: "#dc2626", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
              Withdraw
            </button>
          )}
          {showRemove && (
            <button aria-label={`Remove application to ${job.title}`} onClick={() => onRemove(job.id, "remove")}
              style={{ padding: "0.38rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fca5a5", backgroundColor: "var(--color-bg-elevated, white)", color: "#dc2626", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const WITHDRAW_REASONS = [
  "Found another job",
  "No longer available",
  "Changed my mind",
  "Other",
];

export default function AppliedJobs() {
  const { appliedJobs, setAppliedJobs, setSavedAppliedJobIds, currentUser, appStatuses: statuses = {}, setPage } = useApp();
  const [confirm, setConfirm] = useState(null); // { jobId, type: "withdraw"|"remove" }
  const [withdrawReason, setWithdrawReason] = useState("");

  const handleRemoveRequest = (jobId, type) => {
    setWithdrawReason("");
    setConfirm({ jobId, type });
  };

  const handleRemoveConfirm = async () => {
    if (!confirm) return;
    const { jobId, type } = confirm;
    setConfirm(null);
    try {
      await removeApplication(currentUser.id, jobId, type === "withdraw" ? withdrawReason || null : null);
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
  const getAppId  = (jobId) => statuses[jobId]?.application_id || null;

  // Sort: Accepted → Rejected → Pending; ties keep original order
  const sorted = [...appliedJobs].sort((a, b) => {
    const sa = STATUS_ORDER[getStatus(a.id)] ?? 2;
    const sb = STATUS_ORDER[getStatus(b.id)] ?? 2;
    return sa - sb;
  });

  const confirmingJob = confirm ? appliedJobs.find(j => j.id === confirm.jobId) : null;

  return (
    <><Helmet><title>Applied Jobs — StudentShifts</title><meta name="robots" content="noindex" /></Helmet>
    <BackButton />
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
                applicationId={getAppId(job.id)}
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

    {confirm && confirmingJob && confirm.type === "withdraw" && (
      <WithdrawReasonDialog
        job={confirmingJob}
        reason={withdrawReason}
        onReasonChange={setWithdrawReason}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}
    {confirm && confirmingJob && confirm.type === "remove" && (
      <ConfirmDialog
        title="Remove application?"
        message={`Remove your declined application to ${confirmingJob.title} at ${confirmingJob.company} from your list?`}
        confirmLabel="Remove"
        confirmStyle={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}
        onConfirm={handleRemoveConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}
    </>
  );
}

function WithdrawReasonDialog({ job, reason, onReasonChange, onConfirm, onCancel }) {
  const panelRef = useRef(null);
  useFocusTrap(panelRef, onCancel);
  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-dialog-title"
        style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "1.75rem 1.5rem", maxWidth: "360px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
      >
        <h3 id="withdraw-dialog-title" style={{ fontWeight: 800, fontSize: "1.1rem", margin: "0 0 0.25rem", color: "#1e293b" }}>Withdraw application?</h3>
        <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1rem", lineHeight: 1.55 }}>
          {job.title} at {job.company} — why are you withdrawing?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.25rem" }}>
          {WITHDRAW_REASONS.map(r => (
            <button
              key={r}
              onClick={() => onReasonChange(r)}
              style={{ padding: "0.6rem 0.85rem", borderRadius: "0.65rem", border: `1.5px solid ${reason === r ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: reason === r ? "#fce7f3" : "var(--color-bg-surface, #f8fafc)", color: reason === r ? "var(--color-brand)" : "var(--color-text-body, #374151)", fontWeight: reason === r ? "700" : "500", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
            >
              {reason === r ? "✓ " : ""}{r}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "#374151", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}
          >
            Keep Application
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason}
            style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", fontWeight: 700, cursor: reason ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "0.875rem", color: "white", background: reason ? "linear-gradient(135deg, #f43f5e, #e11d48)" : "#e2e8f0", boxShadow: reason ? "0 4px 14px rgba(244,63,94,0.3)" : "none" }}
          >
            Withdraw
          </button>
        </div>
      </div>
    </div>
  );
}

const btnBase = { padding: "0.4rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.82rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 2px 8px rgba(162,29,84,0.3)" };
const btnGray = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)", padding: "0.75rem 1.75rem", fontSize: "0.9rem" };
