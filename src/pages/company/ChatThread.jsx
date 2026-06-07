import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";

export default function ChatThread({ jobId, studentId, companyId, senderId, studentName, jobTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  const quickReplies = [
    { label: "You're a Great Fit", text: `Hi ${studentName || "there"}! We've reviewed your CV and think you'd be a perfect candidate for the ${jobTitle || "role"}. We'd love to hear from you — please message us back!` },
    { label: "We'd Love to Hire You", text: `Hi ${studentName || "there"}! Great news — we'd love to have you join our team for the ${jobTitle || "position"}. Please reply here and we'll be in touch with all the details to get you started!` },
    { label: "Tell Us More", text: `Hi ${studentName || "there"}! We're very interested in your application. Could you tell us a bit more about your availability and any relevant experience you have?` },
  ];

  useEffect(() => {
    let channel;
    import("../../lib/auth").then(({ fetchMessages }) => {
      fetchMessages(jobId, studentId, companyId)
        .then(msgs => { setMessages(msgs); setLoading(false); })
        .catch(() => setLoading(false));
    });

    const isDirect = jobId === null;
    channel = supabase
      .channel(isDirect ? `direct_${companyId}_${studentId}` : `msgs_${jobId}_${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          const msg = payload.new;
          const isRelevant = isDirect
            ? (msg.student_id === studentId && msg.company_id === companyId && msg.job_id === null)
            : (msg.job_id === jobId && msg.student_id === studentId);
          if (!isRelevant) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            const withoutOptimistic = prev.filter(m =>
              !(typeof m.id === "string" && m.id.startsWith("opt_") && m.sender_id === msg.sender_id && m.text === msg.text)
            );
            return [...withoutOptimistic, msg];
          });
        })
      .subscribe();

    return () => { channel && supabase.removeChannel(channel); };
  }, [jobId, studentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const optId = `opt_${Date.now()}`;
    setMessages(prev => [...prev, { id: optId, sender_id: senderId, text, created_at: new Date().toISOString() }]);
    setInput("");

    try {
      const { sendMessage } = await import("../../lib/auth");
      await sendMessage(jobId, studentId, companyId, senderId, text);
    } catch (e) {
      Sentry.captureException(e);
      setMessages(prev => prev.filter(m => m.id !== optId));
      setInput(text);
      toast.error("Failed to send message — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e5e7eb)", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem", position: "relative" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)", marginBottom: "0.5rem" }}>💬 Messages</p>
      <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {loading
          ? <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", textAlign: "center", padding: "0.5rem 0" }}>Loading…</p>
          : messages.length === 0
            ? <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", textAlign: "center", padding: "0.5rem 0" }}>No messages yet.</p>
            : messages.map((m, idx) => {
                const isMine = m.sender_id === senderId;
                const isLastMine = isMine && messages.slice(idx + 1).every(x => x.sender_id !== senderId);
                return (
                  <div key={m.id} style={{ alignSelf: isMine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                    <div style={{ backgroundColor: isMine ? "#3b82f6" : "#e5e7eb", color: isMine ? "white" : "#111827", padding: "0.4rem 0.65rem", borderRadius: "0.55rem", fontSize: "0.8rem", lineHeight: 1.4 }}>
                      {m.text}
                    </div>
                    <p style={{ fontSize: "0.65rem", color: "var(--color-text-secondary, #64748b)", margin: "0.1rem 0 0", textAlign: isMine ? "right" : "left", display: "flex", alignItems: "center", justifyContent: isMine ? "flex-end" : "flex-start", gap: "0.2rem" }}>
                      {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                      {isMine && <span style={{ fontSize: "0.62rem", color: isLastMine ? "#3b82f6" : "#94a3b8", fontWeight: "700" }}>✓✓</span>}
                    </p>
                  </div>
                );
              })
        }
        <div ref={bottomRef} />
      </div>
      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        {messages.length > 0 && `New message from ${messages[messages.length - 1]?.sender_id === senderId ? "you" : studentName}`}
      </div>
      {!input && !loading && messages.length === 0 && (
        <div style={{ marginBottom: "0.4rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.65rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
          <div style={{ display: "flex", gap: "0.35rem", overflowX: "auto", scrollbarWidth: "none" }}>
            {quickReplies.map(qr => (
              <button key={qr.label} onMouseDown={e => { e.preventDefault(); setInput(qr.text); setTimeout(() => inputRef.current?.focus(), 0); }}
                style={{ flexShrink: 0, padding: "0.28rem 0.6rem", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fdf2f8", color: "var(--color-brand)", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >{qr.label}</button>
            ))}
          </div>
        </div>
      )}
      {input.length > 3800 && (
        <p style={{ margin: "0 0 0.3rem", fontSize: "0.68rem", color: input.length >= 4000 ? "#ef4444" : "#f97316", fontWeight: 600, textAlign: "right" }}>
          {input.length}/4000 characters
        </p>
      )}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          ref={inputRef}
          aria-label={`Message ${studentName}`}
          value={input}
          onChange={e => { if (e.target.value.length <= 4000) setInput(e.target.value); }}
          onKeyDown={e => e.key === "Enter" && !sending && send()}
          maxLength={4000}
          disabled={sending}
          placeholder="Type a message…"
          style={{ flex: 1, padding: "0.45rem 0.65rem", borderRadius: "0.4rem", border: "1.5px solid #d1d5db", fontSize: "0.8rem", fontFamily: "inherit" }}
        />
        <button aria-label="Send message" onClick={send} disabled={sending || !input.trim()} style={{ padding: "0.45rem 0.75rem", borderRadius: "0.4rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: sending ? "default" : "pointer", fontFamily: "inherit", opacity: (sending || !input.trim()) ? 0.6 : 1 }}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
