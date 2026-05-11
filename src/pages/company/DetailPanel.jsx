import { useState, useEffect, lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { saveApplicationNotes } from "../../lib/auth";
import { Section } from "./shared";
import ChatThread from "./ChatThread";
import { InterviewInviteModal } from "./InterviewInviteModal";

import { TrialInviteModal } from "./TrialInviteModal";
import { CloseJobModal } from "./CloseJobModal";

const PdfModal = lazy(() => import("./PdfModal").then(m => ({ default: m.PdfModal })));

/* ─── Local style helpers ────────────────────────────────────────────────── */

const panelActionBtn = (variant) => {
  const styles = {
    primary:   { backgroundColor: "var(--color-brand)", color: "white",    border: "none" },
    secondary: { backgroundColor: "white",   color: "#374151",  border: "1px solid #d1d5db" },
    danger:    { backgroundColor: "white",   color: "#b91c1c",  border: "1px solid #fca5a5" },
    accept:    { backgroundColor: "#15803d", color: "white",    border: "none" },
  };
  const s = styles[variant] || styles.primary;
  return { width: "100%", padding: "0.65rem 1rem", borderRadius: "0.4rem", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", ...s };
};

/* ─── CheckItem ──────────────────────────────────────────────────────────── */

export function CheckItem({ ok, label, warn }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.82rem" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, backgroundColor: ok ? "#dcfce7" : warn ? "#fef3c7" : "#fee2e2", color: ok ? "#16a34a" : warn ? "#d97706" : "#ef4444", fontSize: "0.65rem", fontWeight: "900" }}>
        {ok ? "✓" : warn ? "–" : "✗"}
      </span>
      <span style={{ color: ok ? "#374151" : "#6b7280", fontWeight: ok ? "600" : "400" }}>{label}</span>
    </div>
  );
}

/* ─── StatusBadge ────────────────────────────────────────────────────────── */

const STATUS_CLS = {
  Pending:  { cls: "badge-gray",  label: "Under Review" },
  Accepted: { cls: "badge-green", label: "Hired" },
  Rejected: { cls: "badge-red",   label: "Declined" },
};

export function StatusBadge({ status }) {
  const { cls, label } = STATUS_CLS[status] || STATUS_CLS.Pending;
  return <span className={`badge badge-tag ${cls}`}>{label}</span>;
}

export { CloseJobModal };

/* ─── DetailPanel ────────────────────────────────────────────────────────── */

export default function DetailPanel({ applicant, postingId, postingTitle, companyId, onClose, onStageAction, onUpdateStatus, onNotesSaved, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite, onSendTrialInvite }) {
  const [cvUrl, setCvUrl]     = useState(null);
  const [clUrl, setClUrl]     = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [clLoading, setClLoading] = useState(false);
  const [cvOpen, setCvOpen]   = useState(false);
  const [clOpen, setClOpen]   = useState(false);
  const [notes, setNotes]     = useState(applicant.notes || "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [trialDate, setTrialDate] = useState(applicant.trialDate || "");
  const [trialTime, setTrialTime] = useState(applicant.trialTime || "");
  const [profileOpen, setProfileOpen] = useState((applicant.pipelineStage || "applied") === "applied");
  const [inviteModalOpen, setInviteModalOpen] = useState(null); // null = closed, number = round index
  const [trialInviteOpen, setTrialInviteOpen] = useState(false);
  const [shortlistInviteOpen, setShortlistInviteOpen] = useState(false);
  const [nextRoundInviteOpen, setNextRoundInviteOpen] = useState(false);

  const buildRounds = (a) => {
    const stored = Array.isArray(a.interviewRoundsData) ? a.interviewRoundsData : [];
    const count  = Math.max(a.interviewRound || 1, 1);
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push({ date: stored[i]?.date || "", time: stored[i]?.time || "" });
    }
    // Backward compat: if round 1 empty but old single fields exist, use them
    if (result.length > 0 && !result[0].date && !result[0].time && (a.interviewDate || a.interviewTime)) {
      result[0] = { date: a.interviewDate || "", time: a.interviewTime || "" };
    }
    return result;
  };

  const [interviewRounds, setInterviewRounds] = useState(() => buildRounds(applicant));

  // Sync all local state when switching to a different applicant
  useEffect(() => {
    const s = applicant.pipelineStage || "applied";
    setNotes(applicant.notes || "");
    setTrialDate(applicant.trialDate || "");
    setTrialTime(applicant.trialTime || "");
    setInterviewRounds(buildRounds(applicant));
    setProfileOpen(s === "applied");
    setInviteModalOpen(null);
    setTrialInviteOpen(false);
    setShortlistInviteOpen(false);
    setNextRoundInviteOpen(false);
    setCvUrl(null);
    setClUrl(null);
    setCvOpen(false);
    setClOpen(false);
  }, [applicant.id]);

  const openCv = async () => {
    if (!cvUrl) {
      setCvLoading(true);
      try {
        const { getSignedDocumentUrl } = await import("../../lib/auth");
        setCvUrl(await getSignedDocumentUrl("documents", applicant.cvName));
      } catch (e) { Sentry.captureException(e); toast.error(`Could not load CV: ${e.message}`); setCvLoading(false); return; }
      setCvLoading(false);
    }
    setCvOpen(true);
  };

  const openCoverLetter = async () => {
    if (!clUrl) {
      setClLoading(true);
      try {
        const { getSignedDocumentUrl } = await import("../../lib/auth");
        setClUrl(await getSignedDocumentUrl("documents", applicant.coverLetterName));
      } catch (e) { Sentry.captureException(e); toast.error(`Could not load cover letter: ${e.message}`); setClLoading(false); return; }
      setClLoading(false);
    }
    setClOpen(true);
  };

  const handleNotesBlur = async () => {
    if (notes === applicant.notes) return;
    setNotesSaving(true);
    try {
      await saveApplicationNotes(applicant.id, notes);
      onNotesSaved(applicant.id, notes);
    } catch { /* silently ignore — notes are non-critical */ }
    setNotesSaving(false);
  };

  const stage = applicant.pipelineStage || "applied";

  return (
    <>
      <Suspense fallback={null}>
        {cvOpen && cvUrl && <PdfModal url={cvUrl} label={`${applicant.name}'s CV`} fileName={`${applicant.name.replace(/\s+/g, "_")}_CV.${(applicant.cvName || "pdf").split(".").pop()}`} onClose={() => setCvOpen(false)} />}
        {clOpen && clUrl && <PdfModal url={clUrl} label={`${applicant.name}'s Cover Letter`} fileName={`${applicant.name.replace(/\s+/g, "_")}_Cover_Letter.${(applicant.coverLetterName || "pdf").split(".").pop()}`} onClose={() => setClOpen(false)} />}
      </Suspense>

      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: 1100, animation: "fadeInOverlay 0.18s ease" }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(460px, 100vw)",
        backgroundColor: "white",
        zIndex: 1101,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
        overflowY: "auto",
        animation: "slideInRight 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: "0.85rem", flexShrink: 0 }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {applicant.profilePhoto
              ? <img loading="lazy" src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 0.3rem", fontWeight: "700", fontSize: "0.975rem", color: "#0f172a", letterSpacing: "-0.01em" }}>{applicant.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <StatusBadge status={applicant.status} />
              {applicant.preferredShift && (
                <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{applicant.preferredShift}</span>
              )}
            </div>
          </div>
          <button aria-label="Close panel" onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "0.4rem", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Stage progress strip */}
        <div style={{ padding: "0.6rem 1.5rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 0, flexShrink: 0, backgroundColor: "#f8fafc" }}>
          {["applied", "shortlisted", "interview", "trial", "decision"].map((s, i) => {
            const order = ["applied", "shortlisted", "interview", "trial", "decision"];
            const currentIdx = order.indexOf(stage);
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;
            const interviewRound = applicant.interviewRound || 1;
            const crumbLabel = s === "interview"
              ? (isCurrent && interviewRound > 1 ? `Interview Rd ${interviewRound}` : "Interview")
              : { applied: "Applied", shortlisted: "Shortlisted", trial: "Trial", decision: "Decision" }[s];
            return (
              <span key={s} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                {i > 0 && <span style={{ flex: "0 0 1px", height: "1px", backgroundColor: isPast ? "var(--color-brand)" : "#e2e8f0", margin: "0 0.2rem" }} />}
                <span style={{ fontSize: "0.68rem", fontWeight: isCurrent ? "700" : "500", color: isCurrent ? "var(--color-brand)" : isPast ? "var(--color-brand)" : "#cbd5e1", whiteSpace: "nowrap", opacity: isPast ? 0.6 : 1, flex: 1, textAlign: "center" }}>
                  {crumbLabel}
                </span>
              </span>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.5rem", flex: 1 }}>

          {/* Application Screening — applied stage only */}
          {stage === "applied" && (
            <Section label="Application Screening">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <CheckItem ok={!!applicant.cvName}              label="CV uploaded" />
                <CheckItem ok={!!applicant.coverLetterName}     label="Cover letter uploaded" />
                <CheckItem ok={!!applicant.bio}                 label="Bio written" />
                <CheckItem ok={(applicant.skills?.length||0)>0} label="Skills listed" />
                <CheckItem ok={!!applicant.linkedin} warn       label="LinkedIn provided (optional)" />
              </div>
              {!applicant.cvName && !applicant.bio && !(applicant.skills?.length) && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#b45309", fontWeight: "600", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "0.4rem", padding: "0.35rem 0.6rem" }}>
                  ⚠ Incomplete profile — consider requesting more info before advancing
                </p>
              )}
            </Section>
          )}

          {/* View Profile toggle — non-applied stages */}
          {stage !== "applied" && (
            <button
              onClick={() => setProfileOpen(p => !p)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.55rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", backgroundColor: profileOpen ? "#f8fafc" : "white", color: "#374151", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span>{profileOpen ? "Hide Profile" : "View Profile"}</span>
              <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{profileOpen ? "▲" : "▼"}</span>
            </button>
          )}

          {/* Bio + Skills + LinkedIn + Documents — always visible for applied, toggleable otherwise */}
          {(stage === "applied" || profileOpen) && (<>
            <Section label="Bio">
              <p style={{ margin: 0, fontSize: "0.85rem", color: applicant.bio ? "#374151" : "#9ca3af", fontStyle: applicant.bio ? "normal" : "italic", lineHeight: 1.6 }}>
                {applicant.bio || "Not provided"}
              </p>
            </Section>

            <Section label="Skills">
              {applicant.skills?.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {applicant.skills.map(s => (
                    <span key={s} className="badge badge-sm badge-blue">{s}</span>
                  ))}
                </div>
              ) : <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic" }}>Not listed</p>}
            </Section>

            <Section label="LinkedIn">
              {applicant.linkedin && /^https?:\/\//i.test(applicant.linkedin)
                ? <a href={applicant.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0a66c2", fontWeight: "600", textDecoration: "underline", display: "flex", alignItems: "center", gap: "0.3rem" }}>🔗 View LinkedIn Profile</a>
                : <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic" }}>Not provided</p>
              }
            </Section>

            <Section label="Documents">
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={openCv}
                  disabled={!applicant.cvName || cvLoading}
                  style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: "0.4rem", border: `1px solid ${applicant.cvName ? "#d1d5db" : "#e2e8f0"}`, backgroundColor: "white", color: applicant.cvName ? "#374151" : "#9ca3af", fontWeight: "600", fontSize: "0.82rem", cursor: applicant.cvName ? "pointer" : "default", fontFamily: "inherit", textAlign: "center" }}
                >
                  {cvLoading ? "Loading…" : "View CV"}
                </button>
                <button
                  onClick={openCoverLetter}
                  disabled={!applicant.coverLetterName || clLoading}
                  style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: "0.4rem", border: `1px solid ${applicant.coverLetterName ? "#d1d5db" : "#e2e8f0"}`, backgroundColor: "white", color: applicant.coverLetterName ? "#374151" : "#9ca3af", fontWeight: "600", fontSize: "0.82rem", cursor: applicant.coverLetterName ? "pointer" : "default", fontFamily: "inherit", textAlign: "center" }}
                >
                  {clLoading ? "Loading…" : "Cover Letter"}
                </button>
              </div>
            </Section>
          </>)}

          {/* Notes */}
          <Section label={notesSaving ? "Notes — saving…" : "Notes"}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Private notes visible only to your company…"
              rows={3}
              style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, color: "#374151" }}
            />
          </Section>

          {/* Interview rounds — shortlisted and interview stages */}
          {(stage === "shortlisted" || stage === "interview") && (
            <Section label="Interview Schedule">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {interviewRounds.map((round, i) => (
                  <div key={i} style={{ backgroundColor: "#faf5ff", border: "1.5px solid #e9d5ff", borderRadius: "0.6rem", padding: "0.65rem 0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.45rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "#7c3aed", color: "white", fontSize: "0.65rem", fontWeight: "900", flexShrink: 0 }}>{i + 1}</span>
                      <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: "800", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em" }}>Interview</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
                      <input
                        type="date"
                        value={round.date}
                        onChange={e => {
                          const v = e.target.value;
                          setInterviewRounds(prev => prev.map((r, idx) => idx === i ? { ...r, date: v } : r));
                        }}
                        onBlur={() => onSaveInterviewRoundsData?.(applicant.id, interviewRounds)}
                        style={{ flex: 1, minWidth: "120px", padding: "0.4rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #e9d5ff", fontSize: "0.8rem", fontFamily: "inherit", color: "#374151", backgroundColor: "white" }}
                      />
                      <input
                        type="time"
                        value={round.time}
                        onChange={e => {
                          const v = e.target.value;
                          setInterviewRounds(prev => prev.map((r, idx) => idx === i ? { ...r, time: v } : r));
                        }}
                        onBlur={() => onSaveInterviewRoundsData?.(applicant.id, interviewRounds)}
                        style={{ flex: 1, minWidth: "90px", padding: "0.4rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #e9d5ff", fontSize: "0.8rem", fontFamily: "inherit", color: "#374151", backgroundColor: "white" }}
                      />
                    </div>
                    <button
                      onClick={() => setInviteModalOpen(i)}
                      style={{ width: "100%", padding: "0.4rem", borderRadius: "0.4rem", border: "1px solid #e9d5ff", backgroundColor: "white", color: "#7c3aed", fontWeight: "600", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Send Invite
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Trial schedule — only in trial stage */}
          {stage === "trial" && (
            <Section label="Trial Shift Schedule">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  type="date"
                  value={trialDate}
                  onChange={e => setTrialDate(e.target.value)}
                  onBlur={() => onSaveTrialSchedule?.(applicant.id, trialDate, trialTime)}
                  style={{ flex: 1, minWidth: "130px", padding: "0.45rem 0.65rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151" }}
                />
                <input
                  type="time"
                  value={trialTime}
                  onChange={e => setTrialTime(e.target.value)}
                  onBlur={() => onSaveTrialSchedule?.(applicant.id, trialDate, trialTime)}
                  style={{ flex: 1, minWidth: "100px", padding: "0.45rem 0.65rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151" }}
                />
              </div>
              {(trialDate || trialTime) && (
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#16a34a", fontWeight: "600" }}>
                  {trialDate && trialTime ? `Scheduled: ${trialDate} at ${trialTime}` : trialDate ? `Date: ${trialDate}` : `Time: ${trialTime}`}
                </p>
              )}
            </Section>
          )}

          {/* Chat — only for accepted applicants */}
          {applicant.status === "Accepted" && (
            <Section label="Messages">
              <ChatThread jobId={postingId} studentId={applicant.studentId} companyId={companyId} senderId={companyId} studentName={applicant.name} jobTitle={postingTitle} />
            </Section>
          )}
        </div>

        {/* Interview invite modal (rendered inside panel so it layers correctly) */}
        {inviteModalOpen !== null && (
          <InterviewInviteModal
            applicant={applicant}
            roundNumber={inviteModalOpen + 1}
            date={interviewRounds[inviteModalOpen]?.date || ""}
            time={interviewRounds[inviteModalOpen]?.time || ""}
            onClose={() => setInviteModalOpen(null)}
            onSend={async (note, teamsLink, date, time) => {
              await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink);
            }}
          />
        )}

        {/* Stage action buttons */}
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
          {stage === "applied" && (
            <button onClick={() => onStageAction(applicant.id, "shortlisted")} style={panelActionBtn("primary")}>Move to Shortlist</button>
          )}
          {stage === "shortlisted" && (
            <button onClick={() => setShortlistInviteOpen(true)} style={panelActionBtn("primary")}>Send Interview Invite</button>
          )}
          {stage === "interview" && (<>
            <button onClick={() => setNextRoundInviteOpen(true)} style={panelActionBtn("secondary")}>Schedule Next Round</button>
            <button onClick={() => onStageAction(applicant.id, "trial")} style={panelActionBtn("primary")}>Advance to Trial</button>
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("secondary")}>Move to Decision</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("danger")}>Decline Applicant</button>
          </>)}
          {stage === "trial" && (<>
            <button onClick={() => setTrialInviteOpen(true)} style={panelActionBtn("secondary")}>Send Trial Invite</button>
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("primary")}>Move to Decision</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("danger")}>Decline Applicant</button>
          </>)}
          {stage === "decision" && applicant.status === "Pending" && (<>
            <button onClick={() => onUpdateStatus(applicant.id, "Accepted", applicant)} style={panelActionBtn("accept")}>Hire Applicant</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("danger")}>Decline Applicant</button>
          </>)}
        </div>
      </div>

      {/* Next round interview invite — increments round + sends email */}
      {nextRoundInviteOpen && (
        <InterviewInviteModal
          applicant={applicant}
          roundNumber={(applicant.interviewRound || 1) + 1}
          date=""
          time=""
          onClose={() => setNextRoundInviteOpen(false)}
          onSend={async (note, teamsLink, date, time) => {
            const newRounds = [...interviewRounds, { date: date || "", time: time || "" }];
            setInterviewRounds(newRounds);
            await onIncrementRound?.(applicant.id, applicant.interviewRound || 1, newRounds);
            await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink);
          }}
        />
      )}

      {/* Interview invite from shortlist — moves stage + sends email */}
      {shortlistInviteOpen && (
        <InterviewInviteModal
          applicant={applicant}
          roundNumber={1}
          date=""
          time=""
          onClose={() => setShortlistInviteOpen(false)}
          onSend={async (note, teamsLink, date, time) => {
            await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink);
            onStageAction(applicant.id, "interview_1");
          }}
        />
      )}

      {/* Trial invite modal */}
      {trialInviteOpen && (
        <TrialInviteModal
          applicant={applicant}
          date={trialDate}
          time={trialTime}
          onClose={() => setTrialInviteOpen(false)}
          onSend={async (date, time, note) => {
            await onSendTrialInvite?.(applicant.id, date, time, note);
          }}
        />
      )}
    </>
  );
}
