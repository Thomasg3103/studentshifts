import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "../../lib/supabase";
import { fetchAllMessagesWithStudent, sendMessage, sendEmail } from "../../lib/auth";
import { StudentAvailabilityRow } from "./shared";

export default function SavedStudents({ students, _loading, fetched, error, likedStudentIds, applicantStudentIds, onToggleLike, chatStudent, setChatStudent, companyId, _companyName }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [chatError, setChatError]       = useState("");
  const [dmMap, setDmMap]               = useState({});
  const msgAreaRef   = useRef(null);
  const chatInputRef = useRef(null);

  const savedQuickReplies = chatStudent ? [
    { label: "Hiring Opportunity", text: `Hi ${chatStudent.name}! We came across your profile and think you could be a great fit for our team. We have a part-time opportunity coming up — would you be interested in hearing more?` },
    { label: "We'd Love to Have You", text: `Hi ${chatStudent.name}! We've been impressed by your profile and would love to have you on our team. Please reply here and we'll be in touch with all the details!` },
    { label: "Tell Us About You", text: `Hi ${chatStudent.name}! We're very interested in your profile. Could you tell us a bit more about your availability and what kind of work you're looking for?` },
  ] : [];

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("chat_messages")
      .select("student_id, text, sender_id, created_at")
      .eq("company_id", companyId)
      .is("job_id", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const map = {};
        for (const msg of data) {
          if (!map[msg.student_id]) map[msg.student_id] = msg;
        }
        setDmMap(map);
      })
      .catch(console.warn);
  }, [companyId]);

  useEffect(() => {
    if (!chatStudent) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setChatLoading(true);
    setChatError("");
    fetchAllMessagesWithStudent(chatStudent.id, companyId)
      .then(msgs => { setChatMessages(msgs); setChatLoading(false); })
      .catch(e => { setChatLoading(false); setChatError(e?.message || "Failed to load messages — please try again."); });

    // R3-C4: filter on both company_id AND student_id — otherwise the subscription receives
    // ALL messages this company has with any student, not just the open conversation.
    const channel = supabase
      .channel(`saved_direct_${companyId}_${chatStudent.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `and(company_id=eq.${companyId},student_id=eq.${chatStudent.id},job_id=is.null)`,
      }, payload => {
        const msg = payload.new;
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setDmMap(prev => ({ ...prev, [msg.student_id]: { text: msg.text, sender_id: msg.sender_id, created_at: msg.created_at } }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatStudent?.id]);

  useEffect(() => {
    if (msgAreaRef.current) msgAreaRef.current.scrollTop = msgAreaRef.current.scrollHeight;
  }, [chatMessages]);

  const sendDM = async () => {
    const text = chatInput.trim();
    if (!text || !chatStudent) return;
    // Rate limit: max 3 company messages since last student reply
    let lastStudentIdx = -1;
    for (let i = chatMessages.length - 1; i >= 0; i--) {
      if (chatMessages[i].sender_id !== companyId) { lastStudentIdx = i; break; }
    }
    const companyMsgsSinceReply = chatMessages.slice(lastStudentIdx + 1).filter(m => m.sender_id === companyId).length;
    if (companyMsgsSinceReply >= 3) {
      setChatError(`You've sent 3 messages — wait for ${chatStudent.name} to reply before sending more.`);
      return;
    }
    const isFirst = chatMessages.length === 0;
    setChatInput("");
    setChatError("");
    try {
      const sent = await sendMessage(null, chatStudent.id, companyId, companyId, text);
      if (sent) {
        setChatMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent]);
        setDmMap(prev => ({ ...prev, [chatStudent.id]: { text: sent.text, sender_id: sent.sender_id, created_at: sent.created_at } }));
      } else {
        setDmMap(prev => ({ ...prev, [chatStudent.id]: { text, sender_id: companyId, created_at: new Date().toISOString() } }));
      }
      if (isFirst) {
        const { data: emailRows } = await supabase.rpc("get_user_emails", { user_ids: [chatStudent.id] });
        const studentEmail = emailRows?.[0]?.email;
        if (studentEmail) {
          sendEmail({
            to: studentEmail,
            templateType: "company_interested",
            magicLinkEmail: studentEmail,
            redirectTo: import.meta.env.VITE_SITE_URL || "https://studentshifts.ie",
          }).catch(console.warn);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      setChatError(e.message || "Failed to send — please try again.");
    }
  };

  let _lastStudentIdx = -1;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    if (chatMessages[i].sender_id !== companyId) { _lastStudentIdx = i; break; }
  }
  const companyMsgsSinceReply = chatMessages.slice(_lastStudentIdx + 1).filter(m => m.sender_id === companyId).length;
  const rateLimited = !chatLoading && companyMsgsSinceReply >= 3;

  if (chatStudent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: "400px", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", flexShrink: 0 }}>
          <button onClick={() => setChatStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "var(--color-text-secondary, #6b7280)", padding: "0.2rem 0.5rem" }}>←</button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{chatStudent.name}</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>Direct Message</p>
          </div>
        </div>
        <div ref={msgAreaRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {chatLoading
            ? <p style={{ color: "var(--color-text-secondary, #64748b)", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>Loading…</p>
            : chatMessages.length === 0
              ? <p style={{ color: "var(--color-text-secondary, #64748b)", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>No messages yet. Introduce yourself!</p>
              : chatMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender_id === companyId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div style={{ backgroundColor: m.sender_id === companyId ? "var(--color-brand)" : "#e5e7eb", color: m.sender_id === companyId ? "white" : "#111827", padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
                    {m.text}
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "var(--color-text-secondary, #64748b)", margin: "0.1rem 0 0", textAlign: m.sender_id === companyId ? "right" : "left" }}>
                    {new Date(m.created_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
          }
        </div>
        {chatError && (
          <p style={{ margin: 0, padding: "0.4rem 1rem", fontSize: "0.78rem", color: "#e11d48", backgroundColor: "#fff1f2", borderTop: "1px solid #fecdd3" }}>{chatError}</p>
        )}
        {!chatInput && !chatLoading && chatMessages.length === 0 && (
          <div style={{ padding: "0.5rem 1rem 0", backgroundColor: "var(--color-bg-elevated, white)", borderTop: "1.5px solid #e5e7eb" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
              {savedQuickReplies.map(qr => (
                <button key={qr.label} onMouseDown={e => { e.preventDefault(); setChatInput(qr.text); setTimeout(() => chatInputRef.current?.focus(), 0); }}
                  style={{ flexShrink: 0, padding: "0.35rem 0.75rem", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fdf2f8", color: "var(--color-brand)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >{qr.label}</button>
              ))}
            </div>
          </div>
        )}
        {rateLimited ? (
          <div style={{ padding: "0.85rem 1rem", borderTop: "1.5px solid #fcd34d", backgroundColor: "#fffbeb" }}>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400e", fontWeight: 600, lineHeight: 1.4 }}>
              You've sent 3 messages without a reply. Wait for {chatStudent.name} to respond before sending more.
            </p>
          </div>
        ) : (
          <>
            {companyMsgsSinceReply > 0 && (
              <div style={{ padding: "0.4rem 1rem", borderTop: "1.5px solid #fcd34d", backgroundColor: "#fffbeb" }}>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "#92400e", fontWeight: 600 }}>
                  You have {3 - companyMsgsSinceReply} message{3 - companyMsgsSinceReply !== 1 ? "s" : ""} remaining until {chatStudent.name} replies
                </p>
              </div>
            )}
          <div style={{ padding: "0.75rem 1rem", borderTop: chatInput ? "1.5px solid #e5e7eb" : "none", display: "flex", gap: "0.5rem", backgroundColor: "var(--color-bg-elevated, white)" }}>
            <input
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendDM()}
              maxLength={4000}
              placeholder={`Message ${chatStudent.name}…`}
              style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
            />
            <button onClick={sendDM} disabled={!chatInput.trim()} style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: chatInput.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: chatInput.trim() ? 1 : 0.5 }}>
              Send
            </button>
          </div>
          </>
        )}
      </div>
    );
  }

  if (!fetched) {
    return <p style={{ textAlign: "center", color: "var(--color-text-secondary, #6b7280)", padding: "3rem 1rem" }}>Loading students…</p>;
  }

  if (fetched && error) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#fff1f2", borderRadius: "0.75rem", border: "1.5px solid #fca5a5" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", color: "#b91c1c", marginBottom: "0.4rem" }}>Could not load students</p>
        <p style={{ fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>{error}</p>
      </div>
    );
  }

  const savedStudents = students.filter(s => likedStudentIds?.has(s.id));

  if (savedStudents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--color-text-secondary, #6b7280)" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>♡</div>
        <p style={{ fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.4rem" }}>No saved students yet</p>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)" }}>Browse Students and tap the heart icon to save students here.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", margin: 0 }}>
        {savedStudents.length} saved student{savedStudents.length !== 1 ? "s" : ""}
      </p>
      {savedStudents.map(s => {
        const hasApplied = applicantStudentIds?.has(s.id);
        return (
        <div key={s.id} style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e5e7eb)", borderRadius: "0.85rem", padding: "1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {s.profile_photo_url
              ? <img loading="lazy" src={`${s.profile_photo_url}?width=100&quality=75`} alt={`${s.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{s.name}</p>
                {hasApplied && (
                  <span className="badge badge-sm badge-green" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Applied ✓</span>
                )}
              </div>
              <button
                onClick={() => onToggleLike?.(s.id)}
                title="Remove from saved"
                aria-label={`Remove ${s.name} from saved`}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0.1rem 0.25rem", color: "#e11d48" }}
              >
                ♥
              </button>
            </div>
            {s.bio && <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>{s.bio.length > 160 ? s.bio.slice(0, 160).trimEnd() + "…" : s.bio}</p>}
            {s.skills?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                {s.skills.slice(0, 5).map(sk => (
                  <span key={sk} className="badge badge-sm badge-blue">{sk}</span>
                ))}
              </div>
            )}
            {s.job_preferences?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
                {s.job_preferences.map(p => (
                  <span key={p} className="badge badge-sm badge-green">{p}</span>
                ))}
              </div>
            )}
            <StudentAvailabilityRow availability={s.availability} />
            {dmMap[s.id] && (
              <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.6rem", backgroundColor: "#f0fdf4", borderRadius: "0.5rem", border: "1px solid #bbf7d0", overflow: "hidden" }}>
                <span style={{ fontSize: "0.72rem", flexShrink: 0 }}>💬</span>
                <span style={{ fontSize: "0.72rem", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ fontWeight: 700, color: dmMap[s.id].sender_id === companyId ? "#16a34a" : "#7c3aed" }}>
                    {dmMap[s.id].sender_id === companyId ? "You: " : `${s.name}: `}
                  </span>
                  {dmMap[s.id].text.length > 55 ? dmMap[s.id].text.slice(0, 55) + "…" : dmMap[s.id].text}
                </span>
              </div>
            )}
            <button
              onClick={() => { if (s.allow_company_dm !== false) { setChatStudent({ id: s.id, name: s.name }); setChatMessages([]); setChatInput(""); } }}
              disabled={s.allow_company_dm === false}
              title={s.allow_company_dm === false ? "This student has disabled direct messages" : undefined}
              style={{ marginTop: "0.75rem", width: "100%", padding: "0.5rem 1rem", borderRadius: "2rem", border: "none", background: s.allow_company_dm === false ? "#e5e7eb" : "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: s.allow_company_dm === false ? "#64748b" : "white", fontWeight: "700", fontSize: "0.85rem", cursor: s.allow_company_dm === false ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {s.allow_company_dm === false ? "DMs disabled" : "Message Student"}
            </button>
          </div>
        </div>
        ); })}
    </div>
  );
}
