import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { supabase, withTimeout } from "../lib/supabase";
import { sendEmail, emailApplicantAccepted, emailApplicantDeclined, emailInterviewInvite, emailInterviewRejection, emailTrialInvite, emailTrialRejection, fetchAvailabilityHeatmap, fetchAllVerifiedStudents, updateApplicationStage, saveApplicationNotes, incrementInterviewRound, saveTrialSchedule, saveInterviewRoundsData, moveToInterviewRound, fetchLikedStudentIds, likeStudent, unlikeStudent } from "../lib/auth";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

import BrowseStudents from "./company/BrowseStudents";
import SavedStudents from "./company/SavedStudents";
import JobPostingCard from "./company/JobPostingCard";
import ApplicantsView from "./company/ApplicantsView";
import JobForm from "./company/JobForm";
import { StatCard, Modal, AvailabilityHeatmap, weekdays, timeSlots } from "./company/shared";

function normaliseJob(j) {
  return {
    id:              j.id,
    title:           j.title,
    category:        j.category,
    location:        j.location,
    lat:             j.lat,
    lng:             j.lng,
    pay:             j.pay,
    description:     j.description || "",
    deadline:        j.deadline || "",
    days:            j.days || [],
    times:           j.times || {},
    weekendRequired: j.weekend_required || false,
    sickPay:         j.sick_pay || false,
    holidays:        j.holidays || "",
    status:          j.status || "Active",
    photos:          j.photos || [],
    photoCrops:      j.photo_crops || [],
    filledShifts:    j.filled_shifts || [],
    applicants:      [],
    applicantCount:  j.applicant_count || 0,
  };
}

