import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabaseImg } from "../../utils/img";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { saveApplicationNotes } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { Section } from "./shared";
import ChatThread from "./ChatThread";
import { InterviewInviteModal } from "./InterviewInviteModal";
import { useFocusTrap } from "../../hooks/useFocusTrap";

import { TrialInviteModal } from "./TrialInviteModal";
import { CloseJobModal } from "./CloseJobModal";

const PdfModal = lazy(() => import("./PdfModal").then(m => ({ default: m.PdfModal })));

/* ─── Local style helpers ────────────────────────────────────────────────── */

const panelActionBtn = (variant) => {
  const styles = {
    primary:   { backgroundColor: "var(--color-brand)", color: "white",    border: "none" },
    secondary: { backgroundColor: "var(--color-bg-elevated, white)",   color: "var(--color-text-body, #374151)",  border: "1px solid var(--color-border-light, #d1d5db)" },
    danger:    { backgroundColor: "var(--color-bg-elevated, white)",   color: "#b91c1c",  border: "1px solid #fca5a5" },
    accept:    { backgroundColor: "#15803d", color: "white",    border: "none" },
    purple:    { backgroundColor: "#7c3aed", color: "white",    border: "none" },
    green:     { backgroundColor: "#15803d", color: "white",    border: "none" },
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

export default function DetailPanel({ applicant, postingId, postingTitle, companyId, onClose, onStageAction, onUpdateStatus, onNotesSaved, onIncrementRound, _onSaveTrialSchedule, _onSaveInterviewRoundsData, onSendInterviewInvite, onSendTrialInvite }) {
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
  const [hireLoading, setHireLoading]   = useState(false);
  const [rehireLoading, setRehireLoading] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [reliabilityScore, setReliabilityScore] = useState(null);
  const panelBodyRef = useRef(null);
  useFocusTrap(panelBodyRef, onClose);

  useEffect(() => {
    if (!applicant.studentId) return;
    supabase.rpc("get_student_reliability_score", { p_student_id: applicant.studentId })
      .then(({ data }) => { if (data) setReliabilityScore(data); })
      .catch(() => {});
  }, [applicant.studentId]);

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
  const [interviewSlots, setInterviewSlots]   = useState([]); // slots offered to student

  // Load interview slots and subscribe to realtime when panel is open at interview stage
  useEffect(() => {
    const stage = applicant.pipelineStage || "applied";
    if (stage !== "interview") { setInterviewSlots([]); return; }

    supabase.from("interview_slots")
      .select("id, slot_time, selected")
      .eq("application_id", applicant.id)
      .order("slot_time")
      .then(({ data }) => setInterviewSlots(data || []));

    const channel = supabase.channel(`slots-company:${applicant.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "interview_slots",
        filter: `application_id=eq.${applicant.id}`,
      }, (payload) => {
        setInterviewSlots(prev => prev.map(s =>
          s.id === payload.new.id ? { ...s, selected: payload.new.selected } : s
        ));
        // If this update marks a slot as selected, auto-fill the round card
        if (payload.new.selected) {
          const st = payload.new.slot_time;
          const [datePart, timePart = ""] = st.split("T");
          const timeOnly = timePart.slice(0, 5);
          setInterviewRounds(prev => {
            const updated = [...prev];
            if (updated[0]) updated[0] = { ...updated[0], date: datePart, time: timeOnly };
            return updated;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant.id, applicant.pipelineStage]);

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
    setNotesSaved(false);
    // Scroll panel back to top when switching applicants
    if (panelBodyRef.current) panelBodyRef.current.scrollTop = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant.id, applicant.pipelineStage, applicant.notes, applicant.trialDate, applicant.trialTime, applicant.interviewRoundsData]);

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
    if (notes === (applicant.notes || "")) return;
    setNotesSaving(true);
    setNotesSaved(false);
    try {
      await saveApplicationNotes(applicant.id, notes);
      onNotesSaved(applicant.id, notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch { toast.error("Failed to save notes — please try again."); }
    setNotesSaving(false);
  };

  const handleRehire = async () => {
    setRehireLoading(true);
    try {
      const firstName = applicant.name.split(" ")[0];
      await supabase.from("chat_messages").insert({
        job_id:     postingId,
        student_id: applicant.studentId,
        company_id: companyId,
        sender_id:  companyId,
        text:       `Hi ${firstName}! We really enjoyed having you with us. Would you be interested in working another shift? Let us know when you're available!`,
      });
      toast.success("Rehire message sent!");
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Could not send message — please try again.");
    }
    setRehireLoading(false);
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
      <div
        ref={panelBodyRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${applicant.name} — applicant details`}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(460px, 100vw)",
          backgroundColor: "var(--color-bg-elevated, white)",
          zIndex: 1101,
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
          overflowY: "auto",
          animation: "slideInRight 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-start", gap: "0.85rem", flexShrink: 0 }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "var(--color-bg-surface, #f1f5f9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {applicant.profilePhoto
              ? <img loading="lazy" src={supabaseImg(applicant.profilePhoto, 88)} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 0.3rem", fontWeight: "700", fontSize: "0.975rem", color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.01em" }}>{applicant.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <StatusBadge status={applicant.status} />
              {reliabilityScore && (() => {
                const lbl = reliabilityScore.label;
                const styles = {
                  Reliable: { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
                  New:      { bg: "#f1f5f9", color: "var(--color-text-secondary, #64748b)", border: "#cbd5e1" },
                  Flagged:  { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
                };
                const s = styles[lbl] || styles.New;
                return (
                  <span style={{ fontSize: "0.65rem", fontWeight: "700", padding: "0.1rem 0.45rem", borderRadius: "999px", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                    {lbl === "Reliable" ? "✓ " : lbl === "Flagged" ? "⚠ " : ""}{lbl}
                  </span>
                );
              })()}
              {applicant.preferredShift && (
                <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>{applicant.preferredShift}</span>
              )}
            </div>
          </div>
          <button aria-label="Close panel" onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "0.4rem", border: "1px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", cursor: "pointer", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Stage progress strip */}
        <div style={{ padding: "0.6rem 1.5rem", borderBottom: "1px solid var(--color-border-light, #f1f5f9)", display: "flex", alignItems: "center", gap: 0, flexShrink: 0, backgroundColor: "var(--color-bg-surface, #f8fafc)" }}>
          {["applied", "shortlisted", "interview", "trial", "decision"].map((s, i) => {
            const order = ["applied", "shortlisted", "interview", "trial", "decision"];
            const currentIdx = order.indexOf(stage);
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;
            const interviewRound = applicant.interviewRound || 1;
            const crumbLabel = s === "interview"
              ? `Interview Rd ${interviewRound}`
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

          {/* Work Profile — structured signals (all stages) */}
          {(applicant.rightToWork || applicant.driverLicence || applicant.transport?.length > 0 || applicant.workExperience || applicant.canStart) && (
            <Section label="Work Profile">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <CheckItem ok={applicant.rightToWork}    label="Right to work in Ireland" />
                <CheckItem ok={applicant.driverLicence}  label="Full driver's licence" />
              </div>
              {applicant.transport?.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Transport</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {applicant.transport.map(t => <span key={t} className="badge badge-sm badge-gray">{t}</span>)}
                  </div>
                </div>
              )}
              {(applicant.workExperience || applicant.canStart) && (
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {applicant.workExperience && (
                    <div>
                      <p style={{ margin: "0 0 0.15rem", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Experience</p>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: "600", color: "var(--color-text-body, #374151)" }}>
                        {{ none: "None", under1: "Under 1 yr", "1to3": "1–3 yrs", "3plus": "3+ yrs" }[applicant.workExperience] || applicant.workExperience}
                      </p>
                    </div>
                  )}
                  {applicant.canStart && (
                    <div>
                      <p style={{ margin: "0 0 0.15rem", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Can start</p>
                      <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: "600", color: "var(--color-text-body, #374151)" }}>
                        {{ immediately: "Immediately", "1week": "Within 1 wk", "2weeks": "Within 2 wks", "1month": "Within 1 mo" }[applicant.canStart] || applicant.canStart}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Screening answers (Option A) */}
          {applicant.screeningAnswers?.length > 0 && (
            <Section label="Screening Answers">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {applicant.screeningAnswers.map((a, i) => {
                  const isKnockout = a.knockout_if_no && a.type === "yes_no" && a.answer === "no";
                  return (
                    <div key={i} style={{ backgroundColor: isKnockout ? "#fff1f2" : "var(--color-bg-surface, #f8fafc)", border: `1px solid ${isKnockout ? "#fca5a5" : "var(--color-border-light, #e2e8f0)"}`, borderRadius: "0.5rem", padding: "0.55rem 0.7rem" }}>
                      <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", fontWeight: "700", color: isKnockout ? "#b91c1c" : "#64748b" }}>
                        {isKnockout ? "⚠ " : ""}Q{i + 1}: {a.question}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "600", color: isKnockout ? "#b91c1c" : "#374151" }}>
                        {a.type === "yes_no" ? (a.answer === "yes" ? "✓ Yes" : "✗ No") : (a.answer || "—")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* View Profile toggle — non-applied stages */}
          {stage !== "applied" && (
            <button
              onClick={() => setProfileOpen(p => !p)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.55rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", backgroundColor: profileOpen ? "var(--color-bg-surface, #f8fafc)" : "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span>{profileOpen ? "Hide Profile" : "View Profile"}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary, #64748b)" }}>{profileOpen ? "▲" : "▼"}</span>
            </button>
          )}

          {/* Bio + Skills + LinkedIn + Documents — always visible for applied, toggleable otherwise */}
          {(stage === "applied" || profileOpen) && (<>
            <Section label="Bio">
              <p style={{ margin: 0, fontSize: "0.85rem", color: applicant.bio ? "#374151" : "#64748b", fontStyle: applicant.bio ? "normal" : "italic", lineHeight: 1.6 }}>
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
              ) : <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)", fontStyle: "italic" }}>Not listed</p>}
            </Section>

            <Section label="LinkedIn">
              {applicant.linkedin && /^https?:\/\//i.test(applicant.linkedin)
                ? <a href={applicant.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0a66c2", fontWeight: "600", textDecoration: "underline", display: "flex", alignItems: "center", gap: "0.3rem" }}>🔗 View LinkedIn Profile</a>
                : <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)", fontStyle: "italic" }}>Not provided</p>
              }
            </Section>

            <Section label="Documents">
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={openCv}
                  disabled={!applicant.cvName || cvLoading}
                  style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: "0.4rem", border: `1px solid ${applicant.cvName ? "var(--color-border-light, #d1d5db)" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: "var(--color-bg-elevated, white)", color: applicant.cvName ? "var(--color-text-body, #374151)" : "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.82rem", cursor: applicant.cvName ? "pointer" : "default", fontFamily: "inherit", textAlign: "center" }}
                >
                  {cvLoading ? "Loading…" : "View CV"}
                </button>
                <button
                  onClick={openCoverLetter}
                  disabled={!applicant.coverLetterName || clLoading}
                  style={{ flex: 1, padding: "0.55rem 0.75rem", borderRadius: "0.4rem", border: `1px solid ${applicant.coverLetterName ? "var(--color-border-light, #d1d5db)" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: "var(--color-bg-elevated, white)", color: applicant.coverLetterName ? "var(--color-text-body, #374151)" : "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.82rem", cursor: applicant.coverLetterName ? "pointer" : "default", fontFamily: "inherit", textAlign: "center" }}
                >
                  {clLoading ? "Loading…" : "Cover Letter"}
                </button>
              </div>
            </Section>
          </>)}

          {/* Notes */}
          <Section label={notesSaving ? "Notes — saving…" : notesSaved ? "Notes — saved ✓" : "Notes"}>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Private notes visible only to your company…"
              rows={3}
              maxLength={4000}
              autoComplete="off"
              style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, color: "var(--color-text-body, #374151)" }}
            />
            <div style={{ textAlign: "right", fontSize: "0.72rem", color: notes.length >= 3800 ? "#ef4444" : "#64748b", marginTop: "0.2rem" }}>{notes.length}/4000</div>
          </Section>

          {/* Interview slot status — only shown when slots were offered */}
          {stage === "interview" && interviewSlots.length > 0 && (() => {
            const confirmed = interviewSlots.find(s => s.selected);
            if (confirmed) {
              const [dp, tp = ""] = confirmed.slot_time.split("T");
              return (
                <Section label="Interview Schedule">
                  <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: "0.6rem" }}>
                    <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: "800", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem" }}>Student Confirmed</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "var(--color-text-primary, #1e293b)" }}>{dp} at {tp.slice(0, 5)}</p>
                  </div>
                </Section>
              );
            }
            return (
              <Section label="Interview Schedule">
                <div style={{ padding: "0.6rem 0.85rem", backgroundColor: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: "0.6rem" }}>
                  <p style={{ margin: "0 0 0.3rem", fontSize: "0.72rem", fontWeight: "800", color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>Waiting for Student</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    {interviewSlots.map((s, i) => {
                      const [dp, tp = ""] = s.slot_time.split("T");
                      return <p key={s.id} style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-body, #374151)" }}>{i + 1}. {dp} at {tp.slice(0, 5)}</p>;
                    })}
                  </div>
                </div>
              </Section>
            );
          })()}

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
            onSend={async (note, teamsLink, date, time, slots) => {
              await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink, slots);
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
            <button onClick={() => setNextRoundInviteOpen(true)} style={panelActionBtn("purple")}>Schedule Next Round</button>
            <button onClick={() => onStageAction(applicant.id, "trial")} style={panelActionBtn("primary")}>Advance to Trial</button>
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("green")}>Move to Decision</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("danger")}>Decline Applicant</button>
            {applicant.status === "Pending" && <button disabled title="Coming soon — flag if applicant is not responding" style={{ ...panelActionBtn("danger"), opacity: 0.4, cursor: "default", fontSize: "0.78rem" }}>🚫 Flag as Ghosted · Soon</button>}
          </>)}
          {stage === "trial" && (<>
            <button onClick={() => setTrialInviteOpen(true)} style={panelActionBtn("purple")}>Send Trial Invite</button>
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("green")}>Move to Decision</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("danger")}>Decline Applicant</button>
            {applicant.status === "Pending" && <button disabled title="Coming soon — flag if applicant is not responding" style={{ ...panelActionBtn("danger"), opacity: 0.4, cursor: "default", fontSize: "0.78rem" }}>🚫 Flag as Ghosted · Soon</button>}
          </>)}
          {stage === "decision" && applicant.status === "Pending" && (<>
            <button
              disabled={hireLoading}
              onClick={async () => {
                setHireLoading(true);
                try { await onUpdateStatus(applicant.id, "Accepted", applicant); }
                finally { setHireLoading(false); }
              }}
              style={{ ...panelActionBtn("accept"), opacity: hireLoading ? 0.6 : 1 }}
            >{hireLoading ? "Hiring…" : "Hire Applicant"}</button>
            <button
              disabled={hireLoading}
              onClick={async () => {
                setHireLoading(true);
                try { await onUpdateStatus(applicant.id, "Rejected", applicant); }
                finally { setHireLoading(false); }
              }}
              style={{ ...panelActionBtn("danger"), opacity: hireLoading ? 0.6 : 1 }}
            >{hireLoading ? "Processing…" : "Decline Applicant"}</button>
          </>)}
          {applicant.status === "Accepted" && (<>
            <button
              disabled={rehireLoading}
              onClick={handleRehire}
              style={{ ...panelActionBtn("secondary"), opacity: rehireLoading ? 0.6 : 1 }}
            >{rehireLoading ? "Sending…" : "Offer Another Shift"}</button>
            <button disabled title="Coming soon — send a formal offer letter" style={{ ...panelActionBtn("secondary"), opacity: 0.45, cursor: "default", fontSize: "0.82rem" }}>📄 Send Offer Letter · Soon</button>
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
          onSend={async (note, teamsLink, date, time, slots) => {
            const newRounds = [...interviewRounds, { date: date || "", time: time || "" }];
            setInterviewRounds(newRounds);
            await onIncrementRound?.(applicant.id, applicant.interviewRound || 1, newRounds);
            await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink, slots);
          }}
        />
      )}

      {/* Interview invite from shortlist — moves stage + sends email */}
      {shortlistInviteOpen && (
        <InterviewInviteModal
          applicant={applicant}
          roundNumber={1}
          date={interviewRounds[0]?.date || ""}
          time={interviewRounds[0]?.time || ""}
          onClose={() => setShortlistInviteOpen(false)}
          onSend={async (note, teamsLink, date, time, slots) => {
            await onSendInterviewInvite?.(applicant.id, date || "", time || "", note, teamsLink, slots);
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
