import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { jobCategories } from "../data/jobCategories";
import { geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";
import { sendEmail, emailApplicantAccepted, emailApplicantDeclined, emailCompanyInterested, emailInterviewInvite, fetchAvailabilityHeatmap, fetchAllVerifiedStudents, fetchMessages, sendMessage, updateApplicationStage, saveApplicationNotes, incrementInterviewRound, saveTrialSchedule, saveInterviewRoundsData, moveToInterviewRound, fetchLikedStudentIds, likeStudent, unlikeStudent } from "../lib/auth";
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
    status:          j.status || "Active",
    photos:          j.photos || [],
    photoCrops:      j.photo_crops || [],
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
  const [extendData, setExtendData] = useState(null);
  const [heatmap, setHeatmap]     = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeTab, setActiveTab] = useState("jobs"); // "jobs" | "students"
  const [students, setStudents]   = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsFetched, setStudentsFetched] = useState(false);
  const [chatStudent, setChatStudent] = useState(null); // { id, name } for inline DM
  const [likedStudentIds, setLikedStudentIds] = useState(new Set());

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
    fetchAllVerifiedStudents()
      .then(data => { setStudents(data); setStudentsFetched(true); })
      .catch(() => setStudentsFetched(true))
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
    const studentIds = (appData || []).map(a => a.student_id);
    let profileMap = {};
    let cvMap = {};
    if (studentIds.length) {
      const [{ data: profiles }, { data: students }] = await Promise.all([
        supabase.from("profiles").select("id, name").in("id", studentIds),
        supabase.rpc("get_company_applicant_profiles", { student_ids: studentIds }),
      ]);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
      (students || []).forEach(s => { cvMap[s.id] = s; });
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
    setExtendData(null);
  };

  const openExtend = (posting) => {
    setExtendData({ id: posting.id, deadline: posting.deadline || "", days: [...posting.days], times: { ...posting.times }, status: posting.status });
    setModal("extend");
  };

  const saveExtend = async () => {
    if (!extendData.days.length) { alert("Select at least one day."); return; }
    const today = new Date().toISOString().split("T")[0];
    const wasExpired = extendData.status !== "Active" && extendData.deadline && extendData.deadline < today;
    const updates = {
      deadline: extendData.deadline || null,
      days:     extendData.days,
      times:    extendData.times,
      ...(wasExpired && extendData.deadline >= today ? { status: "Active" } : {}),
    };
    const { error } = await withTimeout(
      supabase.from("jobs").update(updates).eq("id", extendData.id),
      10000, "Update timed out."
    );
    if (error) { alert("Failed to save. Please try again."); return; }
    setPostings(prev => prev.map(p => p.id === extendData.id ? { ...p, ...updates } : p));
    closeModal();
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

      // 2. Auto-decline all other pending applicants for this job
      const { data: others } = await withTimeout(
        supabase.from("applications")
          .select("id, student_id")
          .eq("job_id", activePosting.id)
          .eq("status", "Pending")
          .neq("id", applicationId),
        10000, "Timeout."
      );
      const otherIds = (others || []).map(o => o.id);
      if (otherIds.length) {
        await withTimeout(
          supabase.from("applications").update({ status: "Rejected" }).in("id", otherIds),
          10000, "Timeout."
        );
      }

      // 3. Update UI immediately
      const otherSet = new Set(otherIds);
      const uiUpdater = (p) => ({
        ...p,
        applicants: p.applicants.map(a => {
          if (a.id === applicationId) return { ...a, status: "Accepted" };
          if (otherSet.has(a.id))     return { ...a, status: "Rejected" };
          return a;
        }),
      });
      setPostings(prev => prev.map(p => p.id === activePosting.id ? uiUpdater(p) : p));
      setActivePosting(prev => uiUpdater(prev));

      // 4. Send emails best-effort (don't block the UI)
      try {
        const allStudentIds = [applicant.studentId, ...(others || []).map(o => o.student_id)];
        const { data: emailProfiles } = await supabase
          .rpc("get_user_emails", { user_ids: allStudentIds });
        const emailMap = Object.fromEntries((emailProfiles || []).map(p => [p.id, p.email]));
        const appUrl = window.location.origin;

        await Promise.allSettled([
          // Acceptance email to winner
          emailMap[applicant.studentId] && sendEmail({
            to: emailMap[applicant.studentId],
            subject: `Congratulations! ${currentUser.name} has accepted your application`,
            html: emailApplicantAccepted(applicant.name, activePosting.title, currentUser.name),
            magicLinkEmail: emailMap[applicant.studentId],
            redirectTo: appUrl,
          }),
          // Rejection emails to auto-declined applicants
          ...(others || []).map(o => {
            const declinedApplicant = activePosting.applicants?.find(a => a.id === o.id);
            return emailMap[o.student_id] && sendEmail({
              to: emailMap[o.student_id],
              subject: `Update on your ${activePosting.title} application`,
              html: emailApplicantDeclined(
                declinedApplicant?.name || "there",
                activePosting.title,
                currentUser.name,
              ),
            });
          }).filter(Boolean),
        ]);
      } catch (e) {
        console.warn("Email sending failed:", e);
      }
      return;
    }

    // Simple reject (no email, no auto-decline)
    const { error } = await withTimeout(
      supabase.from("applications").update({ status: newStatus }).eq("id", applicationId),
      10000, "Update timed out."
    );
    if (error) { alert("Failed to update status."); return; }
    const updater = (p) => ({ ...p, applicants: p.applicants.map(a => a.id === applicationId ? { ...a, status: newStatus } : a) });
    setPostings(prev => prev.map(p => p.id === activePosting.id ? updater(p) : p));
    setActivePosting(prev => updater(prev));
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

  const handleSendInterviewInvite = async (applicationId, date, time, note, teamsLink) => {
    const applicant = activePosting?.applicants?.find(a => a.id === applicationId);
    if (!applicant) return;
    try {
      const { data: emailRows } = await supabase.rpc("get_user_emails", { user_ids: [applicant.studentId] });
      const studentEmail = emailRows?.[0]?.email;
      if (!studentEmail) throw new Error("Could not find student email.");
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
    <PageWrapper>
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", margin: 0, color: "#1e293b" }}>Company Dashboard</h1>
          {currentUser && (
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>{currentUser.name}</p>
          )}
        </div>
        {isVerified && activeTab === "jobs" && <button onClick={openCreate} style={btnGreen}>+ New Job</button>}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", backgroundColor: "#f1f5f9", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1.5rem", gap: "0.25rem" }}>
        {[{ val: "jobs", label: "My Jobs" }, { val: "students", label: "Browse Students" }].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setActiveTab(val)}
            style={{
              flex: 1, padding: "0.55rem", borderRadius: "0.6rem", border: "none",
              fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit",
              backgroundColor: activeTab === val ? "white" : "transparent",
              color: activeTab === val ? "#6366f1" : "#64748b",
              boxShadow: activeTab === val ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats — jobs tab only */}
      {activeTab === "jobs" && (
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} color="#3b82f6" />
        <StatCard label="Active" value={activeCount} color="#16a34a" />
        <StatCard label="Closed" value={postings.length - activeCount} color="#6b7280" />
        <StatCard label="Total Applicants" value={totalApplicants} color="#f59e0b" />
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
            <button onClick={() => setShowHeatmap(p => !p)} style={{ padding: "0.35rem 0.85rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#6366f1", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
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
            <p style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>No job postings yet</p>
            <p style={{ marginBottom: "1.5rem" }}>
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
                onExtend={() => openExtend(posting)}
              />
            ))}
          </div>
        )
      )}

      {/* Footer nav */}
      <div style={{ marginTop: "2rem" }}>
        <button onClick={() => setPage("account")} style={btnGray}>My Account</button>
      </div>

      {/* Applicants Modal */}
      {modal === "applicants" && activePosting && (
        <Modal onClose={closeModal} title={`Applicants — ${activePosting.title}`}>
          <ApplicantsView posting={activePosting} onUpdateStatus={updateApplicantStatus} onStageChange={handleStageChange} onNotesSaved={handleNotesSaved} onCloseJob={handleCloseJob} onIncrementRound={handleIncrementRound} onSaveTrialSchedule={handleSaveTrialSchedule} onSaveInterviewRoundsData={handleSaveInterviewRoundsData} onSendInterviewInvite={handleSendInterviewInvite} likedStudents={students.filter(s => likedStudentIds.has(s.id))} companyId={currentUser?.id} />
        </Modal>
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

      {/* Extend Modal */}
      {modal === "extend" && extendData && (
        <Modal onClose={closeModal} title="Extend Job">
          <ExtendForm data={extendData} setData={setExtendData} onSave={saveExtend} onCancel={closeModal} />
        </Modal>
      )}
    </PageWrapper>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function BrowseStudents({ students, loading, fetched, companyIndustries, companyId, companyName, chatStudent, setChatStudent, setPage, likedStudentIds, onToggleLike }) {
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
                  <div style={{ backgroundColor: m.sender_id === companyId ? "#6366f1" : "#e5e7eb", color: m.sender_id === companyId ? "white" : "#111827", padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
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
          <button onClick={sendDM} style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
            Send
          </button>
        </div>
      </div>
    );
  }

  if (!fetched && loading) {
    return <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading students…</p>;
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
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: companyIndustries.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${filterByIndustries ? "#6366f1" : "#e2e8f0"}`, backgroundColor: filterByIndustries ? "#eef2ff" : "white", color: filterByIndustries ? "#4f46e5" : "#64748b", opacity: companyIndustries.length === 0 ? 0.5 : 1 }}
          >
            My Industries
          </button>
          <button
            onClick={() => setFilterByIndustries(false)}
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${!filterByIndustries ? "#6366f1" : "#e2e8f0"}`, backgroundColor: !filterByIndustries ? "#eef2ff" : "white", color: !filterByIndustries ? "#4f46e5" : "#64748b" }}
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
              style={{ marginTop: "0.75rem", width: "100%", padding: "0.5rem 1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
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
                backgroundColor: isWeekend ? "#fef3c7" : "#eef2ff",
                border: `1.5px solid ${isWeekend ? "#fcd34d" : "#c7d2fe"}`,
                borderRadius: "0.45rem", padding: "0.2rem 0.4rem", minWidth: "34px",
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: "800", color: isWeekend ? "#d97706" : "#4f46e5" }}>{DAY_ABBR[day]}</span>
              <span style={{ fontSize: "0.6rem", color: isWeekend ? "#b45309" : "#6366f1", fontWeight: "600", whiteSpace: "nowrap" }}>
                {earliest === latest ? fmt(earliest) : `${fmt(earliest)}–${fmt(latest)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      flex: "1", minWidth: "110px",
      backgroundColor: "white", border: `2px solid ${color}30`,
      borderRadius: "0.75rem", padding: "0.75rem 1rem", textAlign: "center",
    }}>
      <p style={{ fontSize: "1.75rem", fontWeight: "700", color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: "0.7rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{label}</p>
    </div>
  );
}

function JobPostingCard({ posting, onViewApplicants, onEdit, onDelete, onToggleStatus, onExtend }) {
  const isActive = posting.status === "Active";
  const today = new Date().toISOString().split("T")[0];
  const isExpired = posting.status === "Closed" && posting.deadline && posting.deadline < today;
  const photo = posting.photos?.[0] || null;
  const crop  = posting.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
  return (
    <div className="job-posting-card" style={{
      borderRadius: "0.75rem", overflow: "hidden",
      backgroundColor: "#f9fafb", border: `1.5px solid ${isExpired ? "#fca5a5" : "#e5e7eb"}`,
      display: "flex", alignItems: "flex-start",
      opacity: isActive ? 1 : 0.75,
    }}>
      {/* Square photo */}
      <div style={{ width: "120px", height: "120px", flexShrink: 0, position: "relative", backgroundColor: "#0f172a", overflow: "hidden" }}>
        {photo ? (
          <div style={{ position: "absolute", inset: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
            <img src={photo} alt={posting.title} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          </div>
        ) : (
          <div style={{ width: "120px", height: "120px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0f172a,#312e81)" }}>
            <span style={{ fontSize: "2rem", opacity: 0.3 }}>🏢</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "0.85rem 0.85rem 0.85rem 1rem", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
          <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", margin: 0 }}>{posting.title}</h2>
          <span style={{
            fontSize: "0.65rem", fontWeight: "700", padding: "0.15rem 0.55rem",
            borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.05em",
            backgroundColor: isActive ? "#dcfce7" : isExpired ? "#fee2e2" : "#f3f4f6",
            color: isActive ? "#16a34a" : isExpired ? "#dc2626" : "#6b7280",
          }}>
            {isExpired ? "Expired" : posting.status}
          </span>
        </div>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.4rem" }}>
          {posting.location} · {posting.pay}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
          {posting.days.map(day => (
            <span key={day} style={{
              fontSize: "0.7rem", backgroundColor: "#eff6ff", color: "#1d4ed8",
              padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: "600",
            }}>
              {day.slice(0, 3)}{posting.times?.[day] ? ` · ${posting.times[day]}` : ""}
            </span>
          ))}
          {posting.weekendRequired && (
            <span style={{ fontSize: "0.7rem", backgroundColor: "#fef3c7", color: "#d97706", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: "600" }}>
              Weekend
            </span>
          )}
        </div>
        <p style={{ fontSize: "0.8rem", color: "#374151", fontWeight: "600", margin: 0 }}>
          {posting.applicantCount} applicant{posting.applicantCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="job-posting-btns" style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0, padding: "0.85rem 1rem 0.85rem 0" }}>
        <button onClick={onViewApplicants} style={btnSmallGreen}>View Applicants</button>
        <button onClick={onEdit} style={btnSmallBlue}>Edit</button>
        <button onClick={onExtend} style={btnSmallPurple}>Extend</button>
        <button onClick={onToggleStatus} style={btnSmallGray}>
          {isActive ? "Close Job" : "Reopen Job"}
        </button>
        <button onClick={onDelete} style={btnSmallRed}>Delete</button>
      </div>
    </div>
  );
}

function ExtendForm({ data, setData, onSave, onCancel }) {
  const today = new Date().toISOString().split("T")[0];

  const toggleDay = (day) => {
    setData(prev => {
      const removing = prev.days.includes(day);
      const days  = removing ? prev.days.filter(d => d !== day) : [...prev.days, day];
      const times = { ...prev.times };
      if (removing) delete times[day];
      return { ...prev, days, times };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>New Deadline <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          type="date"
          value={data.deadline || ""}
          min={today}
          onChange={e => setData(prev => ({ ...prev, deadline: e.target.value }))}
          style={inputStyle}
        />
        {data.deadline && data.deadline < today && (
          <p style={{ fontSize: "0.78rem", color: "#ef4444", margin: "-0.5rem 0 0" }}>
            This date is in the past — the job will remain closed.
          </p>
        )}
      </div>

      <div>
        <label style={labelStyle}>Days Available *</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
          {weekdays.map(day => {
            const active = data.days.includes(day);
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

      {data.days.length > 0 && (
        <div>
          <label style={labelStyle}>Shift Start Times</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.25rem" }}>
            {data.days.map(day => {
              const isWeekend = day === "Saturday" || day === "Sunday";
              return (
                <div key={day} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ minWidth: "88px", fontSize: "0.875rem", fontWeight: "600", color: isWeekend ? "#d97706" : "#374151" }}>{day}</span>
                  <select
                    value={data.times?.[day] || ""}
                    onChange={e => setData(prev => ({ ...prev, times: { ...prev.times, [day]: e.target.value } }))}
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

      <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={onSave} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(168,85,247,0.35)" }}>Save Changes</button>
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

function ApplicantsView({ posting, onUpdateStatus, onStageChange, onNotesSaved, onCloseJob, companyId, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite, likedStudents }) {
  const [activeStage, setActiveStage]             = useState("applied");
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showCloseJob, setShowCloseJob]           = useState(false);
  const [viewMode, setViewMode]                   = useState("list");

  if (posting.applicantsLoading) {
    return <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem 1rem" }}>Loading applicants…</p>;
  }
  if (posting.applicantsError) {
    return <p style={{ color: "#ef4444", textAlign: "center", padding: "2rem 1rem" }}>Error loading applicants. Please try again.</p>;
  }
  if (posting.applicants.length === 0) {
    return <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem 1rem" }}>No applicants yet for this posting.</p>;
  }

  const dynamicStages = buildDynamicStages(posting.applicants);

  const countFor = (key) => posting.applicants.filter(a => getVirtualStageKey(a) === key).length;
  const visible  = posting.applicants.filter(a => getVirtualStageKey(a) === activeStage);

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

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem", gap: "0.35rem" }}>
        <button onClick={() => setViewMode("list")} style={{ padding: "0.3rem 0.8rem", fontSize: "0.78rem", fontWeight: "600", border: `1.5px solid ${viewMode === "list" ? "#6366f1" : "#e2e8f0"}`, borderRadius: "0.45rem", cursor: "pointer", fontFamily: "inherit", background: viewMode === "list" ? "#eef2ff" : "white", color: viewMode === "list" ? "#4f46e5" : "#64748b" }}>☰ List</button>
        <button onClick={() => setViewMode("kanban")} style={{ padding: "0.3rem 0.8rem", fontSize: "0.78rem", fontWeight: "600", border: `1.5px solid ${viewMode === "kanban" ? "#6366f1" : "#e2e8f0"}`, borderRadius: "0.45rem", cursor: "pointer", fontFamily: "inherit", background: viewMode === "kanban" ? "#eef2ff" : "white", color: viewMode === "kanban" ? "#4f46e5" : "#64748b" }}>⊞ Board</button>
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
                padding: "0.5rem 0.9rem",
                border: "none",
                borderBottom: active ? "2px solid #6366f1" : "2px solid transparent",
                marginBottom: "-2px",
                background: "transparent",
                fontWeight: active ? "700" : "600",
                fontSize: "0.82rem",
                color: active ? "#6366f1" : "#64748b",
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
                  backgroundColor: active ? "#6366f1" : "#94a3b8",
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

      {/* Compact applicant rows for active stage */}
      {visible.length === 0 ? (
        <p style={{ color: "#94a3b8", textAlign: "center", padding: "2rem 1rem", fontSize: "0.875rem" }}>
          No applicants in this stage yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visible.map(applicant => (
            <ApplicantRow
              key={applicant.id}
              applicant={applicant}
              onClick={() => setSelectedApplicant(applicant)}
            />
          ))}
        </div>
      )}

      {/* Liked students — Shortlisted tab only, not yet applied */}
      {activeStage === "shortlisted" && (() => {
        const appliedIds = new Set(posting.applicants.map(a => a.studentId));
        const saved = (likedStudents || []).filter(s => !appliedIds.has(s.id));
        if (saved.length === 0) return null;
        return (
          <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1.5px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.72rem", fontWeight: "800", color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Saved Students — haven't applied yet
            </p>
            {saved.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e0e7ff", backgroundColor: "#f5f3ff", marginBottom: "0.4rem" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.profile_photo_url
                    ? <img src={s.profile_photo_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "1rem" }}>👤</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "0.85rem", color: "#1e293b" }}>{s.name}</p>
                  {s.bio && <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.bio}</p>}
                </div>
                <span style={{ fontSize: "0.7rem", color: "#6366f1", fontWeight: "600", whiteSpace: "nowrap" }}>♥ Saved</span>
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
            style={{ width: "100%", padding: "0.7rem", borderRadius: "0.6rem", border: "1.5px solid #fca5a5", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Close this Job
          </button>
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
          onSendInterviewInvite={onSendInterviewInvite}
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

function ApplicantRow({ applicant, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.65rem 0.85rem", borderRadius: "0.6rem",
        border: "1.5px solid #e2e8f0", backgroundColor: "white",
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}
    >
      {/* Photo */}
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {applicant.profilePhoto
          ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        }
      </div>
      {/* Name + skills */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: "700", fontSize: "0.875rem", color: "#1e293b" }}>{applicant.name}</p>
        {applicant.skills?.length > 0 && (
          <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            {applicant.skills.slice(0, 3).map(s => (
              <span key={s} style={{ fontSize: "0.65rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "0.05rem 0.4rem", fontWeight: "600" }}>{s}</span>
            ))}
          </div>
        )}
      </div>
      {/* Chevron */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function KanbanBoard({ applicants, stages, onSelectApplicant, onMoveToStage }) {
  const [draggingId, setDraggingId]       = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const getColColor = (key) => {
    if (key === "applied")              return { bg: "#f8fafc", border: "#e2e8f0", header: "#64748b" };
    if (key === "shortlisted")          return { bg: "#f0f9ff", border: "#bae6fd", header: "#0284c7" };
    if (key.startsWith("interview_"))   return { bg: "#faf5ff", border: "#e9d5ff", header: "#7c3aed" };
    if (key === "trial")                return { bg: "#f0fdf4", border: "#bbf7d0", header: "#16a34a" };
    if (key === "decision")             return { bg: "#fff7ed", border: "#fed7aa", header: "#ea580c" };
    return { bg: "#f8fafc", border: "#e2e8f0", header: "#64748b" };
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggingId) return;
    const a = applicants.find(x => x.id === draggingId);
    if (a && getVirtualStageKey(a) !== targetKey) {
      onMoveToStage?.(draggingId, targetKey);
    }
    setDraggingId(null);
  };

  return (
    <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingBottom: "0.75rem", alignItems: "flex-start" }}>
      {(stages || []).map(({ key, label }) => {
        const cards  = applicants.filter(a => getVirtualStageKey(a) === key);
        const c      = getColColor(key);
        const isOver = dragOverStage === key;
        return (
          <div
            key={key}
            onDragOver={e => { e.preventDefault(); setDragOverStage(key); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
            onDrop={e => handleDrop(e, key)}
            style={{
              minWidth: "160px", flex: "0 0 160px",
              backgroundColor: isOver ? (c.bg) : c.bg,
              border: `1.5px solid ${isOver ? c.header : c.border}`,
              borderRadius: "0.75rem", padding: "0.6rem",
              transition: "border-color 0.15s",
              boxShadow: isOver ? `0 0 0 3px ${c.header}22` : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "800", color: c.header, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", backgroundColor: c.border, color: c.header, borderRadius: "999px", padding: "0.05rem 0.4rem" }}>{cards.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minHeight: "40px" }}>
              {cards.length === 0 && (
                <p style={{ fontSize: "0.72rem", color: isOver ? c.header : "#94a3b8", textAlign: "center", padding: "0.75rem 0", margin: 0, fontStyle: isOver ? "normal" : "normal", fontWeight: isOver ? "700" : "400" }}>
                  {isOver ? "Drop here" : "Empty"}
                </p>
              )}
              {cards.map(applicant => (
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
                    width: "100%", display: "flex", alignItems: "center", gap: "0.45rem",
                    padding: "0.5rem 0.55rem", borderRadius: "0.5rem",
                    border: "1.5px solid rgba(0,0,0,0.06)", backgroundColor: "white",
                    cursor: "grab", fontFamily: "inherit", textAlign: "left",
                    opacity: draggingId === applicant.id ? 0.45 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {applicant.profilePhoto
                      ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    }
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CheckItem({ ok, label, warn }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem" }}>
      <span style={{ fontWeight: "800", minWidth: "14px", color: ok ? "#16a34a" : warn ? "#d97706" : "#ef4444" }}>
        {ok ? "✓" : warn ? "—" : "✗"}
      </span>
      <span style={{ color: ok ? "#374151" : "#6b7280" }}>{label}</span>
    </div>
  );
}

function DetailPanel({ applicant, postingId, companyId, onClose, onStageAction, onUpdateStatus, onNotesSaved, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite }) {
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
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: 1100 }} />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(440px, 100vw)",
        backgroundColor: "white",
        zIndex: 1101,
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.18)",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1.5px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {applicant.profilePhoto
              ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "#1e293b" }}>{applicant.name}</p>
            <StatusBadge status={applicant.status} />
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.3rem", cursor: "pointer", color: "#64748b", lineHeight: 1, padding: "0.25rem" }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem", flex: 1 }}>

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
                ? <a href={applicant.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: "0.85rem", color: "#0a66c2", fontWeight: "600", textDecoration: "underline" }}>View Profile</a>
                : <p style={{ margin: 0, fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic" }}>Not provided</p>
              }
            </Section>

            <Section label="Documents">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  onClick={openCv}
                  disabled={!applicant.cvName || cvLoading}
                  style={{ padding: "0.4rem 0.9rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: applicant.cvName ? "white" : "#f8fafc", color: applicant.cvName ? "#16a34a" : "#9ca3af", fontWeight: "600", fontSize: "0.8rem", cursor: applicant.cvName ? "pointer" : "default", fontFamily: "inherit" }}
                >
                  {cvLoading ? "Loading…" : "📄 CV"}
                </button>
                <button
                  onClick={openCoverLetter}
                  disabled={!applicant.coverLetterName || clLoading}
                  style={{ padding: "0.4rem 0.9rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: applicant.coverLetterName ? "white" : "#f8fafc", color: applicant.coverLetterName ? "#6366f1" : "#9ca3af", fontWeight: "600", fontSize: "0.8rem", cursor: applicant.coverLetterName ? "pointer" : "default", fontFamily: "inherit" }}
                >
                  {clLoading ? "Loading…" : "📝 Cover Letter"}
                </button>
              </div>
            </Section>
          </>)}

          {/* Notes */}
          <Section label={notesSaving ? "Notes (saving…)" : "Notes"}>
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
                    <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", fontWeight: "800", color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Interview {i + 1}
                    </p>
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
                      style={{ width: "100%", padding: "0.4rem", borderRadius: "0.4rem", border: "1.5px solid #e9d5ff", backgroundColor: "white", color: "#7c3aed", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      ✉ Send Invite
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
            onSend={async (note, teamsLink) => {
              const r = interviewRounds[inviteModalOpen] || {};
              await onSendInterviewInvite?.(applicant.id, r.date || "", r.time || "", note, teamsLink);
            }}
          />
        )}

        {/* Stage action buttons */}
        <div style={{ padding: "1rem 1.25rem", borderTop: "1.5px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "0.5rem", flexShrink: 0 }}>
          {stage === "applied" && (
            <button onClick={() => onStageAction(applicant.id, "shortlisted")} style={panelActionBtn("#6366f1")}>Shortlist →</button>
          )}
          {stage === "shortlisted" && (
            <button onClick={() => onStageAction(applicant.id, "interview_1")} style={panelActionBtn("#6366f1")}>Invite to Interview →</button>
          )}
          {stage === "interview" && (<>
            <button onClick={() => {
              const newRounds = [...interviewRounds, { date: "", time: "" }];
              setInterviewRounds(newRounds);
              onIncrementRound?.(applicant.id, applicant.interviewRound || 1, newRounds);
            }} style={panelActionBtn("#6b7280")}>+ Next Round of Interviews</button>
            <button onClick={async () => {
              const last = interviewRounds[interviewRounds.length - 1] || {};
              if (last.date || last.time) {
                await onSaveTrialSchedule?.(applicant.id, last.date || "", last.time || "");
              }
              onStageAction(applicant.id, "trial");
            }} style={panelActionBtn("#6366f1")}>Advance to Trial →</button>
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("#475569")}>Skip to Decision →</button>
          </>)}
          {stage === "trial" && (
            <button onClick={() => onStageAction(applicant.id, "decision")} style={panelActionBtn("#6366f1")}>Move to Decision →</button>
          )}
          {stage === "decision" && applicant.status === "Pending" && (<>
            <button onClick={() => onUpdateStatus(applicant.id, "Accepted", applicant)} style={panelActionBtn("#16a34a")}>Hire this Applicant ✓</button>
            <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={panelActionBtn("#e11d48")}>Decline ✕</button>
          </>)}
        </div>
      </div>
    </>
  );
}

function InterviewInviteModal({ applicant, roundNumber, date, time, onClose, onSend }) {
  const [note, setNote]           = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");

  const send = async () => {
    setSending(true);
    setError("");
    try {
      await onSend(note, teamsLink);
      onClose();
    } catch (e) {
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const whenLine = date && time ? `${date} at ${time}` : date || time || "Time not set";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1301, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(400px,92vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Send Interview {roundNumber} Invite</h3>
        <p style={{ margin: "0 0 1.1rem", fontSize: "0.82rem", color: "#64748b" }}>To: <strong>{applicant.name}</strong> · {whenLine}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
          <button onClick={send} disabled={sending} style={{ flex: 2, padding: "0.65rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : "Send Invite ✉"}
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
            <button onClick={() => setMode("found")} style={closeOptBtn("#6366f1", "#eef2ff", "#c7d2fe")}>
              <span style={{ fontWeight: "700" }}>Found a Student</span>
              <span style={{ fontSize: "0.75rem", color: "#6366f1" }}>Select which student you hired</span>
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
          <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "#6366f1", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: "0.75rem" }}>← Back</button>
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
                    border: `1.5px solid ${winner?.id === a.id ? "#6366f1" : "#e2e8f0"}`,
                    backgroundColor: winner?.id === a.id ? "#eef2ff" : "white",
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
                  {winner?.id === a.id && <span style={{ marginLeft: "auto", color: "#6366f1", fontSize: "0.9rem" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            disabled={!winner || confirming}
            onClick={() => confirm({ foundStudent: true, winnerId: winner.id, winnerApplicant: winner })}
            style={{ width: "100%", padding: "0.7rem", borderRadius: "0.6rem", border: "none", backgroundColor: winner ? "#6366f1" : "#e2e8f0", color: winner ? "white" : "#94a3b8", fontWeight: "700", fontSize: "0.875rem", cursor: winner ? "pointer" : "default", fontFamily: "inherit", opacity: confirming ? 0.7 : 1 }}
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
      <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {children}
    </div>
  );
}

const panelActionBtn = (color) => ({
  width: "100%", padding: "0.65rem", borderRadius: "0.6rem", border: "none",
  backgroundColor: color, color: "white", fontWeight: "700", fontSize: "0.875rem",
  cursor: "pointer", fontFamily: "inherit",
});

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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
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
    Pending:  { bg: "#fef3c7", text: "#d97706" },
    Accepted: { bg: "#dcfce7", text: "#16a34a" },
    Rejected: { bg: "#fee2e2", text: "#dc2626" },
  };
  const c = colors[status] || colors.Pending;
  return (
    <span style={{
      fontSize: "0.65rem", fontWeight: "700", padding: "0.2rem 0.6rem",
      borderRadius: "999px", backgroundColor: c.bg, color: c.text,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {status}
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
      setCropSettings(prev => ({
        ...prev,
        [d.idx]: {
          ...(prev[d.idx] || { zoom: 1 }),
          offsetX: d.originX + ((cx - d.startX) / width  * 100),
          offsetY: d.originY + ((cy - d.startY) / height * 100),
        },
      }));
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
                  <button type="button" onClick={() => { dragRef.current.zoom = 1; setCrop(safeIdx, { zoom: 1, offsetX: 0, offsetY: 0 }); }} style={{ ...zoomBtn, color: "#6366f1" }}>Reset</button>
                  <button type="button" onClick={() => { const nz = Math.max(1, getCrop(safeIdx).zoom - 2.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>−</button>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: "32px", textAlign: "center" }}>{Math.round(100 + (crop.zoom - 1) / 9 * 100)}%</span>
                  <button type="button" onClick={() => { const nz = Math.min(10, getCrop(safeIdx).zoom + 2.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>+</button>
                </div>
              </div>
              <div
                ref={previewRef}
                style={{ position: "relative", width: "100%", aspectRatio: "1/1", maxHeight: "340px", backgroundColor: "#0f172a", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
                onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
                onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <div style={{
                  position: "absolute", inset: 0,
                  transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`,
                  transformOrigin: "center",
                  transition: isDragging ? "none" : "transform 0.1s ease",
                }}>
                  <img src={src} alt="preview" draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
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
                <div key={url} onClick={() => setPreviewIndex(i)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "#6366f1" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #a5b4fc" : "none" }}>
                  <img src={url} alt="job photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={e => { e.stopPropagation(); removeExistingPhoto(url); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", color: "white", width: "18px", height: "18px", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                </div>
              );
            })}
            {photoFiles.map((file, i) => {
              const globalIdx = existingPhotos.length + i;
              const isActive = Math.min(previewIndex, existingPhotos.length + photoFiles.length - 1) === globalIdx;
              return (
                <div key={i} onClick={() => setPreviewIndex(globalIdx)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "#6366f1" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #a5b4fc" : "none" }}>
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
                  const bg = count === 0 ? "#f1f5f9"
                    : isWeekend
                      ? `rgba(245,158,11,${0.15 + intensity * 0.75})`
                      : `rgba(99,102,241,${0.15 + intensity * 0.75})`;
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

const btnBase      = { padding: "0.6rem 1.1rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit" };
const btnGreen     = { ...btnBase, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.35)" };
const btnGray      = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" };

const zoomBtn      = { padding: "0.2rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" };

const navBtn        = { background: "none", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.4rem", color: "white", fontSize: "0.85rem", fontWeight: "700", padding: "0.1rem 0.5rem", cursor: "pointer", fontFamily: "inherit" };
const cvHeaderBtn   = { background: "none", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.4rem", color: "white", fontSize: "0.75rem", fontWeight: "600", padding: "0.25rem 0.6rem", cursor: "pointer", fontFamily: "inherit" };
const btnSmallBase  = { padding: "0.32rem 0.75rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" };
const btnSmallGreen = { ...btnSmallBase, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 2px 6px rgba(16,185,129,0.3)" };
const btnSmallBlue  = { ...btnSmallBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 6px rgba(99,102,241,0.3)" };
const btnSmallGray   = { ...btnSmallBase, backgroundColor: "#64748b" };
const btnSmallPurple = { ...btnSmallBase, background: "linear-gradient(135deg, #a855f7, #7c3aed)", boxShadow: "0 2px 6px rgba(168,85,247,0.3)" };
const btnSmallRed    = { ...btnSmallBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 2px 6px rgba(244,63,94,0.3)" };
