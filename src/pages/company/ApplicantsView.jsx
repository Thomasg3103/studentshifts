import { useState } from "react";
import toast from "react-hot-toast";
import DetailPanel, { StatusBadge, CloseJobModal } from "./DetailPanel";

/* ─── Pipeline stage constants ───────────────────────────────────────────── */

export const PIPELINE_STAGES = [
  { key: "applied",     label: "Applied" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview",   label: "Interview" },
  { key: "trial",       label: "Trial" },
  { key: "decision",    label: "Decision" },
];

// Returns a virtual stage key that includes the round number for interview stages
export const getVirtualStageKey = (a) =>
  a.pipelineStage === "interview" ? `interview_${a.interviewRound || 1}` : a.pipelineStage;

// Decodes a virtual stage key back to the DB stage + round
export const resolveStageKey = (key) => {
  if (key.startsWith("interview_")) {
    return { dbStage: "interview", round: parseInt(key.replace("interview_", ""), 10) };
  }
  return { dbStage: key, round: undefined };
};

// Builds the dynamic stage list, expanding interview rounds as they're added
export const buildDynamicStages = (applicants) => {
  const maxRound = applicants.reduce(
    (m, a) => a.pipelineStage === "interview" ? Math.max(m, a.interviewRound || 1) : m, 1
  );
  return [
    { key: "applied",     label: "Applied" },
    { key: "shortlisted", label: "Shortlisted" },
    ...Array.from({ length: maxRound }, (_, i) => ({
      key:   `interview_${i + 1}`,
      label: i === 0 ? "Interview" : `Interview Rd ${i + 1}`,
    })),
    { key: "trial",    label: "Trial" },
    { key: "decision", label: "Decision" },
  ];
};

/* ─── ApplicantRow ───────────────────────────────────────────────────────── */

function ApplicantRow({ applicant, onClick, onHire, onDecline, isSelected, onToggleSelect, isInvited }) {
  const isDecision = applicant.pipelineStage === "decision" && applicant.status === "Pending";
  const [hireLoading, setHireLoading] = useState(false);
  const statusColors = {
    Accepted: { cls: "badge-green", label: "Hired" },
    Rejected: { cls: "badge-red",   label: "Declined" },
  };
  const sc = statusColors[applicant.status];
  return (
    <div
      style={{ borderRadius: "0.5rem", border: `1px solid ${isSelected ? "var(--color-brand)" : "#e2e8f0"}`, overflow: "hidden", backgroundColor: isSelected ? "#fdf8fb" : "white", transition: "all 0.12s", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; } }}
      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; } }}
    >
      <button
        onClick={onClick}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1rem", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
      >
        {/* Checkbox — pending only */}
        {applicant.status === "Pending" && (
          <div onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <input type="checkbox" checked={isSelected || false} aria-label={`Select ${applicant.name}`} onChange={() => {}} onClick={e => { e.stopPropagation(); onToggleSelect?.(); }} style={{ cursor: "pointer", accentColor: "var(--color-brand)", width: "15px", height: "15px" }} />
          </div>
        )}
        {/* Photo */}
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {applicant.profilePhoto
            ? <img loading="lazy" src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          }
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem", flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#0f172a" }}>{applicant.name}</p>
            {sc && <span className={`badge badge-tag ${sc.cls}`} style={{ flexShrink: 0 }}>{sc.label}</span>}
            {isInvited && <span className="badge badge-tag badge-blue" style={{ flexShrink: 0 }}>Invite sent</span>}
            {applicant.linkedin && <span className="badge badge-tag badge-blue" style={{ flexShrink: 0 }}>LinkedIn</span>}
          </div>
          {applicant.preferredShift && (
            <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", color: "#64748b" }}>{applicant.preferredShift}</p>
          )}
          {applicant.skills?.length > 0 ? (
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {applicant.skills.slice(0, 4).map(s => (
                <span key={s} className="badge badge-tag badge-gray">{s}</span>
              ))}
            </div>
          ) : applicant.bio ? (
            <p style={{ margin: "0.1rem 0 0", fontSize: "0.72rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.bio}</p>
          ) : null}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
      </button>
      {isDecision && (
        <div style={{ display: "flex", borderTop: "1px solid #e2e8f0" }}>
          <button
            disabled={hireLoading}
            onClick={async (e) => { e.stopPropagation(); setHireLoading(true); try { await onHire?.(applicant); } finally { setHireLoading(false); } }}
            style={{ flex: 1, padding: "0.6rem", backgroundColor: "white", border: "none", borderRight: "1px solid #e2e8f0", color: "#15803d", fontWeight: "600", fontSize: "0.8rem", cursor: hireLoading ? "default" : "pointer", fontFamily: "inherit", opacity: hireLoading ? 0.6 : 1 }}
          >{hireLoading ? "Hiring…" : "Hire Applicant"}</button>
          <button
            disabled={hireLoading}
            onClick={async (e) => { e.stopPropagation(); setHireLoading(true); try { await onDecline?.(applicant); } finally { setHireLoading(false); } }}
            style={{ flex: 1, padding: "0.6rem", backgroundColor: "white", border: "none", color: "#b91c1c", fontWeight: "600", fontSize: "0.8rem", cursor: hireLoading ? "default" : "pointer", fontFamily: "inherit", opacity: hireLoading ? 0.6 : 1 }}
          >{hireLoading ? "Processing…" : "Decline"}</button>
        </div>
      )}
    </div>
  );
}

