import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { fetchAcceptedConversations, fetchStudentDirectConversations, fetchMessages, sendMessage } from "../lib/auth";
import { supabase } from "../lib/supabase";

function ChatThread({ jobId, studentId, companyId, senderId, companyName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchMessages(jobId, studentId, companyId)
      .then(msgs => { setMessages(msgs); setLoading(false); })
      .catch(() => setLoading(false));

    const isDirect = jobId === null;
    const channelName = isDirect ? `direct_${companyId}_${studentId}` : `msgs_${jobId}_${studentId}`;
    const filter = isDirect ? `student_id=eq.${studentId}` : `job_id=eq.${jobId}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter },
        payload => {
          const { new: msg } = payload;
          if (isDirect ? (msg.company_id === companyId && msg.job_id === null) : (msg.student_id === studentId)) {
            setMessages(prev => [...prev, msg]);
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
                  backgroundColor: m.sender_id === senderId ? "#A21D54" : "#e5e7eb",
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
          style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function Messages({ currentUser, setPage }) {
  const [conversations, setConversations] = useState([]);
  const [directConvs, setDirectConvs]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [active, setActive]               = useState(null); // { jobId, title, companyId, companyName }

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    Promise.all([
      fetchAcceptedConversations(currentUser.id).catch(() => []),
      fetchStudentDirectConversations(currentUser.id).catch(() => []),
    ]).then(([convs, directs]) => {
      setConversations(convs);
      setDirectConvs(directs);
      setLoading(false);
    });
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
    <><BackButton />
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>💬 Messages</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Chat with employers who accepted your application</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading conversations…</p>
      ) : conversations.length === 0 && directConvs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No conversations yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Once an employer accepts your application or messages you directly, you can chat here.</p>
          <button onClick={() => setPage("appliedJobs")} style={btnPrimary}>View Applications</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {directConvs.length > 0 && (
            <>
              <p style={{ fontWeight: "700", fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.25rem 0" }}>Direct Messages</p>
              {directConvs.map(conv => (
                <button
                  key={`direct_${conv.companyId}`}
                  onClick={() => setActive(conv)}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem", borderRadius: "0.75rem", backgroundColor: "white", border: "1.5px solid #fce7f3", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #A21D54, #C2185B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "1.1rem" }}>🏢</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "0.92rem", color: "#1e293b" }}>{conv.companyName}</p>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#A21D54", fontWeight: "600" }}>Direct message</p>
                  </div>
                  <span style={{ fontSize: "1rem", color: "#9ca3af" }}>›</span>
                </button>
              ))}
            </>
          )}
          {conversations.length > 0 && (
            <>
              {directConvs.length > 0 && <p style={{ fontWeight: "700", fontSize: "0.75rem", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0.5rem 0 0.25rem" }}>Job Chats</p>}
              {conversations.map(conv => (
                <button
                  key={conv.jobId}
                  onClick={() => setActive(conv)}
                  style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 1.1rem", borderRadius: "0.75rem", backgroundColor: "white", border: "1.5px solid #e5e7eb", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
                >
                  <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "linear-gradient(135deg, #A21D54, #C2185B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "1.1rem" }}>🏢</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "0.92rem", color: "#1e293b" }}>{conv.title}</p>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>{conv.companyName}</p>
                  </div>
                  <span style={{ fontSize: "1rem", color: "#9ca3af" }}>›</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </PageWrapper></>
  );
}

const btnPrimary = {
  padding: "0.75rem 1.75rem", borderRadius: "2rem", border: "none",
  background: "linear-gradient(135deg, #A21D54, #C2185B)",
  boxShadow: "0 4px 14px rgba(162,29,84,0.3)",
  color: "white", fontWeight: "700", fontSize: "0.9rem",
  cursor: "pointer", fontFamily: "inherit",
};
