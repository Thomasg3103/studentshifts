import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import { useFocusTrap } from "../hooks/useFocusTrap";

const REASONS = [
  "Fake profile / spam",
  "Inappropriate content",
  "Scam or fraud",
  "Harassment or abuse",
  "Misleading information",
  "Underage user",
  "Other",
];

export default function ReportModal({ targetType, targetId, targetName, onClose }) {
  const [reason,      setReason]      = useState("");
  const [detail,      setDetail]      = useState("");
  const [screenshots, setScreenshots] = useState([]); // File[]
  const [previews,    setPreviews]    = useState([]); // object URL[]
  const [submitting,  setSubmitting]  = useState(false);
  const modalRef  = useRef(null);
  const fileRef   = useRef(null);
  useFocusTrap(modalRef, onClose, true);

  const handleFiles = (e) => {
    const incoming = Array.from(e.target.files);
    e.target.value = "";
    const allowed  = incoming.slice(0, 3 - screenshots.length);
    const newPrev  = allowed.map(f => URL.createObjectURL(f));
    setScreenshots(prev => [...prev, ...allowed].slice(0, 3));
    setPreviews(prev => [...prev, ...newPrev].slice(0, 3));
  };

  const removeScreenshot = (i) => {
    URL.revokeObjectURL(previews[i]);
    setScreenshots(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    const full = reason === "Other"
      ? detail.trim()
      : reason + (detail.trim() ? ` — ${detail.trim()}` : "");
    if (!full) { toast.error("Please select a reason."); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let screenshotUrls = [];
      for (const file of screenshots) {
        const ext  = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("report-screenshots")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage
            .from("report-screenshots")
            .getPublicUrl(path);
          screenshotUrls.push(publicUrl);
        }
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id:     user.id,
        target_type:     targetType,
        target_id:       targetId,
        reason:          full,
        screenshot_urls: screenshotUrls.length ? screenshotUrls : null,
      });
      if (error) throw error;
      toast.success("Report submitted — our team will review it.");
      onClose();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem" }}>
      <div ref={modalRef} role="dialog" aria-modal="true" style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.5rem 1.75rem", maxWidth: "420px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <p style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#0f172a" }}>Report {targetName}</p>
        <p style={{ margin: "0 0 1rem", fontSize: "0.83rem", color: "#64748b" }}>Select a reason — our admin team will review this report.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.9rem" }}>
          {REASONS.map(r => (
            <label key={r} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.7rem", borderRadius: "0.5rem", border: `1.5px solid ${reason === r ? "#e11d48" : "#e2e8f0"}`, backgroundColor: reason === r ? "#fff1f2" : "white", cursor: "pointer", fontSize: "0.86rem", fontWeight: reason === r ? "700" : "500", color: reason === r ? "#be123c" : "#374151" }}>
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} style={{ accentColor: "#e11d48" }} />
              {r}
            </label>
          ))}
        </div>

        {reason && (
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder={reason === "Other" ? "Describe the issue…" : "Extra details (optional)…"}
            maxLength={500}
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: "0.75rem" }}
          />
        )}

        <div style={{ marginBottom: "0.9rem" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.78rem", fontWeight: "700", color: "#64748b" }}>
            Screenshots <span style={{ fontWeight: "400", color: "#94a3b8" }}>(optional · max 3)</span>
          </p>
          {previews.length > 0 && (
            <div style={{ display: "flex", gap: "0.45rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
              {previews.map((src, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={src} alt={`screenshot ${i + 1}`} style={{ width: "72px", height: "72px", objectFit: "cover", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", display: "block" }} />
                  <button
                    type="button"
                    onClick={() => removeScreenshot(i)}
                    aria-label="Remove screenshot"
                    style={{ position: "absolute", top: "-6px", right: "-6px", width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "#e11d48", color: "white", fontSize: "0.7rem", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {screenshots.length < 3 && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{ padding: "0.4rem 0.85rem", borderRadius: "0.45rem", border: "1.5px dashed #cbd5e1", background: "white", color: "#475569", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}
              >+ Add screenshot</button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", background: "white", color: "#374151", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!reason || submitting} style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", background: "#e11d48", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", opacity: !reason || submitting ? 0.55 : 1 }}>{submitting ? "Submitting…" : "Submit Report"}</button>
        </div>
      </div>
    </div>
  );
}