/* ─── KanbanBoard ────────────────────────────────────────────────────────── */

function KanbanBoard({ applicants, stages, onSelectApplicant, onMoveToStage }) {
  const [draggingId, setDraggingId]       = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const stageColor = (key) => {
    if (key === "applied")            return "#475569";
    if (key === "shortlisted")        return "#0369a1";
    if (key.startsWith("interview_")) return "#6d28d9";
    if (key === "trial")              return "#15803d";
    if (key === "decision")           return "#b45309";
    return "#475569";
  };

  const handleDrop = (e, targetKey) => {
    e.preventDefault();
    setDragOverStage(null);
    if (!draggingId) return;
    const a = applicants.find(x => x.id === draggingId);
    if (a && getVirtualStageKey(a) !== targetKey) onMoveToStage?.(draggingId, targetKey);
    setDraggingId(null);
  };

  const statusChip = {
    Pending:  { bg: "#f1f5f9", text: "#475569", label: "Under Review" },
    Accepted: { bg: "#dcfce7", text: "#15803d", label: "Hired" },
    Rejected: { bg: "#fee2e2", text: "#b91c1c", label: "Declined" },
  };

  return (
    <div role="list" aria-label="Pipeline board" style={{ display: "flex", gap: "0.85rem", overflowX: "auto", paddingBottom: "1rem", alignItems: "flex-start" }}>
      {(stages || []).map(({ key, label }) => {
        const cards  = applicants.filter(a => getVirtualStageKey(a) === key);
        const color  = stageColor(key);
        const isOver = dragOverStage === key;
        return (
          <div
            key={key}
            role="listitem"
            aria-label={`${label}: ${cards.length} applicant${cards.length !== 1 ? "s" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOverStage(key); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStage(null); }}
            onDrop={e => handleDrop(e, key)}
            style={{
              minWidth: "270px", flex: "0 0 270px",
              backgroundColor: "#f8fafc",
              border: `1.5px solid ${isOver ? color : "#e2e8f0"}`,
              borderRadius: "0.75rem",
              overflow: "hidden",
              boxShadow: isOver ? `0 0 0 3px ${color}30` : "0 1px 4px rgba(0,0,0,0.05)",
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            {/* Coloured header bar */}
            <div style={{ backgroundColor: color, padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "800", color: "white", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: "700", backgroundColor: "rgba(255,255,255,0.22)", color: "white", borderRadius: "999px", padding: "0.1rem 0.55rem", minWidth: "20px", textAlign: "center" }}>{cards.length}</span>
            </div>

            {/* Cards */}
            <div style={{ padding: "0.6rem", display: "flex", flexDirection: "column", gap: "0.55rem", minHeight: "80px" }}>
              {cards.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem 0", color: isOver ? color : "#cbd5e1", fontSize: "0.78rem", fontWeight: isOver ? "600" : "400" }}>
                  {isOver ? "Drop here" : "No applicants"}
                </div>
              )}
              {cards.map(applicant => {
                const sc = statusChip[applicant.status] || statusChip.Pending;
                return (
                  <button
                    key={applicant.id}
                    draggable
                    aria-label={`${applicant.name} — ${sc.label}. Drag to move stage.`}
                    onDragStart={e => {
                      setDraggingId(applicant.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", applicant.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverStage(null); }}
                    onClick={() => onSelectApplicant(applicant)}
                    style={{
                      width: "100%", display: "block",
                      padding: "0.9rem 0.95rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "white",
                      cursor: "grab", fontFamily: "inherit", textAlign: "left",
                      opacity: draggingId === applicant.id ? 0.4 : 1,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                      transition: "opacity 0.15s",
                    }}
                  >
                    {/* Avatar + name row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.65rem" }}>
                      <div style={{ width: "38px", height: "38px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {applicant.profilePhoto
                          ? <img loading="lazy" src={applicant.profilePhoto} alt={applicant.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 0.2rem", fontSize: "0.875rem", fontWeight: "700", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.name}</p>
                        <span style={{ fontSize: "0.72rem", fontWeight: "600", padding: "0.1rem 0.45rem", borderRadius: "0.25rem", backgroundColor: sc.bg, color: sc.text }}>{sc.label}</span>
                      </div>
                    </div>

                    {/* Preferred shift chip */}
                    {applicant.preferredShift && (
                      <div style={{ marginBottom: "0.55rem" }}>
                        <span className="badge badge-tag badge-gray">{applicant.preferredShift}</span>
                      </div>
                    )}

                    {/* Skills */}
                    {applicant.skills?.length > 0 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                        {applicant.skills.slice(0, 3).map(s => (
                          <span key={s} className="badge badge-tag badge-gray">{s}</span>
                        ))}
                      </div>
                    )}

                    {/* Bio fallback if no skills */}
                    {!applicant.skills?.length && applicant.bio && (
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{applicant.bio}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── ApplicantsView ─────────────────────────────────────────────────────── */

export default function ApplicantsView({ posting, onUpdateStatus, onStageChange, onNotesSaved, onCloseJob, companyId, onIncrementRound, onSaveTrialSchedule, onSaveInterviewRoundsData, onSendInterviewInvite, onSendTrialInvite, likedStudents, viewMode }) {
  const [activeStage, setActiveStage]             = useState("applied");
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [showCloseJob, setShowCloseJob]           = useState(false);
  const [search, setSearch]                       = useState("");
  const [sortBy, setSortBy]                       = useState("default"); // "default" | "name_asc" | "name_desc" | "status"
  const [selectedIds, setSelectedIds]             = useState(new Set());
  const [invitedIds, setInvitedIds]               = useState(new Set());
  const [bulkDeclining, setBulkDeclining]         = useState(false);
  const [showBulkDeclineModal, setShowBulkDeclineModal] = useState(false);
  const [pendingDeclineIds, setPendingDeclineIds] = useState([]);

  if (posting.applicantsLoading) {
    return <div style={{ textAlign: "center", padding: "3rem 1rem" }}><div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div><p style={{ color: "#64748b", fontWeight: "600", margin: 0 }}>Loading applicants…</p></div>;
  }
  if (posting.applicantsError) {
    return <div style={{ textAlign: "center", padding: "2rem 1rem", backgroundColor: "#fff1f2", borderRadius: "0.75rem", border: "1.5px solid #fca5a5" }}><div style={{ fontSize: "1.5rem", marginBottom: "0.35rem" }}>⚠️</div><p style={{ color: "#e11d48", fontWeight: "600", margin: 0 }}>Error loading applicants. Please try again.</p></div>;
  }
  if (posting.applicants.length === 0) {
    return <div style={{ textAlign: "center", padding: "3.5rem 1rem" }}><div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>📭</div><p style={{ color: "#1e293b", fontWeight: "700", fontSize: "1rem", margin: "0 0 0.35rem" }}>No applicants yet</p><p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>Share this job posting to start receiving applications.</p></div>;
  }

  const dynamicStages = buildDynamicStages(posting.applicants);

  const countFor = (key) => posting.applicants.filter(a => getVirtualStageKey(a) === key).length;
  const stageApplicants = posting.applicants.filter(a => getVirtualStageKey(a) === activeStage);
  const searched = search.trim()
    ? stageApplicants.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : stageApplicants;
  const visible = [...searched].sort((a, b) => {
    if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "status") {
      const order = { Pending: 0, Accepted: 1, Rejected: 2 };
      return (order[a.status] ?? 0) - (order[b.status] ?? 0);
    }
    return 0;
  });

  // Keep selected applicant in sync when parent state updates (stage/notes changes)
  const liveSelected = selectedApplicant
    ? posting.applicants.find(a => a.id === selectedApplicant.id) || selectedApplicant
    : null;

  const handleStageAction = async (applicationId, stageKey) => {
    const { dbStage, round } = resolveStageKey(stageKey);
    await onStageChange(applicationId, dbStage, round);
    if (stageKey === "interview_1" && window.gtag) {
      window.gtag("event", "generate_lead", { application_id: applicationId, posting_id: posting?.id });
    }
    setSelectedApplicant(null);
    setActiveStage(stageKey);
  };

  // Wrapper: increments round, switches to the new round's tab, closes panel
  const handleRoundIncrement = async (applicationId, currentRound, newRoundsData) => {
    await onIncrementRound(applicationId, currentRound, newRoundsData);
    setSelectedApplicant(null);
    setActiveStage(`interview_${currentRound + 1}`);
  };

  const bulkDecline = () => {
    const pendingSelected = [...selectedIds].filter(id => {
      const a = posting.applicants.find(x => x.id === id);
      return a && a.status === "Pending";
    });
    if (pendingSelected.length === 0) { setSelectedIds(new Set()); return; }
    setPendingDeclineIds(pendingSelected);
    setShowBulkDeclineModal(true);
  };

  const confirmBulkDecline = async () => {
    setShowBulkDeclineModal(false);
    setBulkDeclining(true);
    for (const id of pendingDeclineIds) {
      const applicant = posting.applicants.find(a => a.id === id);
      if (applicant) await onUpdateStatus(id, "Rejected", applicant);
    }
    setBulkDeclining(false);
    setSelectedIds(new Set());
    setPendingDeclineIds([]);
  };

  const wrappedSendInterviewInvite = async (applicationId, ...args) => {
    await onSendInterviewInvite(applicationId, ...args);
    setInvitedIds(prev => new Set([...prev, applicationId]));
  };

  const wrappedSendTrialInvite = async (applicationId, ...args) => {
    await onSendTrialInvite(applicationId, ...args);
    setInvitedIds(prev => new Set([...prev, applicationId]));
  };

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div>
      {/* Bulk Decline Confirmation Modal */}
      {showBulkDeclineModal && (
        <div onClick={() => setShowBulkDeclineModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Decline ${pendingDeclineIds.length} applicants`} style={{ backgroundColor: "white", borderRadius: "1rem", padding: "2rem", maxWidth: "400px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: "1.1rem" }}>✕</span>
              </div>
              <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "#0f172a" }}>
                Decline {pendingDeclineIds.length} applicant{pendingDeclineIds.length !== 1 ? "s" : ""}?
              </h3>
            </div>
            <p style={{ margin: "0 0 1.5rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6 }}>
              Each applicant will receive a rejection email. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowBulkDeclineModal(false)}
                style={{ padding: "0.55rem 1.25rem", borderRadius: "0.55rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkDecline}
                style={{ padding: "0.55rem 1.25rem", borderRadius: "0.55rem", border: "none", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", fontWeight: "700", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(244,63,94,0.3)" }}
              >
                Decline {pendingDeclineIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search + sort bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "180px", position: "relative" }}>
          <span style={{ position: "absolute", left: "0.65rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", pointerEvents: "none", color: "#94a3b8" }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search applicants…"
            aria-label="Search applicants"
            style={{ width: "100%", padding: "0.45rem 0.75rem 0.45rem 2rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151", boxSizing: "border-box", outline: "none" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.8rem", lineHeight: 1, padding: "0.1rem" }}>✕</button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          aria-label="Sort applicants"
          style={{ padding: "0.45rem 0.65rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "#374151", backgroundColor: "white", cursor: "pointer", outline: "none" }}
        >
          <option value="default">Sort: Default</option>
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="status">By Status</option>
        </select>
      </div>

      {viewMode === "kanban" ? (
        <KanbanBoard
          applicants={posting.applicants}
          stages={dynamicStages}
          onSelectApplicant={setSelectedApplicant}
          onMoveToStage={async (applicationId, stageKey) => {
            const { dbStage, round } = resolveStageKey(stageKey);
            try { await onStageChange(applicationId, dbStage, round); }
            catch (e) { toast.error(`Failed to move: ${e?.message || "Unknown error"}`); }
          }}
        />
      ) : (<>
        {/* Pipeline stage tabs */}
        <div role="tablist" aria-label="Pipeline stages" style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", overflowX: "auto", borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {dynamicStages.map(({ key, label }) => {
          const count  = countFor(key);
          const active = activeStage === key;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => { setActiveStage(key); setSelectedIds(new Set()); }}
              style={{
                flexShrink: 0,
                padding: "0.55rem 1.1rem",
                border: "none",
                borderBottom: active ? "2px solid var(--color-brand)" : "2px solid transparent",
                marginBottom: "-2px",
                background: "transparent",
                fontWeight: active ? "700" : "600",
                fontSize: "0.82rem",
                color: active ? "var(--color-brand)" : "#64748b",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                whiteSpace: "nowrap",
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: "0.68rem", fontWeight: "700",
                  backgroundColor: active ? "var(--color-brand)" : "#94a3b8",
                  color: "white", borderRadius: "999px",
                  padding: "0.05rem 0.4rem", minWidth: "16px", textAlign: "center",
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stage summary */}
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>
        {search.trim()
          ? `${visible.length} of ${stageApplicants.length} match${visible.length !== 1 ? "" : "es"} "${search}" · ${posting.applicants.length} total`
          : stageApplicants.length === 0 ? "No applicants in this stage"
          : `${stageApplicants.length} applicant${stageApplicants.length !== 1 ? "s" : ""} in this stage · ${posting.applicants.length} total`
        }
      </p>

      {/* Select-all row */}
      {(() => {
        const pendingInStage = stageApplicants.filter(a => a.status === "Pending");
        if (pendingInStage.length === 0) return null;
        const allSelected = pendingInStage.every(a => selectedIds.has(a.id));
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem", padding: "0 0.25rem" }}>
            <input
              type="checkbox"
              checked={allSelected}
              aria-label={allSelected ? "Deselect all pending applicants" : `Select all ${pendingInStage.length} pending applicants`}
              onChange={e => {
                const ids = pendingInStage.map(a => a.id);
                if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...ids]));
                else setSelectedIds(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
              }}
              style={{ cursor: "pointer", accentColor: "var(--color-brand)", width: "15px", height: "15px" }}
            />
            <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>
              {allSelected ? "Deselect all" : `Select all ${pendingInStage.length} pending`}
            </span>
          </div>
        );
      })()}

      {/* Compact applicant rows for active stage */}
      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}>
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👤</div>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0, fontWeight: "500" }}>No applicants in this stage yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {visible.map(applicant => (
            <ApplicantRow
              key={applicant.id}
              applicant={applicant}
              isSelected={selectedIds.has(applicant.id)}
              onToggleSelect={() => toggleSelect(applicant.id)}
              isInvited={invitedIds.has(applicant.id)}
              onClick={() => setSelectedApplicant(applicant)}
              onHire={(a) => onUpdateStatus(a.id, "Accepted", a)}
              onDecline={(a) => onUpdateStatus(a.id, "Rejected", a)}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar — floats above liked students when selection is active */}
      {selectedIds.size > 0 && (
        <div style={{ position: "sticky", bottom: 0, backgroundColor: "white", borderTop: "1.5px solid #e2e8f0", padding: "0.7rem 0", marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", zIndex: 10, boxShadow: "0 -4px 16px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: "800", color: "#1e293b" }}>{selectedIds.size} selected</span>
            <button onClick={() => setSelectedIds(new Set())} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.78rem", fontWeight: "600", fontFamily: "inherit", padding: 0 }}>Clear</button>
          </div>
          <button
            onClick={bulkDecline}
            disabled={bulkDeclining}
            style={{ padding: "0.5rem 1.1rem", borderRadius: "0.55rem", border: "none", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", fontWeight: "700", fontSize: "0.8rem", cursor: bulkDeclining ? "default" : "pointer", fontFamily: "inherit", opacity: bulkDeclining ? 0.7 : 1, boxShadow: "0 2px 8px rgba(244,63,94,0.3)" }}
          >
            {bulkDeclining ? "Declining…" : `✕ Decline ${selectedIds.size}`}
          </button>
        </div>
      )}

      {/* Liked students — Shortlisted tab only, not yet applied */}
      {activeStage === "shortlisted" && (() => {
        const appliedIds = new Set(posting.applicants.map(a => a.studentId));
        const saved = (likedStudents || []).filter(s => !appliedIds.has(s.id));
        if (saved.length === 0) return null;
        return (
          <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1.5px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.68rem", fontWeight: "700", color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: "0.07em", paddingLeft: "0.5rem", borderLeft: "2px solid var(--color-brand)" }}>
              Saved Students — haven't applied yet
            </p>
            {saved.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", marginBottom: "0.4rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {s.profile_photo_url
                    ? <img loading="lazy" src={s.profile_photo_url} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "0.88rem", color: "#1e293b" }}>{s.name}</p>
                  {s.bio && <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.bio}</p>}
                </div>
                <span className="badge badge-sm badge-brand" style={{ whiteSpace: "nowrap" }}>♥ Saved</span>
              </div>
            ))}
          </div>
        );
      })()}
      </>)}

      {/* Close Job button — Decision stage only, no accepted applicant yet */}
      {(viewMode === "list" ? activeStage === "decision" : posting.applicants.some(a => a.pipelineStage === "decision")) && posting.applicants.every(a => a.status !== "Accepted") && (
        <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1.5px solid #e2e8f0" }}>
          <button
            onClick={() => setShowCloseJob(true)}
            style={{ width: "100%", padding: "0.65rem", borderRadius: "0.4rem", border: "1px solid #fca5a5", backgroundColor: "white", color: "#b91c1c", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
          >
            Close this Job
          </button>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.74rem", color: "#94a3b8", textAlign: "center" }}>
            This will close the listing and notify all pending applicants.
          </p>
        </div>
      )}

      {/* Detail panel */}
      {liveSelected && (
        <DetailPanel
          applicant={liveSelected}
          postingId={posting.id}
          postingTitle={posting.title}
          companyId={companyId}
          onClose={() => setSelectedApplicant(null)}
          onStageAction={handleStageAction}
          onUpdateStatus={onUpdateStatus}
          onNotesSaved={onNotesSaved}
          onIncrementRound={handleRoundIncrement}
          onSaveTrialSchedule={onSaveTrialSchedule}
          onSaveInterviewRoundsData={onSaveInterviewRoundsData}
          onSendInterviewInvite={wrappedSendInterviewInvite}
          onSendTrialInvite={wrappedSendTrialInvite}
        />
      )}

      {/* Close job modal */}
      {showCloseJob && (
        <CloseJobModal
          posting={posting}
          onClose={() => setShowCloseJob(false)}
          onCloseJob={(opts) => onCloseJob(posting.id, opts)}
        />
      )}
    </div>
  );
}

