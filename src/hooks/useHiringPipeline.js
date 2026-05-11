import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { sendEmail, emailInterviewInvite, emailTrialInvite, updateApplicationStage, incrementInterviewRound, saveTrialSchedule, saveInterviewRoundsData, moveToInterviewRound } from "../lib/auth";

export function useHiringPipeline({ activePosting, setPostings, setActivePosting, currentUser }) {
  const applyToPosting = (updater) => {
    setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
    setActivePosting(prev => prev ? updater(prev) : prev);
  };

  const updateApplicantStatus = async (applicationId, newStatus, _applicant) => {
    const action = newStatus === "Accepted" ? "accept" : "reject";
    try {
      const { data, error } = await supabase.functions.invoke("hire-applicant", {
        body: { applicationId, action },
      });
      if (error) throw error;

      if (action === "accept") {
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
      toast.error(action === "accept" ? "Failed to accept applicant." : "Failed to update status.");
    }
  };

  const handleStageChange = async (applicationId, newStage, round) => {
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
      await saveInterviewRoundsData(applicationId, newRoundsData);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, interviewRound: currentRound + 1, interviewRoundsData: newRoundsData }
          : a
        ),
      }));
    } catch {
      toast.error("Failed to update interview round. Please try again.");
    }
  };

  const handleSaveInterviewRoundsData = async (applicationId, rounds) => {
    try {
      await saveInterviewRoundsData(applicationId, rounds);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, interviewRoundsData: rounds } : a),
      }));
    } catch { /* silently ignore */ }
  };

  const getStudentEmail = async (studentId) => {
    const { data: emailRows, error } = await supabase.rpc("get_user_emails", { user_ids: [studentId] });
    if (error) throw new Error(`Email lookup failed: ${error.message}`);
    const email = emailRows?.[0]?.email;
    if (!email) throw new Error(`No email found for student (id: ${studentId}). Make sure the SQL has been updated in Supabase.`);
    return email;
  };

  const handleSendInterviewInvite = async (applicationId, date, time, note, teamsLink) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) throw new Error("Applicant not found.");
    const studentEmail = await getStudentEmail(applicant.studentId);
    const jobTitle = activePosting?.title || "";
    await sendEmail({
      to: studentEmail,
      subject: `Interview Invitation — ${jobTitle ? `${jobTitle} at ` : ""}${currentUser.name}`,
      html: emailInterviewInvite(applicant.name, currentUser.name, jobTitle, date, time, note, teamsLink),
      magicLinkEmail: studentEmail,
      redirectTo: window.location.origin,
    });
  };

  const handleSendTrialInvite = async (applicationId, date, time, note) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) throw new Error("Applicant not found.");
    const studentEmail = await getStudentEmail(applicant.studentId);
    await sendEmail({
      to: studentEmail,
      subject: `Trial Shift Invitation from ${currentUser.name}`,
      html: emailTrialInvite(applicant.name, currentUser.name, activePosting.title, date, time, note),
      magicLinkEmail: studentEmail,
      redirectTo: window.location.origin,
    });
  };

  const handleSaveTrialSchedule = async (applicationId, date, time) => {
    try {
      await saveTrialSchedule(applicationId, date, time);
      applyToPosting(p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, trialDate: date, trialTime: time } : a),
      }));
    } catch { /* silently ignore — schedule is non-critical */ }
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
