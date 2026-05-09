import { Component } from "react";
import * as Sentry from "@sentry/react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error:", error, info);
    Sentry.captureException(error, { extra: info });
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || "Unknown error";
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa", padding: "2rem" }}>
          <div style={{ textAlign: "center", maxWidth: "480px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h2 style={{ fontWeight: "800", fontSize: "1.4rem", color: "#1e293b", marginBottom: "0.5rem" }}>Something went wrong</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>
              We couldn't load StudentShifts. This is usually a temporary issue — please refresh the page.
            </p>
            <p style={{ color: "#b91c1c", fontSize: "0.78rem", fontFamily: "monospace", backgroundColor: "#fff1f2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", marginBottom: "1.5rem", wordBreak: "break-word", textAlign: "left" }}>
              {msg}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "0.7rem 1.75rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(162,29,84,0.35)" }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
