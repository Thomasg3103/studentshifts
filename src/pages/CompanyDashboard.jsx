import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { supabase, withTimeout } from "../lib/supabase";
import { fetchAvailabilityHeatmap, fetchAllVerifiedStudents, fetchLikedStudentIds, likeStudent, unlikeStudent, sendEmail, emailShiftAvailable } from "../lib/auth";
import { useHiringPipeline } from "../hooks/useHiringPipeline";
import { useFocusTrap } from "../hooks/useFocusTrap";
import BrowseStudents from "./company/BrowseStudents";
import SavedStudents from "./company/SavedStudents";
import JobPostingCard from "./company/JobPostingCard";
import { PostingsSkeleton } from "../components/Skeleton";
import ApplicantsView from "./company/ApplicantsView";
import { CloseJobModal } from "./company/CloseJobModal";
import JobForm from "./company/JobForm";
import { StatCard, Modal, AvailabilityHeatmap } from "./company/shared";
import CompanyOnboardingBanner from "../components/CompanyOnboardingBanner";

function ConfirmDialog({ title, body, emoji, confirmLabel, onConfirm, onCancel, confirming }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("button")?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus(); };
  }, []);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", padding: "1.75rem 1.5rem", width: "100%", maxWidth: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", textAlign: "center" }}>
        <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>{emoji}</p>
        <h3 style={{ margin: "0 0 0.4rem", fontWeight: "700", fontSize: "1.05rem", color: "var(--color-text-primary, #0f172a)" }}>{title}</h3>
        <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)" }}>{body}</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={onCancel} disabled={confirming} style={{ flex: 1, padding: "0.6rem 1rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.6rem", background: "var(--color-bg-elevated, white)", cursor: "pointer", color: "var(--color-text-body, #374151)", fontSize: "0.88rem", fontWeight: "600", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={onConfirm} disabled={confirming} style={{ flex: 1, padding: "0.6rem 1rem", border: "none", borderRadius: "0.6rem", background: "#dc2626", cursor: "pointer", color: "white", fontSize: "0.88rem", fontWeight: "700", fontFamily: "inherit", opacity: confirming ? 0.7 : 1 }}>{confirming ? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

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
    isUrgent:            j.is_urgent            || false,
    screeningQuestions:  j.screening_questions  || [],
    status:          j.status || "Active",
    photos:          j.photos || [],
    photoCrops:      j.photo_crops || [],
    filledShifts:    j.filled_shifts || [],
    closeReason:     j.close_reason || "",
    applicants:      [],
    applicantCount:  j.applicant_count || 0,
    createdAt:       j.created_at || null,
  };
}

