import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { useApp } from "../context/AppContext";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { supabase, withTimeout } from "../lib/supabase";
import { fetchAvailabilityHeatmap, fetchAllVerifiedStudents, fetchLikedStudentIds, likeStudent, unlikeStudent } from "../lib/auth";
import { useHiringPipeline } from "../hooks/useHiringPipeline";
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
        })));
      }
      setLoading(false);
    }).catch(() => { setLoadError(true); setLoading(false); });
  }, [currentUser?.id, loadRetryKey]);

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
    setFormData({ title: "", category: "", location: "", pay: "", description: "", deadline: "", days: [], times: {}, weekendRequired: false, status: "Active", photos: [], photoFiles: [], lat: undefined, lng: undefined, sickPay: false, holidays: "" });
    setModal("form");
  };

  const openEdit = (posting) => {
    originalPhotosRef.current = (posting.photos || []).filter(p => typeof p === "string" && p.startsWith("http"));
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
      if (msg.includes("accepted applicants")) {
        toast.error("This job has accepted applicants and cannot be deleted. Close it instead.");
      } else {
        toast.error("Failed to delete job. Please try again.");
      }
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
      ).catch(e => console.warn("[CompanyDashboard] auto-decline on close failed:", e.message));
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
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa", padding: "1.5rem 1rem" }}>
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
          <p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Company Dashboard</p>
          <h1 style={{ fontSize: "1.65rem", fontWeight: "800", margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>{currentUser?.name || "Company"}</h1>
        </div>
        {isVerified && activeTab === "jobs" && <button onClick={openCreate} style={{ ...btnGreen, borderRadius: "2rem", padding: "0.55rem 1.4rem", fontSize: "0.9rem" }}>+ New Job</button>}
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

      {/* Stats â€" jobs tab only */}
      {activeTab === "jobs" && (
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Closed" value={postings.length - activeCount} />
        <StatCard label="Total Applicants" value={totalApplicants} />
      </div>
      )}

      {/* Student Availability Heatmap â€" Browse Students tab */}
      {activeTab === "students" && heatmap && (
        <div style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showHeatmap ? "1rem" : 0 }}>
            <div>
              <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "#1e293b" }}>Student Availability</p>
              <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>When verified students are free â€" use this to plan your job times</p>
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

      {/* Postings â€" jobs tab only */}
      {activeTab === "jobs" && (
        loading ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#64748b", backgroundColor: "white", borderRadius: "1rem", border: "1.5px solid #e2e8f0" }}>
            <div style={{ width: "36px", height: "36px", border: "4px solid #e5e7eb", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
            <p style={{ fontWeight: "600" }}>Loading your job postings…</p>
          </div>
        ) : loadError ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#fff1f2", borderRadius: "1rem", border: "1.5px solid #fca5a5" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⚠️</div>
            <p style={{ fontWeight: "700", color: "#b91c1c", fontSize: "1rem", marginBottom: "0.4rem" }}>Couldn't load your job postings</p>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.25rem" }}>Check your connection and try again.</p>
            <button
              onClick={() => { setLoadError(false); setLoading(true); setLoadRetryKey(k => k + 1); }}
              style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >Retry</button>
          </div>
        ) : postings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#6b7280", backgroundColor: "white", borderRadius: "1rem", border: "1.5px solid #e2e8f0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>ðŸ"‹</div>
            <p style={{ fontSize: "1.15rem", fontWeight: "700", color: "#1e293b", marginBottom: "0.4rem" }}>No job postings yet</p>
            <p style={{ marginBottom: "1.75rem", fontSize: "0.9rem", color: "#94a3b8" }}>
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
                onDelete={() => deletePosting(posting.id)}
                onToggleStatus={() => toggleStatus(posting.id)}
              />
            ))}
          </div>
        )
      )}

      {/* Applicants Modal â€" wide overlay */}
      {modal === "applicants" && activePosting && (
        <div onClick={closeModal} className="applicants-modal-overlay" style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)", animation: "fadeInOverlay 0.18s ease" }}>
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
    </div>
  );
}

