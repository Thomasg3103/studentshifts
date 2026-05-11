import { useState, useEffect, useRef, useCallback } from "react";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import PageWrapper from "../components/PageWrapper";
import {
  fetchPendingStudents, approveStudent, rejectStudent, getSignedDocumentUrl,
  fetchPendingCompanies, approveCompany, rejectCompany,
  sendEmail, emailStudentApproved, emailCompanyApproved,
  getSignups, sendLaunchEmails,
} from "../lib/auth";
import { emailStudentRejected, emailCompanyRejected } from "../lib/emails";

export default function AdminPage() {
  const [tab, setTab]           = useState("students");
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState(null); // { type: "student"|"company", item }
  const inFlight = useRef(new Set()); // F-C6: prevent double-approval across renders
  const [signups, setSignups]             = useState(null); // null = not yet fetched
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [launchSending, setLaunchSending] = useState(false);

  // F-M10: extracted so the Refresh button can re-call it
  const loadData = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchPendingStudents().catch(() => { setError("Failed to load. Please refresh."); return []; }),
      fetchPendingCompanies().catch(() => { setError("Failed to load. Please refresh."); return []; }),
    ]).then(([s, c]) => {
      setStudents(s);
      setCompanies(c);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const data = await getSignups();
      setSignups(data);
    } catch (e) {
      toast.error("Failed to load signups.");
    } finally {
      setSignupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "signups" && signups === null) loadSignups();
  }, [tab, signups, loadSignups]);

  const handleSendLaunchEmails = async () => {
    const unsent = (signups || []).filter(s => !s.launch_email_sent_at).length;
    if (unsent === 0) { toast("All signups have already received the launch email."); return; }
    if (!window.confirm(`Send launch emails to ${unsent} signup${unsent === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setLaunchSending(true);
    try {
      const result = await sendLaunchEmails();
      toast.success(`Sent ${result.sent} launch email${result.sent === 1 ? "" : "s"}!`);
      if (result.errors?.length) console.warn("Launch email errors:", result.errors);
      loadSignups(); // refresh sent_at timestamps
    } catch (e) {
      toast.error(e.message || "Failed to send launch emails.");
    } finally {
      setLaunchSending(false);
    }
  };

  const openDoc = async (path) => {
    try {
      const url = await getSignedDocumentUrl("verification-docs", path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Could not open document. Please try again.");
    }
  };

  const handleApproveStudent = async (student) => {
    if (inFlight.current.has(student.id)) return; // F-C6: double-click guard
    inFlight.current.add(student.id);
    setActionLoading(student.id + "_approve");
    try {
      await approveStudent(student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
      if (student.email) {
        try {
          await sendEmail({
            to: student.email,
            subject: "Your StudentShifts account has been approved!",
            html: emailStudentApproved(student.name),
            magicLinkEmail: student.email,
            redirectTo: window.location.origin,
          });
        } catch (e) {
          console.warn("Approval email failed:", e.message);
          toast.error("Approved, but notification email failed to send.");
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to approve. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(student.id);
      setActionLoading(null);
    }
  };

  // F-M8: confirmed=false → show inline modal; confirmed=true → proceed
  const handleRejectStudent = async (student, confirmed = false) => {
    if (!confirmed) { setRejectConfirm({ type: "student", item: student }); return; }
    if (inFlight.current.has(student.id)) return; // F-C6
    inFlight.current.add(student.id);
    setActionLoading(student.id + "_reject");
    try {
      await rejectStudent(student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
      if (student.email) {
        try {
          await sendEmail({
            to: student.email,
            subject: "StudentShifts verification update",
            html: emailStudentRejected(student.name),
            magicLinkEmail: student.email,
            redirectTo: window.location.origin,
          });
        } catch (e) {
          console.warn("Rejection email failed:", e.message);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to reject. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(student.id);
      setActionLoading(null);
    }
  };

  const handleApproveCompany = async (company) => {
    if (inFlight.current.has(company.id)) return; // F-C6
    inFlight.current.add(company.id);
    setActionLoading(company.id + "_approve");
    try {
      await approveCompany(company.id);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (company.email) {
        try {
          await sendEmail({
            to: company.email,
            subject: "Your StudentShifts company account has been verified!",
            html: emailCompanyApproved(company.name, window.location.origin),
          });
        } catch (e) {
          console.warn("Approval email failed:", e.message);
          toast.error("Approved, but notification email failed to send."); // F-M7
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to approve. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(company.id);
      setActionLoading(null);
    }
  };

  const handleRejectCompany = async (company, confirmed = false) => {
    if (!confirmed) { setRejectConfirm({ type: "company", item: company }); return; } // F-M8
    if (inFlight.current.has(company.id)) return; // F-C6
    inFlight.current.add(company.id);
    setActionLoading(company.id + "_reject");
    try {
      await rejectCompany(company.id);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (company.email) {
        try {
          await sendEmail({
            to: company.email,
            subject: "StudentShifts company verification update",
            html: emailCompanyRejected(company.name),
          });
        } catch (e) {
          console.warn("Rejection email failed:", e.message);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to reject. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(company.id);
      setActionLoading(null);
    }
  };

  const pendingStudents  = students.length;
  const pendingCompanies = companies.length;

  return (
    <PageWrapper>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Admin Dashboard</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Pending verification requests</p>
          </div>
          {/* F-M10: refresh button */}
          <button
            onClick={loadData}
            disabled={loading}
            style={{ padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.82rem", cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.5 : 1, flexShrink: 0 }}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0" }}>
          {[
            { key: "students",  label: "Students",  count: pendingStudents },
            { key: "companies", label: "Companies", count: pendingCompanies },
            { key: "signups",   label: "Signups",   count: 0 },
          ].map(({ key, label, count }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.5rem 0.5rem 0 0",
                  border: "none",
                  background: active ? "white" : "transparent",
                  fontWeight: active ? "700" : "600",
                  fontSize: "0.875rem",
                  color: active ? "var(--color-brand)" : "#64748b",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderBottom: active ? "2px solid var(--color-brand)" : "2px solid transparent",
                  marginBottom: "-2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", backgroundColor: active ? "var(--color-brand)" : "#94a3b8", color: "white", borderRadius: "999px", padding: "0.1rem 0.45rem", minWidth: "18px", textAlign: "center" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "signups" ? (
          <SignupsPanel
            signups={signups}
            loading={signupsLoading}
            launchSending={launchSending}
            onRefresh={loadSignups}
            onSendLaunch={handleSendLaunchEmails}
          />
        ) : loading ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : tab === "students" ? (
          students.length === 0 ? (
            <EmptyState label="No pending student requests" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {students.map(s => (
                <div key={s.id} style={cardStyle}>
                  <div style={{ marginBottom: "0.85rem" }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>{s.name}</p>
                    {s.email && <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "#64748b" }}>{s.email}</p>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                    {s.studentIdUrl && (
                      <button onClick={() => openDoc(s.studentIdUrl)} style={docBtn}>
                        View Student ID
                      </button>
                    )}
                    {s.govIdUrl && (
                      <button onClick={() => openDoc(s.govIdUrl)} style={docBtn}>
                        View Government ID
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button
                      aria-label={`Approve ${s.name}`}
                      onClick={() => handleApproveStudent(s)}
                      disabled={!!actionLoading || !s.studentIdUrl || !s.govIdUrl}
                      title={!s.studentIdUrl || !s.govIdUrl ? "Cannot approve: documents not yet uploaded" : undefined}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: (actionLoading === s.id + "_approve" || !s.studentIdUrl || !s.govIdUrl) ? 0.5 : 1 }}
                    >
                      {actionLoading === s.id + "_approve" ? "Approving…" : "✅ Approve"}
                    </button>
                    <button
                      aria-label={`Reject ${s.name}`}
                      onClick={() => handleRejectStudent(s)}
                      disabled={!!actionLoading}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", opacity: actionLoading === s.id + "_reject" ? 0.7 : 1 }}
                    >
                      {actionLoading === s.id + "_reject" ? "Rejecting…" : "❌ Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          companies.length === 0 ? (
            <EmptyState label="No pending company requests" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {companies.map(c => (
                <div key={c.id} style={cardStyle}>
                  <div style={{ marginBottom: "0.85rem" }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>{c.name}</p>
                    {c.email && (
                      <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <span style={{ fontSize: "0.7rem", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: "700", padding: "0.1rem 0.45rem", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>✓ Email verified</span>
                        {c.email}
                      </p>
                    )}
                  </div>

                  {/* CRO number + verify links */}
                  {c.croNumber ? (
                    <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.6rem", padding: "0.65rem 0.85rem", marginBottom: "1rem" }}>
                      <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", fontWeight: "700", color: "#0369a1" }}>
                        CRO Number: <span style={{ fontFamily: "monospace", fontSize: "0.88rem", color: "#1e293b", letterSpacing: "0.05em" }}>{c.croNumber}</span>
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        <a
                          href={`https://search.cro.ie/company/CompanySearch.aspx`}
                          target="_blank"
                          rel="noreferrer"
                          style={verifyLinkStyle}
                        >
                          🔍 Verify on CRO →
                        </a>
                        <a
                          href={`https://www.solocheck.ie/Irish-Company/search?q=${encodeURIComponent(c.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={verifyLinkStyle}
                        >
                          🔍 SoloCheck →
                        </a>
                      </div>
                      <p style={{ margin: "0.45rem 0 0", fontSize: "0.72rem", color: "#64748b" }}>
                        Search the CRO number above on cro.ie and confirm the company name matches <strong style={{ color: "#1e293b" }}>{c.name}</strong>.
                      </p>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#c2410c" }}>⚠ No CRO number provided — cannot approve without verification</p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button
                      aria-label={`Approve ${c.name}`}
                      onClick={() => handleApproveCompany(c)}
                      disabled={!!actionLoading || !c.croNumber} // S-H10: require CRO
                      title={!c.croNumber ? "Cannot approve: no CRO number provided" : undefined}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: (actionLoading === c.id + "_approve" || !c.croNumber) ? 0.5 : 1 }}
                    >
                      {actionLoading === c.id + "_approve" ? "Approving…" : "✅ Approve"}
                    </button>
                    <button
                      aria-label={`Reject ${c.name}`}
                      onClick={() => handleRejectCompany(c)}
                      disabled={!!actionLoading}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", opacity: actionLoading === c.id + "_reject" ? 0.7 : 1 }}
                    >
                      {actionLoading === c.id + "_reject" ? "Rejecting…" : "❌ Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

      </div>

      {/* F-M8: Reject confirmation modal */}
      {rejectConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "white", borderRadius: "1rem", padding: "1.5rem 1.75rem", maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <p style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.05rem", color: "#1e293b" }}>
              Reject {rejectConfirm.type === "student" ? "Student" : "Company"}?
            </p>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.5 }}>
              {rejectConfirm.type === "student"
                ? <><strong style={{ color: "#1e293b" }}>{rejectConfirm.item.name}</strong> will be notified and can re-submit their documents.</>
                : <><strong style={{ color: "#1e293b" }}>{rejectConfirm.item.name}</strong> will need to contact support to re-apply.</>}
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setRejectConfirm(null)}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#374151", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const item = rejectConfirm.item;
                  const type = rejectConfirm.type;
                  setRejectConfirm(null);
                  if (type === "student") handleRejectStudent(item, true);
                  else handleRejectCompany(item, true);
                }}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#e11d48", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 0", color: "#94a3b8" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
      <p style={{ fontWeight: "600", margin: 0 }}>{label}</p>
    </div>
  );
}

function SignupsPanel({ signups, loading, launchSending, onRefresh, onSendLaunch }) {
  const [search, setSearch] = useState("");

  if (loading || signups === null) {
    return <p style={{ color: "#64748b" }}>Loading…</p>;
  }

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today); week.setDate(week.getDate() - 7);

  const total   = signups.length;
  const todayN  = signups.filter(s => new Date(s.created_at) >= today).length;
  const weekN   = signups.filter(s => new Date(s.created_at) >= week).length;
  const unsent  = signups.filter(s => !s.launch_email_sent_at).length;

  const filtered = search
    ? signups.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()))
    : signups;

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total", value: total },
          { label: "This week", value: weekN },
          { label: "Today", value: todayN },
          { label: "Not emailed", value: unsent },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1rem 1.25rem" }}>
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.72rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "2rem", fontWeight: "800", background: "linear-gradient(135deg,var(--color-brand),#C2185B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "180px", padding: "0.55rem 0.9rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={onRefresh}
          style={{ padding: "0.55rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          ↺ Refresh
        </button>
        <button
          onClick={onSendLaunch}
          disabled={launchSending || unsent === 0}
          style={{ padding: "0.55rem 1rem", borderRadius: "0.5rem", border: "none", background: unsent === 0 ? "#e2e8f0" : "linear-gradient(135deg,var(--color-brand),#C2185B)", color: unsent === 0 ? "#94a3b8" : "white", fontWeight: "700", fontSize: "0.82rem", cursor: (launchSending || unsent === 0) ? "default" : "pointer", fontFamily: "inherit", opacity: launchSending ? 0.6 : 1 }}
        >
          {launchSending ? "Sending…" : unsent === 0 ? "All emailed" : `Send Launch Emails (${unsent})`}
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState label={search ? "No matches found" : "No signups yet"} />
      ) : (
        <div style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", overflow: "hidden" }}>
          {filtered.map((s, i) => {
            const initials = s.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            const date = new Date(s.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.8rem 1.25rem", borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,var(--color-brand),#C2185B)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem", fontWeight: "700", flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>{date}</p>
                  {s.launch_email_sent_at && (
                    <p style={{ margin: "0.1rem 0 0", fontSize: "0.68rem", color: "#22c55e", fontWeight: "600" }}>✓ Emailed</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const cardStyle      = { backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem 1.5rem" };
const docBtn         = { padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "var(--color-brand)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const actionBtnBase  = { padding: "0.6rem 1.25rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" };
const verifyLinkStyle = { display: "inline-flex", alignItems: "center", padding: "0.3rem 0.75rem", borderRadius: "0.45rem", border: "1.5px solid #bae6fd", backgroundColor: "white", color: "#0369a1", fontWeight: "600", fontSize: "0.76rem", textDecoration: "none", fontFamily: "inherit" };
