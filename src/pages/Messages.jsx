import { useState, useEffect, useRef } from "react";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { fetchAcceptedConversations, fetchStudentDirectConversations, fetchMessages, sendMessage, fetchMessageCount } from "../lib/auth";
import { supabase } from "../lib/supabase";

function formatConvTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  const diff = Math.floor((now - d) / 86400000);
  if (diff < 7) return d.toLocaleDateString("en-IE", { weekday: "short" });
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

function Avatar({ url, name, size = 44 }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #A21D54, #C2185B)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white", fontWeight: "700", fontSize: Math.round(size * 0.38) + "px" }}>
      {initials}
    </div>
  );
}

function ConvCard({ avatarUrl, avatarName, name, subtitle, lastMessage, lastMessageAt, isUnread, onClick }) {
  const timeStr = formatConvTime(lastMessageAt);
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "0.85rem",
      padding: "0.85rem 1rem", borderRadius: "0.75rem",
      backgroundColor: isUnread ? "#fdf2f8" : "white",
      border: `1.5px solid ${isUnread ? "#fce7f3" : "#e5e7eb"}`,
      cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
    }}>
      <Avatar url={avatarUrl} name={avatarName || name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.4rem" }}>
          <p style={{ margin: 0, fontWeight: isUnread ? "800" : "700", fontSize: "0.92rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          {timeStr && <p style={{ margin: 0, fontSize: "0.7rem", color: isUnread ? "#A21D54" : "#9ca3af", flexShrink: 0 }}>{timeStr}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", color: isUnread ? "#374151" : "#6b7280", fontWeight: isUnread ? "600" : "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {lastMessage != null ? (lastMessage.length > 45 ? lastMessage.slice(0, 45) + "…" : lastMessage) : subtitle}
          </p>
          {isUnread && <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#A21D54", flexShrink: 0, marginTop: "0.1rem" }} />}
        </div>
      </div>
    </button>
  );
}

function ChatThread({ jobId, studentId, companyId, senderId, companyName, jobTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);
  const msgListRef = useRef(null);
  const inputRef   = useRef(null);

  const isDirect = jobId === null;
  const quickReplies = isDirect ? [
    { label: "Interested in Opportunities", text: `Hi ${companyName}! I'd love to learn more about any upcoming opportunities you might have. I'm available for part-time work and would love to chat!` },
    { label: "Tell Me More", text: `Hi ${companyName}! Thanks for reaching out — could you tell me more about what kind of work you're looking for?` },
    { label: "My Availability", text: `Hi ${companyName}! I'm interested in hearing more about any roles you have available. What does the position involve and what are the typical hours?` },
  ] : [
    { label: "About the Role", text: `Hi ${companyName}! Could you tell me more about what the ${jobTitle || "role"} involves and the typical hours?` },
    { label: "Application Follow-Up", text: `Hi ${companyName}! I submitted my application for the ${jobTitle || "position"} and just wanted to follow up — is there anything else you need from me?` },
    { label: "Interview Timing", text: `Hi ${companyName}! I'm very interested in the ${jobTitle || "position"} and available for an interview at your convenience — when would work best for you?` },
  ];

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
    if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try { await sendMessage(jobId, studentId, companyId, senderId, text); }
    catch (e) { console.error("Send failed:", e); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={msgListRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
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
                }}>{m.text}</div>
                <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.sender_id === senderId ? "right" : "left" }}>
                  {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))
        }
      </div>
      {!input && !loading && (
        <div style={{ padding: "0.5rem 1rem 0", backgroundColor: "white", borderTop: "1.5px solid #e5e7eb" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
            {quickReplies.map(qr => (
              <button
                key={qr.label}
                onClick={() => { setInput(qr.text); setTimeout(() => inputRef.current?.focus(), 0); }}
                style={{ flexShrink: 0, padding: "0.35rem 0.75rem", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fdf2f8", color: "#A21D54", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >{qr.label}</button>
            ))}
          </div>
        </div>
      )}
      <div style={{ padding: "0.75rem 1rem", borderTop: input ? "1.5px solid #e5e7eb" : "none", display: "flex", gap: "0.5rem", backgroundColor: "white" }}>
        <input
          ref={inputRef}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`Message ${companyName}…`}
          style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
        />
        <button onClick={send} style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default function Messages({ currentUser, setPage, setMsgCount }) {
  const [conversations, setConversations] = useState([]);
  const [directConvs, setDirectConvs]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState(false);
  const [tab, setTab]                     = useState("jobs");
  const [active, setActive]               = useState(null);
  const [refreshKey, setRefreshKey]       = useState(0);

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    const isInitial = refreshKey === 0;
    if (isInitial) setLoading(true);
    setFetchError(false);
    let failed = false;
    Promise.all([
      fetchAcceptedConversations(currentUser.id).catch(() => { failed = true; return []; }),
      fetchStudentDirectConversations(currentUser.id).catch(() => { failed = true; return []; }),
    ]).then(([convs, directs]) => {
      if (failed) { setFetchError(true); }
      setConversations(convs);
      setDirectConvs(directs);
      if (isInitial) setLoading(false);
    });
  }, [currentUser?.id, refreshKey]);

  const goBack = () => {
    setActive(null);
    setRefreshKey(k => k + 1);
    if (setMsgCount && currentUser) {
      fetchMessageCount(currentUser.id, "student").then(setMsgCount).catch(() => {});
    }
  };

  if (active) {
    const isDirect = active.jobId === null;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "white", flexShrink: 0 }}>
          <button onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", fontSize: "1rem", color: "#6b7280" }}>←</button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{isDirect ? active.companyName : active.title}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#6b7280" }}>{isDirect ? "Direct message" : active.companyName}</p>
          </div>
        </div>
        <ChatThread jobId={active.jobId} studentId={currentUser.id} companyId={active.companyId} senderId={currentUser.id} companyName={active.companyName} jobTitle={active.title} />
      </div>
    );
  }

  const directUnread = directConvs.filter(c => c.lastSenderId && c.lastSenderId !== currentUser?.id).length;
  const jobsUnread   = conversations.filter(c => c.lastSenderId && c.lastSenderId !== currentUser?.id).length;

  return (
    <><BackButton />
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>💬 Messages</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Chat with employers</p>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading conversations…</p>
      ) : fetchError ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
          <p style={{ fontSize: "1rem", fontWeight: "600", color: "#1e293b", marginBottom: "0.4rem" }}>Couldn't load conversations</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>This usually fixes itself — tap retry.</p>
          <button onClick={() => setRefreshKey(k => k + 1)} style={btnPrimary}>Retry</button>
        </div>
      ) : conversations.length === 0 && directConvs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No conversations yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Once an employer accepts your application or messages you directly, you can chat here.</p>
          <button onClick={() => setPage("appliedJobs")} style={btnPrimary}>View Applications</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "#f1f5f9", borderRadius: "0.65rem", padding: "0.2rem", marginBottom: "1rem" }}>
            {[
              { key: "jobs",   label: "Job Chats",       unread: jobsUnread },
              { key: "direct", label: "Direct Messages", unread: directUnread },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "0.55rem 0.5rem", borderRadius: "0.45rem", border: "none",
                background: tab === t.key ? "white" : "transparent",
                boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                color: tab === t.key ? "#1e293b" : "#64748b",
                fontWeight: tab === t.key ? "700" : "500",
                fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit",
              }}>
                {t.label}
                {t.unread > 0 && <span style={{ marginLeft: "0.35rem", backgroundColor: "#A21D54", color: "white", borderRadius: "10px", padding: "0 0.35rem", fontSize: "0.68rem", fontWeight: "700" }}>{t.unread}</span>}
              </button>
            ))}
          </div>

          {tab === "direct" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {directConvs.length === 0
                ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem 1rem", fontSize: "0.875rem" }}>No direct messages yet.</p>
                : directConvs.map(conv => (
                  <ConvCard
                    key={`direct_${conv.companyId}`}
                    avatarUrl={null}
                    avatarName={conv.companyName}
                    name={conv.companyName}
                    subtitle="Direct message"
                    lastMessage={conv.lastMessage}
                    lastMessageAt={conv.lastMessageAt}
                    isUnread={!!(conv.lastSenderId && conv.lastSenderId !== currentUser?.id)}
                    onClick={() => setActive(conv)}
                  />
                ))
              }
            </div>
          )}

          {tab === "jobs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {conversations.length === 0
                ? <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem 1rem", fontSize: "0.875rem" }}>No job chats yet. Get accepted to start chatting!</p>
                : conversations.map(conv => (
                  <ConvCard
                    key={conv.jobId}
                    avatarUrl={null}
                    avatarName={conv.companyName}
                    name={conv.title}
                    subtitle={conv.companyName}
                    lastMessage={conv.lastMessage}
                    lastMessageAt={conv.lastMessageAt}
                    isUnread={!!(conv.lastSenderId && conv.lastSenderId !== currentUser?.id)}
                    onClick={() => setActive(conv)}
                  />
                ))
              }
            </div>
          )}
        </>
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
