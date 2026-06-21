import { useState, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { supabase } from "../../lib/supabase";
import { fetchAllMessagesWithStudent, sendMessage, sendEmail } from "../../lib/auth";
import { getSignedDocumentUrl } from "../../lib/uploads";
import { StudentAvailabilityRow } from "./shared";

const PAGE_SIZE = 20;

export default function BrowseStudents({ students, loading, fetched, error, companyIndustries, companyId, _companyName, chatStudent, setChatStudent, _setPage, likedStudentIds, applicantStudentIds, onToggleLike, postings = [] }) {
  const [filterByIndustries, setFilterByIndustries] = useState(true);
  const [locationFilter, setLocationFilter]         = useState("");
  const [sortBy, setSortBy]       = useState("default");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [sliders, setSliders]     = useState({ availability: 5, reliability: 5, skills: 3 });
  const [reliabilityMap, setReliabilityMap]     = useState({});
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  const [savedAlerts, setSavedAlerts]   = useState([]);
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  const [alertName, setAlertName]       = useState("");
  const [savingAlert, setSavingAlert]   = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [shortlistFor, setShortlistFor] = useState(null);
  const [hiredThisMonth, setHiredThisMonth] = useState(0);
  const [cvLoading, setCvLoading] = useState(new Set());
  const [dmMap, setDmMap] = useState({});

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filterByIndustries, locationFilter, sortBy, selectedJobId]);

  useEffect(() => {
    if (!companyId) return;
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "Accepted")
      .gte("updated_at", start.toISOString())
      .then(({ count }) => { if (count != null) setHiredThisMonth(count); });
  }, [companyId]);
  // Load saved alerts for this company
  useEffect(() => {
    if (!companyId || alertsLoaded) return;
    supabase.from("job_alerts").select("*").eq("company_id", companyId).order("created_at", { ascending: false })
      .then(({ data }) => { setSavedAlerts(data || []); setAlertsLoaded(true); })
      .catch(() => setAlertsLoaded(true));
  }, [companyId, alertsLoaded]);

  // Load last DM per student for this company (direct messages only, no job thread)
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

  // Load reliability scores when sort mode requires them
  useEffect(() => {
    if (sortBy !== "reliability_first" && sortBy !== "priority") return;
    if (!students.length) return;
    const missing = students.filter(s => !reliabilityMap[s.id]).map(s => s.id);
    if (!missing.length) return;
    setReliabilityLoading(true);
    supabase.rpc("get_reliability_scores_bulk", { p_student_ids: missing })
      .then(({ data }) => {
        if (!data) return;
        setReliabilityMap(prev => {
          const next = { ...prev };
          data.forEach(r => { next[r.student_id] = r.label; });
          return next;
        });
      })
      .catch(console.warn)
      .finally(() => setReliabilityLoading(false));
  }, [sortBy, students.length]);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);
  const [chatSending, setChatSending]   = useState(false);
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
    if (chatStudent.initialMessage) setChatInput(chatStudent.initialMessage);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setChatLoading(true);
    setChatError("");
    fetchAllMessagesWithStudent(chatStudent.id, companyId)
      .then(msgs => { setChatMessages(msgs); setChatLoading(false); })
      .catch(e => { setChatLoading(false); setChatError(e?.message || "Failed to load messages — please try again."); });

    const channel = supabase
      .channel(`direct_${companyId}_${chatStudent.id}`)
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
    if (!text || !chatStudent || chatSending) return;
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
    setChatSending(true);
    setChatError("");
    try {
      const sent = await sendMessage(null, chatStudent.id, companyId, companyId, text);
      setChatInput("");
      if (sent) {
        setChatMessages(prev => prev.some(m => m.id === sent.id) ? prev : [...prev, sent]);
        setDmMap(prev => ({ ...prev, [chatStudent.id]: { text: sent.text, sender_id: sent.sender_id, created_at: sent.created_at } }));
      } else {
        setDmMap(prev => ({ ...prev, [chatStudent.id]: { text, sender_id: companyId, created_at: new Date().toISOString() } }));
      }
      // On first message, email the student
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
      console.error("Send failed:", e);
      const msg = e?.message || "";
      if (msg.includes("row-level security") || msg.includes("policy") || msg.includes("violates")) {
        setChatError("This student has turned off direct messages from companies.");
      } else {
        setChatError(msg || "Failed to send — please try again.");
      }
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  // Rate limit: how many consecutive company messages since the student last replied
  let _lastStudentIdx = -1;
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    if (chatMessages[i].sender_id !== companyId) { _lastStudentIdx = i; break; }
  }
  const companyMsgsSinceReply = chatMessages.slice(_lastStudentIdx + 1).filter(m => m.sender_id === companyId).length;
  const rateLimited = !chatLoading && companyMsgsSinceReply >= 3;

  if (chatStudent) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: "400px", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", overflow: "hidden" }}>
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1.5px solid var(--color-border-light, #e5e7eb)", display: "flex", alignItems: "center", gap: "0.75rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", flexShrink: 0 }}>
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
          <div style={{ padding: "0.5rem 1rem 0", backgroundColor: "var(--color-bg-elevated, white)", borderTop: "1.5px solid var(--color-border-light, #e5e7eb)" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.68rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick replies</p>
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
              {browseQuickReplies.map(qr => (
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
            {chatInput.length > 3800 && (
              <div style={{ padding: "0.25rem 1rem 0", backgroundColor: "var(--color-bg-elevated, white)" }}>
                <span style={{ fontSize: "0.72rem", color: chatInput.length >= 4000 ? "#ef4444" : "#f97316", fontWeight: 600 }}>
                  {chatInput.length}/4000 characters
                </span>
              </div>
            )}
            <div style={{ padding: "0.75rem 1rem", borderTop: chatInput ? "1.5px solid var(--color-border-light, #e5e7eb)" : "none", display: "flex", gap: "0.5rem", backgroundColor: "var(--color-bg-elevated, white)" }}>
              <input
                ref={chatInputRef}
                aria-label={`Message ${chatStudent.name}`}
                value={chatInput}
                onChange={e => { if (e.target.value.length <= 4000) setChatInput(e.target.value); }}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendDM()}
                placeholder={`Message ${chatStudent.name}…`}
                maxLength={4000}
                style={{ flex: 1, padding: "0.55rem 0.85rem", borderRadius: "2rem", border: "1.5px solid #d1d5db", fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}
              />
              <button
                onClick={sendDM}
                disabled={!chatInput.trim() || chatSending}
                aria-label="Send message"
                style={{ padding: "0.55rem 1.1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: (!chatInput.trim() || chatSending) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!chatInput.trim() || chatSending) ? 0.5 : 1 }}>
                {chatSending ? "…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!fetched && loading) {
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

  if (fetched && students.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #6b7280)" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🎓</p>
        <p style={{ fontWeight: "700", fontSize: "1rem", marginBottom: "0.4rem" }}>No verified students yet</p>
        <p style={{ fontSize: "0.875rem" }}>Verified students will appear here once they join.</p>
      </div>
    );
  }

  const filtered = students
    .filter(s => !filterByIndustries || !companyIndustries.length || s.job_preferences?.some(p => companyIndustries.includes(p)))
    .filter(s => !locationFilter.trim() || s.location_display?.toLowerCase().includes(locationFilter.toLowerCase()));

  const toMins     = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const dayCount   = avail => Object.values(avail || {}).filter(v => Array.isArray(v) && v.length > 0).length;
  const hasWeekend = avail => (Array.isArray(avail?.Saturday) && avail.Saturday.length > 0) || (Array.isArray(avail?.Sunday) && avail.Sunday.length > 0);
  const avgStart   = avail => {
    const starts = Object.values(avail || {})
      .filter(v => Array.isArray(v) && v.length > 0)
      .map(slots => Math.min(...slots.filter(t => typeof t === "string").map(toMins)));
    return starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : Infinity;
  };

  const selectedJob = postings.find(p => p.id === Number(selectedJobId) || p.id === selectedJobId) || null;
  const jobMatchScore = (s) => {
    if (!selectedJob?.days?.length || !s.availability) return 0;
    return selectedJob.days.filter(day => (s.availability[day] || []).length > 0).length;
  };

  const reliabilityRank = label => label === "Reliable" ? 0 : label === "New" ? 1 : 2;

  const priorityScore = (s) => {
    const availNorm = Math.min(dayCount(s.availability) / 7, 1);
    const relLabel  = reliabilityMap[s.id];
    const relNorm   = relLabel === "Reliable" ? 1 : relLabel === "Flagged" ? 0 : 0.5;
    const skillNorm = Math.min((s.skills?.length || 0) / 8, 1);
    return availNorm * sliders.availability + relNorm * sliders.reliability + skillNorm * sliders.skills;
  };

  const displayStudents = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "most_available":    return dayCount(b.availability) - dayCount(a.availability);
      case "weekends_first":    return (hasWeekend(b.availability) ? 1 : 0) - (hasWeekend(a.availability) ? 1 : 0);
      case "earliest":          return avgStart(a.availability) - avgStart(b.availability);
      case "match_job":         return jobMatchScore(b) - jobMatchScore(a);
      case "reliability_first": return reliabilityRank(reliabilityMap[a.id]) - reliabilityRank(reliabilityMap[b.id]);
      case "priority":          return priorityScore(b) - priorityScore(a);
      default:                  return 0;
    }
  });

  const perfectMatchCount = sortBy === "match_job" && selectedJob
    ? displayStudents.filter(s => jobMatchScore(s) === selectedJob.days.length).length
    : 0;
  const showGoodEnough = sortBy === "match_job" && selectedJob && displayStudents.length > 0 && perfectMatchCount < displayStudents.length;

  const visibleStudents = displayStudents.slice(0, visibleCount);

  const applyAlert = (alert) => {
    const c = alert.criteria || {};
    if (c.sortBy)                        setSortBy(c.sortBy);
    if (c.selectedJobId !== undefined)   setSelectedJobId(c.selectedJobId || "");
    if (typeof c.filterByIndustries === "boolean") setFilterByIndustries(c.filterByIndustries);
    if (c.locationFilter !== undefined)  setLocationFilter(c.locationFilter || "");
    setVisibleCount(PAGE_SIZE);
  };

  const saveAlert = async () => {
    if (!alertName.trim() || !companyId || savingAlert) return;
    setSavingAlert(true);
    const criteria = { sortBy, selectedJobId: selectedJobId || null, filterByIndustries, locationFilter: locationFilter || null };
    const { data, error } = await supabase.from("job_alerts").insert({ company_id: companyId, label: alertName.trim(), criteria }).select().single();
    if (!error && data) { setSavedAlerts(prev => [data, ...prev]); toast.success("Alert saved!"); }
    setAlertName(""); setShowSaveAlert(false); setSavingAlert(false);
  };

  const deleteAlert = async (id) => {
    await supabase.from("job_alerts").delete().eq("id", id);
    setSavedAlerts(prev => prev.filter(a => a.id !== id));
  };

  const alertMatchCount = (alert) => {
    const c = alert.criteria || {};
    return students
      .filter(s => !c.filterByIndustries || !companyIndustries.length || s.job_preferences?.some(p => companyIndustries.includes(p)))
      .filter(s => !c.locationFilter || s.location_display?.toLowerCase().includes(c.locationFilter.toLowerCase()))
      .length;
  };

  const viewCV = async (studentId, cvUrl) => {
    setCvLoading(prev => new Set(prev).add(studentId));
    try {
      const url = await getSignedDocumentUrl("documents", cvUrl);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open CV — please try again.");
    } finally {
      setCvLoading(prev => { const n = new Set(prev); n.delete(studentId); return n; });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>

      {/* Saved alerts strip */}
      {savedAlerts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>Saved:</span>
          {savedAlerts.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0", borderRadius: "999px", border: "1.5px solid var(--color-border-light, #e2e8f0)", overflow: "hidden", backgroundColor: "var(--color-bg-elevated, white)" }}>
              <button onClick={() => applyAlert(a)} style={{ padding: "0.22rem 0.6rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-brand)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                {a.label} <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)" }}>({alertMatchCount(a)})</span>
              </button>
              <button onClick={() => deleteAlert(a.id)} style={{ padding: "0.22rem 0.45rem 0.22rem 0", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "#94a3b8", fontFamily: "inherit", lineHeight: 1 }} aria-label={`Delete ${a.label} alert`}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", margin: 0 }}>
              {displayStudents.length} of {students.length} verified student{students.length !== 1 ? "s" : ""}
              {filterByIndustries && companyIndustries.length > 0 ? " matching your industries" : ""}
            </p>
            {hiredThisMonth > 0 && (
              <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", borderRadius: "999px", padding: "0.15rem 0.55rem", whiteSpace: "nowrap" }}>
                {hiredThisMonth} hired this month
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
            <button
              onClick={() => setFilterByIndustries(true)}
              disabled={companyIndustries.length === 0}
              title={companyIndustries.length === 0 ? "Set your industries in My Account first" : ""}
              style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: companyIndustries.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", border: `1.5px solid ${filterByIndustries ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: filterByIndustries ? "#fce7f3" : "var(--color-bg-elevated, white)", color: filterByIndustries ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", opacity: companyIndustries.length === 0 ? 0.5 : 1 }}
            >My Industries</button>
            <button
              onClick={() => setFilterByIndustries(false)}
              style={{ padding: "0.3rem 0.85rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${!filterByIndustries ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: !filterByIndustries ? "#fce7f3" : "var(--color-bg-elevated, white)", color: !filterByIndustries ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)" }}
            >All Students</button>
            <select
              value={sortBy}
              onChange={e => { setSortBy(e.target.value); if (e.target.value !== "match_job") setSelectedJobId(""); }}
              style={{ padding: "0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", border: "1.5px solid #e2e8f0", backgroundColor: sortBy !== "default" ? "#fce7f3" : "var(--color-bg-elevated, white)", color: sortBy !== "default" ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", cursor: "pointer", fontFamily: "inherit", outline: "none" }}
            >
              <option value="default">Sort: Default</option>
              <option value="most_available">Most Days Available</option>
              <option value="weekends_first">Weekend Work</option>
              <option value="earliest">Earliest Starts</option>
              {postings.filter(p => p.status === "Active").length > 0 && <option value="match_job">Match to Job</option>}
              <option value="reliability_first">Reliability {reliabilityLoading ? "(loading…)" : ""}</option>
              <option value="priority">Custom Priority</option>
            </select>
            {sortBy === "match_job" && (
              <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
                style={{ padding: "0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", border: "1.5px solid var(--color-brand)", backgroundColor: "#fce7f3", color: "var(--color-brand)", cursor: "pointer", fontFamily: "inherit", outline: "none" }}
              >
                <option value="">Pick a job…</option>
                {postings.filter(p => p.status === "Active").map(p => (<option key={p.id} value={p.id}>{p.title}</option>))}
              </select>
            )}
            {showSaveAlert ? (
              <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                <input autoFocus value={alertName} onChange={e => setAlertName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveAlert(); if (e.key === "Escape") { setShowSaveAlert(false); setAlertName(""); } }} placeholder="Alert name…" style={{ padding: "0.25rem 0.55rem", borderRadius: "0.4rem", border: "1.5px solid #d1d5db", fontSize: "0.75rem", fontFamily: "inherit", width: "130px" }} />
                <button onClick={saveAlert} disabled={!alertName.trim() || savingAlert} style={{ padding: "0.25rem 0.6rem", borderRadius: "0.4rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.75rem", cursor: alertName.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                <button onClick={() => { setShowSaveAlert(false); setAlertName(""); }} style={{ padding: "0.25rem 0.5rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", background: "none", color: "var(--color-text-secondary, #64748b)", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>×</button>
              </div>
            ) : (
              <button onClick={() => { setAlertName(""); setShowSaveAlert(true); }} title="Save current filters as a named alert" style={{ padding: "0.3rem 0.65rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", cursor: "pointer", fontFamily: "inherit" }}>＋ Save Alert</button>
            )}
          </div>
        </div>

        {/* Location filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            placeholder="Filter by location (e.g. Dublin, Cork…)"
            style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", border: `1.5px solid ${locationFilter ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, fontSize: "0.78rem", fontFamily: "inherit", outline: "none", width: "220px", backgroundColor: locationFilter ? "#fce7f3" : "var(--color-bg-elevated, white)", color: locationFilter ? "var(--color-brand)" : "inherit" }}
          />
          {locationFilter && <button onClick={() => setLocationFilter("")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#94a3b8", padding: 0 }}>×</button>}
        </div>

        {/* Priority sliders */}
        {sortBy === "priority" && (
          <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "0.85rem 1rem" }}>
            <p style={{ margin: "0 0 0.65rem", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Adjust priorities — list re-ranks instantly</p>
            {[
              { key: "availability", label: "Availability breadth", hint: "Days & hours available per week" },
              { key: "reliability",  label: "Reliability",          hint: "Track record of showing up" },
              { key: "skills",       label: "Skills count",         hint: "Number of listed skills" },
            ].map(({ key, label, hint }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <div style={{ width: "130px", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: "600", color: "var(--color-text-primary, #1e293b)" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--color-text-secondary, #64748b)" }}>{hint}</p>
                </div>
                <input type="range" min="0" max="10" value={sliders[key]} onChange={e => setSliders(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: "var(--color-brand)", cursor: "pointer" }} />
                <span style={{ width: "24px", textAlign: "center", fontSize: "0.78rem", fontWeight: "700", color: sliders[key] > 0 ? "var(--color-brand)" : "#94a3b8" }}>{sliders[key]}</span>
              </div>
            ))}
            {sliders.reliability > 0 && reliabilityLoading && <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>Loading reliability data…</p>}
          </div>
        )}
      </div>
      {showGoodEnough && (
        <div style={{ backgroundColor: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: "0.75rem", padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#92400e", lineHeight: 1.4 }}>
            {perfectMatchCount > 0
              ? <><strong>{perfectMatchCount}</strong> student{perfectMatchCount !== 1 ? "s" : ""} match all shift days — the rest are partial matches shown below.</>
              : <>No exact availability match for <strong>{selectedJob?.title}</strong> right now — showing your closest {displayStudents.length} student{displayStudents.length !== 1 ? "s" : ""}.</>
            }
          </p>
        </div>
      )}
      {displayStudents.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.65rem" }}>🔍</div>
          <p style={{ margin: "0 0 0.35rem", fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>
            {locationFilter ? `No students found in "${locationFilter}"` : "No students match your industries"}
          </p>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>
            {locationFilter ? "Try a broader location or clear the filter." : <>Students need to set matching job preferences in their account.<br />You can browse all students instead.</>}
          </p>
          {locationFilter
            ? <button onClick={() => setLocationFilter("")} style={{ padding: "0.6rem 1.5rem", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit" }}>Clear Location Filter</button>
            : <button onClick={() => setFilterByIndustries(false)} style={{ padding: "0.6rem 1.5rem", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(162,29,84,0.3)" }}>Browse All Students</button>
          }
        </div>
      )}
      {visibleStudents.map(s => {
        const isLiked   = likedStudentIds?.has(s.id);
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{s.name}</p>
                {hasApplied && (
                  <span className="badge badge-sm badge-green" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>Applied ✓</span>
                )}
                {reliabilityMap[s.id] === "Reliable" && (
                  <span className="badge badge-sm" style={{ whiteSpace: "nowrap", flexShrink: 0, backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>✓ Reliable</span>
                )}
                {reliabilityMap[s.id] === "Flagged" && (
                  <span className="badge badge-sm" style={{ whiteSpace: "nowrap", flexShrink: 0, backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5" }}>⚠ Flagged</span>
                )}
                {sortBy === "match_job" && selectedJob && (
                  <span className="badge badge-sm" style={{ whiteSpace: "nowrap", flexShrink: 0, backgroundColor: jobMatchScore(s) === selectedJob.days.length ? "#fce7f3" : "#f8fafc", color: jobMatchScore(s) === selectedJob.days.length ? "var(--color-brand)" : "#64748b", border: `1px solid ${jobMatchScore(s) === selectedJob.days.length ? "var(--color-brand)" : "#e2e8f0"}` }}>
                    🎯 {jobMatchScore(s)}/{selectedJob.days.length} shifts
                  </span>
                )}
                {sortBy === "priority" && (
                  <span className="badge badge-sm" style={{ whiteSpace: "nowrap", flexShrink: 0, backgroundColor: "#fce7f3", color: "var(--color-brand)", border: "1px solid var(--color-brand)" }}>
                    ⭐ {priorityScore(s).toFixed(1)}
                  </span>
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
            {s.location_display && <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>📍 {s.location_display}</p>}
            {s.bio && <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>{s.bio.length > 160 ? s.bio.slice(0, 160).trimEnd() + "…" : s.bio}</p>}
            {s.skills?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                {s.skills.slice(0, 5).map(sk => (
                  <span key={sk} className="badge badge-sm badge-blue">{sk}</span>
                ))}
              </div>
            )}
            {s.job_preferences?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.4rem" }}>
                {s.job_preferences.map(p => (
                  <span key={p} className="badge badge-sm badge-green">{p}</span>
                ))}
              </div>
            )}
            {s.work_experience_entries?.length > 0 && (() => {
              const jobSector = selectedJob?.category || null;
              const matchingSectors = new Set([...(companyIndustries || []), ...(jobSector ? [jobSector] : [])]);
              const matchCount = s.work_experience_entries.filter(e => matchingSectors.has(e.sector)).length;
              return (
                <div style={{ marginBottom: "0.4rem" }}>
                  {matchCount > 0 && (
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.7rem", fontWeight: "700", color: "#16a34a" }}>
                      ✓ {matchCount}/{s.work_experience_entries.length} experience match{matchCount !== 1 ? "es" : ""}
                    </p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {s.work_experience_entries.map((e, i) => {
                      const dur = { under1: "< 1 yr", "1to3": "1–3 yrs", "3plus": "3+ yrs" }[e.duration] || e.duration;
                      const isMatch = matchingSectors.has(e.sector);
                      return (
                        <span key={i} style={{ fontSize: "0.72rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: isMatch ? "#dcfce7" : "#f3f4f6", color: isMatch ? "#15803d" : "#64748b", border: `1px solid ${isMatch ? "#86efac" : "#e2e8f0"}` }}>
                          {e.sector} · {e.role} · {dur}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={s.allow_company_dm !== false ? () => { setChatStudent({ id: s.id, name: s.name }); setChatMessages([]); } : undefined}
                disabled={s.allow_company_dm === false}
                title={s.allow_company_dm === false ? "This student has turned off direct messages from companies" : undefined}
                style={{ flex: 1, padding: "0.5rem 1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: s.allow_company_dm === false ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: s.allow_company_dm === false ? 0.4 : 1 }}
              >
                {s.allow_company_dm === false ? "DMs Off" : "Message"}
              </button>
              {s.cv_url && (
                <button
                  onClick={() => viewCV(s.id, s.cv_url)}
                  disabled={cvLoading.has(s.id)}
                  style={{ padding: "0.5rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "700", fontSize: "0.82rem", cursor: cvLoading.has(s.id) ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", opacity: cvLoading.has(s.id) ? 0.6 : 1 }}
                >
                  {cvLoading.has(s.id) ? "Opening…" : "📄 CV"}
                </button>
              )}
              {s.linkedin && (
                <a
                  href={s.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ padding: "0.5rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "#0a66c2", fontWeight: "700", fontSize: "0.82rem", textDecoration: "none", display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}
                >
                  in LinkedIn
                </a>
              )}
              {postings.length > 0 && (
                <button
                  onClick={() => setShortlistFor(shortlistFor === s.id ? null : s.id)}
                  style={{ padding: "0.5rem 0.9rem", borderRadius: "2rem", border: `1.5px solid ${shortlistFor === s.id ? "var(--color-brand)" : "#e2e8f0"}`, background: shortlistFor === s.id ? "#fce7f3" : "white", color: shortlistFor === s.id ? "var(--color-brand)" : "#374151", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  Shortlist →
                </button>
              )}
            </div>
            {shortlistFor === s.id && postings.length > 0 && (
              <div style={{ marginTop: "0.5rem", padding: "0.65rem 0.85rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.65rem" }}>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Shortlist for which job?</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                  {postings.filter(p => p.status === "Active").map(p => (
                    <button key={p.id} onClick={() => {
                      if (!likedStudentIds?.has(s.id)) onToggleLike?.(s.id);
                      toast.success(`${s.name} added to ${p.title} shortlist`);
                      setShortlistFor(null);
                    }} style={{ padding: "0.3rem 0.7rem", borderRadius: "999px", border: "1.5px solid var(--color-brand)", background: "var(--color-bg-elevated, white)", color: "var(--color-brand)", fontWeight: "700", fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}>
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        ); })}
      {visibleCount < displayStudents.length ? (
        <div style={{ textAlign: "center", paddingTop: "0.5rem" }}>
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            style={{ padding: "0.6rem 1.75rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "var(--color-bg-elevated, white)", color: "var(--color-text-primary, #1e293b)", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Load more ({displayStudents.length - visibleCount} remaining)
          </button>
        </div>
      ) : displayStudents.length > 0 && (
        <p style={{ textAlign: "center", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", paddingTop: "0.5rem", margin: 0 }}>
          All {displayStudents.length} student{displayStudents.length !== 1 ? "s" : ""} shown
        </p>
      )}
    </div>
  );
}
