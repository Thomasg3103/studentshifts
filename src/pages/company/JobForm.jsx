import { useState, useRef, useEffect } from "react";
import RichTextEditor from "../../components/RichTextEditor";
import { geocodeAddress } from "../../utils/geo";
import { jobCategories } from "../../data/jobCategories";
import { weekdays, timeSlots } from "./shared";

/* ─── Local style constants (used only in JobForm) ───────────────────────── */

const labelStyle = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "#374151", marginBottom: "0.25rem" };
const inputStyle  = { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" };

const btnBase  = { padding: "0.6rem 1.1rem", borderRadius: "0.5rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit", letterSpacing: "-0.01em" };
const btnGreen = { ...btnBase, backgroundColor: "#059669" };
const btnGray  = { ...btnBase, backgroundColor: "#64748b" };
const zoomBtn  = { padding: "0.2rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" };

/* ─── JobForm ────────────────────────────────────────────────────────────── */

export default function JobForm({ formData, setFormData, onSave, onCancel, toggleDay, formSaving }) {
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
        <label htmlFor="form-category" style={labelStyle}>Job Category *</label>
        <select id="form-category" value={formData.category || ""} onChange={handleCategoryChange} style={inputStyle}>
          <option value="">Select a category…</option>
          {categoryNames.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Title — locked until category chosen */}
      <div>
        <label htmlFor="form-title" style={labelStyle}>Job Title *</label>
        <select
          id="form-title"
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
        <label htmlFor="form-location" style={labelStyle}>Location * <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(Eircode or full address)</span></label>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <input
            id="form-location"
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
            <input aria-label="Address line 1" value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="Address line 2" value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="Town or city" value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="County" value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
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
        <label htmlFor="form-pay" style={labelStyle}>Pay *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#374151", fontWeight: "600", pointerEvents: "none" }}>€</span>
          <input
            id="form-pay"
            type="number"
            min="0"
            max="999"
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
        <RichTextEditor
          value={formData.description || ""}
          onChange={html => setFormData(prev => ({ ...prev, description: html }))}
          placeholder="Describe the role, responsibilities, and what you're looking for…"
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
        <label htmlFor="form-holidays" style={labelStyle}>Holiday Entitlement <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          id="form-holidays"
          type="text"
          value={formData.holidays || ""}
          onChange={e => setFormData(prev => ({ ...prev, holidays: e.target.value }))}
          placeholder="e.g. 20 days per year"
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="form-deadline" style={labelStyle}>Application Deadline <span style={{ fontWeight: "400", color: "#9ca3af", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          id="form-deadline"
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
                    aria-label={`${day} shift start time`}
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
                  <button type="button" onClick={() => { setCrop(safeIdx, { zoom: 1, offsetX: 0, offsetY: 0 }); }} style={{ ...zoomBtn, color: "var(--color-brand)" }}>Reset</button>
                  <button type="button" onClick={() => { const nz = Math.max(1, getCrop(safeIdx).zoom - 0.25); setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>−</button>
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", minWidth: "32px", textAlign: "center" }}>{Math.round(crop.zoom * 100)}%</span>
                  <button type="button" onClick={() => { const nz = Math.min(4, getCrop(safeIdx).zoom + 0.25); setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>+</button>
                </div>
              </div>
              <div
                ref={previewRef}
                style={{ position: "relative", width: "100%", backgroundColor: "#f8fafc", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid #e2e8f0", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
                onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY); }}
                onTouchStart={e => { e.preventDefault(); startDrag(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <img loading="lazy" src={src} alt="preview" draggable={false}
                  style={{ width: "100%", height: "auto", maxHeight: "320px", objectFit: "contain", display: "block", transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center", transition: isDragging ? "none" : "transform 0.1s ease" }}
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
                <div key={url} onClick={() => setPreviewIndex(i)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "var(--color-brand)" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                  <img loading="lazy" src={url} alt="job photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={e => { e.stopPropagation(); removeExistingPhoto(url); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", color: "white", width: "18px", height: "18px", fontSize: "0.65rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                </div>
              );
            })}
            {photoFiles.map((file, i) => {
              const globalIdx = existingPhotos.length + i;
              const isActive = Math.min(previewIndex, existingPhotos.length + photoFiles.length - 1) === globalIdx;
              return (
                <div key={i} onClick={() => setPreviewIndex(globalIdx)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "var(--color-brand)" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                  <img loading="lazy" src={URL.createObjectURL(file)} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
          <label htmlFor="form-status" style={labelStyle}>Status</label>
          <select id="form-status" value={formData.status} onChange={set("status")} style={inputStyle}>
            <option value="Active">Active</option>
            <option value="Closed">Closed</option>
            <option value="Expired">Expired</option>
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
