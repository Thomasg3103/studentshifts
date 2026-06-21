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
  const [reason,     setReason]     = useState("");
  const [detail,     setDetail]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose, true);

  const handleSubmit = async () => {
    const full = reason === "Other"
      ? detail.trim()
      : reason + (detail.trim() ? ` — ${detail.trim()}` : "");
    if (!full) { toast.error("Please select a reason."); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id:   targetId,
        reason:      full,
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
      <div ref={modalRef} role="dialog" aria-modal="true" style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.5rem 1.75rem", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
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
            style={{ width: "100%", boxSizing: "border-box", padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", resize: "vertical", outline: "none", marginBottom: "0.9rem" }}
          />
        )}

        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", background: "white", color: "#374151", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!reason || submitting} style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", background: "#e11d48", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", opacity: !reason || submitting ? 0.55 : 1 }}>{submitting ? "Submitting…" : "Submit Report"}</button>
        </div>
      </div>
    </div>
  );
}