export default function CompanyDashboard() {
  const { setPage, currentUser } = useApp();
  const [postings, setPostings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadRetryKey, setLoadRetryKey] = useState(0);
  const [formSaving, setFormSaving] = useState(false);
  const [modal, setModal]         = useState(null);
  const applicantsModalRef = useRef(null);
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
  const [closingPosting, setClosingPosting] = useState(null);
  const [deletingPosting, setDeletingPosting] = useState(null);
  const [deletingConfirming, setDeletingConfirming] = useState(false);
  const [talentPool, setTalentPool]                 = useState([]);
  const [talentPoolLoaded, setTalentPoolLoaded]     = useState(false);
  const [templates, setTemplates]                   = useState([]);
  const [templatesLoaded, setTemplatesLoaded]       = useState(false);
  const [expiringJobs, setExpiringJobs]             = useState([]);
  const originalPhotosRef = useRef([]); // tracks photos at edit-open time for H24 storage cleanup

  const {
    updateApplicantStatus,
    handleStageChange,
    handleNotesSaved,
    handleIncrementRound,
    handleSaveInterviewRoundsData,
    handleSendInterviewInvite,
    handleSendTrialInvite,
    handleSaveTrialSchedule,
  } = useHiringPipeline({ activePosting, setPostings, setActivePosting, currentUser });

  // Load availability heatmap once
  useEffect(() => {
    fetchAvailabilityHeatmap().then(setHeatmap).catch(e => console.warn("[CompanyDashboard] heatmap failed:", e));
  }, []);

  // Load liked student IDs on mount
  useEffect(() => {
    if (!currentUser?.id) return;
    fetchLikedStudentIds(currentUser.id)
      .then(ids => setLikedStudentIds(new Set(ids)))
      .catch(e => console.warn("[CompanyDashboard] liked students failed:", e));
  }, [currentUser?.id]);

  // Load applicant student IDs whenever Browse Students or Saved Students tab is open and jobs are loaded
  useEffect(() => {
    if ((activeTab !== "students" && activeTab !== "saved") || !currentUser || loading) return;
    const jobIds = postings.map(p => p.id);
    if (!jobIds.length) return;
    withTimeout(
      supabase.from("applications").select("student_id").in("job_id", jobIds),
      10000
    ).then(({ data }) => {
      setApplicantStudentIds(new Set((data || []).map(a => a.student_id)));
    }).catch(e => console.warn("[CompanyDashboard] applicant IDs failed:", e));
  }, [activeTab, loading, postings]);

  // Load all verified students when Browse Students/Saved Students tab is opened,
  // or when the applicants view opens and there are liked students (to populate Shortlisted tab saved section)
  useEffect(() => {
    const needStudents = activeTab === "students" || activeTab === "saved" ||
      (modal === "applicants" && likedStudentIds.size > 0);
    if (!needStudents || studentsFetched || !currentUser) return;
    setStudentsLoading(true);
    setStudentsError(null);
    fetchAllVerifiedStudents()
      .then(data => { setStudents(data); setStudentsFetched(true); })
      .catch(e => { setStudentsError(e.message || "Failed to load students"); setStudentsFetched(true); })
      .finally(() => setStudentsLoading(false));
  }, [activeTab, modal, likedStudentIds.size]);

  // Load talent pool (past-hired students) when Talent Pool tab is opened
  useEffect(() => {
    if (activeTab !== "talent" || talentPoolLoaded || !currentUser) return;
    supabase.rpc("get_company_past_hires", { p_company_id: currentUser.id })
      .then(({ data }) => {
        setTalentPool((data || []).map(r => ({
          id:       r.student_id,
          name:     r.student_name,
          photo:    r.profile_photo,
          bio:      r.bio,
          jobTitle: r.job_title,
          hiredAt:  r.hired_at,
        })));
        setTalentPoolLoaded(true);
      })
      .catch(e => { console.warn("[CompanyDashboard] talentPool failed:", e); setTalentPoolLoaded(true); });
  }, [activeTab, talentPoolLoaded, currentUser?.id]);

  // Load job templates when Templates tab is opened
  useEffect(() => {
    if (activeTab !== "templates" || templatesLoaded || !currentUser) return;
    supabase.from("job_templates").select("id, name, data, created_at").eq("company_id", currentUser.id).order("created_at", { ascending: false })
      .then(({ data }) => { setTemplates(data || []); setTemplatesLoaded(true); })
      .catch(() => setTemplatesLoaded(true));
  }, [activeTab, templatesLoaded, currentUser]);

  // Check for jobs expiring in 48h (shown as banner on jobs tab)
  useEffect(() => {
    if (!currentUser) return;
    supabase.rpc("get_jobs_expiring_soon", { hours_ahead: 48 })
      .then(({ data }) => { if (data?.length) setExpiringJobs(data); })
      .catch(() => {});
  }, [currentUser?.id]);

  // Load this company's jobs on mount, auto-expire any past their deadline
  useEffect(() => {
    if (!currentUser) return;
    setLoadError(false);
    withTimeout(
      supabase.from("jobs").select("*, applications(id, status)").eq("company_id", currentUser.id).order("created_at", { ascending: false }),
      10000, "Loading jobs timed out."
    ).then(async ({ data, error }) => {
      if (error) { setLoadError(true); setLoading(false); return; }
      if (data) {
        const today = new Date().toISOString().split("T")[0];
        const expired = data.filter(j => j.status === "Active" && j.deadline && j.deadline < today);
        if (expired.length) {
          await supabase.from("jobs").update({ status: "Expired" }).in("id", expired.map(j => j.id));
          expired.forEach(j => { j.status = "Expired"; });
        }
        setPostings(data.map(j => ({
          ...normaliseJob(j),
          applicantCount: j.applications?.length || 0,
          hiredCount:     j.applications?.filter(a => a.status === "Accepted").length || 0,
        })));
      }
      setLoading(false);
    }).catch(() => { setLoadError(true); setLoading(false); });
  }, [currentUser?.id, loadRetryKey]);

  const totalApplicants = postings.reduce((sum, p) => sum + p.applicantCount, 0);
  const totalHired      = postings.reduce((sum, p) => sum + (p.hiredCount || 0), 0);
  const activeCount     = postings.filter(p => p.status === "Active").length;

  const openApplicants = async (posting) => {
    setApplicantsViewMode("list");
    setActivePosting({ ...posting, applicants: [], applicantsLoading: true, applicantsError: null });
    setModal("applicants");
    const { data: appData, error: appError } = await withTimeout(
      supabase.from("applications").select("id, status, student_id, pipeline_stage, company_notes, interview_round, trial_date, trial_time, interview_date, interview_time, interview_rounds_data, screening_answers").eq("job_id", posting.id).order("created_at", { ascending: true }),
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
      const { data: shiftData } = await withTimeout(
        supabase.from("applications").select("id, preferred_shift").in("id", appIds),
        10000
      ).catch(() => ({ data: [] }));
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
      transport:        cvMap[a.student_id]?.transport         || [],
      canStart:         cvMap[a.student_id]?.can_start         || "",
      workExperience:   cvMap[a.student_id]?.work_experience   || "",
      rightToWork:      cvMap[a.student_id]?.right_to_work     || false,
      driverLicence:    cvMap[a.student_id]?.driver_licence    || false,
      screeningAnswers: a.screening_answers                    || [],
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
    setFormData({ title: "", category: "", location: "", pay: "", description: "", deadline: "", days: [], times: {}, weekendRequired: false, isUrgent: false, screeningQuestions: [], status: "Active", photos: [], photoFiles: [], lat: undefined, lng: undefined, sickPay: false, holidays: "" });
    setModal("form");
  };

  const openEdit = (posting) => {
    originalPhotosRef.current = (posting.photos || []).filter(p => typeof p === "string" && p.startsWith("http"));
    setFormData({ ...posting, days: [...posting.days], times: { ...posting.times }, photoFiles: [] });
    setModal("form");
  };

  const duplicatePosting = (posting) => {
    setFormData({
      title: posting.title,
      category: posting.category,
      location: posting.location,
      lat: posting.lat,
      lng: posting.lng,
      pay: posting.pay,
      description: posting.description || "",
      deadline: "",
      days: [...posting.days],
      times: { ...posting.times },
      weekendRequired: posting.weekendRequired || false,
      isUrgent: false,
      sickPay: posting.sickPay || false,
      holidays: posting.holidays || "",
      screeningQuestions: posting.screeningQuestions || [],
      status: "Active",
      photos: [],
      photoFiles: [],
    });
    setModal("form");
  };

  const closeModal = () => {
    setModal(null);
    setActivePosting(null);
    setFormData(null);
  };
  useFocusTrap(applicantsModalRef, closeModal, modal === "applicants");

  const [notifyingJobIds, setNotifyingJobIds] = useState(new Set());
  const [notifiedJobIds, setNotifiedJobIds]   = useState(new Set());
  const [matchesData, setMatchesData]         = useState({});

  const handleNotifyStudents = async (posting) => {
    if (notifyingJobIds.has(posting.id) || notifiedJobIds.has(posting.id)) return;
    setNotifyingJobIds(prev => new Set([...prev, posting.id]));
    try {
      const { data: matched, error: matchErr } = await supabase.rpc("get_matched_students_for_job", { p_job_id: posting.id });
      if (matchErr) throw matchErr;
      const studentIds = (matched || []).map(s => s.student_id);
      if (!studentIds.length) { toast("No matching students found for this shift."); return; }
      const { data: emailRows, error: emailErr } = await supabase.rpc("get_user_emails", { user_ids: studentIds });
      if (emailErr) throw emailErr;
      const emails = (emailRows || []).map(r => r.email).filter(Boolean);
      if (!emails.length) { toast("Could not find email addresses for matched students."); return; }
      await Promise.all(emails.map(to => sendEmail({
        to,
        subject: `New shift matching your availability — ${posting.title} at ${currentUser.name}`,
        html: emailShiftAvailable("there", currentUser.name, posting.title, posting.days, posting.location),
      })));
      setNotifiedJobIds(prev => new Set([...prev, posting.id]));
      toast.success(`Notified ${emails.length} student${emails.length !== 1 ? "s" : ""}!`);
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Failed to notify students — please try again.");
    } finally {
      setNotifyingJobIds(prev => { const s = new Set(prev); s.delete(posting.id); return s; });
    }
  };

  const handleLoadMatches = async (jobId) => {
    if (matchesData[jobId]?.loaded || matchesData[jobId]?.loading) return;
    setMatchesData(prev => ({ ...prev, [jobId]: { loading: true, loaded: false, students: [] } }));
    const { data, error } = await supabase.rpc("get_matched_students_for_job", { p_job_id: jobId });
    setMatchesData(prev => ({
      ...prev,
      [jobId]: { loading: false, loaded: true, students: error ? [] : (data || []).slice(0, 5), error: error?.message || null },
    }));
  };

  const toggleStatus = async (id) => {
    const posting = postings.find(p => p.id === id);
    const newStatus = posting.status === "Active" ? "Closed" : "Active";
    try {
      const { error } = await withTimeout(
        supabase.from("jobs").update({ status: newStatus }).eq("id", id),
        10000, "Update timed out."
      );
      if (error) throw error;
      setPostings(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      if (activePosting?.id === id) setActivePosting(prev => prev ? { ...prev, status: newStatus } : prev);
    } catch (e) {
      console.error("[CompanyDashboard] toggleStatus error:", e);
      toast.error("Failed to update job status. Please try again.");
    }
  };

  const deletePosting = async (id) => {
    try {
      // Delete job photos from storage before removing the DB row
      const posting = postings.find(p => p.id === id);
      const photoPaths = (posting?.photos || []).flatMap(url => {
        const m = url.match(/\/storage\/v1\/object\/public\/job-photos\/(.+?)(\?|$)/);
        return m ? [decodeURIComponent(m[1])] : [];
      });
      if (photoPaths.length) {
        await supabase.storage.from("job-photos").remove(photoPaths).catch(e => console.warn("Photo cleanup failed:", e));
      }
      // F5/S14: use RPC that cascades applications+chat_messages and blocks deletion
      // if there are any Accepted applicants (would orphan hired students).
      const { error } = await withTimeout(
        supabase.rpc("delete_job_cascade", { p_job_id: id }),
        10000, "Delete timed out."
      );
      if (error) throw error;
      setPostings(prev => prev.filter(p => p.id !== id));
      if (activePosting?.id === id) { setActivePosting(null); setModal(null); }
    } catch (e) {
      console.error("[CompanyDashboard] deletePosting error:", e);
      const msg = e.message || "";
      toast.error(`Failed to delete job: ${msg || "Unknown error"}`);
    }
  };

  const saveForm = async ({ existingPhotos: keptUrls = [], newFiles = [], allCrops = [] } = {}) => {
    if (!formData.category) { toast.error("Please select a job category."); return; }
    if (!formData.title.trim() || !formData.location.trim() || !formData.pay.trim()) {
      toast.error("Please fill in Title, Location, and Pay."); return;
    }
    const payNum = parseFloat((formData.pay || "").replace(/[^0-9.]/g, ""));
    if (!payNum || payNum <= 0) { toast.error("Pay rate must be greater than €0."); return; }
    if (payNum > 999) { toast.error("Pay rate cannot exceed €999/hr."); return; }
    if (formData.days.length === 0) { toast.error("Please select at least one day."); return; }
    if (keptUrls.length === 0 && newFiles.length === 0) { toast.error("Please upload at least 1 photo."); return; }
    const descPlain = (formData.description || "").replace(/<[^>]*>/g, "");
    if (descPlain.length > 5000) { toast.error(`Description is too long (${descPlain.length} characters). Maximum is 5,000.`); return; }
    setFormSaving(true);
    try {
      // Build ordered photo URL array â€" existing first (already URLs), then upload new files in order
      const photoUrls = [...keptUrls];
      const photoCrops = [...allCrops]; // parallel array, same order
      const ALLOWED_PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
      const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
      let skippedPhotoCount = 0;
      for (const file of newFiles) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_PHOTO_EXTS.has(ext)) { skippedPhotoCount++; continue; }
        if (file.size > MAX_PHOTO_BYTES) { skippedPhotoCount++; continue; }
        const path = `${currentUser.id}/photo_${Date.now()}.${ext}`;
        try {
          const { error: upErr } = await withTimeout(
            supabase.storage.from("job-photos").upload(path, file, { upsert: true }),
            8000, "timeout"
          );
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from("job-photos").getPublicUrl(path);
            photoUrls.push(publicUrl);
          } else {
            skippedPhotoCount++;
          }
        } catch (e) {
          skippedPhotoCount++;
          console.warn("Photo upload skipped:", e.message);
        }
      }
      if (skippedPhotoCount > 0) {
        toast.error(`${skippedPhotoCount} photo${skippedPhotoCount > 1 ? "s" : ""} could not be uploaded (wrong type, too large, or network error).`);
      }
      // Delete any photos that were removed during editing
      if (formData.id && originalPhotosRef.current.length > 0) {
        const removed = originalPhotosRef.current.filter(u => !keptUrls.includes(u));
        if (removed.length > 0) {
          const paths = removed.flatMap(url => {
            const m = url.match(/\/storage\/v1\/object\/public\/job-photos\/(.+?)(\?|$)/);
            return m ? [decodeURIComponent(m[1])] : [];
          });
          if (paths.length) supabase.storage.from("job-photos").remove(paths).catch(() => {});
        }
      }

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
        is_urgent:            formData.isUrgent || false,
        screening_questions:  formData.screeningQuestions || [],
        status:          formData.status || "Active",
        photos:          photoUrls,
        photo_crops:     photoCrops,
      };

      if (formData.id) {
        // H25: if days were removed, purge filled_shifts entries for those days so hire logic stays consistent
        const existingJob = postings.find(p => p.id === formData.id);
        if (existingJob?.filledShifts?.length) {
          const cleanedFilled = existingJob.filledShifts.filter(d => formData.days.includes(d));
          if (cleanedFilled.length !== existingJob.filledShifts.length) {
            jobData.filled_shifts = cleanedFilled;
          }
        }
        const { error } = await withTimeout(
          supabase.from("jobs").update(jobData).eq("id", formData.id),
          10000, "Database timeout - please try again."
        );
        if (error) throw error;
        setPostings(prev => prev.map(p => p.id === formData.id
          ? { ...normaliseJob({ ...jobData, id: formData.id }), applicants: p.applicants, applicantCount: p.applicantCount }
          : p
        ));
      } else {
        const { data, error } = await withTimeout(
          supabase.from("jobs").insert(jobData).select().single(),
          10000, "Database timeout - please try again."
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


  const toggleLike = async (studentId) => {
    const isLiked = likedStudentIds.has(studentId);
    // Optimistic update
    if (isLiked) {
      setLikedStudentIds(prev => { const next = new Set(prev); next.delete(studentId); return next; });
    } else {
      setLikedStudentIds(prev => new Set([...prev, studentId]));
    }
    try {
      if (isLiked) {
        await unlikeStudent(currentUser.id, studentId);
      } else {
        await likeStudent(currentUser.id, studentId);
      }
    } catch {
      // Roll back the optimistic update
      if (isLiked) {
        setLikedStudentIds(prev => new Set([...prev, studentId]));
      } else {
        setLikedStudentIds(prev => { const next = new Set(prev); next.delete(studentId); return next; });
      }
      toast.error("Could not update saved students — please try again.");
    }
  };


  const handleCloseJob = async (jobId, { foundStudent, winnerId, winnerApplicant, closeReason }) => {
    if (foundStudent && winnerId && winnerApplicant) {
      await updateApplicantStatus(winnerId, "Accepted", winnerApplicant);
    }
    const update = { status: "Closed" };
    if (closeReason) update.close_reason = closeReason;
    const { error } = await withTimeout(
      supabase.from("jobs").update(update).eq("id", jobId),
      10000, "Update timed out."
    );
    if (error) { toast.error("Failed to close job. Please try again."); return; }
    if (!foundStudent) {
      // Auto-decline all remaining Pending applicants and notify them
      await withTimeout(
        supabase.from("applications").update({ status: "Rejected" }).eq("job_id", jobId).eq("status", "Pending"),
        10000
      ).catch(e => { Sentry.captureException(e); toast.error("Some applicants could not be notified — please check and retry."); });
      supabase.functions.invoke("send-email", { body: { type: "job-closed", jobId } }).catch(() => {});
    }
    setPostings(prev => prev.map(p => p.id === jobId ? { ...p, status: "Closed" } : p));
    closeModal();
  };

  const verificationStatus = currentUser?.verificationStatus;
  const isVerified = verificationStatus === "verified";

  const btnBase  = { padding: "0.6rem 1.1rem", borderRadius: "0.5rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit", letterSpacing: "-0.01em" };
  const btnGreen = { ...btnBase, backgroundColor: "#059669" };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg-subtle)", padding: "1.5rem 1rem" }}>
      <Helmet>
        <title>Company Dashboard — StudentShifts</title>
        <meta name="robots" content="noindex" />
      </Helmet>
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
            <p style={{ margin: "0.2rem 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>Your company account was not approved. Please contact support at support@studentshifts.ie for assistance.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Company Dashboard</p>
          <h1 style={{ fontSize: "1.65rem", fontWeight: "800", margin: 0, color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.02em" }}>{currentUser?.name || "Company"}</h1>
        </div>
        {isVerified && activeTab === "jobs" && <button onClick={openCreate} style={{ ...btnGreen, borderRadius: "2rem", padding: "0.55rem 1.4rem", fontSize: "0.9rem" }}>+ New Job</button>}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", marginBottom: "1.75rem", gap: "0" }}>
        {[
          { val: "jobs",     label: "My Jobs" },
          { val: "students",  label: "Browse Students" },
          { val: "saved",     label: "Saved Students", count: likedStudentIds.size },
          { val: "talent",    label: "Talent Pool",    count: totalHired > 0 ? totalHired : 0 },
          { val: "templates", label: "Templates",      count: templates.length || 0 },
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

      {/* Stats — jobs tab only */}
      {activeTab === "jobs" && (
      <div style={{ display: "flex", gap: "1rem", marginBottom: expiringJobs.length ? "1rem" : "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Closed" value={postings.length - activeCount} />
        <StatCard label="Total Applicants" value={totalApplicants} />
        <StatCard label="Total Hired" value={totalHired} />
      </div>
      )}

      {/* Expiry reminders banner — jobs tab only */}
      {activeTab === "jobs" && expiringJobs.length > 0 && (
        <div style={{ marginBottom: "1.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {expiringJobs.map(j => (
            <div key={j.job_id} style={{ backgroundColor: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "0.75rem", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⏰</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.88rem", color: "#78350f" }}>
                  <strong>{j.title}</strong> closes in 2 days
                </p>
                <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "#92400e" }}>
                  {j.applicant_count > 0 ? `${j.applicant_count} student${j.applicant_count !== 1 ? "s" : ""} waiting — consider extending the deadline.` : "No applicants yet — consider extending the deadline or promoting it."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Availability Heatmap â€" Browse Students tab */}
      {activeTab === "students" && heatmap && (
        <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showHeatmap ? "1rem" : 0 }}>
            <div>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "var(--color-text-primary, #1e293b)" }}>Student Availability</p>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>When verified students are free — use this to plan your job times</p>
            </div>
            <button onClick={() => setShowHeatmap(p => !p)} style={{ padding: "0.35rem 0.85rem", borderRadius: "0.5rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-brand)", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
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
          postings={postings}
        />
      )}

      {/* Saved Students tab */}
      {activeTab === "saved" && (
        <SavedStudents
          students={students}
          loading={studentsLoading}
          fetched={studentsFetched}
          error={studentsError}
          likedStudentIds={likedStudentIds}
          applicantStudentIds={applicantStudentIds}
          onToggleLike={toggleLike}
          chatStudent={chatStudent}
          setChatStudent={setChatStudent}
          companyId={currentUser?.id}
          companyName={currentUser?.name}
        />
      )}

      {/* Templates tab */}
      {activeTab === "templates" && (
        <div>
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #0f172a)" }}>Job Templates</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.83rem", color: "var(--color-text-secondary, #64748b)" }}>Save a job posting as a template to repost it in one click — great for recurring shifts.</p>
          </div>
          {!templatesLoaded ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", textAlign: "center", padding: "2rem 0" }}>Loading…</p>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📋</div>
              <p style={{ fontWeight: "700", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.25rem" }}>No templates yet</p>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)", marginBottom: "1.25rem" }}>Click "Save as Template" on any job posting to save it here.</p>
              <button onClick={() => setActiveTab("jobs")} style={{ padding: "0.5rem 1.25rem", borderRadius: "2rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}>Go to My Jobs →</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {templates.map(t => (
                <div key={t.id} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.85rem", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "var(--color-text-primary, #0f172a)" }}>{t.name}</p>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>
                      {t.data?.category || ""}
                      {t.data?.location ? ` · ${t.data.location}` : ""}
                      {t.data?.pay ? ` · ${t.data.pay}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        const d = { ...t.data, id: undefined, status: "Active" };
                        setFormData(d);
                        setModal("form");
                      }}
                      style={{ padding: "0.38rem 0.85rem", borderRadius: "0.45rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
                    >Use Template</button>
                    <button
                      onClick={async () => {
                        await supabase.from("job_templates").delete().eq("id", t.id);
                        setTemplates(prev => prev.filter(x => x.id !== t.id));
                      }}
                      style={{ padding: "0.38rem 0.85rem", borderRadius: "0.45rem", border: "1.5px solid #fca5a5", backgroundColor: "var(--color-bg-elevated, white)", color: "#dc2626", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
                    >Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Talent Pool tab */}
      {activeTab === "talent" && (
        <div>
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #0f172a)" }}>Talent Pool</p>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.83rem", color: "var(--color-text-secondary, #64748b)" }}>Students you've previously hired — easy to re-engage for future shifts.</p>
          </div>
          {!talentPoolLoaded ? (
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", textAlign: "center", padding: "2rem 0" }}>Loading…</p>
          ) : talentPool.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>👥</div>
              <p style={{ fontWeight: "700", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.25rem" }}>No hired students yet</p>
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>Students you hire will appear here so you can quickly re-hire them.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {talentPool.map(s => {
                const hiredLabel = s.hiredAt
                  ? new Date(s.hiredAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })
                  : null;
                return (
                  <div key={s.id} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.85rem", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
                      {s.photo ? (
                        <img src={s.photo} alt={s.name} style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} loading="lazy" />
                      ) : (
                        <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: "700", fontSize: "1rem", color: "var(--color-brand)" }}>
                          {s.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "var(--color-text-primary, #0f172a)" }}>{s.name}</p>
                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.jobTitle ? `Hired for ${s.jobTitle}` : "Previously hired"}
                          {hiredLabel ? ` · ${hiredLabel}` : ""}
                        </p>
                        {s.bio && (
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                            {s.bio}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => setChatStudent({ id: s.id, name: s.name })}
                        style={{ padding: "0.38rem 0.85rem", borderRadius: "0.45rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
                      >💬 Message</button>
                      <button
                        onClick={() => {
                          setActiveTab("students");
                          if (!studentsFetched) setStudentsLoading(true);
                          setChatStudent({ id: s.id, name: s.name, initialMessage: `Hi ${s.name}! We have a new shift coming up and would love to have you back — are you interested?` });
                        }}
                        style={{ padding: "0.38rem 0.85rem", borderRadius: "0.45rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
                      >⚡ Re-Hire</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: "2rem", backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.85rem", padding: "1.25rem 1.5rem", display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
            <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#15803d" }}>Notify Available Students</p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "#166534" }}>On each of your active job postings, use the <strong>📣 Notify</strong> button to instantly email all verified students whose availability matches your shift days.</p>
            </div>
          </div>
        </div>
      )}

      {/* Postings — jobs tab only */}
      {activeTab === "jobs" && (
        loading ? (
          <PostingsSkeleton />
        ) : loadError ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#fff1f2", borderRadius: "1rem", border: "1.5px solid #fca5a5" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
            <p style={{ fontWeight: "700", color: "#b91c1c", fontSize: "1rem", marginBottom: "0.4rem" }}>Couldn't load your job postings</p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", marginBottom: "1.25rem" }}>Check your connection and try again.</p>
            <button
              onClick={() => { setLoadError(false); setLoading(true); setLoadRetryKey(k => k + 1); }}
              style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >Retry</button>
          </div>
        ) : postings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--color-text-secondary, #6b7280)", backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>ðŸ"‹</div>
            <p style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.4rem" }}>No job postings yet</p>
            <p style={{ marginBottom: "1.75rem", fontSize: "0.9rem", color: "var(--color-text-secondary, #64748b)" }}>
              {isVerified ? "Create your first posting to start receiving applicants." : "Your account must be verified before you can post jobs."}
            </p>
            {isVerified && <button onClick={openCreate} style={{ ...btnGreen, borderRadius: "2rem", padding: "0.55rem 1.4rem" }}>+ Create Job Posting</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {postings.map(posting => (
              <JobPostingCard
                key={posting.id}
                posting={posting}
                onViewApplicants={() => openApplicants(posting)}
                onEdit={() => openEdit(posting)}
                onRequestDelete={() => setDeletingPosting(posting)}
                onToggleStatus={() => toggleStatus(posting.id)}
                onDuplicate={() => duplicatePosting(posting)}
                onNotifyStudents={() => handleNotifyStudents(posting)}
                notifying={notifyingJobIds.has(posting.id)}
                notified={notifiedJobIds.has(posting.id)}
                matchesData={matchesData[posting.id]}
                onLoadMatches={() => handleLoadMatches(posting.id)}
                onRequestClose={() => setClosingPosting(posting)}
                onSaveTemplate={async (name) => {
                  const templateData = {
                    title: posting.title, category: posting.category, location: posting.location,
                    pay: posting.pay, description: posting.description, deadline: posting.deadline,
                    days: posting.days, times: posting.times, weekendRequired: posting.weekendRequired,
                    sickPay: posting.sickPay, holidays: posting.holidays, isUrgent: posting.isUrgent,
                    screeningQuestions: posting.screeningQuestions, photos: posting.photos,
                    photoCrops: posting.photoCrops,
                  };
                  const { data, error } = await supabase.from("job_templates").insert({ company_id: currentUser.id, name, data: templateData }).select("id, name, data, created_at").single();
                  if (error) { toast.error("Failed to save template — please try again."); return; }
                  if (data) { setTemplates(prev => [data, ...prev]); setTemplatesLoaded(true); toast.success(`Template "${name}" saved.`); }
                }}
              />
            ))}
          </div>
        )
      )}

      {/* Applicants Modal â€" wide overlay */}
      {modal === "applicants" && activePosting && (
        <div onClick={closeModal} className="applicants-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)", animation: "fadeInOverlay 0.18s ease" }}>
          <div ref={applicantsModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="applicants-modal-title" className="applicants-modal" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "0.85rem", width: "100%", maxWidth: "min(96vw, 1500px)", minHeight: "88vh", maxHeight: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
            {/* Header */}
            <div style={{ height: "60px", padding: "0 1.75rem", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                <h2 id="applicants-modal-title" style={{ margin: 0, fontWeight: "700", fontSize: "1.05rem", color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{activePosting.title}</h2>
                <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activePosting.location} Â· {activePosting.pay}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                {[{ val: "list", label: "List" }, { val: "kanban", label: "Board" }].map(({ val, label }) => (
                  <button key={val} onClick={() => setApplicantsViewMode(val)} style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem", fontWeight: "600", border: `1px solid ${applicantsViewMode === val ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, borderRadius: "0.4rem", cursor: "pointer", fontFamily: "inherit", backgroundColor: applicantsViewMode === val ? "#fff0f6" : "var(--color-bg-elevated, white)", color: applicantsViewMode === val ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)" }}>{label}</button>
                ))}
                <button onClick={closeModal} aria-label="Close" style={{ width: "32px", height: "32px", borderRadius: "0.4rem", border: "1px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", cursor: "pointer", color: "var(--color-text-secondary, #64748b)", fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
              </div>
            </div>
            {/* Pipeline funnel */}
            {!activePosting.applicantsLoading && activePosting.applicants?.length > 0 && (
              <div style={{ padding: "0.85rem 1.75rem", borderBottom: "1px solid var(--color-border-light, #e2e8f0)", display: "flex", alignItems: "center", flexShrink: 0, backgroundColor: "var(--color-bg-surface, #f8fafc)", gap: 0 }}>
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
              <ApplicantsView key={activePosting?.id} posting={activePosting} onUpdateStatus={updateApplicantStatus} onStageChange={handleStageChange} onNotesSaved={handleNotesSaved} onCloseJob={handleCloseJob} onIncrementRound={handleIncrementRound} onSaveTrialSchedule={handleSaveTrialSchedule} onSaveInterviewRoundsData={handleSaveInterviewRoundsData} onSendInterviewInvite={handleSendInterviewInvite} onSendTrialInvite={handleSendTrialInvite} likedStudents={students.filter(s => likedStudentIds.has(s.id))} companyId={currentUser?.id} viewMode={applicantsViewMode} />
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

      {closingPosting && (
        <CloseJobModal
          posting={{ ...closingPosting, applicants: [] }}
          onClose={() => setClosingPosting(null)}
          onCloseJob={async (opts) => {
            await handleCloseJob(closingPosting.id, opts);
            setClosingPosting(null);
          }}
          noHire
        />
      )}

      {deletingPosting && (
        <ConfirmDialog
          title="Delete this job?"
          body={`"${deletingPosting.title}" and all its applicants will be permanently removed. This cannot be undone.`}
          emoji="🗑️"
          confirmLabel="Yes, Delete"
          confirming={deletingConfirming}
          onConfirm={async () => {
            setDeletingConfirming(true);
            await deletePosting(deletingPosting.id);
            setDeletingConfirming(false);
            setDeletingPosting(null);
          }}
          onCancel={() => setDeletingPosting(null)}
        />
      )}

      <CompanyOnboardingBanner onPostJob={openCreate} />
    </div>
  );
}

