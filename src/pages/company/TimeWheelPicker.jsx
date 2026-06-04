import { useState } from "react";

const btn = (color = "#7c3aed") => ({
  width: "44px",
  height: "36px",
  borderRadius: "0.4rem",
  border: `1.5px solid ${color}22`,
  backgroundColor: `${color}11`,
  color: color,
  fontSize: "1rem",
  fontWeight: "800",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  userSelect: "none",
});

export function TimeWheelPicker({ value = "", onSave }) {
  const initH = value ? parseInt(value.split(":")[0], 10) : 9;
  const initM = value ? Math.round(parseInt(value.split(":")[1], 10) / 5) * 5 : 0;

  const [hour,   setHour]   = useState(Math.max(0, Math.min(23, initH)));
  const [minute, setMinute] = useState(Math.max(0, Math.min(55, initM)));

  const incH = () => setHour(h   => (h + 1)  % 24);
  const decH = () => setHour(h   => (h + 23) % 24);
  const incM = () => setMinute(m => (m + 5)  % 60);
  const decM = () => setMinute(m => (m + 55) % 60);

  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.9rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>

        {/* Hour */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hour</span>
          <button style={btn()} onClick={incH}>▲</button>
          <div style={{ width: "56px", textAlign: "center", fontSize: "2rem", fontWeight: "800", color: "#1e293b", lineHeight: 1.1, padding: "0.15rem 0" }}>
            {String(hour).padStart(2, "0")}
          </div>
          <button style={btn()} onClick={decH}>▼</button>
        </div>

        <span style={{ fontSize: "2.2rem", fontWeight: "800", color: "#7c3aed", marginTop: "1.4rem", lineHeight: 1 }}>:</span>

        {/* Minute */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Min</span>
          <button style={btn()} onClick={incM}>▲</button>
          <div style={{ width: "56px", textAlign: "center", fontSize: "2rem", fontWeight: "800", color: "#1e293b", lineHeight: 1.1, padding: "0.15rem 0" }}>
            {String(minute).padStart(2, "0")}
          </div>
          <button style={btn()} onClick={decM}>▼</button>
        </div>

      </div>

      <button
        type="button"
        onClick={() => onSave(timeStr)}
        style={{
          width: "100%",
          padding: "0.6rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "linear-gradient(135deg,#7c3aed,var(--color-brand))",
          color: "white",
          fontWeight: "700",
          fontSize: "0.9rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Save — {timeStr}
      </button>
    </div>
  );
}
