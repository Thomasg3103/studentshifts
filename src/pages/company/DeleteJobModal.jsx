import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const optBtn = (color, bg, border) => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start",
  gap: "0.15rem", padding: "0.75rem 1rem", borderRadius: "0.6rem",
  border: `1.5px solid ${border}`, backgroundColor: bg,
  color, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
});

export function DeleteJobModal({ posting, onClose, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose);

  const confirm = async () => {
    setConfirming(true);
    try { await onDelete(); onClose(); }
    catch { toast.error("Failed to delete job. Please try again."); }
    finally { setConfirming(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.5)", zIndex: 1200 }} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Delete Job" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1201, backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", padding: "1.75rem", width: "min(420px,90vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary, #1e293b)" }}>Delete "{posting.title}"?</h3>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>Why are you deleting this posting? This cannot be undone.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <button onClick={confirm} disabled={confirming} style={optBtn("#b91c1c", "#fef2f2", "#fecaca")}>
            <span style={{ fontWeight: "700" }}>Duplicate Posting</span>
            <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>Accidentally posted the same job twice</span>
          </button>
          <button onClick={confirm} disabled={confirming} style={optBtn("#0369a1", "#f0f9ff", "#bae6fd")}>
            <span style={{ fontWeight: "700" }}>Posted by Mistake</span>
            <span style={{ fontSize: "0.75rem", color: "#0369a1" }}>Test posting or wrong details entered</span>
          </button>
          <button onClick={confirm} disabled={confirming} style={optBtn("#64748b", "#f8fafc", "#e2e8f0")}>
            <span style={{ fontWeight: "700" }}>Position No Longer Available</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>Role was cancelled or filled another way</span>
          </button>
        </div>
        <button onClick={onClose} disabled={confirming} style={{ marginTop: "1rem", width: "100%", padding: "0.55rem", borderRadius: "0.5rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </>
  );
}
