import { useState, useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useApp } from "../context/AppContext";

const STORAGE_KEY = (id) => `ss_company_onboarding_done_${id}`;

export default function CompanyOnboardingBanner({ onPostJob }) {
  const { currentUser } = useApp();
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  useFocusTrap(panelRef, () => dismiss(), visible);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "company") return;
    if (currentUser.verificationStatus !== "verified") return;
    const done = localStorage.getItem(STORAGE_KEY(currentUser.id));
    if (done) return;
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [currentUser?.id, currentUser?.verificationStatus]);

  const dismiss = () => {
    if (currentUser?.id) localStorage.setItem(STORAGE_KEY(currentUser.id), "1");
    setVisible(false);
  };

  const handlePost = () => {
    dismiss();
    onPostJob?.();
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-onboarding-title"
        style={{ backgroundColor: "white", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "420px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", textAlign: "center" }}
      >
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎉</div>
        <h2 id="company-onboarding-title" style={{ margin: "0 0 0.5rem", fontWeight: 800, fontSize: "1.4rem", color: "#1e293b" }}>
          You're approved, {currentUser?.name?.split(" ")[0] || "there"}!
        </h2>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.65 }}>
          Your company account has been verified. You can now post jobs and start connecting with students.
        </p>

        <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: "0.75rem", padding: "0.85rem 1rem", marginBottom: "1.5rem", textAlign: "left" }}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 700, fontSize: "0.875rem", color: "#15803d" }}>Get started in 3 steps:</p>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#374151", lineHeight: 1.7 }}>
            <li>Post your first job listing</li>
            <li>Review applicants in your pipeline</li>
            <li>Accept students and start chatting</li>
          </ol>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            onClick={handlePost}
            style={{ width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", boxShadow: "0 4px 18px rgba(162,29,84,0.3)" }}
          >
            Post My First Job →
          </button>
          <button
            onClick={dismiss}
            style={{ background: "none", border: "none", color: "#64748b", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem", padding: "0.4rem" }}
          >
            Explore dashboard first
          </button>
        </div>
      </div>
    </div>
  );
}
