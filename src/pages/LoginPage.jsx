import { useState } from "react";
import PageWrapper from "../components/PageWrapper";

export default function LoginPage({ setPage, setCurrentUser, mockUsers }) {

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("student");
  const [error, setError]       = useState("");

  const handleLogin = () => {
    const foundUser = mockUsers.find(u => u.email === email && u.password === password && u.role === role);
    if (foundUser) {
      setCurrentUser(foundUser);
      setPage(role === "student" ? "studentDashboard" : "companyDashboard");
    } else {
      setError("Invalid email, password, or role.");
    }
  };

  const quickLogin = (user) => {
    setCurrentUser(user);
    setPage(user.role === "student" ? "studentDashboard" : "companyDashboard");
  };

  return (
    <PageWrapper>
      <div style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto" }}>

        {/* Brand mark */}
        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Welcome back</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Sign in to find your next shift</p>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" }}>
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
                flex: 1,
                padding: "0.55rem",
                borderRadius: "0.6rem",
                border: "none",
                fontWeight: "600",
                fontSize: "0.875rem",
                cursor: "pointer",
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

        <input
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={fieldStyle}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          style={fieldStyle}
        />

        <button onClick={handleLogin} style={btnPrimary}>Login →</button>
        <button onClick={() => setPage("studentDashboard")} style={btnGhost}>Browse without account</button>
        <button onClick={() => setPage("studentDashboard")} style={btnHome}>← Back to Home</button>

        <p style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748b" }}>
          Don't have an account?{" "}
          <span style={{ color: "#6366f1", cursor: "pointer", fontWeight: "700" }} onClick={() => setPage("signup")}>
            Create one free
          </span>
        </p>

        {/* Demo accounts */}
        <div style={{ marginTop: "2rem", backgroundColor: "#f8fafc", borderRadius: "0.85rem", padding: "1rem", textAlign: "left", border: "1px solid #e2e8f0" }}>
          <p style={{ fontWeight: "700", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "#94a3b8", margin: "0 0 0.75rem" }}>
            Demo Accounts
          </p>
          {mockUsers.map(user => (
            <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", padding: "0.55rem 0.75rem", backgroundColor: "white", borderRadius: "0.65rem", border: "1px solid #e2e8f0" }}>
              <div>
                <p style={{ fontWeight: "600", fontSize: "0.875rem", margin: 0, color: "#1e293b" }}>{user.name}</p>
                <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>{user.email} · {user.password}</p>
              </div>
              <button onClick={() => quickLogin(user)} style={btnQuick}>Go →</button>
            </div>
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}

const fieldStyle = {
  width: "100%",
  padding: "0.72rem 1rem",
  margin: "0.4rem 0",
  display: "block",
  borderRadius: "0.65rem",
  border: "1.5px solid #e2e8f0",
  boxSizing: "border-box",
  fontSize: "0.95rem",
  fontFamily: "'Poppins', sans-serif",
  color: "#1e293b",
  outline: "none",
};

const btnBase = { width: "100%", padding: "0.8rem", borderRadius: "0.75rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", marginTop: "0.6rem", fontSize: "0.95rem", fontFamily: "inherit" };
const btnPrimary = { ...btnBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 4px 18px rgba(99,102,241,0.35)", marginTop: "1rem" };
const btnGhost   = { ...btnBase, backgroundColor: "#f1f5f9", color: "#64748b", boxShadow: "none" };
const btnHome    = { ...btnBase, marginTop: "0.75rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 18px rgba(244,63,94,0.35)" };
const btnQuick   = { padding: "0.35rem 0.85rem", borderRadius: "2rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: "700", fontFamily: "inherit" };
