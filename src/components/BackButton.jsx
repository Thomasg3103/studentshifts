import { useNavigate } from "react-router-dom";

// Small reusable "← Back" control used at the top of detail/sub pages
// (e.g. a single job listing, an account sub-page) so users can return
// to wherever they came from without relying on the browser's own back
// button. navigate(-1) just replays the browser history one step back,
// same as clicking the browser's back button, but styled to match the app.
//
// `sticky` switches between two layouts: a normal in-flow bar (default,
// used on pages with their own scroll) or a bar pinned under the header
// that stays visible while the page content scrolls beneath it.
export default function BackButton({ sticky = false }) {
  const navigate = useNavigate();
  return (
    <div style={{
      ...(sticky ? {
        position: "sticky", top: "60px", zIndex: 20,
        backgroundColor: "var(--color-bg-elevated, white)", borderBottom: "1px solid #f1f5f9",
        padding: "0.5rem 1rem", width: "100%",
      } : {
        maxWidth: "880px", margin: "0 auto", padding: "1rem 1rem 0",
        width: "100%",
      }),
      boxSizing: "border-box",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary, #64748b)", fontWeight: 700, fontSize: "0.88rem", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.25rem", minHeight: "44px" }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--color-brand)"}
        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
      >
        ← Back
      </button>
    </div>
  );
}
