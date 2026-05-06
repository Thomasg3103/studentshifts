import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();
  return (
    <div style={{
      maxWidth: "880px", margin: "0 auto", padding: "1rem 1rem 0",
      width: "100%", boxSizing: "border-box",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontWeight: 700, fontSize: "0.88rem", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0" }}
        onMouseEnter={e => e.currentTarget.style.color = "#A21D54"}
        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
      >
        ← Back
      </button>
    </div>
  );
}
