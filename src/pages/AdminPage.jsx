import { useState, useEffect } from "react";
import PageWrapper from "../components/PageWrapper";
import {
  fetchPendingStudents, approveStudent, rejectStudent, getSignedDocumentUrl,
  fetchPendingCompanies, approveCompany, rejectCompany,
  sendEmail, emailStudentApproved, emailCompanyApproved,
} from "../lib/auth";

export default function AdminPage() {
  const [tab, setTab]           = useState("students");
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchPendingStudents().catch(() => { setError("Failed to load. Please refresh."); return []; }),
      fetchPendingCompanies().catch(() => { setError("Failed to load. Please refresh."); return []; }),
    ]).then(([s, c]) => {
      setStudents(s);
      setCompanies(c);
    }).finally(() => setLoading(false));
  }, []);

  const openDoc = async (path) => {
    try {
      const url = await getSignedDocumentUrl("verification-docs", path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      alert("Could not open document. Please try again.");
    }
  };

  const handleApproveStudent = async (student) => {
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
        }
      }
    } catch (e) {
      alert("Failed to approve. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectStudent = async (studentId) => {
    if (!window.confirm("Reject this student's verification? They will be notified and can re-submit.")) return;
    setActionLoading(studentId + "_reject");
    try {
      await rejectStudent(studentId);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (e) {
      alert("Failed to reject. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveCompany = async (company) => {
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
        }
      }
    } catch (e) {
      alert("Failed to approve. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCompany = async (companyId) => {
    if (!window.confirm("Reject this company? They will need to contact support to re-apply.")) return;
    setActionLoading(companyId + "_reject");
    try {
      await rejectCompany(companyId);
      setCompanies(prev => prev.filter(c => c.id !== companyId));
    } catch (e) {
      alert("Failed to reject. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const pendingStudents  = students.length;
  const pendingCompanies = companies.length;

  return (
    <PageWrapper>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Admin Dashboard</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Pending verification requests</p>
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
                  color: active ? "#A21D54" : "#64748b",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderBottom: active ? "2px solid #A21D54" : "2px solid transparent",
                  marginBottom: "-2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", backgroundColor: active ? "#A21D54" : "#94a3b8", color: "white", borderRadius: "999px", padding: "0.1rem 0.45rem", minWidth: "18px", textAlign: "center" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
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
                      onClick={() => handleApproveStudent(s)}
                      disabled={!!actionLoading}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: actionLoading === s.id + "_approve" ? 0.7 : 1 }}
                    >
                      {actionLoading === s.id + "_approve" ? "Approving…" : "✅ Approve"}
                    </button>
                    <button
                      onClick={() => handleRejectStudent(s.id)}
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
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#c2410c" }}>⚠ No CRO number provided</p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.6rem" }}>
                    <button
                      onClick={() => handleApproveCompany(c)}
                      disabled={!!actionLoading}
                      style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: actionLoading === c.id + "_approve" ? 0.7 : 1 }}
                    >
                      {actionLoading === c.id + "_approve" ? "Approving…" : "✅ Approve"}
                    </button>
                    <button
                      onClick={() => handleRejectCompany(c.id)}
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

const cardStyle      = { backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem 1.5rem" };
const docBtn         = { padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#A21D54", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const actionBtnBase  = { padding: "0.6rem 1.25rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" };
const verifyLinkStyle = { display: "inline-flex", alignItems: "center", padding: "0.3rem 0.75rem", borderRadius: "0.45rem", border: "1.5px solid #bae6fd", backgroundColor: "white", color: "#0369a1", fontWeight: "600", fontSize: "0.76rem", textDecoration: "none", fontFamily: "inherit" };
