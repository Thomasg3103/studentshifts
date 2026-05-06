import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { signUp } from "../lib/auth";
import { jobCategories } from "../data/jobCategories";


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
  const [croNumber, setCroNumber] = useState("");
  const [industries, setIndustries] = useState([]);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const toggleIndustry = (cat) =>
    setIndustries(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const handleSignup = async () => {
    if (!name || !email || !password) { setError("Please fill in all required fields."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (role === "company" && !croNumber.trim()) { setError("Please enter your CRO number."); return; }
    setLoading(true);
    setError("");
    try {
      await signUp({ email, password, name, role, croNumber, industries });
      setDone(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (done && role === "company") {
    return (
      <PageWrapper>
        <div style={{ maxWidth: "440px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📬</div>
          <h2 style={{ margin: "0 0 0.5rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Almost there!</h2>
          <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
            We sent a confirmation link to <strong style={{ color: "#1e293b" }}>{email}</strong>.
          </p>

          {/* Two-step process */}
          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.75rem", padding: "0.85rem 1rem" }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "0.05rem" }}>1️⃣</span>
              <div>
                <p style={{ margin: 0, fontWeight: "700", color: "#15803d", fontSize: "0.875rem" }}>Verify your email</p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#16a34a", lineHeight: 1.5 }}>Click the confirmation link in the email we just sent you.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: "0.75rem", padding: "0.85rem 1rem" }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "0.05rem" }}>2️⃣</span>
              <div>
                <p style={{ margin: 0, fontWeight: "700", color: "#92400e", fontSize: "0.875rem" }}>Wait for admin approval</p>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#b45309", lineHeight: 1.5 }}>Our team will verify your company using your CRO number (<strong>{croNumber}</strong>) and approve your account. You'll receive a confirmation email once approved.</p>
              </div>
            </div>
          </div>

          <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: "1.25rem" }}>Didn't get the email? Check your spam folder.</p>
          <button onClick={() => setPage("login")} style={btnPrimary}>Go to Login →</button>
        </div>
      </PageWrapper>
    );
  }

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
        <div style={{ display: "flex", backgroundColor: "#fafafa", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1.1rem", gap: "0.25rem" }}>
          {[{ val: "student", label: "🎓 Student" }, { val: "company", label: "🏢 Company" }].map(({ val, label }) => (
            <button
              key={val}
              onClick={() => setRole(val)}
              style={{
                flex: 1, padding: "0.55rem", borderRadius: "0.6rem", border: "none",
                fontWeight: "600", fontSize: "0.875rem", cursor: "pointer",
                backgroundColor: role === val ? "white" : "transparent",
                color: role === val ? "#A21D54" : "#64748b",
                boxShadow: role === val ? "0 1px 6px rgba(0,0,0,0.1)" : "none",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          placeholder={role === "company" ? "Company Name" : "Full Name"}
          value={name}
          onChange={e => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !croNumber && role === "company" ? null : e.key === "Enter" && handleSignup()}
          style={inputStyle}
        />

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

        {/* CRO number — company only */}
        {role === "company" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <input
              placeholder="CRO Number (e.g. 123456)"
              value={croNumber}
              onChange={e => setCroNumber(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSignup()}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.76rem", color: "#64748b", lineHeight: 1.4 }}>
              Your Companies Registration Office number — find it at{" "}
              <a href="https://search.cro.ie" target="_blank" rel="noreferrer" style={{ color: "#A21D54", fontWeight: "600" }}>search.cro.ie</a>.
              Used by our admin to verify your company.
            </p>
          </div>
        )}

        {/* Industries — company only */}
        {role === "company" && (
          <div style={{ marginBottom: "0.75rem" }}>
            <p style={{ fontWeight: "700", fontSize: "0.875rem", color: "#374151", marginBottom: "0.35rem" }}>
              Industries <span style={{ fontWeight: "400", color: "#9ca3af" }}>(optional — select all that apply)</span>
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {Object.keys(jobCategories).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleIndustry(cat)}
                  style={{
                    padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600",
                    cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${industries.includes(cat) ? "#A21D54" : "#e2e8f0"}`,
                    backgroundColor: industries.includes(cat) ? "#fce7f3" : "white",
                    color: industries.includes(cat) ? "#A21D54" : "#64748b",
                  }}
                >
                  {industries.includes(cat) ? "✓ " : ""}{cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info banners */}
        {role === "student" && (
          <div style={{ marginTop: "0.5rem", backgroundColor: "#f0f9ff", borderRadius: "0.85rem", padding: "0.9rem 1.1rem", border: "1px solid #bae6fd" }}>
            <p style={{ margin: "0 0 0.25rem", fontWeight: "700", color: "#0369a1", fontSize: "0.875rem" }}>🪪 Verification required</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#0369a1", lineHeight: 1.5 }}>
              After confirming your email you'll be asked to upload your Student ID and Government ID. You can apply for jobs once verified.
            </p>
          </div>
        )}

        {role === "company" && (
          <div style={{ marginTop: "0.5rem", backgroundColor: "#fef3c7", borderRadius: "0.85rem", padding: "0.9rem 1.1rem", border: "1px solid #fcd34d" }}>
            <p style={{ margin: "0 0 0.25rem", fontWeight: "700", color: "#92400e", fontSize: "0.875rem" }}>🏢 Two-step approval</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#b45309", lineHeight: 1.5 }}>
              1. Verify your email address.<br />
              2. Our admin will review and approve your company — you'll get an email when you're cleared to post jobs.
            </p>
          </div>
        )}

        <button onClick={handleSignup} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Creating account…" : "Create Account →"}
        </button>
        <button onClick={() => setPage("studentDashboard")} style={btnHome}>← Back to Home</button>
        <p style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748b", textAlign: "center" }}>
          Already have an account?{" "}
          <span style={{ color: "#A21D54", cursor: "pointer", fontWeight: "700" }} onClick={() => setPage("login")}>
            Sign in
          </span>
        </p>

      </div>
    </PageWrapper>
  );
}


const inputStyle = { width: "100%", padding: "0.72rem 1rem", marginBottom: "0.75rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.95rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" };
const btnBase    = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit" };
const btnPrimary = { ...btnBase, marginTop: "1.25rem", background: "linear-gradient(135deg, #A21D54, #C2185B)", boxShadow: "0 4px 18px rgba(162,29,84,0.35)" };
const btnHome    = { ...btnBase, marginTop: "0.6rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 18px rgba(244,63,94,0.35)" };
