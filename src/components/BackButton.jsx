import { useNavigate } from "react-router-dom";

export default function BackButton({ sticky = false }) {
  const navigate = useNavigate();
  return (
    <div style={{
      ...(sticky ? {
        position: "sticky", top: "60px", zIndex: 20,
        backgroundColor: "white", borderBottom: "1px solid #f1f5f9",
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
        style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: "0.88rem", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0" }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--color-brand)"}
        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
      >
        ← Back
      </button>
    </div>
  );
}
