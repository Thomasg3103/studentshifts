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
        name:    currentUser.name || null,
        role:    currentUser.role || null,
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
      <style>{`
        @keyframes betaPulse {
          0%, 100% { box-shadow: 0 6px 28px rgba(162,29,84,0.55), 0 0 0 0 rgba(162,29,84,0.4); }
          50%       { box-shadow: 0 6px 28px rgba(162,29,84,0.55), 0 0 0 10px rgba(162,29,84,0); }
        }
      `}</style>

      {/* Floating button — prominent for beta testers */}
      <button
        onClick={() => setOpen(true)}
        title="Send us feedback"
        style={{
          position: "fixed", bottom: "calc(64px + 1.25rem)", right: "1.5rem", zIndex: 900,
          background: "linear-gradient(135deg, #A21D54, #C2185B)",
          color: "white", border: "none", borderRadius: "2rem",
          padding: "0.9rem 1.5rem",
          fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: "800", fontSize: "1rem",
          cursor: "pointer",
          animation: "betaPulse 2.5s ease-in-out infinite",
          display: "flex", alignItems: "center", gap: "0.5rem",
          letterSpacing: "-0.01em",
        }}
      >
        💬 Share Feedback
      </button>

      {/* Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: "1rem", WebkitBackdropFilter: "blur(3px)", backdropFilter: "blur(3px)" }}
        >
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.5rem", padding: "2rem 2rem 1.75rem", maxWidth: "480px", width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.25)" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>💬</div>
                <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1.3rem", color: "var(--color-text-primary, #1e293b)" }}>Share your feedback</h3>
              </div>
              <button
                onClick={() => { setOpen(false); setMessage(""); }}
                style={{ background: "none", border: "none", fontSize: "1.3rem", color: "#94a3b8", cursor: "pointer", padding: "0.2rem", lineHeight: 1, marginTop: "-0.2rem" }}
                aria-label="Close"
              >×</button>
            </div>

            <p style={{ margin: "0.5rem 0 1.25rem", fontSize: "0.9rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>
              You're one of our first testers — your feedback shapes the app. Tell us what's working, what's broken, or what you'd love to see.
            </p>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. The map isn't loading on mobile, or — I'd love to filter jobs by pay rate…"
              rows={5}
              maxLength={1000}
              autoFocus
              style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.9rem", resize: "vertical", outline: "none", boxSizing: "border-box", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-surface, #f8fafc)", lineHeight: 1.6 }}
            />
            <p style={{ margin: "0.3rem 0 1.1rem", fontSize: "0.72rem", color: "#94a3b8", textAlign: "right" }}>{message.length}/1000</p>

            <div style={{ display: "flex", gap: "0.65rem" }}>
              <button
                onClick={() => { setOpen(false); setMessage(""); }}
                style={{ flex: 1, padding: "0.8rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "transparent", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || sending}
                style={{ flex: 2, padding: "0.8rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "800", cursor: message.trim() && !sending ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "0.95rem", opacity: !message.trim() || sending ? 0.55 : 1, letterSpacing: "-0.01em" }}
              >
                {sending ? "Sending…" : "Send Feedback →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
