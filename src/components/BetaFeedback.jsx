// BETA ONLY — remove this file and its import in StudentShiftsWeb.jsx before full launch
import { useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

export default function BetaFeedback() {
  const { currentUser } = useApp();
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (!currentUser || currentUser.role === "admin") return null;

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const { error } = await supabase.from("beta_suggestions").insert({
        user_id: currentUser.id,
        name:    currentUser.name  || null,
        role:    currentUser.role  || null,
        message: trimmed,
      });
      if (error) throw error;
      toast.success("Thanks for the feedback!");
      setMessage("");
      setOpen(false);
    } catch {
      toast.error("Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Send us feedback"
        style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 900,
          background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
          color: "white", border: "none", borderRadius: "2rem",
          padding: "0.55rem 1rem",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: "700", fontSize: "0.82rem",
          cursor: "pointer", boxShadow: "0 4px 18px rgba(162,29,84,0.4)",
          display: "flex", alignItems: "center", gap: "0.35rem",
        }}
      >
        💬 Feedback
      </button>

      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: "1rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)" }}
        >
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "1.75rem", maxWidth: "420px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 0.2rem", fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary, #1e293b)" }}>Send us a suggestion</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>
              Bug, idea, or anything on your mind — we read every one.
            </p>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us what you think…"
              rows={4}
              maxLength={1000}
              autoFocus
              style={{ width: "100%", padding: "0.7rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.875rem", resize: "vertical", outline: "none", boxSizing: "border-box", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-surface, #f8fafc)", lineHeight: 1.55 }}
            />
            <p style={{ margin: "0.3rem 0 0.85rem", fontSize: "0.72rem", color: "#94a3b8", textAlign: "right" }}>{message.length}/1000</p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => { setOpen(false); setMessage(""); }}
                style={{ flex: 1, padding: "0.7rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "transparent", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                style={{ flex: 2, padding: "0.7rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: message.trim() && !sending ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "0.875rem", opacity: !message.trim() || sending ? 0.55 : 1 }}
              >
                {sending ? "Sending…" : "Send Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
