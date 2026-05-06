import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { updatePassword } from "../lib/auth";

export default function ResetPasswordPage({ setPage }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  const handleSubmit = async () => {
    if (!password || !confirm) { setError("Please fill in both fields."); return; }
    if (password.length < 8)   { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => setPage("login"), 2500);
    } catch (e) {
      setError(e.message || "Failed to update password — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper>
      <div style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Set new password</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Choose a strong password for your account</p>
        </div>

        {success ? (
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.6rem", padding: "0.9rem 1rem", color: "#16a34a", fontSize: "0.875rem", fontWeight: "500" }}>
            ✅ Password updated! Redirecting to login…
          </div>
        ) : (
          <>
            {error && (
              <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" }}>
                {error}
              </div>
            )}
            <input
              placeholder="New password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={fieldStyle}
            />
            <input
              placeholder="Confirm new password"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={fieldStyle}
            />
            <p style={{ fontSize: "0.78rem", color: "#9ca3af", textAlign: "left", margin: "0.1rem 0 0.5rem" }}>
              Minimum 8 characters
            </p>
            <button onClick={handleSubmit} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Updating…" : "Update Password →"}
            </button>
          </>
        )}
      </div>
    </PageWrapper>
  );
}

const fieldStyle = { width: "100%", padding: "0.72rem 1rem", margin: "0.4rem 0", display: "block", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", boxSizing: "border-box", fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1e293b", outline: "none" };
const btnPrimary = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", marginTop: "0.6rem", fontSize: "0.95rem", fontFamily: "inherit", background: "linear-gradient(135deg, #A21D54, #C2185B)", boxShadow: "0 4px 18px rgba(162,29,84,0.35)" };
