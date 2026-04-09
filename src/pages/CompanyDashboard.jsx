import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import { jobCategories } from "../data/jobCategories";
import { geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";

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

  // Load this company's jobs on mount
  useEffect(() => {
    if (!currentUser) return;
    withTimeout(
      supabase.from("jobs").select("*, applications(id, status)").eq("company_id", currentUser.id).order("created_at", { ascending: false }),
      10000, "Loading jobs timed out."
    ).then(({ data, error }) => {
      if (!error && data) {
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
    setActivePosting({ ...posting, applicants: [] });
    setModal("applicants");
    const { data, error } = await withTimeout(
      supabase.from("applications").select("id, status, created_at, profiles:student_id(id, name, email), students:student_id(cv_url)").eq("job_id", posting.id).order("created_at", { ascending: true }),
      10000, "Loading applicants timed out."
    );
    if (!error && data) {
      const applicants = data.map(a => ({
        id:     a.id,
        name:   a.profiles?.name   || "Unknown",
        email:  a.profiles?.email  || "",
        cvName: a.students?.cv_url || null,
        status: a.status,
      }));
      setActivePosting(prev => ({ ...prev, applicants }));
    }
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

  const updateApplicantStatus = async (applicationId, newStatus) => {
    const { error } = await withTimeout(
      supabase.from("applications").update({ status: newStatus }).eq("id", applicationId),
      10000, "Update timed out."
    );
    if (error) { alert("Failed to update status."); return; }
    const updater = (p) => ({ ...p, applicants: p.applicants.map(a => a.id === applicationId ? { ...a, status: newStatus } : a) });
    setPostings(prev => prev.map(p => p.id === activePosting.id ? updater(p) : p));
    setActivePosting(prev => updater(prev));
  };

  return (
    <PageWrapper>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", margin: 0, color: "#1e293b" }}>Company Dashboard</h1>
          {currentUser && (
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>{currentUser.name}</p>
          )}
        </div>
        <button onClick={openCreate} style={btnGreen}>+ New Job</button>
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
          <p style={{ marginBottom: "1.5rem" }}>Create your first posting to start receiving applicants.</p>
          <button onClick={openCreate} style={btnGreen}>+ Create Job Posting</button>
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
          <ApplicantsView posting={activePosting} onUpdateStatus={updateApplicantStatus} />
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

function JobPostingCard({ posting, onViewApplicants, onEdit, onDelete, onToggleStatus }) {
  const isActive = posting.status === "Active";
  return (
    <div style={{
      padding: "1rem 1.25rem", borderRadius: "0.75rem",
      backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb",
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      gap: "1rem", opacity: isActive ? 1 : 0.75,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
          <h2 style={{ fontWeight: "bold", fontSize: "1.1rem", margin: 0 }}>{posting.title}</h2>
          <span style={{
            fontSize: "0.65rem", fontWeight: "700", padding: "0.15rem 0.55rem",
            borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.05em",
            backgroundColor: isActive ? "#dcfce7" : "#f3f4f6",
            color: isActive ? "#16a34a" : "#6b7280",
          }}>
            {posting.status}
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
        <button onClick={onToggleStatus} style={btnSmallGray}>
          {isActive ? "Close Job" : "Reopen Job"}
        </button>
        <button onClick={onDelete} style={btnSmallRed}>Delete</button>
      </div>
    </div>
  );
}

function ApplicantsView({ posting, onUpdateStatus }) {
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
          />
        ))}
      </div>
    </div>
  );
}

function ApplicantCard({ applicant, postingId, onUpdateStatus }) {
  const [showChat, setShowChat] = useState(false);
  return (
    <div style={{ backgroundColor: "#f9fafb", borderRadius: "0.5rem", border: "1px solid #e5e7eb", padding: "0.75rem 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: "600", fontSize: "0.9rem", margin: 0 }}>{applicant.name}</p>
          <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: "0.1rem 0" }}>{applicant.email}</p>
          <p style={{ fontSize: "0.75rem", margin: 0, color: applicant.cvName ? "#16a34a" : "#ef4444" }}>
            {applicant.cvName ? `✓ ${applicant.cvName}` : "No CV uploaded"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem", flexShrink: 0 }}>
          <StatusBadge status={applicant.status} />
          {applicant.status === "Pending" && (
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button onClick={() => onUpdateStatus(applicant.id, "Accepted")} style={btnSmallGreen}>Accept</button>
              <button onClick={() => onUpdateStatus(applicant.id, "Rejected")} style={btnSmallRed}>Reject</button>
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
        <ChatThread applicantId={applicant.id} jobId={postingId} role="company" />
      )}
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
                  <button type="button" onClick={() => { const nz = Math.max(0.25, getCrop(safeIdx).zoom - 0.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>−</button>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: "32px", textAlign: "center" }}>{Math.round(crop.zoom * 100)}%</span>
                  <button type="button" onClick={() => { const nz = Math.min(4, getCrop(safeIdx).zoom + 0.25); dragRef.current.zoom = nz; setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>+</button>
                </div>
              </div>
              <div
                ref={previewRef}
                style={{ position: "relative", width: "100%", aspectRatio: "16/7", backgroundColor: "#0f172a", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
                onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
                onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <img
                  src={src}
                  alt="preview"
                  draggable={false}
                  style={{
                    position: "absolute",
                    top: `calc(50% + ${crop.offsetY}%)`,
                    left: `calc(50% + ${crop.offsetX}%)`,
                    transform: `translate(-50%, -50%) scale(${crop.zoom})`,
                    transformOrigin: "center",
                    minWidth: "100%", minHeight: "100%",
                    maxWidth: "none",
                    width: "auto", height: "auto",
                    transition: isDragging ? "none" : "transform 0.1s ease",
                  }}
                />
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

function ChatThread({ applicantId, jobId, role }) {
  const key = "ss_msgs_" + applicantId + "_" + jobId;
  const [messages, setMessages] = useState(() => JSON.parse(localStorage.getItem(key) || "[]"));
  const [input, setInput] = useState("");

  const send = () => {
    if (!input.trim()) return;
    const msg = { from: role, text: input.trim(), time: new Date().toISOString() };
    const updated = [...messages, msg];
    setMessages(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    setInput("");
  };

  return (
    <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#374151", marginBottom: "0.5rem" }}>💬 Messages</p>
      <div style={{ maxHeight: "160px", overflowY: "auto", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {messages.length === 0
          ? <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>No messages yet.</p>
          : messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.from === role ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{ backgroundColor: m.from === role ? "#3b82f6" : "#e5e7eb", color: m.from === role ? "white" : "#111827", padding: "0.4rem 0.65rem", borderRadius: "0.55rem", fontSize: "0.8rem", lineHeight: 1.4 }}>
                {m.text}
              </div>
              <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.from === role ? "right" : "left" }}>
                {new Date(m.time).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))
        }
      </div>
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Type a message…"
          style={{ flex: 1, padding: "0.45rem 0.65rem", borderRadius: "0.4rem", border: "1.5px solid #d1d5db", fontSize: "0.8rem" }}
        />
        <button onClick={send} style={{ padding: "0.45rem 0.75rem", borderRadius: "0.4rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}>
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

const btnSmallBase  = { padding: "0.32rem 0.75rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" };
const btnSmallGreen = { ...btnSmallBase, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 2px 6px rgba(16,185,129,0.3)" };
const btnSmallBlue  = { ...btnSmallBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 6px rgba(99,102,241,0.3)" };
const btnSmallGray  = { ...btnSmallBase, backgroundColor: "#64748b" };
const btnSmallRed   = { ...btnSmallBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 2px 6px rgba(244,63,94,0.3)" };
