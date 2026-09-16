/*
 * ============================================================================
 * JobForm — the job posting create/edit form
 * ============================================================================
 * This is the form behind "Post a Job" and "Edit" on the company dashboard.
 * It's a fairly large, self-contained piece of UI covering:
 *
 *   - Category & Title — category picks from a fixed list (data/jobCategories.js);
 *     title options depend on the chosen category. Both support an "Other…" free-text
 *     fallback for categories/titles that aren't in the preset lists (see the
 *     customCategory/customTitle state below).
 *   - Live match count — as the company sets category/skills, a debounced call
 *     to a Supabase RPC shows how many verified students currently match, so
 *     they get early warning if a category is too narrow.
 *   - Location — takes an Eircode/address, geocodes it via geocodeAddress() to
 *     get lat/lng for map/distance features, with a manual fallback form if
 *     geocoding fails.
 *   - Days & shift times — pick which weekdays the job needs covering and an
 *     optional start time per day; a "Weekend Required" toggle auto-selects
 *     Saturday & Sunday.
 *   - Photos — up to 10 photos. Every newly added photo goes through a crop
 *     modal (react-easy-crop) before being attached to the form; existing saved
 *     photos get a separate lightweight drag-to-reposition/zoom preview instead
 *     of the full crop modal.
 *   - Screening questions — up to 5 yes/no or free-text questions shown to
 *     applicants, with an optional "knockout" flag on yes/no questions.
 *
 * IMPORTANT: `formData` and `setFormData` are owned by the parent (CompanyDashboard),
 * not local state — this component just reads/writes into that shared object, plus
 * a handful of purely-local UI states (crop modal, location search box, etc.)
 * that don't need to live in the saved form data itself.
 * ============================================================================
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import toast from "react-hot-toast";
import RichTextEditor from "../../components/RichTextEditor";
import { geocodeAddress } from "../../utils/geo";
import { jobCategories } from "../../data/jobCategories";
import { weekdays, timeSlots } from "./shared";
import { supabase } from "../../lib/supabase";

// Downscales + crops an image client-side (canvas) to the pixel rect chosen in
// the crop modal, capping the output width at 1800px so uploaded job photos
// don't bloat storage/bandwidth with unnecessarily huge originals.
async function getCroppedBlobRect(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const maxW = 1800;
  const scale = Math.min(1, maxW / pixelCrop.width);
  canvas.width  = Math.round(pixelCrop.width  * scale);
  canvas.height = Math.round(pixelCrop.height * scale);
  canvas.getContext("2d").drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

/* ─── Local style constants (used only in JobForm) ───────────────────────── */

const labelStyle = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-body, #374151)", marginBottom: "0.25rem" };
const inputStyle  = { width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)" };

const btnBase  = { padding: "0.6rem 1.1rem", borderRadius: "0.5rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.875rem", fontFamily: "inherit", letterSpacing: "-0.01em" };
const btnGreen = { ...btnBase, backgroundColor: "#059669" };
const btnGray  = { ...btnBase, backgroundColor: "#64748b" };
const zoomBtn  = { padding: "0.2rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" };

/* ─── JobForm ────────────────────────────────────────────────────────────── */

