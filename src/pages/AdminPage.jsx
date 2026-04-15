import { useState, useEffect } from "react";
import PageWrapper from "../components/PageWrapper";
import { fetchPendingStudents, approveStudent, rejectStudent, getSignedDocumentUrl } from "../lib/auth";

export default function AdminPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [actionLoading, setActionLoading] = useState(null); // studentId being actioned

  useEffect(() => {
    fetchPendingStudents()
      .then(setStudents)
      .catch(e => setError(e.message || "Failed to load pending students."))
      .finally(() => setLoading(false));
  }, []);

  const openDoc = async (path) => {
    try {
      const url = await getSignedDocumentUrl("verification-docs", path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      alert("Could not open document: " + e.message);
    }
  };

  const handleApprove = async (studentId) => {
    setActionLoading(studentId + "_approve");
    try {
      await approveStudent(studentId);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (e) {
      alert("Failed to approve: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (studentId) => {
    if (!window.confirm("Reject this student's verification? They will be notified and can re-submit.")) return;
    setActionLoading(studentId + "_reject");
    try {
      await rejectStudent(studentId);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (e) {
      alert("Failed to reject: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <PageWrapper>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Admin Dashboard</h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Pending verification requests</p>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading…</p>
        ) : students.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "#94a3b8" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
            <p style={{ fontWeight: "600", margin: 0 }}>No pending requests</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {students.map(s => (
              <div key={s.id} style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem 1.5rem" }}>
                <div style={{ marginBottom: "0.85rem" }}>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "#1e293b" }}>{s.name}</p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  {s.studentIdUrl && (
                    <button onClick={() => openDoc(s.studentIdUrl)} style={docBtn}>
                      🪪 View Student ID
                    </button>
                  )}
                  {s.govIdUrl && (
                    <button onClick={() => openDoc(s.govIdUrl)} style={docBtn}>
                      📄 View Government ID
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    onClick={() => handleApprove(s.id)}
                    disabled={!!actionLoading}
                    style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: actionLoading === s.id + "_approve" ? 0.7 : 1 }}
                  >
                    {actionLoading === s.id + "_approve" ? "Approving…" : "✅ Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={!!actionLoading}
                    style={{ ...actionBtnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", opacity: actionLoading === s.id + "_reject" ? 0.7 : 1 }}
                  >
                    {actionLoading === s.id + "_reject" ? "Rejecting…" : "❌ Reject"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  );
}

const docBtn = { padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#6366f1", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const actionBtnBase = { padding: "0.6rem 1.25rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" };
