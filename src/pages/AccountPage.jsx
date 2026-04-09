import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { geocodeAddress, getCurrentPosition } from "../utils/geo";
import { updateStudentProfile, uploadAvatar, signOut } from "../lib/auth";

export default function AccountPage({
  currentUser,
  setCurrentUser,
  setPage,
  setLikedJobs,
  setAppliedJobs,
  setStudentLocation,
}) {

  const [linkedIn, setLinkedIn] = useState(currentUser.linkedIn || "");
  const [cv, setCv] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [bio, setBio] = useState(currentUser.bio || "");
  const [skills, setSkills] = useState(currentUser.skills || []);
  const [skillInput, setSkillInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(currentUser.profilePhoto || "");
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProfilePhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || skills.includes(s)) return;
    setSkills([...skills, s]);
    setSkillInput("");
  };
  const removeSkill = (s) => setSkills(skills.filter(x => x !== s));

  // Location state (students only)
  const saved_loc = currentUser.savedLocation || null;
  const [locationType, setLocationType] = useState(saved_loc?.type || "home");
  const [locationAddress, setLocationAddress] = useState(saved_loc?.address || "");
  const [locationCoords, setLocationCoords] = useState(saved_loc ? { lat: saved_loc.lat, lng: saved_loc.lng, displayName: saved_loc.displayName } : null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manualLine1, setManualLine1] = useState("");
  const [manualLine2, setManualLine2] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualCounty, setManualCounty] = useState("");

  const applyGeoResult = (result) => {
    setLocationCoords(result);
    setLocationAddress(result.displayName);
    setLocationError("");
    setShowManual(false);
  };

  const handleGeocode = async () => {
    if (!locationAddress.trim()) { setLocationError("Enter an Eircode or address first."); return; }
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(locationAddress + ", Ireland");
    setLocationLoading(false);
    if (result) {
      applyGeoResult(result);
    } else {
      setLocationError("Eircode not found. Fill in the address manually below.");
      setShowManual(true);
    }
  };

  const handleManualGeocode = async () => {
    if (!manualLine1.trim() && !manualCity.trim()) { setLocationError("Enter at least the address and city."); return; }
    const fullAddress = [manualLine1, manualLine2, manualCity, manualCounty, "Ireland"].filter(Boolean).join(", ");
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(fullAddress);
    setLocationLoading(false);
    if (result) {
      applyGeoResult(result);
    } else {
      setLocationError("Could not find that address. Try adjusting the details.");
    }
  };

  const handleGPS = async () => {
    setLocationLoading(true);
    setLocationError("");
    const pos = await getCurrentPosition();
    setLocationLoading(false);
    if (pos) {
      setLocationCoords({ lat: pos.lat, lng: pos.lng, displayName: "Your current GPS location" });
      setLocationAddress("GPS location");
      setShowManual(false);
    } else {
      setLocationError("Could not get GPS location. Check browser permissions.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      let photoUrl = currentUser.profilePhoto;

      // Upload new profile photo if one was picked (skip silently on timeout)
      if (profilePhotoFile) {
        try {
          photoUrl = await uploadAvatar(currentUser.id, profilePhotoFile);
        } catch (e) {
          console.warn("Photo upload skipped:", e.message);
        }
      }

      const savedLocation = (currentUser.role === "student" && locationCoords)
        ? { type: locationType, address: locationAddress, lat: locationCoords.lat, lng: locationCoords.lng, displayName: locationCoords.displayName }
        : currentUser.savedLocation || null;

      const updates = {
        bio,
        skills,
        linkedin:          linkedIn,
        cv_url:            cv ? cv.name : currentUser.cvName,
        cover_letter_url:  coverLetter ? coverLetter.name : currentUser.coverLetterName,
        profile_photo_url: photoUrl,
        location_lat:      savedLocation?.lat    || null,
        location_lng:      savedLocation?.lng    || null,
        location_display:  savedLocation?.displayName || null,
      };

      await updateStudentProfile(currentUser.id, updates);

      const updatedUser = {
        ...currentUser,
        linkedIn,
        cvName:           updates.cv_url,
        coverLetterName:  updates.cover_letter_url,
        bio,
        skills,
        savedLocation,
        profilePhoto:     photoUrl,
      };

      setCurrentUser(updatedUser);
      if (setStudentLocation) setStudentLocation(savedLocation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => setShowLogoutModal(true);

  const confirmLogout = async () => {
    try { await signOut(); } catch (_) {}
    setCurrentUser(null);
    setLikedJobs([]);
    setAppliedJobs([]);
    setPage("studentDashboard");
  };

  const goBack = () => setPage(currentUser.role === "student" ? "studentDashboard" : "companyDashboard");

  return (
    <PageWrapper>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>

        {/* Profile photo */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{ width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden", border: "3px solid #e2e8f0", backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              {profilePhoto
                ? <img src={profilePhoto} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <PersonIcon />
              }
            </div>
            <label style={{ position: "absolute", bottom: "2px", right: "2px", width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.7rem" }}>
              📷
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </label>
          </div>
          <p style={{ margin: "0.6rem 0 0.1rem", fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>{currentUser.name}</p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>{currentUser.email}</p>
        </div>

        {/* Basic Info */}
        <Section title="Account Details">
          <InfoRow label="Name" value={currentUser.name} />
          <InfoRow label="Email" value={currentUser.email} />
          <InfoRow label="Role" value={currentUser.role === "student" ? "Student" : "Company"} />
        </Section>

        {/* Verification docs uploaded at signup */}
        {currentUser.role === "student" && (
          <Section title="Verification Documents">
            <DocRow label="Student ID Card" filename={currentUser.studentIdCardName} />
            <DocRow label="Government ID" filename={currentUser.governmentIdName} />
          </Section>
        )}

        {/* My Location — students only */}
        {currentUser.role === "student" && (
          <Section title="My Location">
            <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "0.9rem" }}>
              Set your address so we can show job distances. Your location is never shared publicly.
            </p>

            {/* Address type selector */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
              {[["home", "🏠 Home"], ["college", "🎓 College / Accom"], ["local", "📍 Local Address"]].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLocationType(val)}
                  style={{
                    padding: "0.35rem 0.85rem", borderRadius: "0.5rem", cursor: "pointer",
                    border: `1.5px solid ${locationType === val ? "#3b82f6" : "#d1d5db"}`,
                    backgroundColor: locationType === val ? "#eff6ff" : "white",
                    color: locationType === val ? "#1d4ed8" : "#374151",
                    fontWeight: locationType === val ? "700" : "500",
                    fontSize: "0.8rem",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Eircode input row */}
            <label style={labelStyle}>
              {locationType === "home" ? "Home Address" : locationType === "college" ? "College / Accommodation Address" : "Local Address"}
              <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem", marginLeft: "0.4rem" }}>(Eircode)</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
              <input
                placeholder="Eircode"
                value={locationAddress}
                onChange={e => { setLocationAddress(e.target.value); setLocationCoords(null); setShowManual(false); }}
                onKeyDown={e => e.key === "Enter" && handleGeocode()}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button
                type="button"
                onClick={handleGeocode}
                disabled={locationLoading}
                style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.85rem", cursor: locationLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
              >
                {locationLoading ? "…" : "Find"}
              </button>
            </div>

            {/* Confirmed coords */}
            {locationCoords && !showManual && (
              <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", marginBottom: "0.4rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700" }}>✓ Location found</span>
                <p style={{ color: "#374151", margin: "0.15rem 0 0", fontSize: "0.7rem" }}>{locationCoords.displayName}</p>
              </div>
            )}

            {/* Error */}
            {locationError && (
              <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 0.4rem" }}>{locationError}</p>
            )}

            {/* Manual address toggle */}
            {!showManual && !locationCoords && (
              <button type="button" onClick={() => setShowManual(true)} style={{ background: "none", border: "none", padding: 0, color: "#6b7280", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", marginBottom: "0.5rem" }}>
                Enter address manually instead
              </button>
            )}

            {/* Manual address form */}
            {showManual && (
              <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#374151", marginBottom: "0.6rem" }}>Enter address manually</p>
                <input value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
                <input value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
                <input value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
                <input value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" onClick={handleManualGeocode} disabled={locationLoading} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: locationLoading ? "not-allowed" : "pointer" }}>
                    {locationLoading ? "Finding…" : "Find Address"}
                  </button>
                  <button type="button" onClick={() => setShowManual(false)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "white", color: "#6b7280", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* GPS fallback */}
            <button
              type="button"
              onClick={handleGPS}
              disabled={locationLoading}
              style={{ padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.8rem", cursor: locationLoading ? "not-allowed" : "pointer", marginBottom: "0.4rem" }}
            >
              📡 Use my current GPS location
            </button>
          </Section>
        )}

        {/* Profile section — CV, Cover Letter, LinkedIn, Bio, Skills */}
        {currentUser.role === "student" && (
          <Section title="My Profile">
            {/* Completeness bar */}
            {(() => {
              const fields = [
                { label: "CV",           done: !!(currentUser.cvName || cv) },
                { label: "Location",     done: !!locationCoords },
                { label: "Bio",          done: !!bio.trim() },
                { label: "Skills",       done: skills.length > 0 },
                { label: "LinkedIn",     done: !!linkedIn.trim() },
              ];
              const done = fields.filter(f => f.done).length;
              const pct  = Math.round((done / fields.length) * 100);
              const col  = pct >= 80 ? "#16a34a" : pct >= 40 ? "#d97706" : "#ef4444";
              return (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "#374151" }}>Profile Completeness</span>
                    <span style={{ fontSize: "0.8rem", fontWeight: "700", color: col }}>{done}/{fields.length}</span>
                  </div>
                  <div style={{ height: "8px", backgroundColor: "#e5e7eb", borderRadius: "999px", overflow: "hidden", marginBottom: "0.45rem" }}>
                    <div style={{ height: "100%", width: pct + "%", backgroundColor: col, borderRadius: "999px", transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {fields.map(f => (
                      <span key={f.label} style={{ fontSize: "0.7rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: f.done ? "#dcfce7" : "#f3f4f6", color: f.done ? "#16a34a" : "#9ca3af" }}>
                        {f.done ? "✓" : "○"} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <FileUpload
              label="CV"
              hint=".pdf or .docx — required to apply for jobs"
              accept=".pdf,.doc,.docx"
              onChange={setCv}
              file={cv}
              existingName={currentUser.cvName}
              required
            />

            <FileUpload
              label="Cover Letter"
              hint=".pdf or .docx — optional"
              accept=".pdf,.doc,.docx"
              onChange={setCoverLetter}
              file={coverLetter}
              existingName={currentUser.coverLetterName}
            />

            <label style={labelStyle}>LinkedIn URL <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional)</span></label>
            <input
              placeholder="https://linkedin.com/in/yourname"
              value={linkedIn}
              onChange={e => setLinkedIn(e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>Short Bio <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional)</span></label>
            <textarea
              placeholder="Tell employers a bit about yourself…"
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
            />

            <label style={labelStyle}>Skills <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional — press Enter to add)</span></label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                placeholder="e.g. Customer Service"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
              />
              <button type="button" onClick={addSkill} style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer" }}>
                + Add
              </button>
            </div>
            {skills.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
                {skills.map(s => (
                  <span key={s} style={{ fontSize: "0.8rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #bfdbfe", borderRadius: "999px", padding: "0.2rem 0.6rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    {s}
                    <button onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: "0.75rem", padding: 0, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}

            {saveError && (
              <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.6rem 0.9rem", marginBottom: "0.75rem", color: "#e11d48", fontSize: "0.85rem", fontWeight: "500" }}>
                {saveError}
              </div>
            )}
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
              {saved ? "✓ Saved!" : saving ? "Saving…" : "Save Profile"}
            </button>
          </Section>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button onClick={goBack} style={btnGray}>Back to Dashboard</button>
          <button onClick={handleLogout} style={btnRed}>Logout</button>
        </div>
      </div>
      {/* Logout modal */}
      {showLogoutModal && (
        <div onClick={() => setShowLogoutModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff1f2", border: "2px solid #fecdd3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>
              👋
            </div>
            <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.35rem", color: "#1e293b" }}>Log out?</h3>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem", margin: "0 0 1.5rem" }}>
              You'll need to sign back in to access your account.
            </p>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
              >
                Stay
              </button>
              <button
                onClick={confirmLogout}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: "#f43f5e", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
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

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.75rem", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
      <p style={{ fontWeight: "700", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b7280", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.95rem" }}>
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
        ? <span style={{ color: "#16a34a", fontWeight: "600" }}>✓ {filename}</span>
        : <span style={{ color: "#ef4444", fontWeight: "600" }}>Not uploaded</span>
      }
    </div>
  );
}

function FileUpload({ label, hint, accept, onChange, file, existingName, required }) {
  const hasFile = file || existingName;
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label style={{ display: "block", fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem", color: "#374151" }}>
        {label} {required && !existingName && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.35rem" }}>{hint}</p>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        border: `1.5px dashed ${hasFile ? "#22c55e" : "#d1d5db"}`,
        borderRadius: "0.5rem", padding: "0.5rem 0.75rem",
        backgroundColor: hasFile ? "#f0fdf4" : "white",
      }}>
        <label style={{ cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", color: "#3b82f6", whiteSpace: "nowrap" }}>
          {hasFile ? "Change" : "Choose file"}
          <input type="file" accept={accept} style={{ display: "none" }} onChange={e => onChange(e.target.files[0] || null)} />
        </label>
        <span style={{ fontSize: "0.8rem", color: hasFile ? "#16a34a" : "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file ? `✓ ${file.name}` : existingName ? `✓ ${existingName}` : "No file chosen"}
        </span>
      </div>
    </div>
  );
}

const labelStyle  = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.3rem" };
const inputStyle  = { width: "100%", padding: "0.6rem 0.75rem", marginBottom: "1rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" };
const btnBase     = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit" };
const btnPrimary  = { ...btnBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" };
const btnGray     = { ...btnBase, backgroundColor: "#64748b" };
const btnRed      = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" };
