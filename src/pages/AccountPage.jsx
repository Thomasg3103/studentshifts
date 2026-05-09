import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import BackButton from "../components/BackButton";
import { geocodeAddress, getCurrentPosition } from "../utils/geo";
import { updateStudentProfile, updateCompanyProfile, uploadAvatar, uploadDocument, signOut, deleteAccount, verifyPassword, exportMyData } from "../lib/auth";
import { jobCategories } from "../data/jobCategories";

const PART_TIME_SKILLS = [
  "Customer Service", "Cash Handling", "Till Operation", "Retail Sales", "Stock Management",
  "Merchandising", "Visual Merchandising", "Product Knowledge",
  "Food Service", "Food Preparation", "Kitchen Porter", "Barista", "Bartending",
  "Waitressing", "Hosting", "Catering", "Hospitality",
  "Cleaning & Housekeeping", "Laundry & Linen",
  "Warehouse Work", "Packing & Picking", "Forklift Operation", "Goods Receiving",
  "Delivery Driving", "Courier Work", "Bike Delivery",
  "Data Entry", "Administration", "Reception & Front Desk", "Filing & Record Keeping",
  "Microsoft Office", "Word Processing", "Spreadsheets",
  "Social Media Management", "Content Creation", "Graphic Design", "Photography",
  "Childcare", "Babysitting", "After-School Care",
  "Tutoring", "Teaching Assistant",
  "Event Staff", "Event Setup & Breakdown", "Ushering", "Crowd Management",
  "Security", "Door Work",
  "Call Centre", "Telesales", "Customer Support",
  "Teamwork", "Communication", "Time Management", "Attention to Detail",
  "Problem Solving", "Multitasking", "Cash Register", "POS Systems",
  "Manual Handling", "Health & Safety", "First Aid",
  "Promotions & Leafleting", "Brand Ambassador",
  "Gardening & Landscaping", "Car Washing", "Parking Attendant",
];

