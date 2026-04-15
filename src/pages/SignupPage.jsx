import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { signUp } from "../lib/auth";

function getPasswordStrength(pw) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: "Weak",   color: "#ef4444", bars: 1 };
  if (score === 2) return { level: "Fair",   color: "#f97316", bars: 2 };
  if (score === 3) return { level: "Good",   color: "#eab308", bars: 3 };
  return              { level: "Strong", color: "#22c55e", bars: 4 };
}

export default function SignupPage({ setPage }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("student");
  const [studentIdCard, setStudentIdCard] = useState(null);
  const [governmentId, setGovernmentId]   = useState(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) { setError("Please fill in your name, email and password."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (role === "student") {
      if (!studentIdCard) { setError("Please upload your Student ID card."); return; }
      if (!governmentId)  { setError("Please upload a Government ID."); return; }
    }
    setLoading(true);
    setError("");
    try {
      await signUp({ email, password, name, role });
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <PageWrapper>
        <div style={{ maxWidth: "440px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
          <h2 style={{ margin: "0 0 0.5rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Check your email</h2>
          <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            We sent a confirmation link to <strong style={{ color: "#1e293b" }}>{email}</strong>.<br />
            Click it to activate your account.
          </p>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.75rem", padding: "0.85rem 1rem", marginBottom: "1.5rem", color: "#16a34a", fontSize: "0.85rem", fontWeight: "500" }}>
            ✅ Once confirmed you'll be able to log in.
          </div>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>Didn't get it? Check your spam folder.</p>
          <button onClick={() => setPage("login")} style={btnPrimary}>Go to Login →</button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div style={{ maxWidth: "440px", margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Create account</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Join StudentShifts — it's free</p>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500" }}>
            {error}
          </div>
        )}

        {/* Role toggle */}
        <div style={{ display: "flex", backgroundColor: "#f1f5f9", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1.1rem", gap: "0.25rem" }}>
          {[{ val: "student", label: "🎓 Student" }, { val: "company", label: "🏢 Company" }].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setRole(val)}
              style={{
                flex: 1, padding: "0.55rem", borderRadius: "0.6rem", border: "none",
                fontWeight: "600", fontSize: "0.875rem", cursor: "pointer",
                backgroundColor: role === val ? "white" : "transparent",
                color: role === val ? "#6366f1" : "#64748b",
                boxShadow: role === val ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input placeholder={role === "company" ? "Company Name" : "Full Name"} value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSignup()} style={inputStyle} />

        {password && (() => {
          const s = getPasswordStrength(password);
          return (
            <div style={{ marginTop: "-0.4rem", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.3rem" }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ flex: 1, height: "4px", borderRadius: "2px", backgroundColor: i <= s.bars ? s.color : "#e2e8f0", transition: "background-color 0.2s" }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: "0.78rem", color: s.color, fontWeight: "600" }}>{s.level} password</p>
            </div>
          );
        })()}

        {role === "student" && (
          <div style={{ marginTop: "1.25rem", backgroundColor: "#f8fafc", borderRadius: "0.85rem", padding: "1rem 1.25rem", border: "1px solid #e2e8f0" }}>
            <p style={{ fontWeight: "700", marginBottom: "0.2rem", color: "#1e293b", fontSize: "0.95rem" }}>Verification Documents</p>
            <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem", marginTop: 0 }}>
              Required to verify your student status. Reviewed securely.
            </p>
            <FileUpload label="Student ID Card" hint="Photo of your student ID card" accept="image/*,.pdf" onChange={setStudentIdCard} file={studentIdCard} />
            <FileUpload label="Government ID" hint="Age Card, Passport or Driver's Licence" accept="image/*,.pdf" onChange={setGovernmentId} file={governmentId} />
          </div>
        )}

        <button onClick={handleSignup} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Creating account…" : "Create Account →"}
        </button>
        <button onClick={() => setPage("studentDashboard")} style={btnHome}>← Back to Home</button>
        <p style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748b", textAlign: "center" }}>
          Already have an account?{" "}
          <span style={{ color: "#6366f1", cursor: "pointer", fontWeight: "700" }} onClick={() => setPage("login")}>
            Sign in
          </span>
        </p>

      </div>
    </PageWrapper>
  );
}

function FileUpload({ label, hint, accept, onChange, file }) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label style={{ display: "block", fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.2rem", color: "#374151" }}>
        {label} <span style={{ color: "#f43f5e" }}>*</span>
      </label>
      <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.35rem", marginTop: 0 }}>{hint}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", border: `1.5px dashed ${file ? "#10b981" : "#e2e8f0"}`, borderRadius: "0.6rem", padding: "0.55rem 0.75rem", backgroundColor: file ? "#f0fdf4" : "white" }}>
        <label style={{ cursor: "pointer", fontSize: "0.8rem", fontWeight: "600", color: "#6366f1", whiteSpace: "nowrap" }}>
          {file ? "Change" : "Choose file"}
          <input type="file" accept={accept} style={{ display: "none" }} onChange={e => onChange(e.target.files[0] || null)} />
        </label>
        <span style={{ fontSize: "0.8rem", color: file ? "#10b981" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file ? `✓ ${file.name}` : "No file chosen"}
        </span>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", padding: "0.72rem 1rem", marginBottom: "0.75rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" };
const btnBase    = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit" };
const btnPrimary = { ...btnBase, marginTop: "1.25rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 18px rgba(99,102,241,0.35)" };
const btnHome    = { ...btnBase, marginTop: "0.6rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 18px rgba(244,63,94,0.35)" };
