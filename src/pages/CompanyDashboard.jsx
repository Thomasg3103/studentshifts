import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { jobCategories } from "../data/jobCategories";
import { geocodeAddress } from "../utils/geo";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

const seedPostings = [
  {
    id: 1, title: "Bar Staff", category: "Hospitality", location: "City Centre", pay: "€12/hr",
    days: ["Tuesday", "Thursday"], times: { Tuesday: "18:00", Thursday: "18:00" }, weekendRequired: true, status: "Active",
    description: "Join our bar team serving drinks and looking after customers. Some experience preferred — full training provided for the right candidate.",
    deadline: "2026-05-15",
    applicants: [
      { id: 1, name: "John Student", email: "student@test.com", cvName: "john_cv.pdf", status: "Pending" },
      { id: 3, name: "Emily Clarke", email: "emily@test.com", cvName: "emily_cv.pdf", status: "Pending" },
      { id: 5, name: "Sarah Murphy", email: "sarah@test.com", cvName: "sarah_cv.pdf", status: "Pending" },
    ],
  },
  {
    id: 2, title: "Barista", category: "Café & Coffee", location: "Near Campus", pay: "€11/hr",
    days: ["Monday", "Wednesday", "Friday"], times: { Monday: "08:00", Wednesday: "08:00", Friday: "08:00" }, weekendRequired: false, status: "Active",
    description: "Craft specialty coffees and serve customers in a fast-paced campus café. Latte art training provided to the successful candidate!",
    deadline: "2026-04-25",
    applicants: [
      { id: 2, name: "Jane Student", email: "jane@test.com", cvName: null, status: "Pending" },
      { id: 4, name: "Mark Ryan", email: "mark@test.com", cvName: "mark_cv.pdf", status: "Accepted" },
    ],
  },
  {
    id: 3, title: "Waiter", category: "Hospitality", location: "Near Campus", pay: "€11/hr",
    days: ["Tuesday", "Friday"], times: { Tuesday: "12:00", Friday: "12:00" }, weekendRequired: true, status: "Active",
    description: "Serve food and drinks with a friendly, professional attitude. Teamwork is essential — we're a busy restaurant and need reliable staff.",
    deadline: "",
    applicants: [
      { id: 6, name: "Cian Byrne", email: "cian@test.com", cvName: "cian_cv.pdf", status: "Pending" },
      { id: 7, name: "Aoife Walsh", email: "aoife@test.com", cvName: "aoife_cv.pdf", status: "Rejected" },
      { id: 8, name: "Liam Kelly", email: "liam@test.com", cvName: "liam_cv.pdf", status: "Pending" },
      { id: 9, name: "Niamh Burke", email: "niamh@test.com", cvName: "niamh_cv.pdf", status: "Pending" },
    ],
  },
  {
    id: 4, title: "Receptionist", category: "Service & Reception", location: "Downtown", pay: "€13/hr",
    days: ["Monday", "Wednesday", "Friday"], times: { Monday: "09:00", Wednesday: "09:00", Friday: "09:00" }, weekendRequired: false, status: "Closed",
    description: "Welcome guests, manage bookings, and handle front-desk enquiries at our city centre hotel. Excellent communication skills required.",
    deadline: "",
    applicants: [
      { id: 10, name: "Tom Hennessy", email: "tom@test.com", cvName: "tom_cv.pdf", status: "Accepted" },
    ],
  },
  {
    id: 5, title: "Kitchen Staff", category: "Hospitality", location: "City Centre", pay: "€11/hr",
    days: ["Thursday", "Friday"], times: { Thursday: "17:00", Friday: "17:00" }, weekendRequired: true, status: "Active",
    description: "Support our chefs with food prep and maintaining kitchen hygiene standards. No experience needed — great for culinary students.",
    deadline: "2026-06-01",
    applicants: [],
  },
  {
    id: 6, title: "Delivery Assistant", category: "Delivery & Logistics", location: "Downtown", pay: "€12/hr",
    days: ["Tuesday", "Thursday"], times: { Tuesday: "09:00", Thursday: "09:00" }, weekendRequired: false, status: "Active",
    description: "Help with local deliveries, packing orders, and warehouse duties around the city. A full clean driving licence is advantageous.",
    deadline: "",
    applicants: [
      { id: 11, name: "Roisin Doyle", email: "roisin@test.com", cvName: "roisin_cv.pdf", status: "Pending" },
      { id: 12, name: "Conor Flood", email: "conor@test.com", cvName: "conor_cv.pdf", status: "Pending" },
    ],
  },
  {
    id: 7, title: "Bar Staff", category: "Hospitality", location: "City Centre", pay: "€13/hr",
    days: ["Saturday", "Sunday"], times: { Saturday: "18:00", Sunday: "17:00" }, weekendRequired: false, status: "Active",
    description: "Weekend bar staff for our busy city centre venue. Ideal for students who have Saturday and Sunday free. Experience preferred.",
    deadline: "2026-05-10",
    applicants: [
      { id: 13, name: "Darragh Quinn", email: "darragh@test.com", cvName: "darragh_cv.pdf", status: "Pending" },
      { id: 14, name: "Sinead Carr", email: "sinead@test.com", cvName: "sinead_cv.pdf", status: "Pending" },
      { id: 15, name: "Kevin Moore", email: "kevin@test.com", cvName: "kevin_cv.pdf", status: "Pending" },
    ],
  },
  {
    id: 8, title: "Cashier", category: "Retail", location: "5 min walk", pay: "€10/hr",
    days: ["Saturday", "Sunday"], times: { Saturday: "09:00", Sunday: "10:00" }, weekendRequired: false, status: "Active",
    description: "Operate tills, process payments, and provide excellent customer service in our busy retail store. Friendly attitude is a must.",
    deadline: "",
    applicants: [
      { id: 16, name: "Aisling Boyle", email: "aisling@test.com", cvName: "aisling_cv.pdf", status: "Pending" },
    ],
  },
];

