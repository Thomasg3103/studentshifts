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
      fetchMessages(jobId, studentId)
        .then(msgs => { setMessages(msgs); setLoading(false); })
        .catch(() => setLoading(false));
    });

    channel = supabase
      .channel(`msgs_${jobId}_${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `and(job_id=eq.${jobId},student_id=eq.${studentId})` },
        payload => {
          const msg = payload.new;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
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
    setInput("");
    try {
      const { sendMessage } = await import("../../lib/auth");
      await sendMessage(jobId, studentId, companyId, senderId, text);
    } catch (e) {
      Sentry.captureException(e);
      setInput(text);
      toast.error("Failed to send message — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", marginTop: "0.5rem", position: "relative" }}>
      <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "#374151", marginBottom: "0.5rem" }}>💬 Messages</p>
      <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {loading
          ? <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>Loading…</p>
          : messages.length === 0
            ? <p style={{ fontSize: "0.8rem", color: "#9ca3af", textAlign: "center", padding: "0.5rem 0" }}>No messages yet.</p>
            : messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender_id === senderId ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{ backgroundColor: m.sender_id === senderId ? "#3b82f6" : "#e5e7eb", color: m.sender_id === senderId ? "white" : "#111827", padding: "0.4rem 0.65rem", borderRadius: "0.55rem", fontSize: "0.8rem", lineHeight: 1.4 }}>
                  {m.text}
                </div>
                <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.sender_id === senderId ? "right" : "left" }}>
                  {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))
        }
        <div ref={bottomRef} />
      </div>
      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        {messages.length > 0 && `New message from ${messages[messages.length - 1]?.sender_id === senderId ? "you" : studentName}`}
      </div>
      {!input && !loading && messages.length === 0 && (
        <div style={{ marginBottom: "0.4rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.65rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
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
