import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import { fetchAcceptedConversations, fetchMessages, sendMessage } from "../lib/auth";
import { supabase } from "../lib/supabase";

function ChatThread({ jobId, studentId, companyId, senderId, companyName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchMessages(jobId, studentId)
      .then(msgs => { setMessages(msgs); setLoading(false); })
      .catch(() => setLoading(false));

    const channel = supabase
      .channel(`msgs_${jobId}_${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `job_id=eq.${jobId}` },
        payload => {
          if (payload.new.student_id === studentId) {
            setMessages(prev => [...prev, payload.new]);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId, studentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      await sendMessage(jobId, studentId, companyId, senderId, text);
    } catch (e) {
      console.error("Send failed:", e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {loading
          ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>Loading…</p>
          : messages.length === 0
            ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>No messages yet. Say hello!</p>
            : messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender_id === senderId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{
                  backgroundColor: m.sender_id === senderId ? "#6366f1" : "#e5e7eb",
                  color: m.sender_id === senderId ? "white" : "#111827",
                  padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45,
                }}>
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
      <div style={{ padding: "0.75rem 1rem", borderTop: "1.5px solid #e5e7eb", display: "flex", gap: "0.5rem", backgroundColor: "white" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`Message ${companyName}…`}
          style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={send}
          style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function Messages({ currentUser, setPage }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [active, setActive]               = useState(null); // { jobId, title, companyId, companyName }

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    fetchAcceptedConversations(currentUser.id)
      .then(convs => { setConversations(convs); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentUser?.id]);

  if (active) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
        {/* Thread header */}
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "white", flexShrink: 0 }}>
          <button
            onClick={() => setActive(null)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", fontSize: "1rem", color: "#6b7280" }}
          >
            ←
          </button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{active.title}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>{active.companyName}</p>
          </div>
        </div>
        <ChatThread
          jobId={active.jobId}
          studentId={currentUser.id}
          companyId={active.companyId}
          senderId={currentUser.id}
          companyName={active.companyName}
        />
      </div>
    );
  }

  return (
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>💬 Messages</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Chat with employers who accepted your application</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading conversations…</p>
      ) : conversations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No conversations yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Once an employer accepts your application, you can message them here.</p>
          <button onClick={() => setPage("appliedJobs")} style={btnPrimary}>View Applications</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {conversations.map(conv => (
            <button
              key={conv.jobId}
              onClick={() => setActive(conv)}
              style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem", borderRadius: "0.75rem", backgroundColor: "white", border: "1.5px solid #e5e7eb", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
            >
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>🏢</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.92rem", color: "#1e293b" }}>{conv.title}</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>{conv.companyName}</p>
              </div>
              <span style={{ fontSize: "1rem", color: "#9ca3af" }}>›</span>
            </button>
          ))}
        </div>
      )}
    </PageWrapper>
  );
}

const btnPrimary = {
  padding: "0.75rem 1.75rem", borderRadius: "2rem", border: "none",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  boxShadow: "0 4px 14px rgba(99,102,241,0.3)",
  color: "white", fontWeight: "700", fontSize: "0.9rem",
  cursor: "pointer", fontFamily: "inherit",
};
