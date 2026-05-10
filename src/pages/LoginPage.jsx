import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import PageWrapper from "../components/PageWrapper";
import { signIn, sendPasswordReset } from "../lib/auth";
import { useApp } from "../context/AppContext";

export default function LoginPage() {
  const { setPage } = useApp();
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent]   = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState("");
  const [resetCooldown, setResetCooldown] = useState(0);

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      await signIn({ email, password });
      if (window.gtag) window.gtag("event", "login", { method: "email" });
    } catch (e) {
      Sentry.captureException(e);
      // Always show the same message to prevent email enumeration
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const id = setInterval(() => setResetCooldown(c => c - 1), 1000);
    return () => clearInterval(id);
  }, [resetCooldown]);

  const handleReset = async () => {
    if (resetCooldown > 0) return;
    if (!resetEmail) { setResetError("Please enter your email address."); return; }
    setResetLoading(true);
    setResetError("");
    try {
      await sendPasswordReset(resetEmail);
    } catch (e) {
      Sentry.captureException(e);
    } finally {
      // Always show "sent" regardless of whether the email exists (prevents enumeration)
      setResetSent(true);
      setResetCooldown(60);
      setResetLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <PageWrapper narrow>
        <div style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto" }}>
          <div style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Reset password</h2>
            <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
              {resetSent ? "Check your email for a reset link." : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          {resetSent ? (
            <>
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.6rem", padding: "0.9rem 1rem", marginBottom: "1.25rem", color: "#16a34a", fontSize: "0.875rem", fontWeight: "500" }}>
                ✅ Reset link sent to <strong>{resetEmail}</strong>. Check your inbox (and spam folder).
              </div>
              <button onClick={() => { setForgotMode(false); setResetSent(false); setResetEmail(""); }} style={btnPrimary}>
                Back to Login
              </button>
            </>
          ) : (
            <>
              {resetError && (
                <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" }}>
                  {resetError}
                </div>
              )}
              <label htmlFor="reset-email" style={srOnly}>Email address</label>
              <input
                id="reset-email"
                placeholder="Email address"
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleReset()}
                style={fieldStyle}
              />
              <button onClick={handleReset} disabled={resetLoading || resetCooldown > 0} style={{ ...btnPrimary, opacity: (resetLoading || resetCooldown > 0) ? 0.7 : 1 }}>
                {resetLoading ? "Sending…" : resetCooldown > 0 ? `Resend available in ${resetCooldown}s` : "Send Reset Link →"}
              </button>
              <button onClick={() => { setForgotMode(false); setResetError(""); }} style={btnGhost}>
                Back to Login
              </button>
            </>
          )}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper narrow>
      <Helmet>
        <title>Log In — StudentShifts</title>
        <meta name="description" content="Sign in to your StudentShifts account to find and apply for part-time jobs." />
      </Helmet>
      <div style={{ textAlign: "center", maxWidth: "420px", margin: "0 auto" }}>

        <div style={{ marginBottom: "1.75rem" }}>
          <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Welcome back</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Sign in to find your next shift</p>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem", fontWeight: "500", textAlign: "left" }}>
            {error}
          </div>
        )}

        <label htmlFor="login-email" style={srOnly}>Email address</label>
        <input
          id="login-email"
          placeholder="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={fieldStyle}
        />
        <label htmlFor="login-password" style={srOnly}>Password</label>
        <div style={{ position: "relative" }}>
          <input
            id="login-password"
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{ ...fieldStyle, margin: 0, paddingRight: "2.75rem" }}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(p => !p)}
            style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: 0, cursor: "pointer", color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1 }}
          >
            {showPassword ? "🙈" : "👁"}
          </button>
        </div>

        <div style={{ textAlign: "right", marginTop: "0.25rem", marginBottom: "0.25rem" }}>
          <span
            onClick={() => { setForgotMode(true); setResetEmail(email); }}
            style={{ fontSize: "0.82rem", color: "var(--color-brand)", cursor: "pointer", fontWeight: "600" }}
          >
            Forgot password?
          </span>
        </div>

        <button onClick={handleLogin} disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Signing in…" : "Login →"}
        </button>
        <button onClick={() => setPage("studentDashboard")} style={btnGhost}>Browse without account</button>
        <button onClick={() => setPage("studentDashboard")} style={btnHome}>← Back to Home</button>

        <p style={{ marginTop: "1.25rem", fontSize: "0.875rem", color: "#64748b" }}>
          Don't have an account?{" "}
          <span style={{ color: "var(--color-brand)", cursor: "pointer", fontWeight: "700" }} onClick={() => setPage("signup")}>
            Create one free
          </span>
        </p>

      </div>
    </PageWrapper>
  );
}

const fieldStyle = { width: "100%", padding: "0.72rem 1rem", margin: "0.4rem 0", display: "block", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", boxSizing: "border-box", fontSize: "0.95rem", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#1e293b", outline: "none" };
const srOnly     = { position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: 0, border: 0, clip: "rect(0,0,0,0)", overflow: "hidden" };
const btnBase    = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", marginTop: "0.6rem", fontSize: "0.95rem", fontFamily: "inherit" };
const btnPrimary = { ...btnBase, background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 4px 18px rgba(162,29,84,0.35)", marginTop: "1rem" };
const btnGhost   = { ...btnBase, backgroundColor: "#fafafa", color: "#64748b", boxShadow: "none" };
const btnHome    = { ...btnBase, marginTop: "0.75rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 18px rgba(244,63,94,0.35)" };
