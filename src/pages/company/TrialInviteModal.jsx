import { useState, useRef } from "react";
import * as Sentry from "@sentry/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export function TrialInviteModal({ applicant, date: initialDate, time: initialTime, onClose, onSend }) {
  const [date, setDate]     = useState(initialDate || "");
  const [time, setTime]     = useState(initialTime || "");
  const [note, setNote]     = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState("");
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose);

  const send = async () => {
    setSending(true);
    setError("");
    try {
      await onSend(date, time, note);
      onClose();
    } catch (e) {
      Sentry.captureException(e);
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1300 }} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Send Trial Shift Invite" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1301, backgroundColor: "white", borderRadius: "1rem", padding: "1.75rem", width: "min(400px,92vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Send Trial Shift Invite</h3>
        <p style={{ margin: "0 0 1.1rem", fontSize: "0.82rem", color: "#64748b" }}>To: <strong>{applicant.name}</strong></p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Note to student <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Please arrive 10 minutes early. Dress code is smart casual."
              rows={3}
              maxLength={1000}
              style={{ width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5, color: "#374151" }}
            />
          </div>
        </div>

        {error && <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#e11d48", fontWeight: "600" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.65rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={send} disabled={sending} style={{ flex: 2, padding: "0.65rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : "Send Trial Invite ✉"}
          </button>
        </div>
      </div>
    </>
  );
}
