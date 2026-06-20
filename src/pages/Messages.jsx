import { useState, useEffect, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import toast from "react-hot-toast";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { fetchAcceptedConversations, fetchStudentDirectConversations, fetchMessages, sendMessage, fetchMessageCount } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { supabaseImg } from "../utils/img";
import { JobRowsSkeleton } from "../components/Skeleton";

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

function formatMsgTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const now = new Date();
  const timeStr = d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return timeStr;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }) + " · " + timeStr;
}

function Avatar({ url, name, size = 44 }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (url) {
    return <img loading="lazy" src={supabaseImg(url, size * 2)} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white", fontWeight: "700", fontSize: Math.round(size * 0.38) + "px" }}>
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
      backgroundColor: isUnread ? "#fdf2f8" : "var(--color-bg-elevated, white)",
      border: `1.5px solid ${isUnread ? "#fce7f3" : "var(--color-border-light, #e5e7eb)"}`,
      cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
    }}>
      <Avatar url={avatarUrl} name={avatarName || name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.4rem" }}>
          <p style={{ margin: 0, fontWeight: isUnread ? "800" : "700", fontSize: "0.92rem", color: "var(--color-text-primary, #1e293b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          {timeStr && <p style={{ margin: 0, fontSize: "0.7rem", color: isUnread ? "var(--color-brand)" : "#64748b", flexShrink: 0 }}>{timeStr}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <p style={{ margin: "0.1rem 0 0", fontSize: "0.8rem", color: isUnread ? "#374151" : "#6b7280", fontWeight: isUnread ? "600" : "400", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {lastMessage != null ? (lastMessage.length > 45 ? lastMessage.slice(0, 45) + "…" : lastMessage) : subtitle}
          </p>
          {isUnread && <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--color-brand)", flexShrink: 0, marginTop: "0.1rem" }} />}
        </div>
      </div>
    </button>
  );
}

const PAGE_SIZE = 30;

function ChatThread({ jobId, studentId, companyId, senderId, companyName, jobTitle }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending]     = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const msgListRef = useRef(null);
  const inputRef   = useRef(null);
  const prevScrollHeightRef = useRef(null);

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

  const loadEarlier = useCallback(async () => {
    if (loadingMore || !messages.length) return;
    setLoadingMore(true);
    prevScrollHeightRef.current = msgListRef.current?.scrollHeight ?? 0;
    try {
      const older = await fetchMessages(jobId, studentId, companyId, { limit: PAGE_SIZE, before: messages[0].created_at });
      setMessages(prev => [...older, ...prev]);
      setHasMore(older.length === PAGE_SIZE);
    } catch (e) { console.warn("Load earlier failed:", e); }
    finally { setLoadingMore(false); }
  }, [jobId, studentId, companyId, messages, loadingMore]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setMessages([]);
    setHasMore(false);

    fetchMessages(jobId, studentId, companyId, { limit: PAGE_SIZE })
      .then(msgs => { setMessages(msgs); setHasMore(msgs.length === PAGE_SIZE); })
      .catch(() => { setLoadError(true); })
      .finally(() => setLoading(false));

    const channelName = isDirect ? `direct_${companyId}_${studentId}` : `msgs_${jobId}_${studentId}`;

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" },
        payload => {
          const { new: msg } = payload;
          const isRelevant = isDirect
            ? (msg.student_id === studentId && msg.company_id === companyId && msg.job_id === null)
            : (msg.job_id === jobId && msg.student_id === studentId);
          if (!isRelevant) return;
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            // Replace matching optimistic message (same sender + text) with the confirmed row
            const withoutOptimistic = prev.filter(m =>
              !(typeof m.id === "string" && m.id.startsWith("opt_") && m.sender_id === msg.sender_id && m.text === msg.text)
            );
            return [...withoutOptimistic, msg];
          });
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId, studentId, companyId]);

  useEffect(() => {
    if (prevScrollHeightRef.current !== null) {
      // Restore scroll position after prepending older messages
      if (msgListRef.current) {
        msgListRef.current.scrollTop = msgListRef.current.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = null;
    } else {
      // Scroll to bottom on initial load or new messages
      if (msgListRef.current) msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const optId = `opt_${Date.now()}`;
    const optimistic = { id: optId, sender_id: senderId, text, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput("");

    try {
      await sendMessage(jobId, studentId, companyId, senderId, text);
      // Optimistic message stays visible; Realtime will replace it with the real row
    } catch (e) {
      console.error("Send failed:", e);
      setMessages(prev => prev.filter(m => m.id !== optId));
      setInput(text);
      toast.error("Couldn't send message. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div ref={msgListRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {!loading && hasMore && (
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <button onClick={loadEarlier} disabled={loadingMore} style={{ padding: "0.35rem 1rem", borderRadius: "999px", border: "1.5px solid var(--color-border-light, #e5e7eb)", background: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: loadingMore ? 0.6 : 1 }}>
              {loadingMore ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {loading
          ? <p style={{ color: "var(--color-text-secondary, #64748b)", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>Loading…</p>
          : loadError
            ? (
              <div style={{ textAlign: "center", marginTop: "2rem" }}>
                <p style={{ color: "#ef4444", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>Couldn't load messages.</p>
                <button
                  onClick={() => {
                    setLoadError(false);
                    setLoading(true);
                    fetchMessages(jobId, studentId, companyId, { limit: PAGE_SIZE })
                      .then(msgs => { setMessages(msgs); setHasMore(msgs.length === PAGE_SIZE); })
                      .catch(() => { setLoadError(true); })
                      .finally(() => setLoading(false));
                  }}
                  style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
                >Retry</button>
              </div>
            )
          : messages.length === 0
            ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: "2rem 1rem", gap: "0.75rem" }}>
                <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <line x1="9" y1="10" x2="15" y2="10"/>
                  <line x1="9" y1="14" x2="12" y2="14"/>
                </svg>
                <p style={{ color: "var(--color-text-secondary, #64748b)", fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>No messages yet</p>
                <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>Say hello to start the conversation!</p>
              </div>
            )
            : (() => {
              let lastDateStr = null;
              const items = [];
              for (const m of messages) {
                const d = new Date(m.created_at);
                const dateStr = d.toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short" });
                if (dateStr !== lastDateStr) {
                  lastDateStr = dateStr;
                  items.push(
                    <div key={`sep-${dateStr}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.35rem 0" }}>
                      <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
                      <span style={{ fontSize: "0.68rem", color: "#9ca3af", fontWeight: 600, whiteSpace: "nowrap", padding: "0.15rem 0.55rem", backgroundColor: "#f3f4f6", borderRadius: "999px" }}>{dateStr}</span>
                      <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
                    </div>
                  );
                }
                items.push(
                  <div key={m.id} style={{ alignSelf: m.sender_id === senderId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                    <div style={{
                      backgroundColor: m.sender_id === senderId ? "var(--color-brand)" : "#e5e7eb",
                      color: m.sender_id === senderId ? "white" : "#111827",
                      padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45,
                      wordBreak: "break-word", whiteSpace: "pre-wrap",
                    }}>{m.text}</div>
                    <p style={{ fontSize: "0.65rem", color: "var(--color-text-secondary, #64748b)", margin: "0.1rem 0 0", textAlign: m.sender_id === senderId ? "right" : "left" }}>
                      {formatMsgTime(m.created_at)}
                    </p>
                  </div>
                );
              }
              return items;
            })()
        }
      </div>
      {!input && !loading && !loadError && messages.length === 0 && (
        <div style={{ padding: "0.5rem 1rem 0", backgroundColor: "var(--color-bg-elevated, white)", borderTop: "1.5px solid var(--color-border-light, #e5e7eb)" }}>
          <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
          <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
            {quickReplies.map(qr => (
              <button
                key={qr.label}
                onClick={() => { setInput(qr.text); setTimeout(() => inputRef.current?.focus(), 0); }}
                style={{ flexShrink: 0, padding: "0.35rem 0.75rem", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fdf2f8", color: "var(--color-brand)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >{qr.label}</button>
            ))}
          </div>
        </div>
      )}
      <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        {messages.length > 0 && `New message from ${messages[messages.length - 1]?.sender_id === senderId ? "you" : companyName}`}
      </div>
      {input.length > 3800 && (
        <div style={{ padding: "0.25rem 1rem 0", backgroundColor: "var(--color-bg-elevated, white)" }}>
          <span style={{ fontSize: "0.72rem", color: input.length >= 4000 ? "#ef4444" : "#f97316", fontWeight: 600 }}>
            {input.length}/4000 characters
          </span>
        </div>
      )}
      <div style={{ padding: "0.75rem 1rem", borderTop: input ? "1.5px solid var(--color-border-light, #e5e7eb)" : "none", display: "flex", gap: "0.5rem", backgroundColor: "var(--color-bg-elevated, white)" }}>
        <input
          ref={inputRef}
          aria-label={`Message ${companyName}`}
          value={input}
          onChange={e => { if (e.target.value.length <= 4000) setInput(e.target.value); }}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={`Message ${companyName}…`}
          maxLength={4000}
          style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid var(--color-border-light, #d1d5db)", fontSize: "0.85rem", fontFamily: "inherit", outline: "none", backgroundColor: "var(--color-bg-surface, white)", color: "var(--color-text-primary, #1e293b)" }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: (!input.trim() || sending) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!input.trim() || sending) ? 0.5 : 1 }}>
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

export default function Messages() {
  const { currentUser, setPage, setMsgCount } = useApp();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
      <div style={{ display: "flex", flexDirection: "column", height: isMobile ? "calc(100vh - 80px - 64px)" : "calc(100vh - 80px)" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid var(--color-border-light, #e5e7eb)", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "var(--color-bg-elevated, white)", flexShrink: 0 }}>
          <button aria-label="Back to conversations" onClick={goBack} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", fontSize: "1rem", color: "var(--color-text-secondary, #6b7280)" }}>←</button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{isDirect ? active.companyName : active.title}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #6b7280)" }}>{isDirect ? "Direct message" : active.companyName}</p>
          </div>
        </div>
        <ChatThread key={`${active.jobId}_${active.companyId}`} jobId={active.jobId} studentId={currentUser.id} companyId={active.companyId} senderId={currentUser.id} companyName={active.companyName} jobTitle={active.title} />
      </div>
    );
  }

  const directUnread = directConvs.filter(c => c.lastSenderId && c.lastSenderId !== currentUser?.id).length;
  const jobsUnread   = conversations.filter(c => c.lastSenderId && c.lastSenderId !== currentUser?.id).length;

  return (
    <><Helmet><title>Messages — StudentShifts</title><meta name="robots" content="noindex" /></Helmet>
    <BackButton />
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "var(--color-text-primary, #1e293b)" }}>💬 Messages</h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem" }}>Chat with employers</p>
      </div>

      {loading ? (
        <JobRowsSkeleton count={4} />
      ) : fetchError && conversations.length === 0 && directConvs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #6b7280)" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
          <p style={{ fontSize: "1rem", fontWeight: "600", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.4rem" }}>Couldn't load conversations</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>This usually fixes itself — tap retry.</p>
          <button onClick={() => setRefreshKey(k => k + 1)} style={btnPrimary}>Retry</button>
        </div>
      ) : conversations.length === 0 && directConvs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #6b7280)" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No conversations yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Once an employer accepts your application or messages you directly, you can chat here.</p>
          <button onClick={() => setPage("appliedJobs")} style={btnPrimary}>View Applications</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "var(--color-bg-surface, #f1f5f9)", borderRadius: "0.65rem", padding: "0.2rem", marginBottom: "1rem" }}>
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
                {t.unread > 0 && <span style={{ marginLeft: "0.35rem", backgroundColor: "var(--color-brand)", color: "white", borderRadius: "10px", padding: "0 0.35rem", fontSize: "0.68rem", fontWeight: "700" }}>{t.unread}</span>}
              </button>
            ))}
          </div>

          {tab === "direct" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {directConvs.length === 0
                ? <p style={{ textAlign: "center", color: "var(--color-text-secondary, #64748b)", padding: "2rem 1rem", fontSize: "0.875rem" }}>No direct messages yet. Companies can message you from Browse Students.</p>
                : directConvs.map(conv => (
                  <ConvCard
                    key={`direct_${conv.companyId}`}
                    avatarUrl={conv.profilePhotoUrl || null}
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
                ? <p style={{ textAlign: "center", color: "var(--color-text-secondary, #64748b)", padding: "2rem 1rem", fontSize: "0.875rem" }}>No job chats yet. Get accepted to start chatting!</p>
                : conversations.map(conv => (
                  <ConvCard
                    key={conv.jobId}
                    avatarUrl={conv.profilePhotoUrl || null}
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
  background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
  boxShadow: "0 4px 14px rgba(162,29,84,0.3)",
  color: "white", fontWeight: "700", fontSize: "0.9rem",
  cursor: "pointer", fontFamily: "inherit",
};
