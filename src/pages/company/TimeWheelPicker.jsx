import { useState, useRef, useEffect } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NOW     = new Date();
const CUR_YR  = NOW.getFullYear();

function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); } // m is 1-indexed
function pad2(n) { return String(n).padStart(2, "0"); }

/* ── Shared: stepper button with hold-down acceleration ─────────────────── */

function StepBtn({ onStep, children, color = "#7c3aed" }) {
  const phase1 = useRef(null); // slow repeat
  const phase2 = useRef(null); // fast repeat

  const stop = () => {
    clearTimeout(phase1.current);
    clearInterval(phase2.current);
  };

  const start = (e) => {
    e.preventDefault();
    onStep();
    // After 500 ms start repeating at 150 ms
    phase1.current = setTimeout(() => {
      phase2.current = setInterval(onStep, 150);
      // After another 800 ms speed up to 60 ms
      setTimeout(() => {
        clearInterval(phase2.current);
        phase2.current = setInterval(onStep, 60);
      }, 800);
    }, 500);
  };

  return (
    <button
      onMouseDown={start} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={start} onTouchEnd={stop}
      onContextMenu={e => e.preventDefault()}
      style={{
        width: "44px", height: "36px",
        borderRadius: "0.4rem",
        border: `1.5px solid ${color}33`,
        backgroundColor: `${color}12`,
        color,
        fontSize: "1rem", fontWeight: "800",
        cursor: "pointer", fontFamily: "inherit",
        lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
    >
      {children}
    </button>
  );
}

/* ── Shared: single step column (label / ▲ / value / ▼) ─────────────────── */

function StepCol({ label, display, onInc, onDec, wide = false, color = "#7c3aed" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
      <span style={{ fontSize: "0.62rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <StepBtn onStep={onInc} color={color}>▲</StepBtn>
      <div style={{
        width: wide ? "64px" : "52px",
        textAlign: "center",
        fontSize: wide ? "1.6rem" : "2rem",
        fontWeight: "800",
        color: "var(--color-text-primary, #1e293b)",
        lineHeight: 1.15,
        padding: "0.1rem 0",
      }}>
        {display}
      </div>
      <StepBtn onStep={onDec} color={color}>▼</StepBtn>
    </div>
  );
}

/* ── SaveButton ─────────────────────────────────────────────────────────── */

function SaveButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", padding: "0.6rem",
        borderRadius: "0.5rem", border: "none",
        background: "linear-gradient(135deg,#7c3aed,var(--color-brand))",
        color: "white", fontWeight: "700", fontSize: "0.9rem",
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

/* ══ TimeWheelPicker ════════════════════════════════════════════════════════ */

export function TimeWheelPicker({ value = "", onSave }) {
  const initH = value ? parseInt(value.split(":")[0], 10) : 9;
  const initM = value ? Math.round(parseInt(value.split(":")[1], 10) / 5) * 5 : 0;

  const [hour,   setHour]   = useState(Math.max(0, Math.min(23, initH)));
  const [minute, setMinute] = useState(Math.max(0, Math.min(55, initM)));

  const incH = () => setHour(h => (h + 1)  % 24);
  const decH = () => setHour(h => (h + 23) % 24);
  const incM = () => setMinute(m => (m + 5)  % 60);
  const decM = () => setMinute(m => (m + 55) % 60);

  const timeStr = `${pad2(hour)}:${pad2(minute)}`;

  const handleTextChange = (e) => {
    const [h, m] = e.target.value.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      setHour(Math.max(0, Math.min(23, h)));
      setMinute(Math.round(Math.max(0, Math.min(59, m)) / 5) * 5);
    }
  };

  const inputStyle = {
    width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.45rem",
    border: "1.5px solid #e2e8f0", fontSize: "0.9rem", fontFamily: "inherit",
    boxSizing: "border-box", color: "var(--color-text-body, #374151)", textAlign: "center",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <StepCol label="Hour"   display={pad2(hour)}   onInc={incH} onDec={decH} />
        <span style={{ fontSize: "2.2rem", fontWeight: "800", color: "#7c3aed", marginTop: "1.5rem", lineHeight: 1 }}>:</span>
        <StepCol label="Min"    display={pad2(minute)} onInc={incM} onDec={decM} />
      </div>
      <input type="time" value={timeStr} onChange={handleTextChange} style={inputStyle} />
      <SaveButton label={`Save — ${timeStr}`} onClick={() => onSave(timeStr)} />
    </div>
  );
}

/* ══ DateStepper ════════════════════════════════════════════════════════════ */

export function DateStepper({ value = "", onSave }) {
  const init = value ? new Date(value + "T00:00:00") : NOW;
  const [day,   setDay]   = useState(init.getDate());
  const [month, setMonth] = useState(init.getMonth() + 1); // 1-indexed
  const [year,  setYear]  = useState(init.getFullYear());

  // Clamp day whenever month or year changes
  useEffect(() => {
    setDay(d => Math.min(d, daysInMonth(year, month)));
  }, [month, year]);

  const incDay   = () => setDay(d => d >= daysInMonth(year, month) ? 1 : d + 1);
  const decDay   = () => setDay(d => d <= 1 ? daysInMonth(year, month) : d - 1);
  const incMonth = () => setMonth(m => m >= 12 ? 1 : m + 1);
  const decMonth = () => setMonth(m => m <= 1 ? 12 : m - 1);
  const incYear  = () => setYear(y => Math.min(y + 1, CUR_YR + 5));
  const decYear  = () => setYear(y => Math.max(y - 1, CUR_YR));

  const safeDay = Math.min(day, daysInMonth(year, month));
  const dateStr = `${year}-${pad2(month)}-${pad2(safeDay)}`;
  const label   = `Save — ${pad2(safeDay)} ${MONTHS[month - 1]} ${year}`;

  const handleDateInput = (e) => {
    if (!e.target.value) return;
    const d = new Date(e.target.value + "T00:00:00");
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setDay(d.getDate());
  };

  const inputStyle = {
    width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.45rem",
    border: "1.5px solid #e2e8f0", fontSize: "0.9rem", fontFamily: "inherit",
    boxSizing: "border-box", color: "var(--color-text-body, #374151)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <StepCol label="Day"   display={pad2(safeDay)}        onInc={incDay}   onDec={decDay} />
        <StepCol label="Month" display={MONTHS[month - 1]}    onInc={incMonth} onDec={decMonth} wide />
        <StepCol label="Year"  display={String(year)}         onInc={incYear}  onDec={decYear}  wide />
      </div>
      <input type="date" value={dateStr} onChange={handleDateInput} style={inputStyle} />
      <SaveButton label={label} onClick={() => onSave(dateStr)} />
    </div>
  );
}
