import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const closeOptBtn = (color, bg, border) => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start",
  gap: "0.15rem", padding: "0.75rem 1rem", borderRadius: "0.6rem",
  border: `1.5px solid ${border}`, backgroundColor: bg,
  color, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
});

export function CloseJobModal({ posting, onClose, onCloseJob }) {
  const [mode, setMode]               = useState(null); // null | "found"
  const [winner, setWinner]           = useState(null);
  const [confirming, setConfirming]   = useState(false);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose);

  const decisionApplicants = posting.applicants.filter(
    a => a.pipelineStage === "decision" && a.status === "Pending"
  );

  const confirm = async (opts) => {
    setConfirming(true);
    try { await onCloseJob(opts); onClose(); }
    catch { toast.error("Failed to close job. Please try again."); }
    finally { setConfirming(false); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.5)", zIndex: 1200 }} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Close Job" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1201, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(420px,90vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

        {mode === null && (<>
          <h3 style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.1rem", color: "#1e293b" }}>Close this Job</h3>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.85rem", color: "#64748b" }}>How did this hiring process end?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button onClick={() => setMode("found")} style={closeOptBtn("var(--color-brand)", "#fce7f3", "#fce7f3")}>
              <span style={{ fontWeight: "700" }}>Found a Student</span>
              <span style={{ fontSize: "0.75rem", color: "var(--color-brand)" }}>Select which student you hired</span>
            </button>
            <button onClick={() => confirm({ foundStudent: false, closeReason: "hired_elsewhere" })} disabled={confirming} style={closeOptBtn("#0369a1", "#f0f9ff", "#bae6fd")}>
              <span style={{ fontWeight: "700" }}>Hired Elsewhere</span>
              <span style={{ fontSize: "0.75rem", color: "#0369a1" }}>Found someone outside StudentShifts</span>
            </button>
            <button onClick={() => confirm({ foundStudent: false, closeReason: "no_longer_needed" })} disabled={confirming} style={closeOptBtn("#64748b", "#f8fafc", "#e2e8f0")}>
              <span style={{ fontWeight: "700" }}>Job No Longer Needed</span>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Position was cancelled or filled internally</span>
            </button>
          </div>
          <button onClick={onClose} style={{ marginTop: "1rem", width: "100%", padding: "0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        </>)}

        {mode === "found" && (<>
          <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: "var(--color-brand)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: "0.75rem" }}>← Back</button>
          <h3 style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Who did you hire?</h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b" }}>They'll get an acceptance email. Everyone else will be declined.</p>
          {decisionApplicants.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", fontStyle: "italic", marginBottom: "1rem" }}>No applicants in the Decision stage yet — advance candidates first.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
              {decisionApplicants.map(a => (
                <button
                  key={a.id}
                  onClick={() => setWinner(a)}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.65rem",
                    padding: "0.6rem 0.85rem", borderRadius: "0.55rem",
                    border: `1.5px solid ${winner?.id === a.id ? "var(--color-brand)" : "#e2e8f0"}`,
                    backgroundColor: winner?.id === a.id ? "#fce7f3" : "white",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {a.profilePhoto
                      ? <img loading="lazy" src={a.profilePhoto} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    }
                  </div>
                  <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "#1e293b" }}>{a.name}</span>
                  {winner?.id === a.id && <span style={{ marginLeft: "auto", color: "var(--color-brand)", fontSize: "0.9rem" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            disabled={!winner || confirming}
            onClick={() => confirm({ foundStudent: true, winnerId: winner.id, winnerApplicant: winner, closeReason: "found_student" })}
            style={{ width: "100%", padding: "0.7rem", borderRadius: "0.6rem", border: "none", backgroundColor: winner ? "var(--color-brand)" : "#e2e8f0", color: winner ? "white" : "#94a3b8", fontWeight: "700", fontSize: "0.875rem", cursor: winner ? "pointer" : "default", fontFamily: "inherit", opacity: confirming ? 0.7 : 1 }}
          >
            {confirming ? "Processing…" : "Confirm Hire & Close Job"}
          </button>
        </>)}

      </div>
    </>
  );
}
