import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import { supabase } from "../../lib/supabase";
import { fetchAllMessagesWithStudent, sendMessage, sendEmail, emailCompanyInterested } from "../../lib/auth";
import { StudentAvailabilityRow, weekdays } from "./shared";

const PAGE_SIZE = 20;

export default function BrowseStudents({ students, loading, fetched, error, companyIndustries, companyId, companyName, chatStudent, setChatStudent, setPage, likedStudentIds, applicantStudentIds, onToggleLike }) {
  const [filterByIndustries, setFilterByIndustries] = useState(true);
  const [sortBy, setSortBy] = useState("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterByIndustries, sortBy]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [chatError, setChatError]       = useState("");
  const msgAreaRef   = useRef(null);
  const chatInputRef = useRef(null);

  const browseQuickReplies = chatStudent ? [
    { label: "Hiring Opportunity", text: `Hi ${chatStudent.name}! We came across your profile and think you could be a great fit for our team. We have a part-time opportunity coming up — would you be interested in hearing more?` },
    { label: "We'd Love to Have You", text: `Hi ${chatStudent.name}! We've been impressed by your profile and would love to have you on our team. Please reply here and we'll be in touch with all the details!` },
    { label: "Tell Us About You", text: `Hi ${chatStudent.name}! We're very interested in your profile. Could you tell us a bit more about your availability and what kind of work you're looking for?` },
  ] : [];

  useEffect(() => {
    if (!chatStudent) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setChatLoading(true);
    setChatError("");
    fetchAllMessagesWithStudent(chatStudent.id, companyId)
      .then(msgs => { setChatMessages(msgs); setChatLoading(false); })
      .catch(e => { setChatLoading(false); setChatError(e?.message || "Failed to load messages — please try again."); });

    const channel = supabase
      .channel(`direct_${companyId}_${chatStudent.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `company_id=eq.${companyId}` },
        payload => {
          if (payload.new.student_id === chatStudent.id) {
            setChatMessages(prev => [...prev, payload.new]);
          }
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
    const isFirst = chatMessages.length === 0;
    setChatInput("");
    setChatError("");
    try {
      await sendMessage(null, chatStudent.id, companyId, companyId, text);
      // On first message, email the student
      if (isFirst) {
        const { data: emailRows } = await supabase.rpc("get_user_emails", { user_ids: [chatStudent.id] });
        const studentEmail = emailRows?.[0]?.email;
        if (studentEmail) {
          sendEmail({
            to: studentEmail,
            subject: `${companyName} is interested in hiring you`,
            html: emailCompanyInterested(chatStudent.name, companyName),
            magicLinkEmail: studentEmail,
            redirectTo: window.location.origin,
          }).catch(console.warn);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      console.error("Send failed:", e);
      setChatError(e.message || "Failed to send — please try again.");
    }
  };

  if (chatStudent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: "400px", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid #e5e7eb", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "#f8fafc", flexShrink: 0 }}>
          <button onClick={() => setChatStudent(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1rem", color: "#6b7280", padding: "0.2rem 0.5rem" }}>←</button>
          <div>
            <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{chatStudent.name}</p>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Direct Message</p>
          </div>
        </div>
        <div ref={msgAreaRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {chatLoading
            ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>Loading…</p>
            : chatMessages.length === 0
              ? <p style={{ color: "#9ca3af", textAlign: "center", fontSize: "0.85rem", marginTop: "2rem" }}>No messages yet. Introduce yourself!</p>
              : chatMessages.map(m => (
                <div key={m.id} style={{ alignSelf: m.sender_id === companyId ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                  <div style={{ backgroundColor: m.sender_id === companyId ? "var(--color-brand)" : "#e5e7eb", color: m.sender_id === companyId ? "white" : "#111827", padding: "0.5rem 0.8rem", borderRadius: "0.65rem", fontSize: "0.85rem", lineHeight: 1.45 }}>
                    {m.text}
                  </div>
                  <p style={{ fontSize: "0.65rem", color: "#9ca3af", margin: "0.1rem 0 0", textAlign: m.sender_id === companyId ? "right" : "left" }}>
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
          <div style={{ padding: "0.5rem 1rem 0", backgroundColor: "white", borderTop: "1.5px solid #e5e7eb" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
              {browseQuickReplies.map(qr => (
                <button key={qr.label} onMouseDown={e => { e.preventDefault(); setChatInput(qr.text); setTimeout(() => chatInputRef.current?.focus(), 0); }}
                  style={{ flexShrink: 0, padding: "0.35rem 0.75rem", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fdf2f8", color: "var(--color-brand)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >{qr.label}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ padding: "0.75rem 1rem", borderTop: chatInput ? "1.5px solid #e5e7eb" : "none", display: "flex", gap: "0.5rem", backgroundColor: "white" }}>
          <input
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendDM()}
            placeholder={`Message ${chatStudent.name}…`}
            style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
          />
          <button onClick={sendDM} style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
            Send
          </button>
        </div>
      </div>
    );
  }

  if (!fetched && loading) {
    return <p style={{ textAlign: "center", color: "#6b7280", padding: "3rem 1rem" }}>Loading students…</p>;
  }

  if (fetched && error) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", backgroundColor: "#fff1f2", borderRadius: "0.75rem", border: "1.5px solid #fca5a5" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚠️</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", color: "#b91c1c", marginBottom: "0.4rem" }}>Could not load students</p>
        <p style={{ fontSize: "0.85rem", color: "#64748b" }}>{error}</p>
      </div>
    );
  }

  if (fetched && students.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎓</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", marginBottom: "0.4rem" }}>No verified students yet</p>
        <p style={{ fontSize: "0.875rem" }}>Verified students will appear here once they join.</p>
      </div>
    );
  }

  const filtered = filterByIndustries && companyIndustries.length > 0
    ? students.filter(s => s.job_preferences?.some(p => companyIndustries.includes(p)))
    : students;

  const toMins     = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const dayCount   = avail => Object.values(avail || {}).filter(v => Array.isArray(v) && v.length > 0).length;
  const hasWeekend = avail => (Array.isArray(avail?.Saturday) && avail.Saturday.length > 0) || (Array.isArray(avail?.Sunday) && avail.Sunday.length > 0);
  const avgStart   = avail => {
    const starts = Object.values(avail || {})
      .filter(v => Array.isArray(v) && v.length > 0)
      .map(slots => Math.min(...slots.filter(t => typeof t === "string").map(toMins)));
    return starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : Infinity;
  };

  const displayStudents = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "most_available": return dayCount(b.availability) - dayCount(a.availability);
      case "weekends_first": return (hasWeekend(b.availability) ? 1 : 0) - (hasWeekend(a.availability) ? 1 : 0);
      case "earliest":       return avgStart(a.availability) - avgStart(b.availability);
      default:               return 0;
    }
  });
  const visibleStudents = displayStudents.slice(0, visibleCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <p style={{ fontSize: "0.8rem", color: "#64748b", margin: 0 }}>
          {displayStudents.length} of {students.length} verified student{students.length !== 1 ? "s" : ""}
          {filterByIndustries && companyIndustries.length > 0 ? " matching your industries" : ""}
        </p>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setFilterByIndustries(true)}
            disabled={companyIndustries.length === 0}
            title={companyIndustries.length === 0 ? "Set your industries in My Account first" : ""}
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: companyIndustries.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${filterByIndustries ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: filterByIndustries ? "#fce7f3" : "white", color: filterByIndustries ? "var(--color-brand)" : "#64748b", opacity: companyIndustries.length === 0 ? 0.5 : 1 }}
          >
            My Industries
          </button>
          <button
            onClick={() => setFilterByIndustries(false)}
            style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${!filterByIndustries ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: !filterByIndustries ? "#fce7f3" : "white", color: !filterByIndustries ? "var(--color-brand)" : "#64748b" }}
          >
            All Students
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ padding: "0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", border: "1.5px solid #e2e8f0", backgroundColor: sortBy !== "default" ? "#fce7f3" : "white", color: sortBy !== "default" ? "var(--color-brand)" : "#64748b", cursor: "pointer", fontFamily: "inherit", outline: "none" }}
          >
            <option value="default">Sort: Default</option>
            <option value="most_available">Most Days Available</option>
            <option value="weekends_first">Weekend Work</option>
            <option value="earliest">Earliest Starts</option>
          </select>
        </div>
      </div>
      {displayStudents.length === 0 && (
        <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem 1rem", fontSize: "0.875rem" }}>
          No students match your industries yet. Students need to set matching job preferences in their account.
        </p>
      )}
      {visibleStudents.map(s => {
        const isLiked   = likedStudentIds?.has(s.id);
        const hasApplied = applicantStudentIds?.has(s.id);
        return (
        <div key={s.id} style={{ backgroundColor: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "0.85rem", padding: "1rem 1.25rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {s.profile_photo_url
              ? <img loading="lazy" src={`${s.profile_photo_url}?width=100&quality=75`} alt={`${s.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "#1e293b" }}>{s.name}</p>
                {hasApplied && (
                  <span className="badge badge-sm badge-green" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Applied ✓</span>
                )}
              </div>
              <button
                onClick={() => onToggleLike?.(s.id)}
                title={isLiked ? "Remove from liked" : "Save student"}
                aria-label={isLiked ? `Remove ${s.name} from saved` : `Save ${s.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", lineHeight: 1, padding: "0.1rem 0.25rem", color: isLiked ? "#e11d48" : "#cbd5e1" }}
              >
                {isLiked ? "♥" : "♡"}
              </button>
            </div>
            {s.bio && <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.5 }}>{s.bio}</p>}
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
            <button
              onClick={() => { setChatStudent({ id: s.id, name: s.name }); setChatMessages([]); }}
              style={{ marginTop: "0.75rem", width: "100%", padding: "0.5rem 1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              Message
            </button>
          </div>
        </div>
        ); })}
      {visibleCount < displayStudents.length && (
        <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            style={{ padding: "0.6rem 1.75rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "white", color: "#1e293b", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Load more ({displayStudents.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
