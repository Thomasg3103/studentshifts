import { useRef } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { supabase, ensureValidSession, withTimeout } from "../lib/supabase";
import { sendEmail, updateApplicationStage, incrementInterviewRound, saveTrialSchedule, saveInterviewRoundsData, moveToInterviewRound, saveInterviewSchedule } from "../lib/auth";

/**
 * useHiringPipeline — all the actions a company can take on an applicant as
 * they move through the hiring pipeline (applied -> shortlisted -> interview
 * -> trial -> decision), used by CompanyDashboard.
 *
 * This hook doesn't hold its own state — it's handed the current posting
 * (`activePosting`) and the setters for the postings list, and every action
 * below updates BOTH: the single active posting shown in the detail panel,
 * and its matching entry inside the full postings array (via applyToPosting),
 * so the list view and the detail view never fall out of sync after an action.
 *
 * Hiring/rejecting a student goes through a Supabase Edge Function
 * ("hire-applicant") rather than a direct DB update, because hiring has
 * side effects that need to happen atomically on the server: marking the
 * job's shift as filled, auto-declining other applicants for that same
 * shift, and possibly closing the job — logic that shouldn't be duplicated
 * (or trusted to run correctly) on the client.
 */
export function useHiringPipeline({ activePosting, setPostings, setActivePosting, currentUser: _currentUser }) {
  // Track in-flight stage-change requests to prevent double-firing on rapid clicks
  const stagingInFlight = useRef(new Set());

  // Applies the same update function to both the active posting AND its
  // matching entry in the full postings list, so switching between list/board
  // view and the detail panel never shows stale data.
  const applyToPosting = (updater) => {
    setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
    setActivePosting(prev => prev ? updater(prev) : prev);
  };

  // Hire or reject an applicant. Routes through the "hire-applicant" Edge
  // Function so shift-filling / auto-decline-others / job-closing logic runs
  // once, server-side, instead of being reimplemented (and potentially
  // getting out of sync) here in the UI.
  const updateApplicantStatus = async (applicationId, newStatus, _applicant) => {
    const action = newStatus === "Accepted" ? "accept" : "reject";
    try {
      await ensureValidSession();
      // withTimeout ensures the Edge Function never hangs the UI indefinitely
      const { data, error } = await withTimeout(
        () => supabase.functions.invoke("hire-applicant", {
          // idempotencyKey lets the server recognise + ignore a duplicate
          // request (e.g. a retried click) instead of double-processing a hire.
          body: { applicationId, action, idempotencyKey: `${applicationId}:${action}` },
        }),
        15000,
        "Hire request timed out — please try again."
      );
      if (error) {
        // Extract the real error message from the edge function response body
        const body = error.context instanceof Response
          ? await error.context.json().catch(() => null)
          : (error.context ?? null);
        const detail = body?.error || error.message || "Unknown error";
        throw new Error(detail);
      }

      if (action === "accept") {
        // The Edge Function returns which shift(s) are now filled, whether
        // the whole job should close (all shifts filled), and the ids of any
        // OTHER applicants who were auto-declined because they'd applied for
        // the same now-filled shift — see CLAUDE.md's "multi-shift hiring
        // logic" notes for the business rule behind this.
        const { filledShifts: newFilledShifts, closedJob, declinedIds = [] } = data;
        const declinedSet = new Set(declinedIds);
        applyToPosting(p => ({
          ...p,
          filledShifts: newFilledShifts,
          status: closedJob ? "Closed" : p.status,
          applicants: p.applicants.map(a => {
            if (a.id === applicationId) return { ...a, status: "Accepted" };
            if (declinedSet.has(a.id))  return { ...a, status: "Rejected" };
            return a;
          }),
        }));
        toast.success("Applicant hired!");
        if (window.gtag) window.gtag("event", "hire_confirmed", { posting_id: activePosting?.id, application_id: applicationId });
      } else {
        applyToPosting(p => ({
          ...p,
          applicants: p.applicants.map(a =>
            a.id === applicationId ? { ...a, status: "Rejected" } : a
          ),
        }));
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(`${action === "accept" ? "Hire failed" : "Decline failed"}: ${e?.message || "Unknown error"}`);
    }
  };

  // Moves an applicant to a different pipeline stage (e.g. shortlisted ->
  // interview). Moving specifically INTO "interview" with a round number goes
  // through moveToInterviewRound instead of the generic stage update, since
  // that also needs to set which interview round they're on.
  const handleStageChange = async (applicationId, newStage, round) => {
    // Prevent double-firing if company clicks the same stage button twice rapidly
    const key = `${applicationId}:${newStage}:${round ?? ""}`;
    if (stagingInFlight.current.has(key)) return;
    stagingInFlight.current.add(key);
    try {
      if (newStage === "interview" && round !== undefined) {
        await moveToInterviewRound(applicationId, round);
      } else {
        await updateApplicationStage(applicationId, newStage);
      }
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, pipelineStage: newStage, ...(round !== undefined ? { interviewRound: round } : {}) }
          : a
        ),
      }));
      if (newStage === "interview" && window.gtag) {
        window.gtag("event", "generate_lead", { item_id: applicationId });
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(`Failed to update stage: ${e?.message || "Unknown error"}`);
    } finally {
      stagingInFlight.current.delete(key);
    }
  };

  const handleNotesSaved = (applicationId, notes) => {
    applyToPosting(p => ({
      ...p,
      applicants: p.applicants.map(a => a.id === applicationId ? { ...a, notes } : a),
    }));
  };

  const handleIncrementRound = async (applicationId, currentRound, newRoundsData) => {
    try {
      await incrementInterviewRound(applicationId, currentRound);
      try {
        await saveInterviewRoundsData(applicationId, newRoundsData);
      } catch {
        // Round incremented but notes failed — still update UI, show warning
        toast("Interview round advanced but schedule notes could not be saved.", { icon: "⚠️" });
      }
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, interviewRound: currentRound + 1, interviewRoundsData: newRoundsData }
          : a
        ),
      }));
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Failed to advance interview round. Please try again.");
    }
  };

  const handleSaveInterviewRoundsData = async (applicationId, rounds) => {
    try {
      await saveInterviewRoundsData(applicationId, rounds);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, interviewRoundsData: rounds } : a),
      }));
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Failed to save interview notes. Please try again.");
    }
  };

  // Companies can't read a student's email directly (RLS blocks it — see
  // CLAUDE.md's RLS notes) so this goes through the get_user_emails RPC,
  // used only when the company needs to actually email the student (e.g.
  // sending an interview/trial invite below).
  const getStudentEmail = async (studentId) => {
    // ensureValidSession + withTimeout prevent hangs on stale sessions or slow network
    await ensureValidSession();
    const { data: emailRows, error } = await withTimeout(
      () => supabase.rpc("get_user_emails", { user_ids: [studentId] }),
      10000,
      "Email lookup timed out — please try again."
    );
    if (error) { Sentry.captureException(error); throw new Error(`Email lookup failed: ${error.message || error.code || JSON.stringify(error)}`); }
    const email = emailRows?.[0]?.email;
    if (!email) throw new Error("Could not find student email. Please try again or contact support.");
    return email;
  };

  const handleSendInterviewInvite = async (applicationId, date, time, note, teamsLink, slots = null) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) throw new Error("Applicant not found.");
    try {
      const studentEmail = await getStudentEmail(applicant.studentId);
      const jobTitle = activePosting?.title || "";
      const emailPayload = {
        to: studentEmail,
        templateType: "interview_invite",
        studentName: applicant.name,
        jobTitle,
        date,
        time,
        note,
        teamsLink,
        magicLinkEmail: studentEmail,
        redirectTo: window.location.origin,
      };
      if (slots?.length) emailPayload.slots = slots;
      await Promise.all([
        sendEmail(emailPayload),
        saveInterviewSchedule(applicationId, date, time).catch(() => {}),
      ]);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, interviewDate: date, interviewTime: time }
          : a
        ),
      }));
    } catch (e) {
      Sentry.captureException(e);
      throw new Error(e?.message || "Failed to send interview invite. Please try again.");
    }
  };

  const handleSendTrialInvite = async (applicationId, date, time, note) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) throw new Error("Applicant not found.");
    try {
      const studentEmail = await getStudentEmail(applicant.studentId);
      await sendEmail({
        to: studentEmail,
        templateType: "trial_invite",
        studentName: applicant.name,
        jobTitle: activePosting.title,
        date,
        time,
        note,
        magicLinkEmail: studentEmail,
        redirectTo: window.location.origin,
      });
    } catch (e) {
      Sentry.captureException(e);
      throw new Error(e?.message || "Failed to send trial invite. Please try again.");
    }
  };

  const handleSaveTrialSchedule = async (applicationId, date, time) => {
    try {
      await saveTrialSchedule(applicationId, date, time);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, trialDate: date, trialTime: time } : a),
      }));
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Trial schedule could not be saved — please try again.");
    }
  };

  return {
    updateApplicantStatus,
    handleStageChange,
    handleNotesSaved,
    handleIncrementRound,
    handleSaveInterviewRoundsData,
    handleSendInterviewInvite,
    handleSendTrialInvite,
    handleSaveTrialSchedule,
    getStudentEmail,
  };
}
