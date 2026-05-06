import { useState, useEffect } from "react";

export default function PageWrapper({ children }) {

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
      padding: "2.5rem 1rem",
      boxSizing: "border-box",
      backgroundColor: "#fafafa",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      <div className="page-inner" style={{
        width: "100%",
        maxWidth: "880px",
        margin: "0 auto",
        padding: "2rem 2.5rem",
        boxSizing: "border-box",
        backgroundColor: "white",
        borderRadius: "1.25rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>
        {children}
      </div>

      {showTop && (
        <button
          onClick={scrollToTop}
          className="scroll-top-btn"
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #A21D54, #C2185B)",
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
          title="Back to top"
        >
          ↑
        </button>
      )}

    </main>
  );
}