export default function CompanyDashboard() {
  const { setPage, currentUser } = useApp();
  const [postings, setPostings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [modal, setModal]         = useState(null);
  const [activePosting, setActivePosting] = useState(null);
  const [formData, setFormData]   = useState(null);
  const [heatmap, setHeatmap]     = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeTab, setActiveTab] = useState("jobs"); // "jobs" | "students"
  const [students, setStudents]   = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsFetched, setStudentsFetched] = useState(false);
  const [studentsError, setStudentsError]     = useState(null);
  const [chatStudent, setChatStudent] = useState(null); // { id, name } for inline DM
  const [likedStudentIds, setLikedStudentIds] = useState(new Set());
  const [applicantStudentIds, setApplicantStudentIds] = useState(new Set());
  const [applicantsViewMode, setApplicantsViewMode] = useState("list");

  // Load availability heatmap once
  useEffect(() => {
    fetchAvailabilityHeatmap().then(setHeatmap).catch(() => {});
  }, []);

  // Load liked student IDs on mount
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchLikedStudentIds(currentUser.id)
      .then(ids => setLikedStudentIds(new Set(ids)))
      .catch(() => {});
  }, [currentUser?.id]);

  // Load applicant student IDs whenever Browse Students tab is open and jobs are loaded
  useEffect(() => {
    if (activeTab !== "students" || !currentUser || loading) return;
    const jobIds = postings.map(p => p.id);
    if (!jobIds.length) return;
    withTimeout(
      supabase.from("applications").select("student_id").in("job_id", jobIds),
      10000
    ).then(({ data }) => {
      setApplicantStudentIds(new Set((data || []).map(a => a.student_id)));
    }).catch(() => {});
  }, [activeTab, loading]);

  // Load all verified students when Browse Students or Saved Students tab is first opened
  useEffect(() => {
    if ((activeTab !== "students" && activeTab !== "saved") || studentsFetched || !currentUser) return;
    setStudentsLoading(true);
    setStudentsError(null);
    fetchAllVerifiedStudents()
      .then(data => { setStudents(data); setStudentsFetched(true); })
      .catch(e => { setStudentsError(e.message || "Failed to load students"); setStudentsFetched(true); })
      .finally(() => setStudentsLoading(false));
  }, [activeTab]);

  // Load this company's jobs on mount, auto-expire any past their deadline
  useEffect(() => {
    if (!currentUser) return;
    withTimeout(
      supabase.from("jobs").select("*, applications(id, status)").eq("company_id", currentUser.id).order("created_at", { ascending: false }),
      10000, "Loading jobs timed out."
    ).then(async ({ data, error }) => {
      if (!error && data) {
        const today = new Date().toISOString().split("T")[0];
        const expired = data.filter(j => j.status === "Active" && j.deadline && j.deadline < today);
        if (expired.length) {
          await supabase.from("jobs").update({ status: "Closed" }).in("id", expired.map(j => j.id));
          expired.forEach(j => { j.status = "Closed"; });
        }
        setPostings(data.map(j => ({
          ...normaliseJob(j),
          applicantCount: j.applications?.length || 0,
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [currentUser?.id]);

  const totalApplicants = postings.reduce((sum, p) => sum + p.applicantCount, 0);
  const activeCount     = postings.filter(p => p.status === "Active").length;

  const openApplicants = async (posting) => {
    setApplicantsViewMode("list");
    setActivePosting({ ...posting, applicants: [], applicantsLoading: true, applicantsError: null });
    setModal("applicants");
    const { data: appData, error: appError } = await withTimeout(
      supabase.from("applications").select("id, status, student_id, pipeline_stage, company_notes, interview_round, trial_date, trial_time, interview_date, interview_time, interview_rounds_data").eq("job_id", posting.id).order("created_at", { ascending: true }),
      10000, "Loading applicants timed out."
    );
    if (appError) {
      setActivePosting(prev => ({ ...prev, applicantsLoading: false, applicantsError: appError.message }));
      return;
    }
    const appIds    = (appData || []).map(a => a.id);
    const studentIds = (appData || []).map(a => a.student_id);
    let profileMap = {};
    let cvMap = {};
    let shiftMap = {};
    const fetches = [];
    if (studentIds.length) {
      fetches.push(
        supabase.from("profiles").select("id, name").in("id", studentIds),
        supabase.rpc("get_company_applicant_profiles", { student_ids: studentIds }),
      );
    }
    const results = studentIds.length ? await Promise.all(fetches) : [];
    if (results[0]) (results[0].data || []).forEach(p => { profileMap[p.id] = p; });
    if (results[1]) (results[1].data || []).forEach(s => { cvMap[s.id] = s; });
    // Fetch preferred_shift separately â€” silently skip if column doesn't exist yet
    if (appIds.length) {
      const { data: shiftData } = await supabase
        .from("applications").select("id, preferred_shift").in("id", appIds);
      (shiftData || []).forEach(s => { shiftMap[s.id] = s.preferred_shift || null; });
    }
    const applicants = (appData || []).map(a => ({
      id:               a.id,
      studentId:        a.student_id,
      name:             profileMap[a.student_id]?.name        || "Unknown",
      cvName:           cvMap[a.student_id]?.cv_url           || null,
      coverLetterName:  cvMap[a.student_id]?.cover_letter_url || null,
      bio:              cvMap[a.student_id]?.bio              || "",
      skills:           cvMap[a.student_id]?.skills           || [],
      linkedin:         cvMap[a.student_id]?.linkedin         || "",
      profilePhoto:     cvMap[a.student_id]?.profile_photo_url || null,
      status:         a.status,
      pipelineStage:  a.pipeline_stage  || "applied",
      notes:          a.company_notes   || "",
      interviewRound: a.interview_round || 1,
      trialDate:      a.trial_date      || "",
      trialTime:      a.trial_time      || "",
      interviewDate:  a.interview_date  || "",
      interviewTime:  a.interview_time  || "",
      interviewRoundsData: a.interview_rounds_data || [],
      preferredShift: shiftMap[a.id] || null,
    }));
    setActivePosting(prev => ({ ...prev, applicants, applicantsLoading: false }));
  };

  const openCreate = () => {
    setFormData({ title: "", category: "", location: "", pay: "", description: "", deadline: "", days: [], times: {}, weekendRequired: false, status: "Active", photos: [], photoFiles: [] });
    setModal("form");
  };

  const openEdit = (posting) => {
    setFormData({ ...posting, days: [...posting.days], times: { ...posting.times }, photoFiles: [] });
    setModal("form");
  };

  const closeModal = () => {
    setModal(null);
    setActivePosting(null);
    setFormData(null);
  };


  const toggleStatus = async (id) => {
    const posting = postings.find(p => p.id === id);
    const newStatus = posting.status === "Active" ? "Closed" : "Active";
    const { error } = await withTimeout(
      supabase.from("jobs").update({ status: newStatus }).eq("id", id),
      10000, "Update timed out."
    );
    if (!error) setPostings(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const deletePosting = async (id) => {
    const { error } = await withTimeout(
      supabase.from("jobs").delete().eq("id", id),
      10000, "Delete timed out."
    );
    if (!error) setPostings(prev => prev.filter(p => p.id !== id));
  };

  const saveForm = async ({ existingPhotos: keptUrls = [], newFiles = [], allCrops = [] } = {}) => {
    if (!formData.title.trim() || !formData.location.trim() || !formData.pay.trim()) {
      toast.error("Please fill in Title, Location, and Pay."); return;
    }
    if (formData.days.length === 0) { toast.error("Please select at least one day."); return; }
    if (keptUrls.length === 0 && newFiles.length === 0) { toast.error("Please upload at least 1 photo."); return; }
    const descPlain = (formData.description || "").replace(/<[^>]*>/g, "");
    if (descPlain.length > 5000) { toast.error(`Description is too long (${descPlain.length} characters). Maximum is 5,000.`); return; }
    setFormSaving(true);
    try {
      // Build ordered photo URL array â€” existing first (already URLs), then upload new files in order
      const photoUrls = [...keptUrls];
      const photoCrops = [...allCrops]; // parallel array, same order
      const ALLOWED_PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
      const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
      for (const file of newFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_PHOTO_EXTS.has(ext)) { console.warn("Photo upload skipped: invalid type"); continue; }
        if (file.size > MAX_PHOTO_BYTES) { console.warn("Photo upload skipped: too large"); continue; }
        const path = `${currentUser.id}/photo_${Date.now()}.${ext}`;
        try {
          const { error: upErr } = await withTimeout(
            supabase.storage.from("job-photos").upload(path, file, { upsert: true }),
            8000, "timeout"
          );
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from("job-photos").getPublicUrl(path);
            photoUrls.push(publicUrl);
          }
        } catch (e) {
          console.warn("Photo upload skipped:", e.message);
        }
      }
      console.log("[saveForm] photos done, inserting jobâ€¦");

      const jobData = {
        company_id:      currentUser.id,
        title:           formData.title,
        category:        formData.category,
        location:        formData.location,
        lat:             formData.lat || null,
        lng:             formData.lng || null,
        pay:             formData.pay,
        description:     formData.description || "",
        deadline:        formData.deadline || null,
        days:            formData.days,
        times:           formData.times,
        weekend_required: formData.weekendRequired || false,
        sick_pay:        formData.sickPay || false,
        holidays:        formData.holidays || "",
        status:          formData.status || "Active",
        photos:          photoUrls,
        photo_crops:     photoCrops,
      };

      if (formData.id) {
        const { error } = await withTimeout(
          supabase.from("jobs").update(jobData).eq("id", formData.id),
          10000, "Database timeout â€” please try again."
        );
        if (error) throw error;
        setPostings(prev => prev.map(p => p.id === formData.id
          ? { ...normaliseJob({ ...jobData, id: formData.id }), applicants: p.applicants, applicantCount: p.applicantCount }
          : p
        ));
      } else {
        const { data, error } = await withTimeout(
          supabase.from("jobs").insert(jobData).select().single(),
          10000, "Database timeout â€” please try again."
        );
        if (error) throw error;
        setPostings(prev => [{ ...normaliseJob(data), applicants: [], applicantCount: 0 }, ...prev]);
      }
      closeModal();
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Error saving job. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  const toggleDay = (day) => {
    setFormData(prev => {
      const removing = prev.days.includes(day);
      const days = removing ? prev.days.filter(d => d !== day) : [...prev.days, day];
      const times = { ...prev.times };
      if (removing) delete times[day];
      return { ...prev, days, times };
    });
  };

  const updateApplicantStatus = async (applicationId, newStatus, applicant) => {
    if (newStatus === "Accepted") {
      // 1. Accept the winner
      const { error } = await withTimeout(
        supabase.from("applications").update({ status: "Accepted" }).eq("id", applicationId),
        10000, "Update timed out."
      );
      if (error) { toast.error("Failed to accept applicant."); return; }

      // 2. Mark the hired shift as filled on the job posting
      const hiredDay = applicant.preferredShift ? applicant.preferredShift.split(" Â· ")[0].trim() : null;
      const currentFilledShifts = activePosting.filledShifts || [];
      const remainingUnfilledDays = (activePosting.days || []).filter(d => !currentFilledShifts.includes(d));
      // If student applied for all shifts (no preferred), they fill every remaining shift
      const newFilledShifts = hiredDay
        ? (!currentFilledShifts.includes(hiredDay) ? [...currentFilledShifts, hiredDay] : currentFilledShifts)
        : [...(activePosting.days || [])];
      // Build a human-readable shift string for emails
      const hiredShiftWithTime = applicant.preferredShift
        || (hiredDay && activePosting.times?.[hiredDay] ? `${hiredDay} Â· ${activePosting.times[hiredDay]}` : hiredDay)
        || remainingUnfilledDays.map(d => activePosting.times?.[d] ? `${d} Â· ${activePosting.times[d]}` : d).join(", ")
        || null;
      if (newFilledShifts !== currentFilledShifts) {
        await withTimeout(
          supabase.from("jobs").update({ filled_shifts: newFilledShifts }).eq("id", activePosting.id),
          10000, "Timeout."
        );
      }

      // 3. Auto-decline pending applicants who competed for the same shift.
      //    If the hired student had a specific shift, only decline applicants with
      //    the same shift day or no preferred shift (applied to all). Applicants
      //    for other shifts stay pending so they can be hired for those shifts.
      const { data: others } = await withTimeout(
        supabase.from("applications")
          .select("id, student_id, preferred_shift")
          .eq("job_id", activePosting.id)
          .eq("status", "Pending")
          .neq("id", applicationId),
        10000, "Timeout."
      );
      const allShiftsFilled = newFilledShifts.length >= (activePosting.days || []).length;
      const otherIds = (others || []).filter(o => {
        if (!hiredDay) return true; // hired for all shifts â†’ decline everyone
        const oDay = o.preferred_shift ? o.preferred_shift.split(" Â· ")[0].trim() : null;
        if (oDay === hiredDay) return true; // competing for the same specific shift â†’ decline
        if (!oDay) return allShiftsFilled; // applied to all shifts â†’ only decline if no shifts remain
        return false; // different specific shift â†’ leave in pipeline
      }).map(o => o.id);
      if (otherIds.length) {
        await withTimeout(
          supabase.from("applications").update({ status: "Rejected" }).in("id", otherIds),
          10000, "Timeout."
        );
      }

      // 4. If all shifts are now filled, close the job automatically
      if (allShiftsFilled) {
        await withTimeout(
          supabase.from("jobs").update({ status: "Closed" }).eq("id", activePosting.id),
          10000, "Timeout."
        );
      }

      // 5. Update UI immediately
      const otherSet = new Set(otherIds);
      const uiUpdater = (p) => ({
        ...p,
        filledShifts: newFilledShifts,
        status: allShiftsFilled ? "Closed" : p.status,
        applicants: p.applicants.map(a => {
          if (a.id === applicationId) return { ...a, status: "Accepted" };
          if (otherSet.has(a.id))     return { ...a, status: "Rejected" };
          return a;
        }),
      });
      setPostings(prev => prev.map(p => p.id === activePosting.id ? uiUpdater(p) : p));
      setActivePosting(prev => uiUpdater(prev));

      // 6. Send emails best-effort (don't block the UI)
      try {
        const allStudentIds = [applicant.studentId, ...(others || []).map(o => o.student_id)];
        const { data: emailProfiles } = await supabase
          .rpc("get_user_emails", { user_ids: allStudentIds });
        const emailMap = Object.fromEntries((emailProfiles || []).map(p => [p.id, p.email]));
        const appUrl = window.location.origin;
        const remainingShiftsAfterHire = activePosting.days
          .filter(d => !newFilledShifts.includes(d))
          .map(d => {
            const timeStr = activePosting.times?.[d];
            return timeStr ? `${d} Â· ${timeStr}` : d;
          });

        // Applicants who were NOT auto-declined but had this shift as an option
        // (applied to all, no preferred_shift) â€” notify them the shift was taken
        const notifyOnly = hiredDay ? (others || []).filter(o => {
          if (otherIds.includes(o.id)) return false; // already declined
          return !o.preferred_shift; // applied to all shifts, stays in pipeline
        }) : [];

        await Promise.allSettled([
          // Acceptance email to winner
          emailMap[applicant.studentId] && sendEmail({
            to: emailMap[applicant.studentId],
            subject: `You've been hired â€” ${activePosting.title} at ${currentUser.name}`,
            html: emailApplicantAccepted(applicant.name, activePosting.title, currentUser.name, hiredShiftWithTime || null),
            magicLinkEmail: emailMap[applicant.studentId],
            redirectTo: appUrl,
          }),
          // Rejection emails to auto-declined applicants
          ...(otherIds.map(id => {
            const declinedApplicant = activePosting.applicants?.find(a => a.id === id);
            const oStudentId = others?.find(o => o.id === id)?.student_id;
            return oStudentId && emailMap[oStudentId] && sendEmail({
              to: emailMap[oStudentId],
              subject: `Update on your ${activePosting.title} application`,
              html: emailApplicantDeclined(
                declinedApplicant?.name || "there",
                activePosting.title,
                currentUser.name,
                hiredShiftWithTime,
                [],
              ),
            });
          })).filter(Boolean),
          // Notification to all-shift applicants still in pipeline â€” shift taken, others remain
          ...notifyOnly.map(o => {
            const notifyApplicant = activePosting.applicants?.find(a => a.student_id === o.student_id || a.id === o.id);
            const name = notifyApplicant?.name || "there";
            return emailMap[o.student_id] && sendEmail({
              to: emailMap[o.student_id],
              subject: `Update on your ${activePosting.title} application`,
              html: emailApplicantDeclined(
                name,
                activePosting.title,
                currentUser.name,
                hiredShiftWithTime,
                remainingShiftsAfterHire,
              ),
            });
          }).filter(Boolean),
        ]);
      } catch (e) {
        console.warn("Email sending failed:", e);
      }
      return;
    }

    // Manual reject â€” stage-aware email
    const { error } = await withTimeout(
      supabase.from("applications").update({ status: newStatus }).eq("id", applicationId),
      10000, "Update timed out."
    );
    if (error) { toast.error("Failed to update status."); return; }
    const updater = (p) => ({ ...p, applicants: p.applicants.map(a => a.id === applicationId ? { ...a, status: newStatus } : a) });
    setPostings(prev => prev.map(p => p.id === activePosting.id ? updater(p) : p));
    setActivePosting(prev => updater(prev));

    try {
      const { data: emailRows } = await supabase.rpc("get_user_emails", { user_ids: [applicant.studentId] });
      const studentEmail = emailRows?.[0]?.email;
      if (!studentEmail) return;
      const stage = applicant.pipelineStage || "applied";
      let html, subject;
      if (stage === "interview") {
        subject = `Update on your ${activePosting.title} application`;
        html = emailInterviewRejection(applicant.name, activePosting.title, currentUser.name);
      } else if (stage === "trial") {
        subject = `Update on your ${activePosting.title} application`;
        html = emailTrialRejection(applicant.name, activePosting.title, currentUser.name);
      } else {
        subject = `Update on your ${activePosting.title} application`;
        html = emailApplicantDeclined(applicant.name, activePosting.title, currentUser.name);
      }
      await sendEmail({ to: studentEmail, subject, html });
    } catch (e) {
      console.warn("Rejection email failed:", e);
    }
  };

  const handleStageChange = async (applicationId, newStage, round) => {
    try {
      if (newStage === "interview" && round !== undefined) {
        await moveToInterviewRound(applicationId, round);
      } else {
        await updateApplicationStage(applicationId, newStage);
      }
      const updater = p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, pipelineStage: newStage, ...(round !== undefined ? { interviewRound: round } : {}) }
          : a),
      });
      setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
      setActivePosting(prev => prev ? updater(prev) : prev);
    } catch (e) {
      Sentry.captureException(e);
      toast.error(`Failed to update stage: ${e?.message || "Unknown error"}`);
    }
  };

  const handleNotesSaved = (applicationId, notes) => {
    const updater = p => ({
      ...p,
      applicants: p.applicants.map(a => a.id === applicationId ? { ...a, notes } : a),
    });
    setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
    setActivePosting(prev => prev ? updater(prev) : prev);
  };

  const toggleLike = async (studentId) => {
    const isLiked = likedStudentIds.has(studentId);
    try {
      if (isLiked) {
        await unlikeStudent(currentUser.id, studentId);
        setLikedStudentIds(prev => { const next = new Set(prev); next.delete(studentId); return next; });
      } else {
        await likeStudent(currentUser.id, studentId);
        setLikedStudentIds(prev => new Set([...prev, studentId]));
      }
    } catch { /* silently ignore */ }
  };

  const handleIncrementRound = async (applicationId, currentRound, newRoundsData) => {
    try {
      await incrementInterviewRound(applicationId, currentRound);
      await saveInterviewRoundsData(applicationId, newRoundsData);
      const updater = p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId
          ? { ...a, interviewRound: currentRound + 1, interviewRoundsData: newRoundsData }
          : a),
      });
      setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
      setActivePosting(prev => prev ? updater(prev) : prev);
    } catch {
      toast.error("Failed to update interview round. Please try again.");
    }
  };

  const handleSaveInterviewRoundsData = async (applicationId, rounds) => {
    try {
      await saveInterviewRoundsData(applicationId, rounds);
      const updater = p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, interviewRoundsData: rounds } : a),
      });
      setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
      setActivePosting(prev => prev ? updater(prev) : prev);
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
    try {
      const studentEmail = await getStudentEmail(applicant.studentId);
      await sendEmail({
        to: studentEmail,
        subject: `Interview Invitation from ${currentUser.name}`,
        html: emailInterviewInvite(applicant.name, currentUser.name, date, time, note, teamsLink),
        magicLinkEmail: studentEmail,
        redirectTo: window.location.origin,
      });
    } catch (e) {
      throw new Error(e?.message || "Failed to send invite.");
    }
  };

  const handleSendTrialInvite = async (applicationId, date, time, note) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) throw new Error("Applicant not found.");
    try {
      const studentEmail = await getStudentEmail(applicant.studentId);
      await sendEmail({
        to: studentEmail,
        subject: `Trial Shift Invitation from ${currentUser.name}`,
        html: emailTrialInvite(applicant.name, currentUser.name, activePosting.title, date, time, note),
        magicLinkEmail: studentEmail,
        redirectTo: window.location.origin,
      });
    } catch (e) {
      throw new Error(e?.message || "Failed to send trial invite.");
    }
  };

  const handleSaveTrialSchedule = async (applicationId, date, time) => {
    try {
      await saveTrialSchedule(applicationId, date, time);
      const updater = p => ({
        ...p,
        applicants: p.applicants.map(a => a.id === applicationId ? { ...a, trialDate: date, trialTime: time } : a),
      });
      setPostings(prev => prev.map(p => p.id === activePosting?.id ? updater(p) : p));
      setActivePosting(prev => prev ? updater(prev) : prev);
    } catch { /* silently ignore â€” schedule is non-critical */ }
  };

  const handleCloseJob = async (jobId, { foundStudent, winnerId, winnerApplicant }) => {
    if (foundStudent && winnerId && winnerApplicant) {
      await updateApplicantStatus(winnerId, "Accepted", winnerApplicant);
    }
    const { error } = await withTimeout(
      supabase.from("jobs").update({ status: "Closed" }).eq("id", jobId),
      10000, "Update timed out."
    );
    if (error) { toast.error("Failed to close job. Please try again."); return; }
    setPostings(prev => prev.map(p => p.id === jobId ? { ...p, status: "Closed" } : p));
    closeModal();
  };

  const verificationStatus = currentUser?.verificationStatus;
  const isVerified = verificationStatus === "verified";

  const btnBase  = { padding: "0.6rem 1.1rem", borderRadius: "0.5rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit", letterSpacing: "-0.01em" };
  const btnGreen = { ...btnBase, backgroundColor: "#059669" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Verification banner */}
      {verificationStatus === "pending_review" && (
        <div style={{ backgroundColor: "#fef3c7", border: "1.5px solid #fcd34d", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>â³</span>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: "#92400e", fontSize: "0.95rem" }}>Account pending verification</p>
            <p style={{ margin: "0.2rem 0 0", color: "#b45309", fontSize: "0.85rem" }}>Our team is reviewing your company account. You'll receive an email once approved and can then start posting jobs.</p>
          </div>
        </div>
      )}
      {verificationStatus === "rejected" && (
        <div style={{ backgroundColor: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>âŒ</span>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: "#991b1b", fontSize: "0.95rem" }}>Verification declined</p>
            <p style={{ margin: "0.2rem 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>Your company account was not approved. Please contact support at thomasgallagher3103@gmail.com for assistance.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Dashboard</p>
          <h1 style={{ fontSize: "1.65rem", fontWeight: "800", margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>{currentUser?.name || "Company"}</h1>
        </div>
        {isVerified && activeTab === "jobs" && <button onClick={openCreate} style={btnGreen}>+ New Job</button>}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "1.75rem", gap: "0" }}>
        {[
          { val: "jobs",     label: "My Jobs" },
          { val: "students", label: "Browse Students" },
          { val: "saved",    label: "Saved Students", count: likedStudentIds.size },
        ].map(({ val, label, count }) => (
          <button
            key={val}
            onClick={() => { setActiveTab(val); setChatStudent(null); }}
            style={{
              padding: "0.7rem 1.25rem", border: "none", background: "none",
              fontWeight: activeTab === val ? "700" : "500", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit",
              color: activeTab === val ? "var(--color-brand)" : "#64748b",
              borderBottom: activeTab === val ? "2px solid var(--color-brand)" : "2px solid transparent",
              marginBottom: "-1px", transition: "color 0.15s, border-color 0.15s",
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
            }}
          >
            {label}
            {count > 0 && (
              <span className={`badge ${activeTab === val ? "badge-brand-solid" : "badge-gray"}`} style={{ minWidth: "18px", textAlign: "center", padding: "0.05rem 0.45rem", fontSize: "0.65rem" }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Stats â€” jobs tab only */}
      {activeTab === "jobs" && (
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Closed" value={postings.length - activeCount} />
        <StatCard label="Total Applicants" value={totalApplicants} />
      </div>
      )}

      {/* Student Availability Heatmap â€” Browse Students tab */}
      {activeTab === "students" && heatmap && (
        <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showHeatmap ? "1rem" : 0 }}>
            <div>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "#1e293b" }}>Student Availability</p>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>When verified students are free â€” use this to plan your job times</p>
            </div>
            <button onClick={() => setShowHeatmap(p => !p)} style={{ padding: "0.35rem 0.85rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "var(--color-brand)", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
              {showHeatmap ? "Hide" : "Show"}
            </button>
          </div>
          {showHeatmap && <AvailabilityHeatmap data={heatmap} />}
        </div>
      )}

      {/* Browse Students tab */}
      {activeTab === "students" && (
        <BrowseStudents
          students={students}
          loading={studentsLoading}
          fetched={studentsFetched}
          error={studentsError}
          companyIndustries={currentUser?.industries || []}
          companyId={currentUser?.id}
          companyName={currentUser?.name}
          chatStudent={chatStudent}
          setChatStudent={setChatStudent}
          setPage={setPage}
          likedStudentIds={likedStudentIds}
          applicantStudentIds={applicantStudentIds}
          onToggleLike={toggleLike}
        />
      )}

      {/* Saved Students tab */}
      {activeTab === "saved" && (
        <SavedStudents
          students={students}
          loading={studentsLoading}
          fetched={studentsFetched}
          likedStudentIds={likedStudentIds}
          onToggleLike={toggleLike}
          chatStudent={chatStudent}
          setChatStudent={setChatStudent}
          companyId={currentUser?.id}
          companyName={currentUser?.name}
        />
      )}

      {/* Postings â€” jobs tab only */}
      {activeTab === "jobs" && (
        loading ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
            <p style={{ fontWeight: "600" }}>Loading your job postingsâ€¦</p>
          </div>
        ) : postings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#6b7280" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>ðŸ“‹</div>
            <p style={{ fontSize: "1.15rem", fontWeight: "700", color: "#1e293b", marginBottom: "0.4rem" }}>No job postings yet</p>
            <p style={{ marginBottom: "1.75rem", fontSize: "0.9rem", color: "#94a3b8" }}>
              {isVerified ? "Create your first posting to start receiving applicants." : "Your account must be verified before you can post jobs."}
            </p>
            {isVerified && <button onClick={openCreate} style={btnGreen}>+ Create Job Posting</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {postings.map(posting => (
              <JobPostingCard
                key={posting.id}
                posting={posting}
                onViewApplicants={() => openApplicants(posting)}
                onEdit={() => openEdit(posting)}
                onDelete={() => deletePosting(posting.id)}
                onToggleStatus={() => toggleStatus(posting.id)}
              />
            ))}
          </div>
        )
      )}

      {/* Applicants Modal â€” wide overlay */}
      {modal === "applicants" && activePosting && (
        <div onClick={closeModal} className="applicants-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(2px)", animation: "fadeInOverlay 0.18s ease" }}>
          <div onClick={e => e.stopPropagation()} className="applicants-modal" style={{ backgroundColor: "white", borderRadius: "0.85rem", width: "100%", maxWidth: "min(96vw, 1500px)", minHeight: "88vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
            {/* Header */}
            <div style={{ height: "60px", padding: "0 1.75rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontWeight: "700", fontSize: "1.05rem", color: "#0f172a", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{activePosting.title}</h2>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activePosting.location} Â· {activePosting.pay}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                {[{ val: "list", label: "List" }, { val: "kanban", label: "Board" }].map(({ val, label }) => (
                  <button key={val} onClick={() => setApplicantsViewMode(val)} style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: "600", border: `1px solid ${applicantsViewMode === val ? "var(--color-brand)" : "#e2e8f0"}`, borderRadius: "0.4rem", cursor: "pointer", fontFamily: "inherit", backgroundColor: applicantsViewMode === val ? "#fff0f6" : "white", color: applicantsViewMode === val ? "var(--color-brand)" : "#64748b" }}>{label}</button>
                ))}
                <button onClick={closeModal} style={{ width: "32px", height: "32px", borderRadius: "0.4rem", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", color: "#64748b", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>âœ•</button>
              </div>
            </div>
            {/* Pipeline funnel */}
            {!activePosting.applicantsLoading && activePosting.applicants?.length > 0 && (
              <div style={{ padding: "0.85rem 1.75rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", flexShrink: 0, backgroundColor: "#f8fafc", gap: 0 }}>
                {[
                  { key: "applied",     label: "Applied"     },
                  { key: "shortlisted", label: "Shortlisted" },
                  { key: "interview",   label: "Interview"   },
                  { key: "trial",       label: "Trial"       },
                  { key: "decision",    label: "Decision"    },
                ].map(({ key, label }, i) => {
                  const count = activePosting.applicants.filter(a => a.pipelineStage === key).length;
                  const hasAny = count > 0;
                  return (
                    <span key={key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                      {i > 0 && <span style={{ flex: "0 0 1px", height: "1px", backgroundColor: "#e2e8f0", margin: "0 0.5rem" }} />}
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                        <span style={{ fontSize: "1.25rem", fontWeight: "700", color: hasAny ? "#0f172a" : "#d1d5db", lineHeight: 1 }}>{count}</span>
                        <span style={{ fontSize: "0.65rem", fontWeight: "500", color: hasAny ? "#64748b" : "#d1d5db", marginTop: "0.2rem", whiteSpace: "nowrap" }}>{label}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Scrollable body */}
            <div style={{ overflowY: "auto", flex: 1, padding: "1.25rem 1.5rem" }}>
              <ApplicantsView posting={activePosting} onUpdateStatus={updateApplicantStatus} onStageChange={handleStageChange} onNotesSaved={handleNotesSaved} onCloseJob={handleCloseJob} onIncrementRound={handleIncrementRound} onSaveTrialSchedule={handleSaveTrialSchedule} onSaveInterviewRoundsData={handleSaveInterviewRoundsData} onSendInterviewInvite={handleSendInterviewInvite} onSendTrialInvite={handleSendTrialInvite} likedStudents={students.filter(s => likedStudentIds.has(s.id))} companyId={currentUser?.id} viewMode={applicantsViewMode} />
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modal === "form" && formData && (
        <Modal onClose={closeModal} title={formData.id ? "Edit Job Posting" : "New Job Posting"}>
          <JobForm
            formData={formData}
            setFormData={setFormData}
            onSave={saveForm}
            onCancel={closeModal}
            toggleDay={toggleDay}
            formSaving={formSaving}
          />
        </Modal>
      )}

      </div>
    </div>
  );
}

