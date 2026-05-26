import { useState, useMemo, useRef } from "react";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = [
  "08:00","09:00","10:00","11:00","12:00","13:00",
  "14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00",
];

function hrLabel(slot) {
  const h = parseInt(slot);
  if (h === 12) return "12pm";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

const QUICK_FILLS = [
  { label: "Weekday mornings",  days: DAYS_FULL.slice(0,5), slots: SLOTS.slice(0,5) },
  { label: "Weekday evenings",  days: DAYS_FULL.slice(0,5), slots: SLOTS.slice(10)  },
  { label: "All weekends",      days: DAYS_FULL.slice(5),   slots: SLOTS             },
  { label: "Clear all",         clear: true },
];

function applyDrag(startValue, mode, touched) {
  const result = {};
  for (const day of DAYS_FULL) {
    const base = [...(startValue[day] || [])];
    for (const slot of SLOTS) {
      if (!touched.has(`${day}:${slot}`)) continue;
      if (mode === "add" && !base.includes(slot)) base.push(slot);
      if (mode === "remove") { const i = base.indexOf(slot); if (i !== -1) base.splice(i, 1); }
    }
    if (base.length) result[day] = base;
  }
  return result;
}

export default function TimetableGrid({ value, onChange }) {
  const [drag, setDrag] = useState(null);
  const containerRef = useRef(null);

  const display = useMemo(() =>
    drag ? applyDrag(drag.startValue, drag.mode, drag.touched) : value,
  [value, drag]);

  const isSel = (day, slot) => (display[day] || []).includes(slot);

  const startDrag = (day, slot) => {
    const mode = isSel(day, slot) ? "remove" : "add";
    setDrag({ mode, startValue: value, touched: new Set([`${day}:${slot}`]) });
  };

  const extendDrag = (day, slot) => {
    if (!drag) return;
    const key = `${day}:${slot}`;
    if (drag.touched.has(key)) return;
    setDrag(prev => ({ ...prev, touched: new Set([...prev.touched, key]) }));
  };

  const commitDrag = () => {
    if (!drag) return;
    onChange(applyDrag(drag.startValue, drag.mode, drag.touched));
    setDrag(null);
  };

  // Touch: find cell under finger
  const onTouchMove = (e) => {
    if (!drag) return;
    e.preventDefault();
    const t = e.touches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const cell = el?.closest("[data-cell]");
    if (!cell) return;
    const [dayIdx, slot] = cell.dataset.cell.split(":");
    extendDrag(DAYS_FULL[parseInt(dayIdx)], slot);
  };

  const totalSlots = Object.values(display).reduce((s, v) => s + (v?.length || 0), 0);

  const applyQuick = (q) => {
    if (q.clear) { onChange({}); return; }
    const next = { ...value };
    for (const day of q.days) {
      const base = new Set(next[day] || []);
      for (const s of q.slots) base.add(s);
      next[day] = [...base];
    }
    onChange(next);
  };

  return (
    <div
      ref={containerRef}
      style={{ userSelect: "none", WebkitUserSelect: "none", touchAction: "none" }}
      onMouseUp={commitDrag}
      onMouseLeave={commitDrag}
      onTouchEnd={commitDrag}
      onTouchMove={onTouchMove}
    >
      {/* Quick-fill strip */}
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {QUICK_FILLS.map(q => (
          <button
            key={q.label}
            type="button"
            onClick={() => applyQuick(q)}
            style={{
              padding: "0.28rem 0.65rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              border: q.clear ? "1.5px solid var(--color-border-light, #e2e8f0)" : "1.5px solid var(--color-brand)",
              background: q.clear ? "none" : "#fce7f3",
              color: q.clear ? "var(--color-text-secondary, #64748b)" : "var(--color-brand)",
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
        <div style={{ minWidth: "320px", padding: "0.5rem" }}>

          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
            <div />
            {DAYS_SHORT.map((d, i) => (
              <div key={d} style={{
                textAlign: "center", fontSize: "0.68rem", fontWeight: "800",
                color: i >= 5 ? "#d97706" : "var(--color-text-secondary, #64748b)",
                padding: "0.2rem 0",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Time rows */}
          {SLOTS.map(slot => (
            <div key={slot} style={{ display: "grid", gridTemplateColumns: "32px repeat(7, 1fr)", gap: "3px", marginBottom: "3px" }}>
              <div style={{
                fontSize: "0.6rem", color: "var(--color-text-muted, #94a3b8)",
                textAlign: "right", paddingRight: "4px", paddingTop: "5px",
                fontWeight: "600", lineHeight: 1,
              }}>
                {hrLabel(slot)}
              </div>
              {DAYS_FULL.map((day, i) => {
                const sel = isSel(day, slot);
                const weekend = i >= 5;
                return (
                  <div
                    key={day}
                    data-cell={`${i}:${slot}`}
                    onMouseDown={e => { e.preventDefault(); startDrag(day, slot); }}
                    onMouseEnter={() => extendDrag(day, slot)}
                    onTouchStart={e => { e.preventDefault(); startDrag(day, slot); }}
                    style={{
                      height: "24px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      backgroundColor: sel
                        ? (weekend ? "#fef3c7" : "var(--color-brand)")
                        : "var(--color-bg-surface, #f8fafc)",
                      border: `1px solid ${sel
                        ? (weekend ? "#f59e0b" : "transparent")
                        : "var(--color-border-light, #e2e8f0)"}`,
                      opacity: sel ? 1 : 0.7,
                      transition: "background-color 0.06s, border-color 0.06s",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>
          {totalSlots === 0
            ? "Tap or drag to mark when you're free"
            : `${totalSlots} hour${totalSlots !== 1 ? "s" : ""} available per week`}
        </p>
        {totalSlots > 0 && (
          <span style={{ fontSize: "0.72rem", color: "var(--color-brand)", fontWeight: "700" }}>
            ✓ Saved automatically
          </span>
        )}
      </div>
    </div>
  );
}
