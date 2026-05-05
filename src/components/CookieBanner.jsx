import { useState } from "react";

const STORAGE_KEY = "ss_cookie_notice_dismissed";

export default function CookieBanner({ setPage, hasBottomNav }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div style={{
      position: "fixed",
      bottom: hasBottomNav ? "64px" : 0,
      left: 0,
      right: 0,
      backgroundColor: "#0f172a",
      color: "white",
      padding: "1rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      flexWrap: "wrap",
      zIndex: 500,
      boxShadow: "0 -4px 24px rgba(0,0,0,0.25)",
    }}>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, flex: 1, minWidth: "200px" }}>
        We use strictly necessary cookies for authentication and session management.
        No tracking or advertising cookies are used.{" "}
        <span
          onClick={() => setPage("privacy")}
          style={{ color: "#a78bfa", cursor: "pointer", fontWeight: "600", textDecoration: "underline" }}
        >
          Privacy Policy
        </span>
      </p>
      <button
        onClick={dismiss}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "2rem",
          border: "none",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "white",
          fontWeight: "700",
          fontSize: "0.85rem",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        Got it
      </button>
    </div>
  );
}