export default function JobForm({ formData, setFormData, onSave, onCancel, toggleDay, formSaving }) {
  const isEdit = !!formData.id;
  const set = (key) => (e) => setFormData(prev => ({ ...prev, [key]: e.target.value }));

  // ── Live "students matching this category" preview ──────────────────────
  // Shows a banner (rendered further down) telling the company roughly how many
  // verified students would currently match this job's category/skills — helps
  // them notice early if they've picked too narrow a category before posting.
  //
  // Debounced: every keystroke/change to category or skills resets a 600ms
  // timer rather than firing a Supabase RPC call on every change, so typing
  // quickly (or picking through several categories) doesn't spam the database
  // with a request per change — only the final settled value gets queried.
  const [matchCount, setMatchCount] = useState(null);
  const matchTimerRef = useRef(null);

  useEffect(() => {
    // Clear immediately on any category/skills change (not just when cleared entirely) so the
    // banner never shows a stale count from the previous category while the new one is fetching.
    setMatchCount(null);
    if (!formData.category) return;
    clearTimeout(matchTimerRef.current);
    matchTimerRef.current = setTimeout(() => {
      supabase.rpc("count_matching_students", { p_skills: formData.skills || [], p_category: formData.category || "" })
        .then(({ data }) => { if (data !== null) setMatchCount(data); })
        .catch(() => {});
    }, 600);
    // Cleanup cancels any pending timer if the component unmounts or the effect
    // re-runs before the 600ms elapses (i.e. the debounce itself).
    return () => clearTimeout(matchTimerRef.current);
  }, [formData.category, formData.skills]);

  const categoryNames = Object.keys(jobCategories);

  // ── Photo preview state ──────────────────────────────────────────────────
  // This is a SEPARATE, lighter-weight reposition/zoom control from the crop
  // modal below — it applies to the currently-selected thumbnail (existing or
  // newly-cropped) and just stores an offset/zoom transform (cropSettings),
  // rather than actually re-cropping the image file. Initialised from any crops
  // already saved on the posting (formData.photoCrops) when editing an existing job.
  const [previewIndex, setPreviewIndex] = useState(0);
  const [cropSettings, setCropSettings] = useState(() => {
    const saved = formData.photoCrops || [];
    const init = {};
    saved.forEach((c, i) => { if (c) init[i] = c; });
    return init;
  });
  const [isDragging, setIsDragging]     = useState(false);
  const previewRef  = useRef(null);
  // Not React state on purpose — drag start position needs to be read/written
  // synchronously inside the mousemove handler without waiting for a re-render.
  const dragRef     = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0, idx: 0 });

  // ── Crop modal flow ───────────────────────────────────────────────────────
  // When a company picks new photo files, each one goes through a full crop
  // modal (react-easy-crop, 4:3 aspect) one at a time. `cropQueue` holds the
  // remaining files still waiting to be cropped after the current one is
  // confirmed, so multi-file uploads step through the modal sequentially
  // instead of trying to crop them all at once.
  const [cropQueue, setCropQueue]                   = useState([]);
  const [activeCropFile, setActiveCropFile]         = useState(null);
  const [activeCropSrc, setActiveCropSrc]           = useState(null);
  const [jobCrop, setJobCrop]                       = useState({ x: 0, y: 0 });
  const [jobCropZoom, setJobCropZoom]               = useState(1);
  const [jobCroppedAreaPixels, setJobCroppedAreaPixels] = useState(null);
  // react-easy-crop reports the crop rectangle in raw pixels via this callback;
  // memoized so the Cropper component doesn't re-subscribe on every render.
  const onJobCropComplete = useCallback((_, pixels) => setJobCroppedAreaPixels(pixels), []);

  // Kicks off the crop modal for one file, reading it into a data URL for the
  // Cropper to display. `queue` is whatever files are still waiting after this one.
  const openCropForFile = (file, queue = []) => {
    setCropQueue(queue);
    setActiveCropFile(file);
    const reader = new FileReader();
    reader.onload = ev => { setActiveCropSrc(ev.target.result); setJobCrop({ x: 0, y: 0 }); setJobCropZoom(1); };
    reader.readAsDataURL(file);
  };

  // Confirms the crop for the file currently in the modal: crops it to a real
  // JPEG File object and appends it to formData.photoFiles, then — if there are
  // more files queued from a multi-select — immediately opens the modal again
  // for the next one, chaining through the whole queue.
  const handleJobCropConfirm = async () => {
    if (!activeCropSrc || !jobCroppedAreaPixels) return;
    const blob = await getCroppedBlobRect(activeCropSrc, jobCroppedAreaPixels);
    const croppedFile = new File([blob], activeCropFile.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
    setFormData(prev => ({ ...prev, photoFiles: [...(prev.photoFiles || []), croppedFile] }));
    setActiveCropSrc(null);
    setActiveCropFile(null);
    if (cropQueue.length > 0) {
      const [next, ...rest] = cropQueue;
      openCropForFile(next, rest);
    }
  };

  const getCrop = (idx) => cropSettings[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
  const setCrop = (idx, patch) => setCropSettings(prev => ({ ...prev, [idx]: { ...(prev[idx] || { zoom: 1, offsetX: 0, offsetY: 0 }), ...patch } }));

  // Begins a drag-to-reposition gesture on the banner preview (see the mousemove
  // listener just below, which does the actual dragging math).
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

  // Global mouse/touch listeners for the drag-to-reposition preview — attached
  // to `window` (not the preview element) so dragging still tracks correctly
  // even if the cursor moves outside the small preview box mid-drag.
  useEffect(() => {
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      if (e.touches && e.cancelable) e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      if (!previewRef.current) return;
      const { width, height } = previewRef.current.getBoundingClientRect();
      // Store as percentage of container so it scales correctly on any screen size
      setCropSettings(prev => {
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

  // ── Custom category/title toggle logic ───────────────────────────────────
  // Both the category and title fields render as a <select> of preset options
  // plus an "Other…" entry. Picking "Other…" flips these booleans to true,
  // which swaps the dropdown for a free-text <input> instead (rendered further
  // down). The initial value is inferred from formData itself: if a job was
  // saved with a category/title that ISN'T in the current preset lists (e.g.
  // jobCategories was edited after this job was posted, or it's genuinely a
  // custom value), the toggle starts "on" so editing shows the text input
  // pre-filled with that value rather than silently losing it in a dropdown
  // that doesn't contain it.
  const [customCategory, setCustomCategory] = useState(() => !!formData.category && !categoryNames.includes(formData.category));
  const [customTitle, setCustomTitle] = useState(() => !!formData.title && !!formData.category && !(jobCategories[formData.category] || []).includes(formData.title));

  // Changing category always clears the title — the previous title likely
  // doesn't exist in the new category's title list (or doesn't make sense
  // anymore), so the company must re-pick it.
  const handleCategoryChange = (e) => {
    setCustomTitle(false);
    setFormData(prev => ({ ...prev, category: e.target.value, title: "" }));
  };

  // Photos: existing URLs (edit mode) + new File objects to upload
  const photoFiles     = formData.photoFiles || [];
  const existingPhotos = (formData.photos    || []).filter(p => typeof p === "string" && p.startsWith("http"));
  const totalPhotos    = existingPhotos.length + photoFiles.length;

  // URL.createObjectURL() creates a browser-memory reference to each File object
  // for use as an <img src>. These must be explicitly revoked when no longer
  // needed (they aren't garbage-collected automatically), otherwise every photo
  // swap during a long editing session would leak memory — the cleanup effect
  // below handles that whenever the file list changes or the form unmounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const photoObjectUrls = useMemo(() => photoFiles.map(f => URL.createObjectURL(f)), [formData.photoFiles]);
  useEffect(() => () => photoObjectUrls.forEach(u => URL.revokeObjectURL(u)), [photoObjectUrls]);

  const ALLOWED_PHOTO_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

  // Validates each newly-selected file (type + size), silently drops invalid
  // ones (with a toast listing what was skipped), then hands the first valid
  // file off to the crop modal — the rest wait in the queue (see openCropForFile).
  const handlePhotoAdd = (e) => {
    const incoming  = Array.from(e.target.files);
    const remaining = 10 - totalPhotos;
    if (remaining <= 0) return;
    const valid = [];
    const skipped = [];
    for (const file of incoming) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_PHOTO_EXTS.has(ext)) { skipped.push(`${file.name} (unsupported type)`); continue; }
      if (file.size > MAX_PHOTO_BYTES)  { skipped.push(`${file.name} (exceeds 5 MB)`); continue; }
      valid.push(file);
    }
    if (skipped.length > 0) toast.error(`Skipped: ${skipped.join(", ")}`);
    e.target.value = "";
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length === 0) return;
    const [first, ...rest] = toAdd;
    openCropForFile(first, rest);
  };

  const removeExistingPhoto = (url) => {
    setFormData(prev => ({ ...prev, photos: existingPhotos.filter(u => u !== url) }));
  };

  const removeNewPhoto = (index) => {
    setFormData(prev => ({ ...prev, photoFiles: photoFiles.filter((_, i) => i !== index) }));
  };

  // ── Location geocoding ────────────────────────────────────────────────────
  // The company types an Eircode or address; geocodeAddress() (a Google/other
  // geocoding API wrapper in utils/geo.js) resolves it to a lat/lng pin used
  // for distance calculations and map display on the student side. If that
  // lookup fails, the manual address form below lets them enter a structured
  // address as a fallback attempt, or ultimately just save the location as
  // plain text with no map pin (distances won't show for that job).
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

  // Fallback geocode attempt using the structured manual address fields. If
  // this ALSO fails to resolve to a pin, the location is still saved as plain
  // text (no lat/lng) rather than blocking the company from posting the job.
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
        <select
          id="form-category"
          value={customCategory ? "__other__" : (formData.category || "")}
          onChange={e => {
            if (e.target.value === "__other__") {
              setCustomCategory(true);
              setCustomTitle(false);
              setFormData(prev => ({ ...prev, category: "", title: "" }));
            } else {
              setCustomCategory(false);
              handleCategoryChange(e);
            }
          }}
          style={inputStyle}
        >
          <option value="">Select a category…</option>
          {categoryNames.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
          <option value="__other__">Other…</option>
        </select>
        {customCategory && (
          <input
            type="text"
            value={formData.category || ""}
            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
            placeholder="Enter custom category"
            maxLength={60}
            style={{ ...inputStyle, marginTop: "0.4rem" }}
          />
        )}
      </div>

      {/* Skills gap preview */}
      {matchCount !== null && formData.category && (
        <div style={{ padding: "0.5rem 0.75rem", borderRadius: "0.55rem", border: `1.5px solid ${matchCount < 5 ? "#fca5a5" : matchCount < 20 ? "#fcd34d" : "#86efac"}`, backgroundColor: matchCount < 5 ? "#fff1f2" : matchCount < 20 ? "#fffbeb" : "#f0fdf4" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: matchCount < 5 ? "#b91c1c" : matchCount < 20 ? "#92400e" : "#15803d" }}>
            {matchCount < 5
              ? `⚠ Only ${matchCount} verified student${matchCount !== 1 ? "s" : ""} match this category — consider broadening.`
              : `✓ ${matchCount} verified students match this category.`}
          </p>
        </div>
      )}

      {/* Title — locked until category chosen */}
      <div>
        <label htmlFor="form-title" style={labelStyle}>Job Title *</label>
        <select
          id="form-title"
          value={customTitle ? "__other__" : (formData.title || "")}
          onChange={e => {
            if (e.target.value === "__other__") {
              setCustomTitle(true);
              setFormData(prev => ({ ...prev, title: "" }));
            } else {
              setCustomTitle(false);
              set("title")(e);
            }
          }}
          disabled={!formData.category}
          style={{ ...inputStyle, color: formData.category ? "#111827" : "#64748b", cursor: formData.category ? "pointer" : "not-allowed" }}
        >
          <option value="">{formData.category ? "Select a title…" : "Select a category first"}</option>
          {titlesForCategory.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
          {formData.category && <option value="__other__">Other…</option>}
        </select>
        {customTitle && (
          <input
            type="text"
            value={formData.title || ""}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter custom job title"
            maxLength={100}
            style={{ ...inputStyle, marginTop: "0.4rem" }}
          />
        )}
      </div>

      {/* Location with geocoding */}
      <div>
        <label htmlFor="form-location" style={labelStyle}>Location * <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem" }}>(Eircode or full address)</span></label>
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
            <p style={{ fontSize: "0.7rem", color: "var(--color-text-body, #374151)", margin: "0.15rem 0 0" }}>{formData.location}</p>
          </div>
        )}

        {/* Error + manual toggle */}
        {locError && (
          <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0 0 0.3rem" }}>{locError}</p>
        )}
        {!showManual && !formData.lat && (
          <button type="button" onClick={() => setShowManual(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--color-text-secondary, #6b7280)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}>
            Enter address manually instead
          </button>
        )}

        {/* Manual address form */}
        {showManual && (
          <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e5e7eb)", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.25rem" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)", marginBottom: "0.6rem" }}>Enter address manually</p>
            <input aria-label="Address line 1" value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="Address line 2" value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="Town or city" value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
            <input aria-label="County" value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={handleManualGeocode} disabled={locLoading} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: locLoading ? "not-allowed" : "pointer" }}>
                {locLoading ? "Finding…" : "Find Address"}
              </button>
              <button type="button" onClick={() => setShowManual(false)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid var(--color-border-light, #d1d5db)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #6b7280)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="form-pay" style={labelStyle}>Pay *</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-body, #374151)", fontWeight: "600", pointerEvents: "none" }}>€</span>
          <input
            id="form-pay"
            type="number"
            min="0.01"
            max="999"
            step="0.50"
            value={formData.pay ? formData.pay.replace(/[^0-9.]/g, "") : ""}
            onChange={e => setFormData(prev => ({ ...prev, pay: e.target.value ? `€${e.target.value}/hr` : "" }))}
            placeholder="12.50"
            style={{ ...inputStyle, paddingLeft: "1.8rem", paddingRight: "2.8rem" }}
          />
          <span style={{ position: "absolute", right: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-secondary, #64748b)", fontSize: "0.82rem", pointerEvents: "none" }}>/hr</span>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Job Description <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem" }}>(optional)</span></label>
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
        <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-body, #374151)" }}>
          Sick pay included
        </span>
      </label>

      {/* Holidays */}
      <div>
        <label htmlFor="form-holidays" style={labelStyle}>Holiday Entitlement <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          id="form-holidays"
          type="text"
          value={formData.holidays || ""}
          onChange={e => setFormData(prev => ({ ...prev, holidays: e.target.value }))}
          placeholder="e.g. 20 days per year"
          maxLength={500}
          style={inputStyle}
        />
      </div>

      <div>
        <label htmlFor="form-deadline" style={labelStyle}>Application Deadline <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem" }}>(optional)</span></label>
        <input
          id="form-deadline"
          type="date"
          value={formData.deadline || ""}
          onChange={set("deadline")}
          min={new Date().toISOString().split("T")[0]}
          max={new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
          style={inputStyle}
        />
      </div>

      {/* Urgent shift toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", padding: "0.6rem 0.75rem", backgroundColor: formData.isUrgent ? "#fff1f2" : "#f9fafb", borderRadius: "0.5rem", border: `1.5px solid ${formData.isUrgent ? "#fca5a5" : "#e5e7eb"}` }}>
        <input
          type="checkbox"
          checked={formData.isUrgent || false}
          onChange={e => setFormData(prev => ({ ...prev, isUrgent: e.target.checked }))}
          style={{ width: "16px", height: "16px", accentColor: "#dc2626", flexShrink: 0 }}
        />
        <div>
          <span style={{ fontWeight: 700, fontSize: "0.875rem", color: formData.isUrgent ? "#dc2626" : "#374151" }}>
            🔴 Urgent — shift needs filling today
          </span>
          <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>
            Shows a red URGENT badge on the job feed to attract fast applicants.
          </p>
        </div>
      </label>

      {/* Weekend required — sits above days so the effect is immediately visible */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", padding: "0.6rem 0.75rem", backgroundColor: formData.weekendRequired ? "#fef3c7" : "#f9fafb", borderRadius: "0.5rem", border: `1.5px solid ${formData.weekendRequired ? "#fbbf24" : "#e5e7eb"}` }}>
        <input
          type="checkbox"
          checked={formData.weekendRequired || false}
          // Checking this box auto-adds Saturday & Sunday to the selected days (and
          // their shift-time entries); unchecking removes them again along with any
          // start times set for those days — so the days list and this toggle stay
          // in sync regardless of which control the company used most recently.
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
        <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-body, #374151)" }}>
          Weekend work required
          <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem", display: "block" }}>Automatically selects Saturday & Sunday below</span>
        </span>
      </label>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Days Available *</label>
          <button
            type="button"
            onClick={() => {
              const allSelected = weekdays.every(d => formData.days.includes(d));
              setFormData(prev => ({
                ...prev,
                days: allSelected ? [] : [...weekdays],
              }));
            }}
            style={{ padding: "0.2rem 0.65rem", borderRadius: "0.4rem", cursor: "pointer", border: `1.5px solid ${weekdays.every(d => formData.days.includes(d)) ? "#3b82f6" : "#d1d5db"}`, backgroundColor: weekdays.every(d => formData.days.includes(d)) ? "#eff6ff" : "var(--color-bg-elevated, white)", color: weekdays.every(d => formData.days.includes(d)) ? "#1d4ed8" : "#374151", fontWeight: "700", fontSize: "0.75rem", fontFamily: "inherit" }}
          >
            All Week
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
          {weekdays.map(day => {
            const active = formData.days.includes(day);
            const isWeekend = day === "Saturday" || day === "Sunday";
            return (
              <button key={day} type="button" onClick={() => toggleDay(day)} style={{
                padding: "0.3rem 0.75rem", borderRadius: "0.4rem", cursor: "pointer",
                border: `1.5px solid ${active ? (isWeekend ? "#f59e0b" : "#3b82f6") : "#d1d5db"}`,
                backgroundColor: active ? (isWeekend ? "#fef3c7" : "#eff6ff") : "var(--color-bg-elevated, white)",
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
          <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem", marginLeft: "0.4rem" }}>
            {totalPhotos}/10 — at least 1 required
          </span>
        </label>

        {/* Banner preview — interactive zoom & pan */}
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (() => {
          const allSrcs = [
            ...existingPhotos,
            ...photoObjectUrls,
          ];
          const safeIdx = Math.min(previewIndex, allSrcs.length - 1);
          const src = allSrcs[safeIdx];
          const crop = getCrop(safeIdx);
          return src ? (
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #6b7280)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>Preview · drag to reposition</p>
                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                  <button type="button" onClick={() => { setCrop(safeIdx, { zoom: 1, offsetX: 0, offsetY: 0 }); }} style={{ ...zoomBtn, color: "var(--color-brand)" }}>Reset</button>
                  <button type="button" onClick={() => { const nz = Math.max(1, getCrop(safeIdx).zoom - 0.25); setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>−</button>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary, #6b7280)", minWidth: "32px", textAlign: "center" }}>{Math.round(crop.zoom * 100)}%</span>
                  <button type="button" onClick={() => { const nz = Math.min(4, getCrop(safeIdx).zoom + 0.25); setCrop(safeIdx, { zoom: nz }); }} style={zoomBtn}>+</button>
                </div>
              </div>
              <div
                ref={previewRef}
                style={{ position: "relative", width: "100%", backgroundColor: "var(--color-bg-surface, #f8fafc)", borderRadius: "0.6rem", overflow: "hidden", border: "1.5px solid var(--color-border-light, #e2e8f0)", cursor: isDragging ? "grabbing" : "grab", userSelect: "none", touchAction: "none" }}
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
        {(existingPhotos.length > 0 || photoFiles.length > 0) && (() => {
          const clampedIdx = Math.min(previewIndex, existingPhotos.length + photoFiles.length - 1);
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem" }}>
              {existingPhotos.map((url, i) => {
                const isActive = clampedIdx === i;
                return (
                  <div key={url} onClick={() => setPreviewIndex(i)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "var(--color-brand)" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                    <img loading="lazy" src={url} alt="job photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" aria-label="Remove photo" onClick={e => { e.stopPropagation(); removeExistingPhoto(url); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%", color: "white", width: "24px", height: "24px", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
              {photoObjectUrls.map((objUrl, i) => {
                const globalIdx = existingPhotos.length + i;
                const isActive = clampedIdx === globalIdx;
                return (
                  <div key={objUrl} onClick={() => setPreviewIndex(globalIdx)} style={{ position: "relative", width: "72px", height: "72px", borderRadius: "0.4rem", overflow: "hidden", border: `2px solid ${isActive ? "var(--color-brand)" : "#d1d5db"}`, cursor: "pointer", boxShadow: isActive ? "0 0 0 2px #f48fb1" : "none" }}>
                    <img loading="lazy" src={objUrl} alt={photoFiles[i]?.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={e => { e.stopPropagation(); removeNewPhoto(i); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.65)", border: "none", borderRadius: "50%", color: "white", width: "24px", height: "24px", fontSize: "0.75rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Add photo button */}
        {totalPhotos < 10 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px dashed var(--color-border-light, #d1d5db)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer" }}>
            + Add Photo{totalPhotos === 0 ? " (required)" : ""}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoAdd} />
          </label>
        )}
        {totalPhotos >= 10 && (
          <p style={{ fontSize: "0.75rem", color: "#d97706", fontWeight: "600" }}>Maximum of 10 photos reached.</p>
        )}
      </div>

      {/* Screening Questions (Option A) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <div>
            <label style={labelStyle}>Screening Questions <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem" }}>(optional)</span></label>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>Up to 5 questions shown to students when applying. Yes/No questions can auto-flag mismatches.</p>
          </div>
        </div>
        {(formData.screeningQuestions || []).map((q, i) => (
          <div key={i} style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.6rem", padding: "0.7rem 0.85rem", marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.45rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "var(--color-text-secondary, #64748b)", paddingTop: "0.1rem", flexShrink: 0 }}>Q{i + 1}</span>
              <input
                placeholder="e.g. Are you over 18?"
                value={q.question}
                onChange={e => {
                  const qs = [...(formData.screeningQuestions || [])];
                  qs[i] = { ...qs[i], question: e.target.value };
                  setFormData(prev => ({ ...prev, screeningQuestions: qs }));
                }}
                maxLength={200}
                style={{ ...inputStyle, padding: "0.4rem 0.6rem", fontSize: "0.82rem", flex: 1 }}
              />
              <button type="button" onClick={() => {
                const qs = (formData.screeningQuestions || []).filter((_, idx) => idx !== i);
                setFormData(prev => ({ ...prev, screeningQuestions: qs }));
              }} style={{ padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1px solid #fca5a5", background: "var(--color-bg-elevated, white)", color: "#b91c1c", fontWeight: "700", fontSize: "0.75rem", cursor: "pointer", flexShrink: 0 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <select value={q.type || "yes_no"} onChange={e => {
                const qs = [...(formData.screeningQuestions || [])];
                qs[i] = { ...qs[i], type: e.target.value };
                setFormData(prev => ({ ...prev, screeningQuestions: qs }));
              }} style={{ padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", fontSize: "0.78rem", fontFamily: "inherit", color: "var(--color-text-body, #374151)", backgroundColor: "var(--color-bg-elevated, white)" }}>
                <option value="yes_no">Yes / No</option>
                <option value="text">Free text</option>
              </select>
              {(q.type || "yes_no") === "yes_no" && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-body, #374151)", cursor: "pointer" }}>
                  <input type="checkbox" checked={q.knockout_if_no || false} onChange={e => {
                    const qs = [...(formData.screeningQuestions || [])];
                    qs[i] = { ...qs[i], knockout_if_no: e.target.checked };
                    setFormData(prev => ({ ...prev, screeningQuestions: qs }));
                  }} style={{ accentColor: "#dc2626", width: "13px", height: "13px" }} />
                  Flag if answered "No"
                </label>
              )}
            </div>
          </div>
        ))}
        {(formData.screeningQuestions || []).length < 5 && (
          <button type="button" onClick={() => {
            const qs = [...(formData.screeningQuestions || []), { question: "", type: "yes_no", knockout_if_no: false }];
            setFormData(prev => ({ ...prev, screeningQuestions: qs }));
          }} style={{ padding: "0.45rem 0.85rem", borderRadius: "0.5rem", border: "1.5px dashed var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
            + Add Question
          </button>
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
            // (allCrops just stores the pan/zoom transform per photo, applied via
            // CSS on display — see JobPostingCard.jsx — rather than actually
            // re-rendering the image pixels, so the original upload stays full quality)
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

      {/* ── Job photo crop modal ── */}
      {activeCropSrc && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem", WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
            <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: "1px solid var(--color-border-light, #e2e8f0)" }}>
              <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>
                Crop photo{cropQueue.length > 0 ? ` (1 of ${cropQueue.length + 1})` : ""}
              </h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>Drag to reposition · Pinch or scroll to zoom</p>
            </div>
            <div style={{ position: "relative", width: "100%", height: "300px", background: "#0f172a" }}>
              <Cropper
                image={activeCropSrc}
                crop={jobCrop}
                zoom={jobCropZoom}
                aspect={4 / 3}
                cropShape="rect"
                showGrid={false}
                onCropChange={setJobCrop}
                onZoomChange={setJobCropZoom}
                onCropComplete={onJobCropComplete}
              />
            </div>
            <div style={{ padding: "0.75rem 1.5rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", flexShrink: 0 }}>Zoom</span>
              <input
                type="range" min={1} max={3} step={0.05} value={jobCropZoom}
                onChange={e => setJobCropZoom(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--color-brand, #a21d54)" }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem 1.25rem" }}>
              <button
                type="button"
                onClick={() => { setActiveCropSrc(null); setActiveCropFile(null); setCropQueue([]); }}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleJobCropConfirm}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
              >{cropQueue.length > 0 ? "Next →" : "Use photo"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
