import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { jobCategories } from "../data/jobCategories";
import { geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";
import { sendEmail, emailApplicantAccepted, emailApplicantDeclined, emailCompanyInterested, emailInterviewInvite, emailInterviewRejection, emailTrialInvite, emailTrialRejection, fetchAvailabilityHeatmap, fetchAllVerifiedStudents, fetchMessages, sendMessage, updateApplicationStage, saveApplicationNotes, incrementInterviewRound, saveTrialSchedule, saveInterviewRoundsData, moveToInterviewRound, fetchLikedStudentIds, likeStudent, unlikeStudent } from "../lib/auth";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

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

export default function CompanyDashboard({ setPage, currentUser }) {
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

  // Load all verified students when Browse Students tab is first opened
  useEffect(() => {
    if (activeTab !== "students" || studentsFetched || !currentUser) return;
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
    // Fetch preferred_shift separately — silently skip if column doesn't exist yet
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
    if (!window.confirm("Delete this job posting? This cannot be undone.")) return;
    const { error } = await withTimeout(
      supabase.from("jobs").delete().eq("id", id),
      10000, "Delete timed out."
    );
    if (!error) setPostings(prev => prev.filter(p => p.id !== id));
  };

  const saveForm = async ({ existingPhotos: keptUrls = [], newFiles = [], allCrops = [] } = {}) => {
    if (!formData.title.trim() || !formData.location.trim() || !formData.pay.trim()) {
      alert("Please fill in Title, Location, and Pay."); return;
    }
    if (formData.days.length === 0) { alert("Please select at least one day."); return; }
    if (keptUrls.length === 0 && newFiles.length === 0) { alert("Please upload at least 1 photo."); return; }
    setFormSaving(true);
    try {
      // Build ordered photo URL array — existing first (already URLs), then upload new files in order
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
      console.log("[saveForm] photos done, inserting job…");

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
          10000, "Database timeout — please try again."
        );
        if (error) throw error;
        setPostings(prev => prev.map(p => p.id === formData.id
          ? { ...normaliseJob({ ...jobData, id: formData.id }), applicants: p.applicants, applicantCount: p.applicantCount }
          : p
        ));
      } else {
        const { data, error } = await withTimeout(
          supabase.from("jobs").insert(jobData).select().single(),
          10000, "Database timeout — please try again."
        );
        if (error) throw error;
        setPostings(prev => [{ ...normaliseJob(data), applicants: [], applicantCount: 0 }, ...prev]);
      }
      closeModal();
    } catch (e) {
      alert("Error saving job. Please try again.");
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
      if (error) { alert("Failed to accept applicant."); return; }

      // 2. Mark the hired shift as filled on the job posting
      const hiredDay = applicant.preferredShift ? applicant.preferredShift.split(" · ")[0].trim() : null;
      const currentFilledShifts = activePosting.filledShifts || [];
      const remainingUnfilledDays = (activePosting.days || []).filter(d => !currentFilledShifts.includes(d));
      // If student applied for all shifts (no preferred), they fill every remaining shift
      const newFilledShifts = hiredDay
        ? (!currentFilledShifts.includes(hiredDay) ? [...currentFilledShifts, hiredDay] : currentFilledShifts)
        : [...(activePosting.days || [])];
      // Build a human-readable shift string for emails
      const hiredShiftWithTime = applicant.preferredShift
        || (hiredDay && activePosting.times?.[hiredDay] ? `${hiredDay} · ${activePosting.times[hiredDay]}` : hiredDay)
        || remainingUnfilledDays.map(d => activePosting.times?.[d] ? `${d} · ${activePosting.times[d]}` : d).join(", ")
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
        if (!hiredDay) return true; // hired for all shifts → decline everyone
        const oDay = o.preferred_shift ? o.preferred_shift.split(" · ")[0].trim() : null;
        if (oDay === hiredDay) return true; // competing for the same specific shift → decline
        if (!oDay) return allShiftsFilled; // applied to all shifts → only decline if no shifts remain
        return false; // different specific shift → leave in pipeline
      }).map(o => o.id);
      if (otherIds.length) {
        await withTimeout(
          supabase.from("applications").update({ status: "Rejected" }).in("id", otherIds),
          10000, "Timeout."
        );
      }

      // 4. Update UI immediately
      const otherSet = new Set(otherIds);
      const uiUpdater = (p) => ({
        ...p,
        filledShifts: newFilledShifts,
        applicants: p.applicants.map(a => {
          if (a.id === applicationId) return { ...a, status: "Accepted" };
          if (otherSet.has(a.id))     return { ...a, status: "Rejected" };
          return a;
        }),
      });
      setPostings(prev => prev.map(p => p.id === activePosting.id ? uiUpdater(p) : p));
      setActivePosting(prev => uiUpdater(prev));

      // 5. Send emails best-effort (don't block the UI)
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
            return timeStr ? `${d} · ${timeStr}` : d;
          });

        // Applicants who were NOT auto-declined but had this shift as an option
        // (applied to all, no preferred_shift) — notify them the shift was taken
        const notifyOnly = hiredDay ? (others || []).filter(o => {
          if (otherIds.includes(o.id)) return false; // already declined
          return !o.preferred_shift; // applied to all shifts, stays in pipeline
        }) : [];

        await Promise.allSettled([
          // Acceptance email to winner
          emailMap[applicant.studentId] && sendEmail({
            to: emailMap[applicant.studentId],
            subject: `You've been hired — ${activePosting.title} at ${currentUser.name}`,
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
          // Notification to all-shift applicants still in pipeline — shift taken, others remain
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

    // Manual reject — stage-aware email
    const { error } = await withTimeout(
      supabase.from("applications").update({ status: newStatus }).eq("id", applicationId),
      10000, "Update timed out."
    );
    if (error) { alert("Failed to update status."); return; }
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
      alert(`Failed to update stage: ${e?.message || "Unknown error"}`);
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
      alert("Failed to update interview round. Please try again.");
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
    } catch { /* silently ignore — schedule is non-critical */ }
  };

  const handleCloseJob = async (jobId, { foundStudent, winnerId, winnerApplicant }) => {
    if (foundStudent && winnerId && winnerApplicant) {
      await updateApplicantStatus(winnerId, "Accepted", winnerApplicant);
    }
    const { error } = await withTimeout(
      supabase.from("jobs").update({ status: "Closed" }).eq("id", jobId),
      10000, "Update timed out."
    );
    if (error) { alert("Failed to close job. Please try again."); return; }
    setPostings(prev => prev.map(p => p.id === jobId ? { ...p, status: "Closed" } : p));
    closeModal();
  };

  const verificationStatus = currentUser?.verificationStatus;
  const isVerified = verificationStatus === "verified";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", padding: "1.5rem 1rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* Verification banner */}
      {verificationStatus === "pending_review" && (
        <div style={{ backgroundColor: "#fef3c7", border: "1.5px solid #fcd34d", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>⏳</span>
          <div>
            <p style={{ margin: 0, fontWeight: "700", color: "#92400e", fontSize: "0.95rem" }}>Account pending verification</p>
            <p style={{ margin: "0.2rem 0 0", color: "#b45309", fontSize: "0.85rem" }}>Our team is reviewing your company account. You'll receive an email once approved and can then start posting jobs.</p>
          </div>
        </div>
      )}
      {verificationStatus === "rejected" && (
        <div style={{ backgroundColor: "#fee2e2", border: "1.5px solid #fca5a5", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>❌</span>
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
        {[{ val: "jobs", label: "My Jobs" }, { val: "students", label: "Browse Students" }].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setActiveTab(val)}
            style={{
              padding: "0.7rem 1.25rem", border: "none", background: "none",
              fontWeight: activeTab === val ? "700" : "500", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit",
              color: activeTab === val ? "#A21D54" : "#64748b",
              borderBottom: activeTab === val ? "2px solid #A21D54" : "2px solid transparent",
              marginBottom: "-1px", transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats — jobs tab only */}
      {activeTab === "jobs" && (
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Closed" value={postings.length - activeCount} />
        <StatCard label="Total Applicants" value={totalApplicants} />
      </div>
      )}

      {/* Student Availability Heatmap — Browse Students tab */}
      {activeTab === "students" && heatmap && (
        <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showHeatmap ? "1rem" : 0 }}>
            <div>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "#1e293b" }}>Student Availability</p>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>When verified students are free — use this to plan your job times</p>
            </div>
            <button onClick={() => setShowHeatmap(p => !p)} style={{ padding: "0.35rem 0.85rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#A21D54", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
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
          onToggleLike={toggleLike}
        />
      )}

      {/* Postings — jobs tab only */}
      {activeTab === "jobs" && (
        loading ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b" }}>
            <p style={{ fontWeight: "600" }}>Loading your job postings…</p>
          </div>
        ) : postings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#6b7280" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📋</div>
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

      {/* Applicants Modal — wide overlay */}
      {modal === "applicants" && activePosting && (
        <div onClick={closeModal} className="applicants-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backdropFilter: "blur(2px)", animation: "fadeInOverlay 0.18s ease" }}>
          <div onClick={e => e.stopPropagation()} className="applicants-modal" style={{ backgroundColor: "white", borderRadius: "0.85rem", width: "100%", maxWidth: "min(96vw, 1500px)", minHeight: "88vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
            {/* Header */}
            <div style={{ height: "60px", padding: "0 1.75rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontWeight: "700", fontSize: "1.05rem", color: "#0f172a", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{activePosting.title}</h2>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activePosting.location} · {activePosting.pay}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                {[{ val: "list", label: "List" }, { val: "kanban", label: "Board" }].map(({ val, label }) => (
                  <button key={val} onClick={() => setApplicantsViewMode(val)} style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: "600", border: `1px solid ${applicantsViewMode === val ? "#A21D54" : "#e2e8f0"}`, borderRadius: "0.4rem", cursor: "pointer", fontFamily: "inherit", backgroundColor: applicantsViewMode === val ? "#fff0f6" : "white", color: applicantsViewMode === val ? "#A21D54" : "#64748b" }}>{label}</button>
                ))}
                <button onClick={closeModal} style={{ width: "32px", height: "32px", borderRadius: "0.4rem", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", color: "#64748b", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
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

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function BrowseStudents({ students, loading, fetched, error, companyIndustries, companyId, companyName, chatStudent, setChatStudent, setPage, likedStudentIds, onToggleLike }) {
  const [filterByIndustries, setFilterByIndustries] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [chatError, setChatError]       = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!chatStudent) return;
    setChatLoading(true);
    fetchMessages(null, chatStudent.id, companyId)
      .then(msgs => { setChatMessages(msgs); setChatLoading(false); })
      .catch(() => setChatLoading(false));

    const channel = supabase
      .channel(`direct_${companyId}_${chatStudent.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `company_id=eq.${companyId}` },
        payload => {
          if (payload.new.student_id === chatStudent.id && payload.new.job_id === null) {
            setChatMessages(prev => [...prev, payload.new]);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatStudent?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendDM = async () => {
    const text = chatInput.trim();
    if (!text || !chatStudent) return;
    const isFirst = chatMessages.length === 0;
    setChatInput("");
    setChatError("");
    try {
      await sendMessage(null, chatStudent.id, companyId, companyId, text);
      // On first message, email the student
      if (isFirst) {
        const { data: emailRows } = await supabase.rpc("get_user_emails", { user_ids: [chatStudent.id] });
        const studentEmail = emailRows?.[0]?.email;
        if (studentEmail) {
          sendEmail({
            to: studentEmail,
            subject: `${companyName} is interested in hiring you`,
            html: emailCompanyInterested(chatStudent.name, companyName),
            magicLinkEmail: studentEmail,
            redirectTo: window.location.origin,
          }).catch(console.warn);
        }
      }
    } catch (e) {
      console.error("Send failed:", e);
      setChatError(e.message || "Failed to send — please try again.");
    }
  };

  if (chatStudent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "55vh", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "#f8fafc", flexShrink: 0 }}>
          <button onClick={() => setChatStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "#6b7280", padding: "0.2rem 0.5rem" }}>←</button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{chatStudent.name}</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Direct Message</p>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {chatLoading
            ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>Loading…</p>
            : chatMessages.length === 0
              ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>No messages yet. Introduce yourself!</p>
              : chatMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender_id === companyId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div style={{ backgroundColor: m.sender_id === companyId ? "#A21D54" : "#e5e7eb", color: m.sender_id === companyId ? "white" : "#111827", padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
                    {m.text}
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.sender_id === companyId ? "right" : "left" }}>
                    {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
          }
          <div ref={bottomRef} />
        </div>
        {chatError && (
          <p style={{ margin: 0, padding: "0.4rem 1rem", fontSize: "0.78rem", color: "#e11d48", backgroundColor: "#fff1f2", borderTop: "1px solid #fecdd3" }}>{chatError}</p>
        )}
        <div style={{ padding: "0.75rem 1rem", borderTop: "1.5px solid #e5e7eb", display: "flex", gap: "0.5rem", backgroundColor: "white" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendDM()}
            placeholder={`Message ${chatStudent.name}…`}
            style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
          />
          <button onClick={sendDM} style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
            Send
          </button>
        </div>
      </div>
    );
  }

  if (!fetched && loading) {
    return <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading students…</p>;
  }

  if (fetched && error) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#fff1f2", borderRadius: "0.75rem", border: "1.5px solid #fca5a5" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", color: "#b91c1c", marginBottom: "0.4rem" }}>Could not load students</p>
        <p style={{ fontSize: "0.85rem", color: "#64748b" }}>{error}</p>
      </div>
    );
  }

  if (fetched && students.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎓</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", marginBottom: "0.4rem" }}>No verified students yet</p>
        <p style={{ fontSize: "0.875rem" }}>Verified students will appear here once they join.</p>
      </div>
    );
  }

  const displayStudents = filterByIndustries && companyIndustries.length > 0
    ? students.filter(s => s.job_preferences?.some(p => companyIndustries.includes(p)))
    : students;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
          {displayStudents.length} of {students.length} verified student{students.length !== 1 ? "s" : ""}
          {filterByIndustries && companyIndustries.length > 0 ? " matching your industries" : ""}
        </p>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            onClick={() => setFilterByIndustries(true)}
            disabled={companyIndustries.length === 0}
            title={companyIndustries.length === 0 ? "Set your industries in My Account first" : ""}
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: companyIndustries.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${filterByIndustries ? "#A21D54" : "#e2e8f0"}`, backgroundColor: filterByIndustries ? "#fce7f3" : "white", color: filterByIndustries ? "#A21D54" : "#64748b", opacity: companyIndustries.length === 0 ? 0.5 : 1 }}
          >
            My Industries
          </button>
          <button
            onClick={() => setFilterByIndustries(false)}
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${!filterByIndustries ? "#A21D54" : "#e2e8f0"}`, backgroundColor: !filterByIndustries ? "#fce7f3" : "white", color: !filterByIndustries ? "#A21D54" : "#64748b" }}
          >
            All Students
          </button>
        </div>
      </div>
      {displayStudents.length === 0 && (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem 1rem", fontSize: "0.875rem" }}>
          No students match your industries yet. Students need to set matching job preferences in their account.
        </p>
      )}
      {displayStudents.map(s => {
        const isLiked = likedStudentIds?.has(s.id);
        return (
        <div key={s.id} style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.85rem", padding: "1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {s.profile_photo_url
              ? <img src={s.profile_photo_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "1.2rem" }}>👤</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{s.name}</p>
              <button
                onClick={() => onToggleLike?.(s.id)}
                title={isLiked ? "Remove from liked" : "Save student"}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0.1rem 0.25rem", color: isLiked ? "#e11d48" : "#cbd5e1" }}
              >
                {isLiked ? "♥" : "♡"}
              </button>
            </div>
            {s.bio && <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.5 }}>{s.bio}</p>}
            {s.skills?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                {s.skills.slice(0, 5).map(sk => (
                  <span key={sk} style={{ fontSize: "0.7rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #bfdbfe", borderRadius: "999px", padding: "0.1rem 0.5rem", fontWeight: "600" }}>{sk}</span>
                ))}
              </div>
            )}
            {s.job_preferences?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {s.job_preferences.map(p => (
                  <span key={p} style={{ fontSize: "0.7rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1.5px solid #86efac", borderRadius: "999px", padding: "0.1rem 0.5rem", fontWeight: "600" }}>{p}</span>
                ))}
              </div>
            )}
            <StudentAvailabilityRow availability={s.availability} />
            <button
              onClick={() => { setChatStudent({ id: s.id, name: s.name }); setChatMessages([]); }}
              style={{ marginTop: "0.75rem", width: "100%", padding: "0.5rem 1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              Message
            </button>
          </div>
        </div>
        ); })}
    </div>
  );
}

const DAY_ABBR = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

function StudentAvailabilityRow({ availability }) {
  if (!availability || Object.keys(availability).length === 0) return null;
  const hasAny = weekdays.some(d => availability[d]?.length > 0);
  if (!hasAny) return null;

  return (
    <div>
      <p style={{ fontSize: "0.7rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.3rem" }}>Availability</p>
      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {weekdays.map(day => {
          const slots = availability[day] || [];
          const isWeekend = day === "Saturday" || day === "Sunday";
          const hasSlots = slots.length > 0;
          if (!hasSlots) return null;
          const earliest = slots.reduce((a, b) => a < b ? a : b);
          const latest   = slots.reduce((a, b) => a > b ? a : b);
          // Convert "09:00" → "9am" style
          const fmt = (t) => { const [h] = t.split(":"); const n = parseInt(h); return n < 12 ? `${n}am` : n === 12 ? "12pm" : `${n - 12}pm`; };
          return (
            <div
              key={day}
              title={`${day}: ${slots.join(", ")}`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                backgroundColor: isWeekend ? "#fef3c7" : "#fce7f3",
                border: `1.5px solid ${isWeekend ? "#fcd34d" : "#fce7f3"}`,
                borderRadius: "0.45rem", padding: "0.2rem 0.4rem", minWidth: "34px",
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: "800", color: isWeekend ? "#d97706" : "#A21D54" }}>{DAY_ABBR[day]}</span>
              <span style={{ fontSize: "0.6rem", color: isWeekend ? "#b45309" : "#A21D54", fontWeight: "600", whiteSpace: "nowrap" }}>
                {earliest === latest ? fmt(earliest) : `${fmt(earliest)}–${fmt(latest)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      flex: "1", minWidth: "110px",
      backgroundColor: "white", border: "1px solid #e2e8f0",
      borderRadius: "0.75rem", padding: "1rem 1.25rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.4rem" }}>{label}</p>
      <p style={{ fontSize: "1.85rem", fontWeight: "800", color: "#0f172a", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

function JobPostingCard({ posting, onViewApplicants, onEdit, onDelete, onToggleStatus }) {
  const isActive = posting.status === "Active";
  const today = new Date().toISOString().split("T")[0];
  const isExpired = posting.status === "Closed" && posting.deadline && posting.deadline < today;
  const photo = posting.photos?.[0] || null;
  const crop  = posting.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
  const [hovered, setHovered] = useState(false);
  const deadlineClose = posting.deadline && posting.deadline > today && (new Date(posting.deadline) - new Date(today)) / 86400000 <= 3;
  return (
    <div
      className="job-posting-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: "0.75rem", overflow: "hidden",
        backgroundColor: "white", border: `1px solid ${isExpired ? "#fca5a5" : "#e2e8f0"}`,
        display: "flex", alignItems: "stretch",
        opacity: isActive ? 1 : 0.8,
        boxShadow: hovered ? "0 4px 20px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.18s",
      }}>
      {/* Square photo */}
      <div style={{ width: "160px", flexShrink: 0, position: "relative", overflow: "hidden", alignSelf: "stretch" }}>
        {photo ? (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
            <img src={photo} alt={posting.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "1rem 1.25rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h2
              onClick={onViewApplicants}
              style={{ fontWeight: "700", fontSize: "1.05rem", margin: 0, cursor: "pointer", color: "#0f172a", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "#A21D54"}
              onMouseLeave={e => e.currentTarget.style.color = "#0f172a"}
            >
              {posting.title}
            </h2>
            <span style={{
              fontSize: "0.6rem", fontWeight: "700", padding: "0.15rem 0.5rem",
              borderRadius: "0.3rem", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
              backgroundColor: isActive ? "#dcfce7" : isExpired ? "#fee2e2" : "#f3f4f6",
              color: isActive ? "#16a34a" : isExpired ? "#dc2626" : "#6b7280",
            }}>
              {isExpired ? "Expired" : posting.status}
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.6rem", margin: "0 0 0.6rem" }}>
            {posting.location} · {posting.pay}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
            {posting.days.map(day => {
              const isFilled = (posting.filledShifts || []).includes(day);
              return (
                <span key={day} style={{
                  fontSize: "0.68rem",
                  backgroundColor: isFilled ? "#f1f5f9" : "#f0f9ff",
                  color: isFilled ? "#94a3b8" : "#0369a1",
                  padding: "0.15rem 0.5rem", borderRadius: "0.3rem", fontWeight: "600",
                  textDecoration: isFilled ? "line-through" : "none",
                }}>
                  {day.slice(0, 3)}{posting.times?.[day] ? ` · ${posting.times[day]}` : ""}
                  {isFilled ? " ✓" : ""}
                </span>
              );
            })}
            {posting.weekendRequired && (
              <span style={{ fontSize: "0.68rem", backgroundColor: "#fefce8", color: "#a16207", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", fontWeight: "600" }}>
                Weekend
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.75rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#374151", fontWeight: "600", margin: 0 }}>
            {posting.applicantCount} applicant{posting.applicantCount !== 1 ? "s" : ""}
          </p>
          {posting.deadline && (
            <p style={{ fontSize: "0.72rem", fontWeight: "600", margin: 0, color: deadlineClose ? "#d97706" : "#94a3b8" }}>
              {deadlineClose ? "⚠ " : ""}Closes {posting.deadline}
            </p>
          )}
        </div>
      </div>

      {/* Right action column */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "0.85rem 0.85rem 0.85rem 0", gap: "0.5rem", flexShrink: 0 }}>
        <button
          onClick={onEdit}
          title="Edit job"
          style={{ padding: "0.35rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#64748b", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >
          Edit
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <button onClick={onToggleStatus} style={{ padding: "0.38rem 0.7rem", border: "1px solid #e2e8f0", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#374151", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {isActive ? "Close Job" : "Reopen"}
          </button>
          <button onClick={onDelete} style={{ padding: "0.38rem 0.7rem", border: "1px solid #fca5a5", borderRadius: "0.4rem", background: "white", cursor: "pointer", color: "#dc2626", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}


const PIPELINE_STAGES = [
  { key: "applied",     label: "Applied" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview",   label: "Interview" },
  { key: "trial",       label: "Trial" },
  { key: "decision",    label: "Decision" },
];

// Returns a virtual stage key that includes the round number for interview stages
const getVirtualStageKey = (a) =>
  a.pipelineStage === "interview" ? `interview_${a.interviewRound || 1}` : a.pipelineStage;

// Decodes a virtual stage key back to the DB stage + round
const resolveStageKey = (key) => {
  if (key.startsWith("interview_")) {
    return { dbStage: "interview", round: parseInt(key.replace("interview_", ""), 10) };
  }
  return { dbStage: key, round: undefined };
};

// Builds the dynamic stage list, expanding interview rounds as they're added
const buildDynamicStages = (applicants) => {
  const maxRound = applicants.reduce(
    (m, a) => a.pipelineStage === "interview" ? Math.max(m, a.interviewRound || 1) : m, 1
  );
  return [
    { key: "applied",     label: "Applied" },
    { key: "shortlisted", label: "Shortlisted" },
    ...Array.from({ length: maxRound }, (_, i) => ({
      key:   `interview_${i + 1}`,
      label: i === 0 ? "Interview" : `Interview Rd ${i + 1}`,
    })),
    { key: "trial",    label: "Trial" },
    { key: "decision", label: "Decision" },
  ];
};

function ApplicantsView({ posting, onUpdateStatus, onStageChange, onNotesSaved, onCloseJob, companyId, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite, onSendTrialInvite, likedStudents, viewMode }) {
  const [activeStage, setActiveStage]             = useState("applied");
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showCloseJob, setShowCloseJob]           = useState(false);
  const [search, setSearch]                       = useState("");
  const [sortBy, setSortBy]                       = useState("default"); // "default" | "name_asc" | "name_desc" | "status"
  const [selectedIds, setSelectedIds]             = useState(new Set());
  const [invitedIds, setInvitedIds]               = useState(new Set());
  const [bulkDeclining, setBulkDeclining]         = useState(false);
  const [showBulkDeclineModal, setShowBulkDeclineModal] = useState(false);
  const [pendingDeclineIds, setPendingDeclineIds] = useState([]);

  if (posting.applicantsLoading) {
    return <div style={{ textAlign: "center", padding: "3rem 1rem" }}><div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div><p style={{ color: "#64748b", fontWeight: "600", margin: 0 }}>Loading applicants…</p></div>;
  }
  if (posting.applicantsError) {
    return <div style={{ textAlign: "center", padding: "2rem 1rem", backgroundColor: "#fff1f2", borderRadius: "0.75rem", border: "1.5px solid #fca5a5" }}><div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>⚠️</div><p style={{ color: "#e11d48", fontWeight: "600", margin: 0 }}>Error loading applicants. Please try again.</p></div>;
  }
  if (posting.applicants.length === 0) {
    return <div style={{ textAlign: "center", padding: "3.5rem 1rem" }}><div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div><p style={{ color: "#1e293b", fontWeight: "700", fontSize: "1rem", margin: "0 0 0.35rem" }}>No applicants yet</p><p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>Share this job posting to start receiving applications.</p></div>;
  }

  const dynamicStages = buildDynamicStages(posting.applicants);

  const countFor = (key) => posting.applicants.filter(a => getVirtualStageKey(a) === key).length;
  const stageApplicants = posting.applicants.filter(a => getVirtualStageKey(a) === activeStage);
  const searched = search.trim()
    ? stageApplicants.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : stageApplicants;
  const visible = [...searched].sort((a, b) => {
    if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "status") {
      const order = { Pending: 0, Accepted: 1, Rejected: 2 };
      return (order[a.status] ?? 0) - (order[b.status] ?? 0);
    }
    return 0;
  });

  // Keep selected applicant in sync when parent state updates (stage/notes changes)
  const liveSelected = selectedApplicant
    ? posting.applicants.find(a => a.id === selectedApplicant.id) || selectedApplicant
    : null;

  const handleStageAction = async (applicationId, stageKey) => {
    const { dbStage, round } = resolveStageKey(stageKey);
    await onStageChange(applicationId, dbStage, round);
    setSelectedApplicant(null);
    setActiveStage(stageKey);
  };

  // Wrapper: increments round, switches to the new round's tab, closes panel
  const handleRoundIncrement = async (applicationId, currentRound, newRoundsData) => {
    await onIncrementRound(applicationId, currentRound, newRoundsData);
    setSelectedApplicant(null);
    setActiveStage(`interview_${currentRound + 1}`);
  };

  const bulkDecline = () => {
    const pendingSelected = [...selectedIds].filter(id => {
      const a = posting.applicants.find(x => x.id === id);
      return a && a.status === "Pending";
    });
    if (pendingSelected.length === 0) { setSelectedIds(new Set()); return; }
    setPendingDeclineIds(pendingSelected);
    setShowBulkDeclineModal(true);
  };

  const confirmBulkDecline = async () => {
    setShowBulkDeclineModal(false);
    setBulkDeclining(true);
    for (const id of pendingDeclineIds) {
      const applicant = posting.applicants.find(a => a.id === id);
      if (applicant) await onUpdateStatus(id, "Rejected", applicant);
    }
    setBulkDeclining(false);
    setSelectedIds(new Set());
    setPendingDeclineIds([]);
  };

  const wrappedSendInterviewInvite = async (applicationId, ...args) => {
    await onSendInterviewInvite(applicationId, ...args);
    setInvitedIds(prev => new Set([...prev, applicationId]));
  };

  const wrappedSendTrialInvite = async (applicationId, ...args) => {
    await onSendTrialInvite(applicationId, ...args);
    setInvitedIds(prev => new Set([...prev, applicationId]));
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div>
      {/* Bulk Decline Confirmation Modal */}
      {showBulkDeclineModal && (
        <div onClick={() => setShowBulkDeclineModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1rem", padding: "2rem", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>✕</span>
              </div>
              <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "#0f172a" }}>
                Decline {pendingDeclineIds.length} applicant{pendingDeclineIds.length !== 1 ? "s" : ""}?
              </h3>
            </div>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6 }}>
              Each applicant will receive a rejection email. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowBulkDeclineModal(false)}
                style={{ padding: "0.55rem 1.25rem", borderRadius: "0.55rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDecline}
                style={{ padding: "0.55rem 1.25rem", borderRadius: "0.55rem", border: "none", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(244,63,94,0.3)" }}
              >
                Decline {pendingDeclineIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + sort bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "180px", position: "relative" }}>
          <span style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", pointerEvents: "none", color: "#94a3b8" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search applicants…"
            style={{ width: "100%", padding: "0.45rem 0.75rem 0.45rem 2rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151", boxSizing: "border-box", outline: "none" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1, padding: "0.1rem" }}>✕</button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: "0.45rem 0.65rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151", backgroundColor: "white", cursor: "pointer", outline: "none" }}
        >
          <option value="default">Sort: Default</option>
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="status">By Status</option>
        </select>
      </div>

      {viewMode === "kanban" ? (
        <KanbanBoard
          applicants={posting.applicants}
          stages={dynamicStages}
          onSelectApplicant={setSelectedApplicant}
          onMoveToStage={async (applicationId, stageKey) => {
            const { dbStage, round } = resolveStageKey(stageKey);
            try { await onStageChange(applicationId, dbStage, round); }
            catch (e) { alert(`Failed to move: ${e?.message || "Unknown error"}`); }
          }}
        />
      ) : (<>
        {/* Pipeline stage tabs */}
        <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", overflowX: "auto", borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {dynamicStages.map(({ key, label }) => {
          const count  = countFor(key);
          const active = activeStage === key;
          return (
            <button
              key={key}
              onClick={() => setActiveStage(key)}
              style={{
                flexShrink: 0,
                padding: "0.55rem 1.1rem",
                border: "none",
                borderBottom: active ? "2px solid #A21D54" : "2px solid transparent",
                marginBottom: "-2px",
                background: "transparent",
                fontWeight: active ? "700" : "600",
                fontSize: "0.82rem",
                color: active ? "#A21D54" : "#64748b",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                whiteSpace: "nowrap",
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: "0.68rem", fontWeight: "700",
                  backgroundColor: active ? "#A21D54" : "#94a3b8",
                  color: "white", borderRadius: "999px",
                  padding: "0.05rem 0.4rem", minWidth: "16px", textAlign: "center",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stage summary */}
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>
        {search.trim()
          ? `${visible.length} of ${stageApplicants.length} match${visible.length !== 1 ? "" : "es"} "${search}" · ${posting.applicants.length} total`
          : stageApplicants.length === 0 ? "No applicants in this stage"
          : `${stageApplicants.length} applicant${stageApplicants.length !== 1 ? "s" : ""} in this stage · ${posting.applicants.length} total`
        }
      </p>

      {/* Select-all row */}
      {(() => {
        const pendingInStage = stageApplicants.filter(a => a.status === "Pending");
        if (pendingInStage.length === 0) return null;
        const allSelected = pendingInStage.every(a => selectedIds.has(a.id));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", padding: "0 0.25rem" }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => {
                const ids = pendingInStage.map(a => a.id);
                if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...ids]));
                else setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
              }}
              style={{ cursor: "pointer", accentColor: "#A21D54", width: "15px", height: "15px" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>
              {allSelected ? "Deselect all" : `Select all ${pendingInStage.length} pending`}
            </span>
          </div>
        );
      })()}

      {/* Compact applicant rows for active stage */}
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👤</div>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0, fontWeight: "500" }}>No applicants in this stage yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visible.map(applicant => (
            <ApplicantRow
              key={applicant.id}
              applicant={applicant}
              isSelected={selectedIds.has(applicant.id)}
              onToggleSelect={() => toggleSelect(applicant.id)}
              isInvited={invitedIds.has(applicant.id)}
              onClick={() => setSelectedApplicant(applicant)}
              onHire={(a) => onUpdateStatus(a.id, "Accepted", a)}
              onDecline={(a) => onUpdateStatus(a.id, "Rejected", a)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar — floats above liked students when selection is active */}
      {selectedIds.size > 0 && (
        <div style={{ position: "sticky", bottom: 0, backgroundColor: "white", borderTop: "1.5px solid #e2e8f0", padding: "0.7rem 0", marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", zIndex: 10, boxShadow: "0 -4px 16px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "#1e293b" }}>{selectedIds.size} selected</span>
            <button onClick={() => setSelectedIds(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", padding: 0 }}>Clear</button>
          </div>
          <button
            onClick={bulkDecline}
            disabled={bulkDeclining}
            style={{ padding: "0.5rem 1.1rem", borderRadius: "0.55rem", border: "none", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", fontWeight: "700", fontSize: "0.8rem", cursor: bulkDeclining ? "default" : "pointer", fontFamily: "inherit", opacity: bulkDeclining ? 0.7 : 1, boxShadow: "0 2px 8px rgba(244,63,94,0.3)" }}
          >
            {bulkDeclining ? "Declining…" : `✕ Decline ${selectedIds.size}`}
          </button>
        </div>
      )}

      {/* Liked students — Shortlisted tab only, not yet applied */}
      {activeStage === "shortlisted" && (() => {
        const appliedIds = new Set(posting.applicants.map(a => a.studentId));
        const saved = (likedStudents || []).filter(s => !appliedIds.has(s.id));
        if (saved.length === 0) return null;
        return (
          <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1.5px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.68rem", fontWeight: "700", color: "#A21D54", textTransform: "uppercase", letterSpacing: "0.07em", paddingLeft: "0.5rem", borderLeft: "2px solid #A21D54" }}>
              Saved Students — haven't applied yet
            </p>
            {saved.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", marginBottom: "0.4rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.profile_photo_url
                    ? <img src={s.profile_photo_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "0.88rem", color: "#1e293b" }}>{s.name}</p>
                  {s.bio && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.bio}</p>}
                </div>
                <span style={{ fontSize: "0.68rem", color: "#A21D54", fontWeight: "700", whiteSpace: "nowrap", backgroundColor: "#fce7f3", padding: "0.15rem 0.5rem", borderRadius: "999px" }}>♥ Saved</span>
              </div>
            ))}
          </div>
        );
      })()}
      </>)}

      {/* Close Job button — Decision stage only, no accepted applicant yet */}
      {(viewMode === "list" ? activeStage === "decision" : posting.applicants.some(a => a.pipelineStage === "decision")) && posting.applicants.every(a => a.status !== "Accepted") && (
        <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1.5px solid #e2e8f0" }}>
          <button
            onClick={() => setShowCloseJob(true)}
            style={{ width: "100%", padding: "0.65rem", borderRadius: "0.4rem", border: "1px solid #fca5a5", backgroundColor: "white", color: "#b91c1c", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Close this Job
          </button>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.74rem", color: "#94a3b8", textAlign: "center" }}>
            This will close the listing and notify all pending applicants.
          </p>
        </div>
      )}

      {/* Detail panel */}
      {liveSelected && (
        <DetailPanel
          applicant={liveSelected}
          postingId={posting.id}
          companyId={companyId}
          onClose={() => setSelectedApplicant(null)}
          onStageAction={handleStageAction}
          onUpdateStatus={onUpdateStatus}
          onNotesSaved={onNotesSaved}
          onIncrementRound={handleRoundIncrement}
          onSaveTrialSchedule={onSaveTrialSchedule}
          onSaveInterviewRoundsData={onSaveInterviewRoundsData}
          onSendInterviewInvite={wrappedSendInterviewInvite}
          onSendTrialInvite={wrappedSendTrialInvite}
        />
      )}

      {/* Close job modal */}
      {showCloseJob && (
        <CloseJobModal
          posting={posting}
          onClose={() => setShowCloseJob(false)}
          onCloseJob={(opts) => onCloseJob(posting.id, opts)}
        />
      )}
    </div>
  );
}

function ApplicantRow({ applicant, onClick, onHire, onDecline, isSelected, onToggleSelect, isInvited }) {
  const isDecision = applicant.pipelineStage === "decision" && applicant.status === "Pending";
  const statusColors = {
    Accepted: { bg: "#dcfce7", color: "#15803d", label: "Hired" },
    Rejected: { bg: "#fee2e2", color: "#b91c1c", label: "Declined" },
  };
  const sc = statusColors[applicant.status];
  return (
    <div
      style={{ borderRadius: "0.5rem", border: `1px solid ${isSelected ? "#A21D54" : "#e2e8f0"}`, overflow: "hidden", backgroundColor: isSelected ? "#fdf8fb" : "white", transition: "all 0.12s", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; } }}
    >
      <button
        onClick={onClick}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
      >
        {/* Checkbox — pending only */}
        {applicant.status === "Pending" && (
          <div onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <input type="checkbox" checked={isSelected || false} onChange={() => {}} onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} style={{ cursor: "pointer", accentColor: "#A21D54", width: "15px", height: "15px" }} />
          </div>
        )}
        {/* Photo */}
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {applicant.profilePhoto
            ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          }
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>{applicant.name}</p>
            {sc && <span style={{ fontSize: "0.65rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", backgroundColor: sc.bg, color: sc.color, flexShrink: 0 }}>{sc.label}</span>}
            {isInvited && <span style={{ fontSize: "0.65rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", backgroundColor: "#f0f9ff", color: "#0369a1", flexShrink: 0 }}>Invite sent</span>}
            {applicant.linkedin && <span style={{ fontSize: "0.65rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", backgroundColor: "#f0f9ff", color: "#0369a1", flexShrink: 0 }}>LinkedIn</span>}
          </div>
          {applicant.preferredShift && (
            <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", color: "#64748b" }}>{applicant.preferredShift}</p>
          )}
          {applicant.skills?.length > 0 ? (
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {applicant.skills.slice(0, 4).map(s => (
                <span key={s} style={{ fontSize: "0.65rem", backgroundColor: "#f1f5f9", color: "#475569", borderRadius: "0.3rem", padding: "0.1rem 0.45rem", fontWeight: "500" }}>{s}</span>
              ))}
            </div>
          ) : applicant.bio ? (
            <p style={{ margin: "0.1rem 0 0", fontSize: "0.72rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.bio}</p>
          ) : null}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
      </button>
      {isDecision && (
        <div style={{ display: "flex", borderTop: "1px solid #e2e8f0" }}>
          <button onClick={(e) => { e.stopPropagation(); onHire?.(applicant); }} style={{ flex: 1, padding: "0.6rem", backgroundColor: "white", border: "none", borderRight: "1px solid #e2e8f0", color: "#15803d", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Hire Applicant</button>
          <button onClick={(e) => { e.stopPropagation(); onDecline?.(applicant); }} style={{ flex: 1, padding: "0.6rem", backgroundColor: "white", border: "none", color: "#b91c1c", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Decline</button>
        </div>
      )}
    </div>
  );
}

function KanbanBoard({ applicants, stages, onSelectApplicant, onMoveToStage }) {
  const [draggingId, setDraggingId]       = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const stageColor = (key) => {
    if (key === "applied")            return "#475569";
    if (key === "shortlisted")        return "#0369a1";
    if (key.startsWith("interview_")) return "#6d28d9";
    if (key === "trial")              return "#15803d";
    if (key === "decision")           return "#b45309";
    return "#475569";
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggingId) return;
    const a = applicants.find(x => x.id === draggingId);
    if (a && getVirtualStageKey(a) !== targetKey) onMoveToStage?.(draggingId, targetKey);
    setDraggingId(null);
  };

  const statusChip = {
    Pending:  { bg: "#f1f5f9", text: "#475569", label: "Under Review" },
    Accepted: { bg: "#dcfce7", text: "#15803d", label: "Hired" },
    Rejected: { bg: "#fee2e2", text: "#b91c1c", label: "Declined" },
  };

  return (
    <div style={{ display: "flex", gap: "0.85rem", overflowX: "auto", paddingBottom: "1rem", alignItems: "flex-start" }}>
      {(stages || []).map(({ key, label }) => {
        const cards  = applicants.filter(a => getVirtualStageKey(a) === key);
        const color  = stageColor(key);
        const isOver = dragOverStage === key;
        return (
          <div
            key={key}
            onDragOver={e => { e.preventDefault(); setDragOverStage(key); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
            onDrop={e => handleDrop(e, key)}
            style={{
              minWidth: "270px", flex: "0 0 270px",
              backgroundColor: "#f8fafc",
              border: `1.5px solid ${isOver ? color : "#e2e8f0"}`,
              borderRadius: "0.75rem",
              overflow: "hidden",
              boxShadow: isOver ? `0 0 0 3px ${color}30` : "0 1px 4px rgba(0,0,0,0.05)",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            {/* Coloured header bar */}
            <div style={{ backgroundColor: color, padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "white", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", backgroundColor: "rgba(255,255,255,0.22)", color: "white", borderRadius: "999px", padding: "0.1rem 0.55rem", minWidth: "20px", textAlign: "center" }}>{cards.length}</span>
            </div>

            {/* Cards */}
            <div style={{ padding: "0.6rem", display: "flex", flexDirection: "column", gap: "0.55rem", minHeight: "80px" }}>
              {cards.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: isOver ? color : "#cbd5e1", fontSize: "0.78rem", fontWeight: isOver ? "600" : "400" }}>
                  {isOver ? "Drop here" : "No applicants"}
                </div>
              )}
              {cards.map(applicant => {
                const sc = statusChip[applicant.status] || statusChip.Pending;
                return (
                  <button
                    key={applicant.id}
                    draggable
                    onDragStart={e => {
                      setDraggingId(applicant.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", applicant.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                    onClick={() => onSelectApplicant(applicant)}
                    style={{
                      width: "100%", display: "block",
                      padding: "0.9rem 0.95rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "white",
                      cursor: "grab", fontFamily: "inherit", textAlign: "left",
                      opacity: draggingId === applicant.id ? 0.4 : 1,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {/* Avatar + name row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.65rem" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {applicant.profilePhoto
                          ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 0.2rem", fontSize: "0.875rem", fontWeight: "700", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.name}</p>
                        <span style={{ fontSize: "0.62rem", fontWeight: "600", padding: "0.1rem 0.45rem", borderRadius: "0.25rem", backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                      </div>
                    </div>

                    {/* Preferred shift chip */}
                    {applicant.preferredShift && (
                      <div style={{ marginBottom: "0.55rem" }}>
                        <span style={{ fontSize: "0.7rem", color: "#64748b", backgroundColor: "#f1f5f9", padding: "0.2rem 0.55rem", borderRadius: "0.3rem", fontWeight: "500" }}>{applicant.preferredShift}</span>
                      </div>
                    )}

                    {/* Skills */}
                    {applicant.skills?.length > 0 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        {applicant.skills.slice(0, 3).map(s => (
                          <span key={s} style={{ fontSize: "0.63rem", backgroundColor: "#f8fafc", color: "#475569", borderRadius: "0.25rem", padding: "0.1rem 0.4rem", fontWeight: "500", border: "1px solid #e2e8f0" }}>{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Bio fallback if no skills */}
                    {!applicant.skills?.length && applicant.bio && (
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.bio}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckItem({ ok, label, warn }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.82rem" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, backgroundColor: ok ? "#dcfce7" : warn ? "#fef3c7" : "#fee2e2", color: ok ? "#16a34a" : warn ? "#d97706" : "#ef4444", fontSize: "0.65rem", fontWeight: "900" }}>
        {ok ? "✓" : warn ? "–" : "✗"}
      </span>
      <span style={{ color: ok ? "#374151" : "#6b7280", fontWeight: ok ? "600" : "400" }}>{label}</span>
    </div>
  );
}

function DetailPanel({ applicant, postingId, companyId, onClose, onStageAction, onUpdateStatus, onNotesSaved, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite, onSendTrialInvite }) {
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
  }, [applicant.id]);

  const openCv = async () => {
    if (!cvUrl) {
      setCvLoading(true);
      try {
        const { getSignedDocumentUrl } = await import("../lib/auth");
        setCvUrl(await getSignedDocumentUrl("documents", applicant.cvName));
      } catch { alert("Could not load CV. Please try again."); setCvLoading(false); return; }
      setCvLoading(false);
    }
    setCvOpen(true);
  };

  const openCoverLetter = async () => {
    if (!clUrl) {
      setClLoading(true);
      try {
        const { getSignedDocumentUrl } = await import("../lib/auth");
        setClUrl(await getSignedDocumentUrl("documents", applicant.coverLetterName));
      } catch { alert("Could not load cover letter. Please try again."); setClLoading(false); return; }
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
      {cvOpen && cvUrl && <PdfModal url={cvUrl} label={`${applicant.name}'s CV`} fileName={`${applicant.name.replace(/\s+/g, "_")}_CV.pdf`} onClose={() => setCvOpen(false)} />}
      {clOpen && clUrl && <PdfModal url={clUrl} label={`${applicant.name}'s Cover Letter`} fileName={`${applicant.name.replace(/\s+/g, "_")}_Cover_Letter.pdf`} onClose={() => setClOpen(false)} />}

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
              ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
          <button onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "0.4rem", border: "1px solid #e2e8f0", backgroundColor: "white", cursor: "pointer", color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
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
                {i > 0 && <span style={{ flex: "0 0 1px", height: "1px", backgroundColor: isPast ? "#A21D54" : "#e2e8f0", margin: "0 0.2rem" }} />}
                <span style={{ fontSize: "0.68rem", fontWeight: isCurrent ? "700" : "500", color: isCurrent ? "#A21D54" : isPast ? "#A21D54" : "#cbd5e1", whiteSpace: "nowrap", opacity: isPast ? 0.6 : 1, flex: 1, textAlign: "center" }}>
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
                    <span key={s} style={{ fontSize: "0.72rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "0.15rem 0.5rem", fontWeight: "600" }}>{s}</span>
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
              <ChatThread jobId={postingId} studentId={applicant.studentId} companyId={companyId} senderId={companyId} />
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

function InterviewInviteModal({ applicant, roundNumber, date: initialDate, time: initialTime, onClose, onSend }) {
  const [date, setDate]           = useState(initialDate || "");
  const [time, setTime]           = useState(initialTime || "");
  const [note, setNote]           = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");

  const send = async () => {
    setSending(true);
    setError("");
    try {
      await onSend(note, teamsLink, date, time);
      onClose();
    } catch (e) {
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1301, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(400px,92vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Send Interview {roundNumber} Invite</h3>
        <p style={{ margin: "0 0 1.1rem", fontSize: "0.82rem", color: "#64748b" }}>To: <strong>{applicant.name}</strong></p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Note to student <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Please bring a copy of your CV. Interview will be with the hiring manager."
              rows={3}
              style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, color: "#374151" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Microsoft Teams link <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <input
              type="url"
              value={teamsLink}
              onChange={e => setTeamsLink(e.target.value)}
              placeholder="https://teams.microsoft.com/…"
              style={{ width: "100%", padding: "0.5rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }}
            />
          </div>
        </div>

        {error && <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#e11d48", fontWeight: "600" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.65rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={send} disabled={sending} style={{ flex: 2, padding: "0.65rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg,#7c3aed,#A21D54)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : "Send Invite ✉"}
          </button>
        </div>
      </div>
    </>
  );
}

function TrialInviteModal({ applicant, date: initialDate, time: initialTime, onClose, onSend }) {
  const [date, setDate]     = useState(initialDate || "");
  const [time, setTime]     = useState(initialTime || "");
  const [note, setNote]     = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState("");

  const send = async () => {
    setSending(true);
    setError("");
    try {
      await onSend(date, time, note);
      onClose();
    } catch (e) {
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1301, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(400px,92vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Send Trial Shift Invite</h3>
        <p style={{ margin: "0 0 1.1rem", fontSize: "0.82rem", color: "#64748b" }}>To: <strong>{applicant.name}</strong></p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Note to student <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Please arrive 10 minutes early. Dress code is smart casual."
              rows={3}
              style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, color: "#374151" }}
            />
          </div>
        </div>

        {error && <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#e11d48", fontWeight: "600" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.65rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={send} disabled={sending} style={{ flex: 2, padding: "0.65rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : "Send Trial Invite ✉"}
          </button>
        </div>
      </div>
    </>
  );
}

function CloseJobModal({ posting, onClose, onCloseJob }) {
  const [mode, setMode]               = useState(null); // null | "found"
  const [winner, setWinner]           = useState(null);
  const [confirming, setConfirming]   = useState(false);

  const decisionApplicants = posting.applicants.filter(
    a => a.pipelineStage === "decision" && a.status === "Pending"
  );

  const confirm = async (opts) => {
    setConfirming(true);
    try { await onCloseJob(opts); }
    catch { alert("Failed to close job. Please try again."); }
    finally { setConfirming(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.5)", zIndex: 1200 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1201, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(420px,90vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

        {mode === null && (<>
          <h3 style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.1rem", color: "#1e293b" }}>Close this Job</h3>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "#64748b" }}>How did this hiring process end?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button onClick={() => setMode("found")} style={closeOptBtn("#A21D54", "#fce7f3", "#fce7f3")}>
              <span style={{ fontWeight: "700" }}>Found a Student</span>
              <span style={{ fontSize: "0.75rem", color: "#A21D54" }}>Select which student you hired</span>
            </button>
            <button onClick={() => confirm({ foundStudent: false })} disabled={confirming} style={closeOptBtn("#0369a1", "#f0f9ff", "#bae6fd")}>
              <span style={{ fontWeight: "700" }}>Hired Elsewhere</span>
              <span style={{ fontSize: "0.75rem", color: "#0369a1" }}>Found someone outside StudentShifts</span>
            </button>
            <button onClick={() => confirm({ foundStudent: false })} disabled={confirming} style={closeOptBtn("#64748b", "#f8fafc", "#e2e8f0")}>
              <span style={{ fontWeight: "700" }}>Job No Longer Needed</span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Position was cancelled or filled internally</span>
            </button>
          </div>
          <button onClick={onClose} style={{ marginTop: "1rem", width: "100%", padding: "0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </>)}

        {mode === "found" && (<>
          <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#A21D54", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: "0.75rem" }}>← Back</button>
          <h3 style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Who did you hire?</h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b" }}>They'll get an acceptance email. Everyone else will be declined.</p>
          {decisionApplicants.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", fontStyle: "italic", marginBottom: "1rem" }}>No applicants in the Decision stage yet — advance candidates first.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
              {decisionApplicants.map(a => (
                <button
                  key={a.id}
                  onClick={() => setWinner(a)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    padding: "0.6rem 0.85rem", borderRadius: "0.55rem",
                    border: `1.5px solid ${winner?.id === a.id ? "#A21D54" : "#e2e8f0"}`,
                    backgroundColor: winner?.id === a.id ? "#fce7f3" : "white",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {a.profilePhoto
                      ? <img src={a.profilePhoto} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    }
                  </div>
                  <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>{a.name}</span>
                  {winner?.id === a.id && <span style={{ marginLeft: "auto", color: "#A21D54", fontSize: "0.9rem" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            disabled={!winner || confirming}
            onClick={() => confirm({ foundStudent: true, winnerId: winner.id, winnerApplicant: winner })}
            style={{ width: "100%", padding: "0.7rem", borderRadius: "0.6rem", border: "none", backgroundColor: winner ? "#A21D54" : "#e2e8f0", color: winner ? "white" : "#94a3b8", fontWeight: "700", fontSize: "0.875rem", cursor: winner ? "pointer" : "default", fontFamily: "inherit", opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? "Processing…" : "Confirm Hire & Close Job"}
          </button>
        </>)}

      </div>
    </>
  );
}

const closeOptBtn = (color, bg, border) => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start",
  gap: "0.15rem", padding: "0.75rem 1rem", borderRadius: "0.6rem",
  border: `1.5px solid ${border}`, backgroundColor: bg,
  color, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
});

function Section({ label, children }) {
  return (
    <div>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.65rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      {children}
    </div>
  );
}

const panelActionBtn = (variant) => {
  const styles = {
    primary:   { backgroundColor: "#A21D54", color: "white",    border: "none" },
    secondary: { backgroundColor: "white",   color: "#374151",  border: "1px solid #d1d5db" },
    danger:    { backgroundColor: "white",   color: "#b91c1c",  border: "1px solid #fca5a5" },
    accept:    { backgroundColor: "#15803d", color: "white",    border: "none" },
  };
  const s = styles[variant] || styles.primary;
  return { width: "100%", padding: "0.65rem 1rem", borderRadius: "0.4rem", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.01em", ...s };
};

function PdfModal({ url, label, fileName, onClose }) {
  const modalRef  = useRef(null);
  const scrollRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => { document.removeEventListener("fullscreenchange", handler); document.removeEventListener("webkitfullscreenchange", handler); };
  }, []);

  const toggleFullScreen = () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      const el = modalRef.current;
      if (el?.requestFullscreen) el.requestFullscreen();
      else if (el?.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  };

  const save = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) { alert("Could not save. Please try again."); }
  };

  const openWith = async () => {
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], fileName, { type: "application/pdf" });
        await navigator.share({ files: [file], title: label });
      } catch (e) { if (e.name !== "AbortError") alert("Could not share. Please try again."); }
    } else {
      window.open(url, "_blank", "noreferrer");
    }
  };

  const buttons = [
    { icon: "🖨", label: "Print",       onClick: () => window.print() },
    { icon: "⬇", label: "Save",         onClick: save },
    { icon: "↗", label: "Open With",    onClick: openWith },
    { icon: isFullScreen ? "⊠" : "⛶", label: isFullScreen ? "Exit Full Screen" : "Full Screen", onClick: toggleFullScreen },
    { icon: "✕", label: "Close",        onClick: onClose },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1300, padding: "1rem", backdropFilter: "blur(2px)" }}>
      <div ref={modalRef} onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "720px", height: "85vh", display: "flex", flexDirection: "column", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#1e293b", padding: "0.65rem 1rem", flexShrink: 0 }}>
          <span style={{ color: "white", fontWeight: "700", fontSize: "0.9rem" }}>📄 {label}</span>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            {buttons.map(({ icon, label: tip, onClick }) => (
              <div key={tip} style={{ position: "relative", display: "inline-block" }} className="cv-tooltip-wrap">
                <button onClick={onClick} style={cvHeaderBtn}>{icon}</button>
                <span className="cv-tooltip" style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", backgroundColor: "#0f172a", color: "white", fontSize: "0.7rem", fontWeight: "600", padding: "0.2rem 0.5rem", borderRadius: "0.35rem", whiteSpace: "nowrap", pointerEvents: "none", opacity: 0, transition: "opacity 0.15s", zIndex: 10 }}>{tip}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", backgroundColor: "#525659", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "1rem" }}>
          <Document file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<p style={{ color: "white", marginTop: "2rem" }}>Loading PDF…</p>} error={<p style={{ color: "#fca5a5", marginTop: "2rem" }}>Failed to load PDF.</p>}>
            {Array.from({ length: numPages || 0 }, (_, i) => (
              <div key={i + 1} data-page={i + 1}>
                <Page pageNumber={i + 1} width={Math.min(window.innerWidth - 64, 680)} renderTextLayer={false} />
              </div>
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
}


function StatusBadge({ status }) {
  const colors = {
    Pending:  { bg: "#f1f5f9", text: "#64748b", label: "Under Review" },
    Accepted: { bg: "#dcfce7", text: "#15803d", label: "Hired" },
    Rejected: { bg: "#fee2e2", text: "#b91c1c", label: "Declined" },
  };
  const c = colors[status] || colors.Pending;
  return (
    <span style={{
      fontSize: "0.65rem", fontWeight: "600", padding: "0.2rem 0.55rem",
      borderRadius: "0.3rem", backgroundColor: c.bg, color: c.text,
    }}>
      {c.label}
    </span>
  );
}

function JobForm({ formData, setFormData, onSave, onCancel, toggleDay, formSaving }) {
  const isEdit = !!formData.id;
  const set = (key) => (e) => setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const categoryNames = Object.keys(jobCategories);

  // Photo preview state — initialise from saved crops when editing
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cropSettings, setCropSettings] = useState(() => {
    const saved = formData.photoCrops || [];
    const init = {};
    saved.forEach((c, i) => { if (c) init[i] = c; });
    return init;
  });
  const [isDragging, setIsDragging]     = useState(false);
  const previewRef  = useRef(null);
  const dragRef     = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, idx: 0 });

  const getCrop = (idx) => cropSettings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
  const setCrop = (idx, patch) => setCropSettings(prev => ({ ...prev, [idx]: { ...(prev[idx] || { zoom: 1, offsetX: 0, offsetY: 0 }), ...patch } }));

  const startDrag = (clientX, clientY) => {
    const crop = getCrop(previewIndex);
    dragRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      originX: crop.offsetX,
      originY: crop.offsetY,
      idx: previewIndex,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      if (!previewRef.current) return;
      const { width, height } = previewRef.current.getBoundingClientRect();
      // Store as percentage of container so it scales correctly on any screen size
      setCropSettings(prev => {
        const current = prev[d.idx] || { zoom: 1, offsetX: 0, offsetY: 0 };

        return {
          ...prev,
          [d.idx]: {
            ...(prev[d.idx] || { zoom: 1 }),
            offsetX: d.originX + ((cx - d.startX) / width  * 100),
            offsetY: d.originY + ((cy - d.startY) / height * 100),
          },
        };
      });
    };
    const onUp = () => { dragRef.current.active = false; setIsDragging(false); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
    };
  }, []);
  const titlesForCategory = formData.category ? jobCategories[formData.category] ?? [] : [];

  const handleCategoryChange = (e) => {
    setFormData(prev => ({ ...prev, category: e.target.value, title: "" }));
  };

  // Photos: existing URLs (edit mode) + new File objects to upload
  const photoFiles     = formData.photoFiles || [];
  const existingPhotos = (formData.photos    || []).filter(p => typeof p === "string" && p.startsWith("http"));
  const totalPhotos    = existingPhotos.length + photoFiles.length;

  const handlePhotoAdd = (e) => {
    const incoming  = Array.from(e.target.files);
    const remaining = 10 - totalPhotos;
    if (remaining <= 0) return;
    const toAdd    = incoming.slice(0, remaining);
    const newFiles = [...photoFiles, ...toAdd];
    setFormData(prev => ({ ...prev, photoFiles: newFiles }));
    e.target.value = "";
  };

  const removeExistingPhoto = (url) => {
    setFormData(prev => ({ ...prev, photos: existingPhotos.filter(u => u !== url) }));
  };

  const removeNewPhoto = (index) => {
    setFormData(prev => ({ ...prev, photoFiles: photoFiles.filter((_, i) => i !== index) }));
  };

  // Location geocoding state
  const [locInput, setLocInput] = useState(formData.location || "");
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualLine1, setManualLine1] = useState("");
  const [manualLine2, setManualLine2] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualCounty, setManualCounty] = useState("");

  const applyGeoResult = (result) => {
    setFormData(prev => ({ ...prev, location: result.displayName, lat: result.lat, lng: result.lng }));
    setLocInput(result.displayName);
    setLocError("");
    setShowManual(false);
  };

  const handleFindLocation = async () => {
    if (!locInput.trim()) { setLocError("Enter an Eircode or address."); return; }
    setLocLoading(true);
    setLocError("");
    const result = await geocodeAddress(locInput + ", Ireland");
    setLocLoading(false);
    if (result) {
      applyGeoResult(result);
    } else {
      setLocError("Eircode not found. Fill in the address manually below.");
      setShowManual(true);
    }
  };

  const handleManualGeocode = async () => {
    if (!manualLine1.trim() && !manualCity.trim()) { setLocError("Enter at least the address and city."); return; }
    const fullAddress = [manualLine1, manualLine2, manualCity, manualCounty, "Ireland"].filter(Boolean).join(", ");
    setLocLoading(true);
    setLocError("");
    const result = await geocodeAddress(fullAddress);
    setLocLoading(false);
    if (result) {
      applyGeoResult(result);
    } else {
      // Save as text-only, no pin
      const textAddr = [manualLine1, manualLine2, manualCity, manualCounty].filter(Boolean).join(", ");
      setFormData(prev => ({ ...prev, location: textAddr, lat: undefined, lng: undefined }));
      setLocInput(textAddr);
      setLocError("Could not pin on map — saved as text. Distances won't show for this job.");
      setShowManual(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>

      {/* Category */}
      <div>
        <label style={labelStyle}>Job Category *</label>
        <select value={formData.category || ""} onChange={handleCategoryChange} style={inputStyle}>
          <option value="">Select a category…</option>
          {categoryNames.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Title — locked until category chosen */}
      <div>
        <label style={labelStyle}>Job Title *</label>
        <select
          value={formData.title || ""}
          onChange={set("title")}
          disabled={!formData.category}
          style={{ ...inputStyle, color: formData.category ? "#111827" : "#9ca3af", cursor: formData.category ? "pointer" : "not-allowed" }}
        >
          <option value="">{formData.category ? "Select a title…" : "Select a category first"}</option>
          {titlesForCategory.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Location with geocoding */}
      <div>
        <label style={labelStyle}>Location * <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(Eircode or full address)</span></label>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <input
            value={locInput}
            onChange={e => { setLocInput(e.target.value); setShowManual(false); setFormData(prev => ({ ...prev, location: e.target.value, lat: undefined, lng: undefined })); }}
            onKeyDown={e => e.key === "Enter" && handleFindLocation()}
            placeholder="Eircode"
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          />
          <button
            type="button"
            onClick={handleFindLocation}
            disabled={locLoading}
            style={{ padding: "0.6rem 0.85rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.85rem", cursor: locLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
          >
            {locLoading ? "…" : "Find"}
          </button>
        </div>

        {/* Resolved full address */}
        {formData.lat && formData.lng && !showManual && (
          <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", marginBottom: "0.4rem" }}>
            <p style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700", margin: 0 }}>✓ Location pinned</p>
            <p style={{ fontSize: "0.7rem", color: "#374151", margin: "0.15rem 0 0" }}>{formData.location}</p>
          </div>
        )}

        {/* Error + manual toggle */}
        {locError && (
          <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0 0 0.3rem" }}>{locError}</p>
        )}
        {!showManual && !formData.lat && (
          <button type="button" onClick={() => setShowManual(true)} style={{ background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}>
            Enter address manually instead
          </button>
        )}

        {/* Manual address form */}
        {showManual && (
          <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.25rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#374151", marginBottom: "0.6rem" }}>Enter address manually</p>
            <input value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={handleManualGeocode} disabled={locLoading} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: locLoading ? "not-allowed" : "pointer" }}>
                {locLoading ? "Finding…" : "Find Address"}
              </button>
              <button type="button" onClick={() => setShowManual(false)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "white", color: "#6b7280", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div>
        <label style={labelStyle}>Pay *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#374151", fontWeight: "600", pointerEvents: "none" }}>€</span>
          <input
            type="number"
            min="0"
            step="0.50"
            value={formData.pay ? formData.pay.replace(/[^0-9.]/g, "") : ""}
            onChange={e => setFormData(prev => ({ ...prev, pay: e.target.value ? `€${e.target.value}/hr` : "" }))}
            placeholder="12.50"
            style={{ ...inputStyle, paddingLeft: "1.8rem", paddingRight: "2.8rem" }}
          />
          <span style={{ position: "absolute", right: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: "0.82rem", pointerEvents: "none" }}>/hr</span>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Job Description <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <textarea
          value={formData.description || ""}
          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the role, responsibilities, and what you're looking for…"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
        />
      </div>

      {/* Sick Pay */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", padding: "0.6rem 0.75rem", backgroundColor: formData.sickPay ? "#f0fdf4" : "#f9fafb", borderRadius: "0.5rem", border: `1.5px solid ${formData.sickPay ? "#86efac" : "#e5e7eb"}` }}>
        <input
          type="checkbox"
          checked={formData.sickPay || false}
          onChange={e => setFormData(prev => ({ ...prev, sickPay: e.target.checked }))}
          style={{ width: "16px", height: "16px", cursor: "pointer" }}
        />
        <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#374151" }}>
          Sick pay included
        </span>
      </label>

      {/* Holidays */}
      <div>
        <label style={labelStyle}>Holiday Entitlement <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          type="text"
          value={formData.holidays || ""}
          onChange={e => setFormData(prev => ({ ...prev, holidays: e.target.value }))}
          placeholder="e.g. 20 days per year"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Application Deadline <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          type="date"
          value={formData.deadline || ""}
          onChange={set("deadline")}
          min={new Date().toISOString().split("T")[0]}
          style={inputStyle}
        />
      </div>
      {/* Weekend required — sits above days so the effect is immediately visible */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", padding: "0.6rem 0.75rem", backgroundColor: formData.weekendRequired ? "#fef3c7" : "#f9fafb", borderRadius: "0.5rem", border: `1.5px solid ${formData.weekendRequired ? "#fbbf24" : "#e5e7eb"}` }}>
        <input
          type="checkbox"
          checked={formData.weekendRequired || false}
          onChange={e => {
            const checked = e.target.checked;
            setFormData(prev => {
              let days = [...prev.days];
              const times = { ...prev.times };
              if (checked) {
                if (!days.includes("Saturday")) days.push("Saturday");
                if (!days.includes("Sunday"))   days.push("Sunday");
              } else {
                days = days.filter(d => d !== "Saturday" && d !== "Sunday");
                delete times["Saturday"];
                delete times["Sunday"];
              }
              return { ...prev, weekendRequired: checked, days, times };
            });
          }}
          style={{ width: "16px", height: "16px", cursor: "pointer" }}
        />
        <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#374151" }}>
          Weekend work required
          <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem", display: "block" }}>Automatically selects Saturday & Sunday below</span>
        </span>
      </label>

      <div>
        <label style={labelStyle}>Days Available *</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
          {weekdays.map(day => {
            const active = formData.days.includes(day);
            const isWeekend = day === "Saturday" || day === "Sunday";
            return (
              <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                padding: "0.3rem 0.75rem", borderRadius: "0.4rem", cursor: "pointer",
                border: `1.5px solid ${active ? (isWeekend ? "#f59e0b" : "#3b82f6") : "#d1d5db"}`,
                backgroundColor: active ? (isWeekend ? "#fef3c7" : "#eff6ff") : "white",
                color: active ? (isWeekend ? "#d97706" : "#1d4ed8") : "#374151",
                fontWeight: "600", fontSize: "0.8rem",
              }}>
                {day.slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Shift start times per selected day */}
      {formData.days.length > 0 && (
        <div>
          <label style={labelStyle}>Shift Start Times</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem" }}>
            {formData.days.map(day => {
              const isWeekend = day === "Saturday" || day === "Sunday";
              return (
                <div key={day} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ minWidth: "88px", fontSize: "0.875rem", fontWeight: "600", color: isWeekend ? "#d97706" : "#374151" }}>{day}</span>
                  <select
                    value={formData.times?.[day] || ""}
                    onChange={e => setFormData(prev => ({ ...prev, times: { ...prev.times, [day]: e.target.value } }))}
                    style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                  >
                    <option value="">Any time</option>
                    {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Photos */}
      <div>
        <label style={labelStyle}>
          Photos *
          <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem", marginLeft: "0.4rem" }}>
            {totalPhotos}/10 — at least 1 required
          </span>
        </label>

        {/* Banner preview — interactive zoom & pan */}
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (() => {
          const allSrcs = [
            ...existingPhotos,
            ...photoFiles.map(f => URL.createObjectURL(f)),
          ];
          const safeIdx = Math.min(previewIndex, allSrcs.length - 1);
          const src = allSrcs[safeIdx];
          const crop = getCrop(safeIdx);
          return src ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <p style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>Preview · drag to reposition</p>
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <button type="button" onClick={() => { dragRef.current.zoom = 1; setCrop(safeIdx, { zoom: 1, offsetX: 0, offsetY: 0 }); }} style={{ ...zoomBtn, color: "#A21D54" }}>Reset</button>
                  <button type="button" onClick={() => { const nz = Math.max(1, getCrop(safeIdx).zoom - 2.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>−</button>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: "32px", textAlign: "center" }}>{Math.round(100 + (crop.zoom - 1) / 9 * 100)}%</span>
                  <button type="button" onClick={() => { const nz = Math.min(10, getCrop(safeIdx).zoom + 2.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>+</button>
                </div>
              </div>
              <div
                ref={previewRef}
                style={{ position: "relative", width: "100%", maxWidth: "340px", aspectRatio: "1/1", backgroundColor: "#0f172a", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
                onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
                onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.1s ease",
                }}>
                  <img src={src} alt="preview" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {/* Thumbnails grid */}
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
            {existingPhotos.map((url, i) => {
              const isActive = Math.min(previewIndex, existingPhotos.length + photoFiles.length - 1) === i;
              return (
                <div key={url} onClick={() => setPreviewIndex(i)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "#A21D54" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                  <img src={url} alt="job photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={e => { e.stopPropagation(); removeExistingPhoto(url); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", color: "white", width: "18px", height: "18px", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                </div>
              );
            })}
            {photoFiles.map((file, i) => {
              const globalIdx = existingPhotos.length + i;
              const isActive = Math.min(previewIndex, existingPhotos.length + photoFiles.length - 1) === globalIdx;
              return (
                <div key={i} onClick={() => setPreviewIndex(globalIdx)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "#A21D54" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                  <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={e => { e.stopPropagation(); removeNewPhoto(i); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", color: "white", width: "18px", height: "18px", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add photo button */}
        {totalPhotos < 10 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px dashed #d1d5db", backgroundColor: "white", color: "#374151", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>
            + Add Photo{totalPhotos === 0 ? " (required)" : ""}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoAdd} />
          </label>
        )}
        {totalPhotos >= 10 && (
          <p style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: "600" }}>Maximum of 10 photos reached.</p>
        )}
      </div>

      {isEdit && (
        <div>
          <label style={labelStyle}>Status</label>
          <select value={formData.status} onChange={set("status")} style={inputStyle}>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
      )}
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
        <button
          onClick={() => {
            // Pass photos in order with their crop settings — no baking, full quality preserved
            const allCrops = [
              ...existingPhotos.map((_, i) => cropSettings[i] || { zoom: 1, offsetX: 0, offsetY: 0 }),
              ...photoFiles.map((_, i) => cropSettings[existingPhotos.length + i] || { zoom: 1, offsetX: 0, offsetY: 0 }),
            ];
            onSave({ existingPhotos, newFiles: photoFiles, allCrops });
          }}
          disabled={formSaving}
          style={{ ...btnGreen, flex: 1, opacity: formSaving ? 0.7 : 1 }}
        >
          {formSaving ? "Saving…" : isEdit ? "Save Changes" : "Create Posting"}
        </button>
        <button onClick={onCancel} style={{ ...btnGray, flex: 1 }}>Cancel</button>
      </div>
    </div>
  );
}

function ChatThread({ jobId, studentId, companyId, senderId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let channel;
    import("../lib/auth").then(({ fetchMessages }) => {
      fetchMessages(jobId, studentId)
        .then(msgs => { setMessages(msgs); setLoading(false); })
        .catch(() => setLoading(false));
    });

    channel = supabase
      .channel(`msgs_${jobId}_${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `job_id=eq.${jobId}` },
        payload => {
          if (payload.new.student_id === studentId) {
            setMessages(prev => [...prev, payload.new]);
          }
        })
      .subscribe();

    return () => { channel && supabase.removeChannel(channel); };
  }, [jobId, studentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      const { sendMessage } = await import("../lib/auth");
      await sendMessage(jobId, studentId, companyId, senderId, text);
    } catch (e) {
      console.error("Send failed:", e);
    }
  };

  return (
    <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#374151", marginBottom: "0.5rem" }}>💬 Messages</p>
      <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {loading
          ? <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>Loading…</p>
          : messages.length === 0
            ? <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>No messages yet.</p>
            : messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender_id === senderId ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{ backgroundColor: m.sender_id === senderId ? "#3b82f6" : "#e5e7eb", color: m.sender_id === senderId ? "white" : "#111827", padding: "0.4rem 0.65rem", borderRadius: "0.55rem", fontSize: "0.8rem", lineHeight: 1.4 }}>
                  {m.text}
                </div>
                <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.sender_id === senderId ? "right" : "left" }}>
                  {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))
        }
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message…"
          style={{ flex: 1, padding: "0.45rem 0.65rem", borderRadius: "0.4rem", border: "1.5px solid #d1d5db", fontSize: "0.8rem", fontFamily: "inherit" }}
        />
        <button onClick={send} style={{ padding: "0.45rem 0.75rem", borderRadius: "0.4rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
          Send
        </button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "1rem",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "white", borderRadius: "1rem", padding: "1.5rem",
          width: "100%", maxWidth: "520px", maxHeight: "85vh",
          overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: "700", fontSize: "1.1rem", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Availability Heatmap ───────────────────────────────────────────────── */

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

function AvailabilityHeatmap({ data }) {
  const allCounts = DAYS.flatMap(d => SLOTS.map(s => data[d]?.[s] || 0));
  const max = Math.max(...allCounts, 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.65rem", width: "100%", minWidth: "480px" }}>
        <thead>
          <tr>
            <th style={{ padding: "0 0.4rem 0.4rem 0", textAlign: "left", color: "#94a3b8", fontWeight: "600", minWidth: "72px" }}></th>
            {SLOTS.map(s => (
              <th key={s} style={{ padding: "0 2px 0.4rem", textAlign: "center", color: "#94a3b8", fontWeight: "600", whiteSpace: "nowrap" }}>
                {s.slice(0,2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map(day => {
            const isWeekend = day === "Saturday" || day === "Sunday";
            return (
              <tr key={day}>
                <td style={{ padding: "2px 0.4rem 2px 0", fontWeight: "600", color: isWeekend ? "#d97706" : "#374151", whiteSpace: "nowrap" }}>
                  {day.slice(0, 3)}
                </td>
                {SLOTS.map(slot => {
                  const count = data[day]?.[slot] || 0;
                  const intensity = count / max;
                  const bg = count === 0 ? "#fafafa"
                    : isWeekend
                      ? `rgba(245,158,11,${0.15 + intensity * 0.75})`
                      : `rgba(162,29,84,${0.15 + intensity * 0.75})`;
                  return (
                    <td key={slot} title={`${day} ${slot} — ${count} student${count !== 1 ? "s" : ""}`} style={{ padding: "2px", textAlign: "center" }}>
                      <div style={{ width: "100%", minWidth: "20px", height: "20px", borderRadius: "3px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", color: intensity > 0.5 ? "white" : "#64748b", fontWeight: "700", fontSize: "0.6rem" }}>
                        {count > 0 ? count : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.5rem", marginBottom: 0 }}>
        Numbers show how many verified students are free at each time. Hover a cell for details.
      </p>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const labelStyle = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.25rem" };
const inputStyle  = { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" };

const btnBase      = { padding: "0.6rem 1.1rem", borderRadius: "0.5rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit", letterSpacing: "-0.01em" };
const btnGreen     = { ...btnBase, backgroundColor: "#059669" };
const btnGray      = { ...btnBase, backgroundColor: "#64748b" };

const zoomBtn      = { padding: "0.2rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" };

const navBtn        = { background: "none", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.4rem", color: "white", fontSize: "0.85rem", fontWeight: "700", padding: "0.1rem 0.5rem", cursor: "pointer", fontFamily: "inherit" };
const cvHeaderBtn   = { background: "none", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.4rem", color: "white", fontSize: "0.75rem", fontWeight: "600", padding: "0.25rem 0.6rem", cursor: "pointer", fontFamily: "inherit" };
const btnSmallBase  = { padding: "0.32rem 0.75rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" };
const btnSmallGreen = { ...btnSmallBase, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 2px 6px rgba(16,185,129,0.3)" };
const btnSmallBlue  = { ...btnSmallBase, background: "linear-gradient(135deg, #A21D54, #C2185B)", boxShadow: "0 2px 6px rgba(162,29,84,0.3)" };
const btnSmallGray  = { ...btnSmallBase, backgroundColor: "#64748b" };
const btnSmallRed   = { ...btnSmallBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 2px 6px rgba(244,63,94,0.3)" };
const btnCardAction = { padding: "0.55rem 1.25rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", backgroundColor: "#64748b", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", whiteSpace: "nowrap" };
