import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import PageWrapper from "../components/PageWrapper";
import { updatePassword } from "../lib/auth";
import { signOut as authSignOut } from "../lib/authOps";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

function isExpiredLinkError(e) {
  const msg = (e?.message || "").toLowerCase();
  return (
    msg.includes("expired") ||
    msg.includes("invalid") ||
    msg.includes("token") ||
    msg.includes("otp") ||
    (e?.status === 401 || e?.status === 403)
  );
}

export default function ResetPasswordPage() {
  const { setPage, setPasswordRecoveryMode } = useApp();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);

  // Detect missing/expired token early: Supabase sets the session via hash on PASSWORD_RECOVERY.
  // If there's no active session when this page loads (i.e. no hash token), show an expired state.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setLinkExpired(true);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!password || !confirm) { setError("Please fill in both fields."); return; }
    if (password.length < 8)   { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) { setError("Password must include at least one letter and one number."); return; }
    if (password !== confirm)  { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await updatePassword(password);
      // Sign out all sessions so the old token is fully invalidated after password change
      await authSignOut({ scope: "global" });
      // Clear the recovery guard so the route becomes inaccessible again
      setPasswordRecoveryMode(false);
      setSuccess(true);
      setTimeout(() => setPage("login"), 2500);
    } catch (e) {
      Sentry.captureException(e);
      if (isExpiredLinkError(e)) {
        setLinkExpired(true);
      } else {
        setError("Failed to update password — please try again.");
        setPassword("");
        setConfirm("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper narrow>
      <Helmet><title>Reset Password — StudentShifts</title><meta name="robots" content="noindex" /></Helmet>
      <div style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "var(--color-text-primary, #1e293b)" }}>Set new password</h2>
          <p style={{ margin: "0.35rem 0 0", color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem" }}>Choose a strong password for your account</p>
        </div>

        {linkExpired ? (
          <div style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "0.75rem", padding: "1.25rem 1.25rem", textAlign: "left" }}>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#92400e", margin: "0 0 0.5rem" }}>⏰ Reset link expired</p>
            <p style={{ fontSize: "0.875rem", color: "#78350f", margin: "0 0 1.25rem", lineHeight: 1.55 }}>
              Password reset links expire after 1 hour. Please request a new one from the login page.
            </p>
            <button
              onClick={() => setPage("login")}
              style={{ width: "100%", padding: "0.72rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 4px 18px rgba(162,29,84,0.35)" }}
            >
              Back to Login →
            </button>
          </div>
        ) : success ? (
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.6rem", padding: "0.9rem 1rem", color: "#16a34a", fontSize: "0.875rem", fontWeight: "500" }}>
            ✅ Password updated! Redirecting to login…
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" }}>
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
            <p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", textAlign: "left", margin: "0.1rem 0 0.5rem" }}>
              Minimum 8 characters, must include a letter and a number
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

const fieldStyle = { width: "100%", padding: "0.72rem 1rem", margin: "0.4rem 0", display: "block", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", boxSizing: "border-box", fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--color-text-primary, #1e293b)", outline: "none" };
const btnPrimary = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", marginTop: "0.6rem", fontSize: "0.95rem", fontFamily: "inherit", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 4px 18px rgba(162,29,84,0.35)" };