export default function CompanyDashboard({ setPage, currentUser }) {
  const [postings, setPostings] = useState(seedPostings);
  const [modal, setModal] = useState(null); // "applicants" | "form"
  const [activePosting, setActivePosting] = useState(null);
  const [formData, setFormData] = useState(null);

  const totalApplicants = postings.reduce((sum, p) => sum + p.applicants.length, 0);
  const activeCount = postings.filter(p => p.status === "Active").length;

  const openApplicants = (posting) => {
    setActivePosting(posting);
    setModal("applicants");
  };

  const openCreate = () => {
    setFormData({ title: "", category: "", location: "", pay: "", description: "", deadline: "", days: [], times: {}, weekendRequired: false, status: "Active", photos: [] });
    setModal("form");
  };

  const openEdit = (posting) => {
    setFormData({ ...posting, days: [...posting.days], times: { ...posting.times } });
    setModal("form");
  };

  const closeModal = () => {
    setModal(null);
    setActivePosting(null);
    setFormData(null);
  };

  const toggleStatus = (id) => {
    setPostings(prev =>
      prev.map(p => p.id === id ? { ...p, status: p.status === "Active" ? "Closed" : "Active" } : p)
    );
  };

  const deletePosting = (id) => {
    if (window.confirm("Delete this job posting? This cannot be undone.")) {
      setPostings(prev => prev.filter(p => p.id !== id));
    }
  };

  const saveForm = () => {
    if (!formData.title.trim() || !formData.location.trim() || !formData.pay.trim()) {
      alert("Please fill in Title, Location, and Pay.");
      return;
    }
    if (formData.days.length === 0) {
      alert("Please select at least one day.");
      return;
    }
    if (!formData.photos || formData.photos.length === 0) {
      alert("Please upload at least 1 photo.");
      return;
    }
    if (formData.id) {
      setPostings(prev => prev.map(p => p.id === formData.id ? { ...p, ...formData } : p));
    } else {
      setPostings(prev => [...prev, { ...formData, id: Date.now(), applicants: [] }]);
    }
    closeModal();
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

  const updateApplicantStatus = (applicantId, newStatus) => {
    // Persist status for student notification
    localStorage.setItem("ss_appstatus_" + applicantId + "_" + activePosting.id, newStatus);
    // Auto-message on first acceptance
    if (newStatus === "Accepted") {
      const msgKey = "ss_msgs_" + applicantId + "_" + activePosting.id;
      if (!localStorage.getItem(msgKey)) {
        localStorage.setItem(msgKey, JSON.stringify([{
          from: "company",
          text: `Hi! We reviewed your application for ${activePosting.title} and we'd love to have you on board. Please confirm your availability for an induction this week.`,
          time: new Date().toISOString(),
        }]));
      }
    }
    const updater = (p) => ({
      ...p,
      applicants: p.applicants.map(a => a.id === applicantId ? { ...a, status: newStatus } : a),
    });
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
      {postings.length === 0 ? (
        <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem" }}>No job postings yet</p>
          <p style={{ marginBottom: "1.5rem" }}>Create your first posting to start receiving applicants.</p>
          <button onClick={openCreate} style={btnGreen}>+ Create Job Posting</button>
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
          {posting.applicants.length} applicant{posting.applicants.length !== 1 ? "s" : ""}
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

function JobForm({ formData, setFormData, onSave, onCancel, toggleDay }) {
  const isEdit = !!formData.id;
  const set = (key) => (e) => setFormData(prev => ({ ...prev, [key]: e.target.value }));

  const categoryNames = Object.keys(jobCategories);
  const titlesForCategory = formData.category ? jobCategories[formData.category] ?? [] : [];

  const handleCategoryChange = (e) => {
    setFormData(prev => ({ ...prev, category: e.target.value, title: "" }));
  };

  // Photo state — File objects for preview; existing names from edit mode
  const [photoFiles, setPhotoFiles] = useState([]);
  const existingPhotos = (formData.photos || []).filter(p => typeof p === "string");
  const totalPhotos = existingPhotos.length + photoFiles.length;

  const handlePhotoAdd = (e) => {
    const incoming = Array.from(e.target.files);
    const remaining = 10 - totalPhotos;
    if (remaining <= 0) return;
    const toAdd = incoming.slice(0, remaining);
    const newFiles = [...photoFiles, ...toAdd];
    setPhotoFiles(newFiles);
    setFormData(prev => ({ ...prev, photos: [...existingPhotos, ...newFiles.map(f => f.name)] }));
    e.target.value = "";
  };

  const removeExistingPhoto = (name) => {
    const updated = existingPhotos.filter(n => n !== name);
    setFormData(prev => ({ ...prev, photos: [...updated, ...photoFiles.map(f => f.name)] }));
  };

  const removeNewPhoto = (index) => {
    const newFiles = photoFiles.filter((_, i) => i !== index);
    setPhotoFiles(newFiles);
    setFormData(prev => ({ ...prev, photos: [...existingPhotos, ...newFiles.map(f => f.name)] }));
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
        <input value={formData.pay} onChange={set("pay")} placeholder="€12/hr" style={inputStyle} />
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

        {/* Thumbnails grid */}
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
            {/* Existing (edit mode) — shown as name pills */}
            {existingPhotos.map(name => (
              <div key={name} style={{ position: "relative", backgroundColor: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: "0.4rem", padding: "0.3rem 2rem 0.3rem 0.6rem", fontSize: "0.75rem", color: "#1d4ed8", fontWeight: "600", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📷 {name}
                <button type="button" onClick={() => removeExistingPhoto(name)} style={{ position: "absolute", top: "2px", right: "4px", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "0.85rem", lineHeight: 1 }}>✕</button>
              </div>
            ))}
            {/* New files — show image preview */}
            {photoFiles.map((file, i) => (
              <div key={i} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: "1.5px solid #d1d5db" }}>
                <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button type="button" onClick={() => removeNewPhoto(i)} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", color: "white", width: "18px", height: "18px", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
              </div>
            ))}
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
        <button onClick={onSave} style={{ ...btnGreen, flex: 1 }}>
          {isEdit ? "Save Changes" : "Create Posting"}
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
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "1rem",
    }}>
      <div style={{
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

const btnSmallBase  = { padding: "0.32rem 0.75rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" };
const btnSmallGreen = { ...btnSmallBase, background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 2px 6px rgba(16,185,129,0.3)" };
const btnSmallBlue  = { ...btnSmallBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 6px rgba(99,102,241,0.3)" };
const btnSmallGray  = { ...btnSmallBase, backgroundColor: "#64748b" };
const btnSmallRed   = { ...btnSmallBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 2px 6px rgba(244,63,94,0.3)" };