export default function AccountPage({
  currentUser,
  setCurrentUser,
  setPage,
  setLikedJobs,
  setAppliedJobs,
  setStudentLocation,
}) {
  const [availability, setAvailability]         = useState(currentUser.availability || {});
  const [jobPreferences, setJobPreferences]     = useState(currentUser.jobPreferences || []);
  const [industries, setIndustries]             = useState(currentUser.industries || []);
  const [industrySaved, setIndustrySaved]       = useState(false);
  const [industrySaving, setIndustrySaving]     = useState(false);
  const [linkedIn, setLinkedIn]                 = useState(currentUser.linkedIn || "");
  const [bio, setBio]                           = useState(currentUser.bio || "");
  const [skills, setSkills]                     = useState(currentUser.skills || []);
  const [skillInput, setSkillInput]             = useState("");
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const skillWrapRef = useRef(null);
  const [saving, setSaving]                     = useState(false);
  const [saved, setSaved]                       = useState(false);
  const [saveError, setSaveError]               = useState("");
  const [showLogoutModal, setShowLogoutModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [deleteConfirm, setDeleteConfirm]       = useState("");
  const [deletePassword, setDeletePassword]     = useState("");
  const [deleting, setDeleting]                 = useState(false);
  const [deleteError, setDeleteError]           = useState("");
  const [exporting, setExporting]               = useState(false);
  const [profilePhoto, setProfilePhoto]         = useState(currentUser.profilePhoto || "");
  const [windowWidth, setWindowWidth]           = useState(window.innerWidth);
  const availDebounceRef = useRef(null);

  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const isMobile  = windowWidth < 768;
  const isStudent = currentUser.role === "student";
  const isCompany = currentUser.role === "company";

  // ── Auto-save helper (students only) ───────────────────────────────────
  const saveField = async (fields) => {
    setSaving(true);
    setSaveError("");
    try {
      await updateStudentProfile(currentUser.id, fields);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Skills ──────────────────────────────────────────────────────────────
  const skillSuggestions = skillInput.trim().length > 0
    ? PART_TIME_SKILLS.filter(s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s))
    : [];

  const addSkillFromSuggestion = (s) => {
    if (skills.includes(s)) return;
    const next = [...skills, s];
    setSkills(next);
    setSkillInput("");
    setShowSkillSuggestions(false);
    saveField({ skills: next });
  };

  const removeSkill = (s) => {
    const next = skills.filter(x => x !== s);
    setSkills(next);
    saveField({ skills: next });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (skillWrapRef.current && !skillWrapRef.current.contains(e.target)) {
        setShowSkillSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Availability (debounced) ─────────────────────────────────────────────
  const handleAvailabilityChange = (newAvail) => {
    setAvailability(newAvail);
    if (availDebounceRef.current) clearTimeout(availDebounceRef.current);
    availDebounceRef.current = setTimeout(() => saveField({ availability: newAvail }), 800);
  };

  // ── Job Preferences ──────────────────────────────────────────────────────
  const handlePrefToggle = (cat) => {
    const active = jobPreferences.includes(cat);
    const next   = active ? jobPreferences.filter(c => c !== cat) : [...jobPreferences, cat];
    setJobPreferences(next);
    saveField({ job_preferences: next });
  };

  // ── Profile Photo auto-upload ────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setProfilePhoto(ev.target.result);
    reader.readAsDataURL(file);
    setSaving(true);
    try {
      const url = await uploadAvatar(currentUser.id, file);
      await updateStudentProfile(currentUser.id, { profile_photo_url: url });
      setCurrentUser(prev => ({ ...prev, profilePhoto: url }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      console.warn("Photo upload skipped:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── CV auto-upload ───────────────────────────────────────────────────────
  const handleCvUpload = async (file) => {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadDocument(currentUser.id, file, "documents", "cv");
      await updateStudentProfile(currentUser.id, { cv_url: url });
      setCurrentUser(prev => ({ ...prev, cvName: url }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("CV upload failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Cover Letter auto-upload ─────────────────────────────────────────────
  const handleCoverLetterUpload = async (file) => {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadDocument(currentUser.id, file, "documents", "cover-letter");
      await updateStudentProfile(currentUser.id, { cover_letter_url: url });
      setCurrentUser(prev => ({ ...prev, coverLetterName: url }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("Cover letter upload failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Location ─────────────────────────────────────────────────────────────
  const saved_loc = currentUser.savedLocation || null;
  const [locationType, setLocationType]     = useState(saved_loc?.type || "home");
  const [locationAddress, setLocationAddress] = useState(saved_loc?.displayName || "");
  const [locationCoords, setLocationCoords] = useState(saved_loc ? { lat: saved_loc.lat, lng: saved_loc.lng, displayName: saved_loc.displayName } : null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError]   = useState("");
  const [showManual, setShowManual]         = useState(false);
  const [manualLine1, setManualLine1]       = useState("");
  const [manualLine2, setManualLine2]       = useState("");
  const [manualCity, setManualCity]         = useState("");
  const [manualCounty, setManualCounty]     = useState("");

  const applyGeoResult = async (result) => {
    setLocationCoords(result);
    setLocationAddress(result.displayName);
    setLocationError("");
    setShowManual(false);
    const savedLocation = { type: locationType, lat: result.lat, lng: result.lng, displayName: result.displayName };
    try {
      await updateStudentProfile(currentUser.id, {
        location_lat:     result.lat,
        location_lng:     result.lng,
        location_display: result.displayName,
      });
      setCurrentUser(prev => ({ ...prev, savedLocation }));
      if (setStudentLocation) setStudentLocation(savedLocation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("Failed to save location.");
    }
  };

  const handleGeocode = async () => {
    if (!locationAddress.trim()) { setLocationError("Enter an Eircode or address first."); return; }
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(locationAddress + ", Ireland");
    setLocationLoading(false);
    if (result) await applyGeoResult(result);
    else { setLocationError("Eircode not found. Fill in the address manually below."); setShowManual(true); }
  };

  const handleManualGeocode = async () => {
    if (!manualLine1.trim() && !manualCity.trim()) { setLocationError("Enter at least the address and city."); return; }
    const fullAddress = [manualLine1, manualLine2, manualCity, manualCounty, "Ireland"].filter(Boolean).join(", ");
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(fullAddress);
    setLocationLoading(false);
    if (result) await applyGeoResult(result);
    else setLocationError("Could not find that address. Try adjusting the details.");
  };

  const handleGPS = async () => {
    setLocationLoading(true);
    setLocationError("");
    const pos = await getCurrentPosition();
    setLocationLoading(false);
    if (pos) {
      await applyGeoResult({ lat: pos.lat, lng: pos.lng, displayName: "Your current GPS location" });
      setLocationAddress("GPS location");
    } else {
      setLocationError("Could not get GPS location. Check browser permissions.");
    }
  };

  // ── Industries (company) ─────────────────────────────────────────────────
  const handleSaveIndustries = async () => {
    setIndustrySaving(true);
    try {
      await updateCompanyProfile(currentUser.id, { industries });
      setCurrentUser(prev => ({ ...prev, industries }));
      setIndustrySaved(true);
      setTimeout(() => setIndustrySaved(false), 2500);
    } catch (e) {
      Sentry.captureException(e);
      alert("Failed to save. Please try again.");
    } finally {
      setIndustrySaving(false);
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportMyData(currentUser.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `studentshifts-data-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      Sentry.captureException(e);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ── Delete / Logout ──────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await verifyPassword(currentUser.email, deletePassword);
      await deleteAccount();
      try { await signOut(); } catch (_) {}
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ss_notif_seen_')) localStorage.removeItem(key);
      }
      setCurrentUser(null);
      setLikedJobs([]);
      setAppliedJobs([]);
      setPage("studentDashboard");
    } catch (e) {
      Sentry.captureException(e);
      setDeleteError(e.message || "Failed to delete account.");
      setDeleting(false);
    }
  };

  const confirmLogout = async () => {
    try { await signOut(); } catch (_) {}
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ss_notif_seen_')) localStorage.removeItem(key);
    }
    setCurrentUser(null);
    setLikedJobs([]);
    setAppliedJobs([]);
    setPage("studentDashboard");
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const docsStored = !!(currentUser.studentIdCardName && currentUser.governmentIdName);

  const profileFields = isStudent ? [
    { label: "CV",       done: !!currentUser.cvName },
    { label: "Location", done: !!locationCoords },
    { label: "Bio",      done: !!bio.trim() },
    { label: "Skills",   done: skills.length > 0 },
    { label: "LinkedIn", done: !!linkedIn.trim() },
  ] : [];
  const donePct = profileFields.length ? Math.round(profileFields.filter(f => f.done).length / profileFields.length * 100) : 0;
  const pcColor = donePct >= 80 ? "#16a34a" : donePct >= 40 ? "#d97706" : "#ef4444";

  // ── Sidebar cards (students) ──────────────────────────────────────────────
  const SidebarAvailability = () => (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "0.85rem 0.9rem", marginBottom: "0.75rem", borderTop: "3px solid var(--color-brand)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-brand)" }}>My Availability</p>
      </div>
      <p style={{ fontSize: "0.73rem", color: "#6b7280", marginBottom: "0.65rem", lineHeight: 1.4 }}>Tap the slots you're free each week.</p>
      <AvailabilityPicker value={availability} onChange={handleAvailabilityChange} />
    </div>
  );

  const SidebarPrefs = () => (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "0.85rem 0.9rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>Job Preferences</p>
      <p style={{ fontSize: "0.73rem", color: "#6b7280", marginBottom: "0.65rem", lineHeight: 1.4 }}>Industries you're interested in.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {Object.keys(jobCategories).map(cat => {
          const active = jobPreferences.includes(cat);
          return (
            <button key={cat} type="button" onClick={() => handlePrefToggle(cat)} style={{
              padding: "0.25rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`,
              backgroundColor: active ? "#fce7f3" : "#f8fafc",
              color: active ? "var(--color-brand)" : "#64748b",
            }}>
              {active ? "✓ " : ""}{cat}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Right column content (shared pieces) ─────────────────────────────────
  const LocationSection = () => (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
      <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 0.75rem" }}>My Location</p>
      <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.85rem", lineHeight: 1.4 }}>
        Set your address so we can show job distances. Never shared publicly.
      </p>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        {[["home", "🏠 Home"], ["college", "🎓 College"], ["local", "📍 Local"]].map(([val, label]) => (
          <button key={val} type="button" onClick={() => setLocationType(val)} style={{
            padding: "0.3rem 0.8rem", borderRadius: "0.5rem", cursor: "pointer",
            border: `1.5px solid ${locationType === val ? "#3b82f6" : "#d1d5db"}`,
            backgroundColor: locationType === val ? "#eff6ff" : "white",
            color: locationType === val ? "#1d4ed8" : "#374151",
            fontWeight: locationType === val ? "700" : "500",
            fontSize: "0.8rem", fontFamily: "inherit",
          }}>{label}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <input
          placeholder="Eircode"
          value={locationAddress}
          onChange={e => { setLocationAddress(e.target.value); setLocationCoords(null); setShowManual(false); }}
          onKeyDown={e => e.key === "Enter" && handleGeocode()}
          style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
        />
        <button type="button" onClick={handleGeocode} disabled={locationLoading} style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.85rem", cursor: locationLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
          {locationLoading ? "…" : "Find"}
        </button>
      </div>
      {locationCoords && !showManual && (
        <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700" }}>✓ Location found</span>
          <p style={{ color: "#374151", margin: "0.15rem 0 0", fontSize: "0.7rem" }}>{locationCoords.displayName}</p>
        </div>
      )}
      {locationError && <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 0.4rem" }}>{locationError}</p>}
      {!showManual && !locationCoords && (
        <button type="button" onClick={() => setShowManual(true)} style={{ background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", marginBottom: "0.5rem", fontFamily: "inherit" }}>
          Enter address manually
        </button>
      )}
      {showManual && (
        <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
          <input value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleManualGeocode} disabled={locationLoading} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
              {locationLoading ? "Finding…" : "Find Address"}
            </button>
            <button type="button" onClick={() => setShowManual(false)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "white", color: "#6b7280", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}
      <button type="button" onClick={handleGPS} disabled={locationLoading} style={{ padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
        📡 Use my current GPS location
      </button>
    </div>
  );

  const BottomActions = () => (
    <>
      <div style={{ borderTop: "1.5px solid #e2e8f0", marginBottom: "1rem", marginTop: "0.25rem" }} />
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <button onClick={() => setShowLogoutModal(true)} style={{ ...btnBase, flex: 1, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}>Logout</button>
        <button onClick={() => { setDeleteConfirm(""); setDeletePassword(""); setDeleteError(""); setShowDeleteModal(true); }} style={{ ...btnBase, flex: 1, backgroundColor: "transparent", border: "1.5px solid #fca5a5", color: "#dc2626", boxShadow: "none" }}>Delete Account</button>
      </div>
      <div style={{ textAlign: "center", marginTop: "0.25rem" }}>
        <button onClick={handleExport} disabled={exporting} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
          {exporting ? "Exporting…" : "Download My Data"}
        </button>
      </div>
    </>
  );

  const firstName = currentUser.name || "";

  return (
    <>
      <BackButton />
      <div style={{ backgroundColor: "#fafafa", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "1.5rem 1.25rem", boxSizing: "border-box", width: "100%", overflowX: "hidden" }}>
        <div style={{ maxWidth: isStudent ? "1100px" : "560px", margin: "0 auto" }}>

          {/* Profile photo + name header */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden", border: "3px solid #fce7f3", backgroundColor: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto", boxShadow: "0 0 0 3px var(--color-brand)22" }}>
                {profilePhoto
                  ? <img src={profilePhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <PersonIcon />}
              </div>
              <label style={{ position: "absolute", bottom: "2px", right: "2px", width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.7rem" }}>
                📷
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
              </label>
            </div>
            <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#94a3b8", fontWeight: "500" }}>Welcome back,</p>
            <p style={{ margin: "0.1rem 0 0.1rem", fontWeight: "800", fontSize: "1.15rem", color: "#1e293b" }}>👋 {firstName}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>{currentUser.email}</p>
          </div>

          {isStudent ? (
            /* ── Student single-column layout ── */
            <div>

              {/* Only show verification docs section if not both stored */}
              {!docsStored && (
                <Collapsible title="Verification Documents" defaultOpen>
                  <DocRow label="Student ID Card" filename={currentUser.studentIdCardName} />
                  <DocRow label="Government ID"   filename={currentUser.governmentIdName} />
                </Collapsible>
              )}

              <LocationSection />

              {/* My Availability — collapsible, below location */}
              <Collapsible title="My Availability">
                <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.75rem", lineHeight: 1.4 }}>Tap the slots you're free each week.</p>
                <AvailabilityPicker value={availability} onChange={handleAvailabilityChange} />
              </Collapsible>

              {/* Job Preferences */}
                <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 0.5rem" }}>Job Preferences</p>
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.65rem" }}>Industries you're interested in.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {Object.keys(jobCategories).map(cat => {
                      const active = jobPreferences.includes(cat);
                      return (
                        <button key={cat} type="button" onClick={() => handlePrefToggle(cat)} style={{
                          padding: "0.25rem 0.6rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600",
                          cursor: "pointer", fontFamily: "inherit",
                          border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`,
                          backgroundColor: active ? "#fce7f3" : "#f8fafc",
                          color: active ? "var(--color-brand)" : "#64748b",
                        }}>
                          {active ? "✓ " : ""}{cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* My Profile */}
                <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1.25rem", marginBottom: "1rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", margin: "0 0 1rem" }}>My Profile</p>

                  {/* Completeness bar */}
                  {(() => {
                    const done = profileFields.filter(f => f.done).length;
                    return (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#374151" }}>Profile Completeness</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: pcColor }}>{done}/{profileFields.length}</span>
                        </div>
                        <div style={{ height: "8px", backgroundColor: "#e5e7eb", borderRadius: "999px", overflow: "hidden", marginBottom: "0.45rem" }}>
                          <div style={{ height: "100%", width: donePct + "%", backgroundColor: pcColor, borderRadius: "999px", transition: "width 0.3s" }} />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {profileFields.map(f => (
                            <span key={f.label} style={{ fontSize: "0.7rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: f.done ? "#dcfce7" : "#f3f4f6", color: f.done ? "#16a34a" : "#9ca3af" }}>
                              {f.done ? "✓" : "○"} {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <FileUpload label="CV" hint=".pdf or .docx — required to apply" accept=".pdf,.doc,.docx" onUpload={handleCvUpload} existingName={currentUser.cvName} required />
                  <FileUpload label="Cover Letter" hint=".pdf or .docx — optional" accept=".pdf,.doc,.docx" onUpload={handleCoverLetterUpload} existingName={currentUser.coverLetterName} />

                  <label style={labelStyle}>LinkedIn URL <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional)</span></label>
                  <input
                    placeholder="https://linkedin.com/in/yourname"
                    value={linkedIn}
                    onChange={e => setLinkedIn(e.target.value)}
                    onBlur={() => saveField({ linkedin: linkedIn })}
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Short Bio <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional)</span></label>
                  <textarea
                    placeholder="Tell employers a bit about yourself…"
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    onBlur={() => saveField({ bio })}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
                  />

                  <label style={labelStyle}>Skills <span style={{ fontWeight: "400", color: "#9ca3af" }}>(type to search, click to add)</span></label>
                  <div ref={skillWrapRef} style={{ position: "relative", marginBottom: "0.5rem" }}>
                    <input
                      placeholder="e.g. Customer Service"
                      value={skillInput}
                      onChange={e => { setSkillInput(e.target.value); setShowSkillSuggestions(true); }}
                      onFocus={() => setShowSkillSuggestions(true)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                    />
                    {showSkillSuggestions && skillSuggestions.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "0.25rem" }}>
                        {skillSuggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addSkillFromSuggestion(s); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "0.55rem 0.85rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#1e293b", fontFamily: "inherit" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          >{s}</button>
                        ))}
                      </div>
                    )}
                    {showSkillSuggestions && skillInput.trim().length > 0 && skillSuggestions.length === 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "0.6rem 0.85rem", marginTop: "0.25rem" }}>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "#9ca3af" }}>No matching skills found</p>
                      </div>
                    )}
                  </div>
                  {skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {skills.map(s => (
                        <span key={s} style={{ fontSize: "0.8rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #bfdbfe", borderRadius: "999px", padding: "0.2rem 0.6rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          {s}
                          <button onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "0.75rem", padding: 0, lineHeight: 1 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

              {/* Save status — above logout/delete */}
              {(saving || saved || saveError) && (
                <div style={{ textAlign: "center", padding: "0.6rem 1rem", marginBottom: "0.75rem", borderRadius: "0.6rem", backgroundColor: saveError ? "#fff1f2" : saved ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${saveError ? "#fca5a5" : saved ? "#86efac" : "#e2e8f0"}` }}>
                  {saving && <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>Saving…</p>}
                  {saved  && <p style={{ margin: 0, fontSize: "0.8rem", color: "#16a34a", fontWeight: 700 }}>✓ Saved</p>}
                  {saveError && <p style={{ margin: 0, fontSize: "0.8rem", color: "#ef4444", fontWeight: 600 }}>{saveError}</p>}
                </div>
              )}

              <BottomActions />
            </div>
          ) : (
            /* ── Company single-column layout ── */
            <div>
              <Collapsible title="Account Details">
                <InfoRow label="Name"  value={currentUser.name} />
                <InfoRow label="Email" value={currentUser.email} />
                <InfoRow label="Role"  value="Company" />
              </Collapsible>

              <Section title="Our Industries">
                <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.9rem" }}>Which industries does your company hire in? Students matching these will appear in Browse Students.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                  {Object.keys(jobCategories).map(cat => {
                    const active = industries.includes(cat);
                    return (
                      <button key={cat} type="button"
                        onClick={() => setIndustries(prev => active ? prev.filter(c => c !== cat) : [...prev, cat])}
                        style={{
                          padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600",
                          cursor: "pointer", fontFamily: "inherit",
                          border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`,
                          backgroundColor: active ? "#fce7f3" : "white",
                          color: active ? "var(--color-brand)" : "#64748b",
                        }}>{active ? "✓ " : ""}{cat}</button>
                    );
                  })}
                </div>
                <button onClick={handleSaveIndustries} disabled={industrySaving} style={{ ...btnBase, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 4px 14px rgba(162,29,84,0.35)", opacity: industrySaving ? 0.7 : 1 }}>
                  {industrySaved ? "✓ Saved!" : industrySaving ? "Saving…" : "Save Industries"}
                </button>
              </Section>

              <BottomActions />
            </div>
          )}
        </div>

        {/* ── Delete modal ── */}
        {showDeleteModal && (
          <div onClick={() => setShowDeleteModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff1f2", border: "2px solid #fecdd3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>⚠️</div>
              <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.35rem", color: "#1e293b" }}>Delete your account?</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 1.25rem" }}>This is permanent. Your profile, CV, and all data will be deleted.</p>
              <p style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151", margin: "0 0 0.4rem", textAlign: "left" }}>Enter your password to confirm</p>
              <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Password" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
              <p style={{ fontSize: "0.8rem", fontWeight: "600", color: "#374151", margin: "0 0 0.4rem", textAlign: "left" }}>Type <strong>DELETE</strong> to confirm</p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={{ ...inputStyle, marginBottom: "0.75rem", borderColor: deleteConfirm === "DELETE" ? "#ef4444" : "#e2e8f0" }} />
              {deleteError && <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 0.75rem" }}>{deleteError}</p>}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE" || !deletePassword || deleting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: deleteConfirm === "DELETE" && deletePassword ? "#dc2626" : "#fca5a5", color: "white", fontWeight: "700", cursor: deleteConfirm === "DELETE" && deletePassword && !deleting ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "0.9rem" }}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Logout modal ── */}
        {showLogoutModal && (
          <div onClick={() => setShowLogoutModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff1f2", border: "2px solid #fecdd3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>👋</div>
              <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.35rem", color: "#1e293b" }}>Log out?</h3>
              <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem" }}>You'll need to sign back in to access your account.</p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Stay</button>
                <button onClick={confirmLogout} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: "#f43f5e", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Log Out</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", marginBottom: "0.75rem", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.1rem", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>{title}</span>
        <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && <div style={{ padding: "0 1.1rem 1rem" }}>{children}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
      <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: "600", color: "#111827" }}>{value}</span>
    </div>
  );
}

function DocRow({ label, filename }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      {filename
        ? <span style={{ color: "#16a34a", fontWeight: "600" }}>✓ Uploaded</span>
        : <span style={{ color: "#ef4444", fontWeight: "600" }}>Not uploaded</span>}
    </div>
  );
}

function FileUpload({ label, hint, accept, onUpload, existingName, required }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    setUploaded(true);
    setTimeout(() => setUploaded(false), 2500);
  };

  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label style={{ display: "block", fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem", color: "#374151" }}>
        {label} {required && !existingName && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.35rem" }}>{hint}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", border: `1.5px dashed ${existingName || uploaded ? "#22c55e" : "#d1d5db"}`, borderRadius: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: existingName || uploaded ? "#f0fdf4" : "white", overflow: "hidden" }}>
        <label style={{ cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", color: uploading ? "#9ca3af" : "#3b82f6", whiteSpace: "nowrap", flexShrink: 0 }}>
          {uploading ? "Uploading…" : existingName ? "Change" : "Choose file"}
          <input type="file" accept={accept} style={{ display: "none" }} onChange={handleChange} disabled={uploading} />
        </label>
        <span style={{ fontSize: "0.8rem", color: existingName || uploaded ? "#16a34a" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {uploaded ? "✓ Uploaded!" : existingName ? "✓ Uploaded" : "No file chosen"}
        </span>
      </div>
    </div>
  );
}

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

function AvailabilityPicker({ value, onChange }) {
  const toggle = (day, slot) => {
    const current = value[day] || [];
    const updated = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
    onChange({ ...value, [day]: updated });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {DAYS.map(day => {
        const selected  = value[day] || [];
        const isWeekend = day === "Saturday" || day === "Sunday";
        return (
          <div key={day}>
            <p style={{ fontSize: "0.72rem", fontWeight: "700", color: isWeekend ? "#d97706" : "#374151", marginBottom: "0.25rem" }}>{day}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {SLOTS.map(slot => {
                const active = selected.includes(slot);
                return (
                  <button key={slot} type="button" onClick={() => toggle(day, slot)} style={{
                    padding: "0.18rem 0.4rem", borderRadius: "0.3rem", fontSize: "0.65rem", fontWeight: "600", cursor: "pointer",
                    border: `1.5px solid ${active ? (isWeekend ? "#f59e0b" : "var(--color-brand)") : "#e2e8f0"}`,
                    backgroundColor: active ? (isWeekend ? "#fef3c7" : "#fce7f3") : "white",
                    color: active ? (isWeekend ? "#d97706" : "var(--color-brand)") : "#94a3b8",
                    fontFamily: "inherit",
                  }}>
                    {slot}
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

const labelStyle = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.3rem" };
const inputStyle = { width: "100%", padding: "0.6rem 0.75rem", marginBottom: "1rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b", backgroundColor: "white" };
const btnBase    = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit" };
