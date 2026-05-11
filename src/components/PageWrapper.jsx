import { useState, useEffect } from "react";

export default function PageWrapper({ children, narrow }) {

  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <main className="page-wrapper-outer" style={{
      width: "100%",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      padding: narrow ? "2.5rem 1rem" : "2rem 2rem",
      boxSizing: "border-box",
      backgroundColor: "#fafafa",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      <div className="page-inner" style={{
        width: "100%",
        maxWidth: narrow ? "520px" : "1400px",
        margin: "0 auto",
        padding: narrow ? "2rem 2.5rem" : "2rem 2.5rem",
        boxSizing: "border-box",
        backgroundColor: "white",
        borderRadius: narrow ? "1.25rem" : "0",
        boxShadow: narrow ? "0 4px 24px rgba(0,0,0,0.07)" : "none",
      }}>
        {children}
      </div>

      {showTop && (
        <button
          onClick={scrollToTop}
          className="scroll-top-btn"
          aria-label="Back to top"
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
            color: "white",
            border: "none",
            fontSize: "1.1rem",
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(162,29,84,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
          }}
        >
          ↑
        </button>
      )}

    </main>
  );
}
