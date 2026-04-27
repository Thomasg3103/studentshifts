import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { uploadVerificationDocs } from "../lib/auth";

export default function VerifyDocsPage({ currentUser, setCurrentUser, setPage }) {
  const [studentIdCard, setStudentIdCard] = useState(null);
  const [governmentId, setGovernmentId]   = useState(null);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [showAvailabilityPrompt, setShowAvailabilityPrompt] = useState(false);

  const isRejected = currentUser?.verificationStatus === "rejected";

  const handleSubmit = async () => {
    if (!studentIdCard) { setError("Please upload your Student ID card."); return; }
    if (!governmentId)  { setError("Please upload a Government ID."); return; }
    setLoading(true);
    setError("");
    try {
      await uploadVerificationDocs(currentUser.id, studentIdCard, governmentId);
      setCurrentUser(prev => ({ ...prev, studentIdPath: "uploaded", verificationStatus: "pending_review" }));
      setShowAvailabilityPrompt(true);
    } catch (e) {
      setError(e.message || "Upload failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <PageWrapper>
      <div style={{ maxWidth: "440px", margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{isRejected ? "❌" : "🪪"}</div>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>
            {isRejected ? "Verification not approved" : "Verify your identity"}
          </h2>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
            {isRejected ? "Please re-submit clearer photos of your documents" : "One last step before you can apply for jobs"}
          </p>
        </div>

        {isRejected ? (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.75rem", padding: "0.85rem 1rem", marginBottom: "1.25rem", color: "#e11d48", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Your previous documents could not be verified. Please upload new, clear photos and resubmit.
          </div>
        ) : (
          <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.75rem", padding: "0.85rem 1rem", marginBottom: "1.25rem", color: "#0369a1", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Your documents are reviewed securely by our team. We'll notify you once your account is verified.
          </div>
        )}

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500" }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: "#f8fafc", borderRadius: "0.85rem", padding: "1rem 1.25rem", border: "1px solid #e2e8f0" }}>
          <FileUpload
            label="Student ID Card"
            hint="Photo of your student ID card"
            accept="image/*,.pdf"
            onChange={setStudentIdCard}
            file={studentIdCard}
          />
          <FileUpload
            label="Government ID"
            hint="Age Card, Passport or Driver's Licence"
            accept="image/*,.pdf"
            onChange={setGovernmentId}
            file={governmentId}
          />
        </div>

        <button onClick={handleSubmit} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Uploading…" : "Submit Documents →"}
        </button>

      </div>
    </PageWrapper>

    {showAvailabilityPrompt && (
      <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", backdropFilter: "blur(2px)" }}>
        <div style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "360px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📅</div>
          <h3 style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.4rem", color: "#1e293b" }}>Documents submitted!</h3>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.5rem", lineHeight: 1.6 }}>
            While you wait for verification, set your available times. Companies use this to plan rosters — it helps you get noticed faster.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <button
              onClick={() => { setShowAvailabilityPrompt(false); setPage("account"); }}
              style={{ padding: "0.75rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem" }}
            >
              Set My Availability →
            </button>
            <button
              onClick={() => { setShowAvailabilityPrompt(false); setPage("studentDashboard"); }}
              style={{ padding: "0.75rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function FileUpload({ label, hint, accept, onChange, file }) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label style={{ display: "block", fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.2rem", color: "#374151" }}>
        {label} <span style={{ color: "#f43f5e" }}>*</span>
      </label>
      <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.35rem", marginTop: 0 }}>{hint}</p>
      <div style={{ border: `1.5px dashed ${file ? "#10b981" : "#e2e8f0"}`, borderRadius: "0.6rem", padding: "0.55rem 0.75rem", backgroundColor: file ? "#f0fdf4" : "white" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: file ? "0.4rem" : 0 }}>
          <label style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: "600", color: "#6366f1", whiteSpace: "nowrap", padding: "0.3rem 0.65rem", borderRadius: "0.4rem", border: "1.5px solid #6366f1", lineHeight: 1.4 }}>
            📷 Take Photo
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => onChange(e.target.files[0] || null)} />
          </label>
          <label style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: "600", color: "#475569", whiteSpace: "nowrap", padding: "0.3rem 0.65rem", borderRadius: "0.4rem", border: "1.5px solid #cbd5e1", lineHeight: 1.4 }}>
            📁 Upload File
            <input type="file" accept={accept} style={{ display: "none" }} onChange={e => onChange(e.target.files[0] || null)} />
          </label>
        </div>
        {file && (
          <span style={{ fontSize: "0.78rem", color: "#10b981", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ✓ {file.name}
          </span>
        )}
      </div>
    </div>
  );
}

const btnPrimary = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit", marginTop: "1.25rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 18px rgba(99,102,241,0.35)" };
