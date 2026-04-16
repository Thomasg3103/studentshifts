import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import { jobCategories } from "../data/jobCategories";
import { geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";
import { sendEmail, emailApplicantAccepted, emailApplicantDeclined } from "../lib/auth";
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
      supabase.from("applications").select("id, status, student_id").eq("job_id", posting.id).order("created_at", { ascending: true }),
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
        supabase.from("students").select("id, cv_url, cover_letter_url, bio, skills, linkedin, profile_photo_url").in("id", studentIds),
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
      status: a.status,
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
    if (error) { alert("Failed to save: " + error.message); return; }
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
      for (const file of newFiles) {
        const path = `${currentUser.id}/${Date.now()}_${file.name}`;
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
      alert("Error saving job: " + e.message);
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
          .from("profiles").select("id, email").in("id", allStudentIds);
        const emailMap = Object.fromEntries((emailProfiles || []).map(p => [p.id, p.email]));
        const appUrl = window.location.origin;

        await Promise.allSettled([
          // Acceptance email to winner
          emailMap[applicant.studentId] && sendEmail({
            to: emailMap[applicant.studentId],
            subject: `Congratulations! ${currentUser.name} has accepted your application`,
            html: emailApplicantAccepted(applicant.name, activePosting.title, currentUser.name, appUrl),
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

  const verificationStatus = currentUser?.verificationStatus;
  const isVerified = verificationStatus === "verified" || verificationStatus === null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", margin: 0, color: "#1e293b" }}>Company Dashboard</h1>
          {currentUser && (
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>{currentUser.name}</p>
          )}
        </div>
        {isVerified && <button onClick={openCreate} style={btnGreen}>+ New Job</button>}
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <StatCard label="Total Postings" value={postings.length} color="#3b82f6" />
        <StatCard label="Active" value={activeCount} color="#16a34a" />
        <StatCard label="Closed" value={postings.length - activeCount} color="#6b7280" />
        <StatCard label="Total Applicants" value={totalApplicants} color="#f59e0b" />
      </div>

      {/* Postings */}
      {loading ? (
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
      ) : loading ? null : (
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
      )}

      {/* Footer nav */}
      <div style={{ marginTop: "2rem" }}>
        <button onClick={() => setPage("account")} style={btnGray}>My Account</button>
      </div>

      {/* Applicants Modal */}
      {modal === "applicants" && activePosting && (
        <Modal onClose={closeModal} title={`Applicants — ${activePosting.title}`}>
          <ApplicantsView posting={activePosting} onUpdateStatus={updateApplicantStatus} companyId={currentUser?.id} />
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
  return (
    <div style={{
      padding: "1rem 1.25rem", borderRadius: "0.75rem",
      backgroundColor: "#f9fafb", border: `1.5px solid ${isExpired ? "#fca5a5" : "#e5e7eb"}`,
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      gap: "1rem", opacity: isActive ? 1 : 0.75,
    }}>
      <div style={{ flex: 1 }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
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

function ApplicantsView({ posting, onUpdateStatus, companyId }) {
  if (posting.applicantsLoading) {
    return <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem 1rem" }}>Loading applicants…</p>;
  }
  if (posting.applicantsError) {
    return <p style={{ color: "#ef4444", textAlign: "center", padding: "2rem 1rem" }}>Error: {posting.applicantsError}</p>;
  }
  if (posting.applicants.length === 0) {
    return (
      <p style={{ color: "#6b7280", textAlign: "center", padding: "2rem 1rem" }}>
        No applicants yet for this posting.
      </p>
    );
  }

  const pending  = posting.applicants.filter(a => a.status === "Pending").length;
  const accepted = posting.applicants.filter(a => a.status === "Accepted").length;
  const rejected = posting.applicants.filter(a => a.status === "Rejected").length;

  return (
    <div>
      {/* Mini stats */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[["Pending", pending, "#d97706"], ["Accepted", accepted, "#16a34a"], ["Rejected", rejected, "#dc2626"]].map(([label, val, color]) => (
          <div key={label} style={{ flex: 1, minWidth: "80px", textAlign: "center", padding: "0.5rem", backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}>
            <p style={{ fontWeight: "700", fontSize: "1.25rem", color, margin: 0 }}>{val}</p>
            <p style={{ fontSize: "0.7rem", color: "#6b7280", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {posting.applicants.map(applicant => (
          <ApplicantCard
            key={applicant.id}
            applicant={applicant}
            postingId={posting.id}
            onUpdateStatus={onUpdateStatus}
            companyId={companyId}
          />
        ))}
      </div>
    </div>
  );
}

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
    } catch (e) { alert("Could not save: " + e.message); }
  };

  const openWith = async () => {
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], fileName, { type: "application/pdf" });
        await navigator.share({ files: [file], title: label });
      } catch (e) { if (e.name !== "AbortError") alert("Could not share: " + e.message); }
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

function ApplicantCard({ applicant, postingId, onUpdateStatus, companyId }) {
  const [showChat, setShowChat] = useState(false);
  const [cvOpen, setCvOpen]   = useState(false);
  const [clOpen, setClOpen]   = useState(false);
  const [cvUrl, setCvUrl]     = useState(null);
  const [clUrl, setClUrl]     = useState(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [clLoading, setClLoading] = useState(false);

  const openCv = async () => {
    if (!cvUrl) {
      setCvLoading(true);
      try {
        const { getSignedDocumentUrl } = await import("../lib/auth");
        setCvUrl(await getSignedDocumentUrl("documents", applicant.cvName));
      } catch (e) { alert("Could not load CV: " + e.message); setCvLoading(false); return; }
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
      } catch (e) { alert("Could not load cover letter: " + e.message); setClLoading(false); return; }
      setClLoading(false);
    }
    setClOpen(true);
  };

  return (
    <>
    {cvOpen && cvUrl && <PdfModal url={cvUrl} label={`${applicant.name}'s CV`} fileName={`${applicant.name.replace(/\s+/g, "_")}_CV.pdf`} onClose={() => setCvOpen(false)} />}
    {clOpen && clUrl && <PdfModal url={clUrl} label={`${applicant.name}'s Cover Letter`} fileName={`${applicant.name.replace(/\s+/g, "_")}_Cover_Letter.pdf`} onClose={() => setClOpen(false)} />}
    <div style={{ backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb", padding: "0.75rem 1rem" }}>
      {/* Top row: photo + name/details + status/actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: 0 }}>
          {/* Profile photo */}
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", overflow: "hidden", backgroundColor: "#e2e8f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {applicant.profilePhoto
              ? <img src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: "700", fontSize: "0.95rem", margin: "0 0 0.1rem" }}>{applicant.name}</p>
            {/* Bio */}
            <div style={{ marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bio</span>
              {applicant.bio
                ? <p style={{ fontSize: "0.78rem", color: "#374151", margin: "0.1rem 0 0", lineHeight: 1.4 }}>{applicant.bio}</p>
                : <p style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic", margin: "0.1rem 0 0" }}>Not provided</p>
              }
            </div>
            {/* Cover Letter */}
            <div style={{ marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cover Letter</span>
              <div style={{ marginTop: "0.1rem" }}>
                {applicant.coverLetterName
                  ? <button onClick={openCoverLetter} disabled={clLoading} style={{ background: "none", border: "none", padding: 0, fontSize: "0.78rem", color: "#6366f1", fontWeight: "600", textDecoration: "underline", cursor: clLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{clLoading ? "Loading…" : "View Cover Letter"}</button>
                  : <span style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic" }}>Not uploaded</span>
                }
              </div>
            </div>
            {/* CV */}
            <div style={{ marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>CV</span>
              <div style={{ marginTop: "0.1rem" }}>
                {applicant.cvName
                  ? <button onClick={openCv} disabled={cvLoading} style={{ background: "none", border: "none", padding: 0, fontSize: "0.78rem", color: "#16a34a", fontWeight: "600", textDecoration: "underline", cursor: cvLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{cvLoading ? "Loading…" : "View CV"}</button>
                  : <span style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic" }}>Not uploaded</span>
                }
              </div>
            </div>
            {/* LinkedIn */}
            <div style={{ marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>LinkedIn</span>
              <div style={{ marginTop: "0.1rem" }}>
                {applicant.linkedin
                  ? <a href={applicant.linkedin} target="_blank" rel="noreferrer" style={{ fontSize: "0.78rem", color: "#0a66c2", fontWeight: "600", textDecoration: "underline" }}>View Profile</a>
                  : <span style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic" }}>Not provided</span>
                }
              </div>
            </div>
            {/* Skills */}
            <div style={{ marginBottom: "0.1rem" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Skills</span>
              {applicant.skills?.length > 0
                ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.1rem" }}>
                    {applicant.skills.map(s => (
                      <span key={s} style={{ fontSize: "0.65rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: "999px", padding: "0.1rem 0.45rem", fontWeight: "600" }}>{s}</span>
                    ))}
                  </div>
                )
                : <p style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic", margin: "0.1rem 0 0" }}>Not listed</p>
              }
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 }}>
          <StatusBadge status={applicant.status} />
          {applicant.status === "Pending" && (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={() => onUpdateStatus(applicant.id, "Accepted", applicant)} style={btnSmallGreen}>Accept</button>
              <button onClick={() => onUpdateStatus(applicant.id, "Rejected", applicant)} style={btnSmallRed}>Reject</button>
            </div>
          )}
          {applicant.status === "Accepted" && (
            <button onClick={() => setShowChat(p => !p)} style={{ ...btnSmallBlue, fontSize: "0.7rem" }}>
              💬 {showChat ? "Hide" : "Messages"}
            </button>
          )}
        </div>
      </div>
      {showChat && applicant.status === "Accepted" && (
        <ChatThread jobId={postingId} studentId={applicant.studentId} companyId={companyId} senderId={companyId} />
      )}
    </div>
    </>
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
                style={{ position: "relative", width: "100%", aspectRatio: "16/7", backgroundColor: "#0f172a", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
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
