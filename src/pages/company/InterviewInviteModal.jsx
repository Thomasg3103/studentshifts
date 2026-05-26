import { useState, useRef } from "react";
import * as Sentry from "@sentry/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { supabase } from "../../lib/supabase";

export function InterviewInviteModal({ applicant, roundNumber, date: initialDate, time: initialTime, onClose, onSend }) {
  const [mode, setMode]           = useState("fixed"); // "fixed" | "slots"
  const [date, setDate]           = useState(initialDate || "");
  const [time, setTime]           = useState(initialTime || "");
  const [note, setNote]           = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState("");
  const [slots, setSlots]         = useState([{ date: "", time: "" }, { date: "", time: "" }]);
  const modalRef = useRef(null);
  useFocusTrap(modalRef, onClose);

  const addSlot = () => { if (slots.length < 5) setSlots(prev => [...prev, { date: "", time: "" }]); };
  const removeSlot = (i) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i, key, val) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  const send = async () => {
    setSending(true);
    setError("");
    try {
      if (mode === "slots") {
        const validSlots = slots.filter(s => s.date && s.time);
        if (!validSlots.length) { setError("Add at least one date and time slot."); setSending(false); return; }
        // Save slots to DB
        const { data: appData } = await supabase
          .from("applications")
          .select("id")
          .eq("student_id", applicant.studentId)
          .single();
        if (appData?.id) {
          await supabase.from("interview_slots").insert(
            validSlots.map(s => ({ application_id: appData.id, slot_time: `${s.date}T${s.time}:00` }))
          );
        }
        await onSend(note + (note ? "\n\n" : "") + "Please pick a time that works for you from the options below.", teamsLink, validSlots[0].date, validSlots[0].time);
      } else {
        await onSend(note, teamsLink, date, time);
      }
      onClose();
    } catch (e) {
      Sentry.captureException(e);
      setError(e?.message || "Failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { width: "100%", padding: "0.5rem 0.55rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", fontFamily: "inherit", boxSizing: "border-box", color: "#374151" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1300 }} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={`Send Interview ${roundNumber} Invite`} style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 1301, backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", padding: "1.75rem", width: "min(440px,92vw)", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>Send Interview {roundNumber} Invite</h3>
        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b" }}>To: <strong>{applicant.name}</strong></p>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.1rem", padding: "0.25rem", backgroundColor: "#f1f5f9", borderRadius: "0.6rem" }}>
          {[{ val: "fixed", label: "Fixed Time" }, { val: "slots", label: "Let Student Pick" }].map(({ val, label }) => (
            <button key={val} onClick={() => setMode(val)} style={{ flex: 1, padding: "0.45rem", borderRadius: "0.45rem", border: "none", background: mode === val ? "var(--color-bg-elevated, white)" : "transparent", fontWeight: mode === val ? "700" : "500", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", color: mode === val ? "#1e293b" : "#64748b", boxShadow: mode === val ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {mode === "fixed" ? (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Time</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inputStyle} />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.45rem" }}>Available Time Slots</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {slots.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", minWidth: "16px" }}>{i + 1}.</span>
                    <input type="date" value={s.date} onChange={e => updateSlot(i, "date", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <input type="time" value={s.time} onChange={e => updateSlot(i, "time", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    {slots.length > 1 && <button onClick={() => removeSlot(i)} style={{ padding: "0.3rem 0.5rem", border: "1px solid #fca5a5", borderRadius: "0.4rem", background: "var(--color-bg-elevated, white)", color: "#dc2626", cursor: "pointer", fontSize: "0.75rem", fontFamily: "inherit" }}>✕</button>}
                  </div>
                ))}
              </div>
              {slots.length < 5 && (
                <button onClick={addSlot} style={{ marginTop: "0.4rem", padding: "0.35rem 0.75rem", borderRadius: "0.4rem", border: "1.5px dashed #d1d5db", background: "var(--color-bg-elevated, white)", color: "#64748b", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>+ Add Slot</button>
              )}
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#64748b" }}>The student will receive all options and pick one that works for them.</p>
            </div>
          )}
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Note to student <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Please bring a copy of your CV." rows={3} maxLength={1000} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </div>
          <div>
            <label style={{ fontSize: "0.72rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.3rem" }}>Microsoft Teams link <span style={{ fontWeight: "400", color: "#cbd5e1" }}>(optional)</span></label>
            <input type="url" value={teamsLink} onChange={e => setTeamsLink(e.target.value)} placeholder="https://teams.microsoft.com/…" style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "#e11d48", fontWeight: "600" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "0.65rem", borderRadius: "0.6rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={send} disabled={sending} style={{ flex: 2, padding: "0.65rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg,#7c3aed,var(--color-brand))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : mode === "slots" ? "Send with Time Options ✉" : "Send Invite ✉"}
          </button>
        </div>
      </div>
    </>
  );
}
