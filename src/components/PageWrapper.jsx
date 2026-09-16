import { useState, useEffect } from "react";

// Generic page-level layout shell used by most pages in the app — it
// centers the page content, applies the shared card-like background/padding,
// and adds a "scroll to top" floating button that appears once the user has
// scrolled down. Using this instead of repeating the same wrapper markup on
// every page keeps page layout consistent app-wide.
//
// `narrow` switches between two layouts: a wide full-width layout for content
// like job listings/dashboards, and a narrower centered "card" layout
// (max 520px) better suited to forms like Login/Signup.
export default function PageWrapper({ children, narrow }) {

  // Controls visibility of the floating "back to top" button.
  const [showTop, setShowTop] = useState(false);

  // Only show the scroll-to-top button once the user has scrolled far enough
  // that returning to the top by hand would be inconvenient.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <main className="page-wrapper-outer page-fade" style={{
      width: "100%",
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      padding: narrow ? "2.5rem 1rem" : "2rem 2rem",
      boxSizing: "border-box",
      backgroundColor: "var(--color-bg-subtle)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      <div className="page-inner" style={{
        width: "100%",
        maxWidth: narrow ? "520px" : "1400px",
        margin: "0 auto",
        padding: narrow ? "2rem 2.5rem" : "2rem 2.5rem",
        boxSizing: "border-box",
        backgroundColor: "var(--color-bg-elevated, white)",
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
            bottom: "5rem",
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
