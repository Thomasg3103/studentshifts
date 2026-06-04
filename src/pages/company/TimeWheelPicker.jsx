import { useState, useRef, useLayoutEffect, useCallback } from "react";

const ITEM_H  = 46;   // px per row
const VISIBLE = 5;    // rows shown (must be odd)
const PAD     = Math.floor(VISIBLE / 2);

function WheelCol({ items, selectedIdx, onSelect, fmt, label }) {
  const ref      = useRef(null);
  const timerRef = useRef(null);

  // Set initial scroll without animation
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIdx * ITEM_H;
  }, []); // eslint-disable-line

  const onScroll = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      onSelect(clamped);
      ref.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 120);
  }, [items.length, onSelect]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" }}>
      <span style={{ fontSize: "0.65rem", fontWeight: "800", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      <div style={{ position: "relative", width: 76, height: ITEM_H * VISIBLE }}>
        {/* Selection band */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: 4, right: 4, height: ITEM_H,
          backgroundColor: "#ede9fe", border: "1.5px solid #c4b5fd",
          borderRadius: "0.5rem", pointerEvents: "none", zIndex: 1,
        }} />
        {/* Scroll area — extra width hides the scrollbar */}
        <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", zIndex: 2 }}>
          <div
            ref={ref}
            onScroll={onScroll}
            style={{
              width: "calc(100% + 20px)",
              height: "100%",
              overflowY: "scroll",
              scrollSnapType: "y mandatory",
              WebkitOverflowScrolling: "touch",
              paddingTop: PAD * ITEM_H,
              paddingBottom: PAD * ITEM_H,
              boxSizing: "content-box",
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                onClick={() => {
                  ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
                  onSelect(i);
                }}
                style={{
                  width: "calc(100% - 20px)",
                  height: ITEM_H,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  scrollSnapAlign: "center",
                  fontSize: i === selectedIdx ? "1.3rem" : "1rem",
                  fontWeight: i === selectedIdx ? "800" : "400",
                  color: i === selectedIdx ? "#7c3aed" : "#94a3b8",
                  cursor: "pointer", userSelect: "none",
                  fontFamily: "inherit",
                  transition: "color 0.1s, font-size 0.1s",
                }}
              >
                {fmt(item)}
              </div>
            ))}
          </div>
        </div>
        {/* Top fade */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: PAD * ITEM_H,
          background: "linear-gradient(to bottom, rgba(255,255,255,0.92), transparent)",
          pointerEvents: "none", zIndex: 3,
        }} />
        {/* Bottom fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: PAD * ITEM_H,
          background: "linear-gradient(to top, rgba(255,255,255,0.92), transparent)",
          pointerEvents: "none", zIndex: 3,
        }} />
      </div>
    </div>
  );
}

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10 … 55

export function TimeWheelPicker({ value = "", onSave }) {
  const initH    = value ? parseInt(value.split(":")[0], 10) : 9;
  const initMRaw = value ? parseInt(value.split(":")[1], 10) : 0;
  const initM    = Math.min(Math.round(initMRaw / 5), MINUTES.length - 1);

  const [hIdx, setHIdx] = useState(Math.max(0, Math.min(23, initH)));
  const [mIdx, setMIdx] = useState(Math.max(0, initM));

  const result = `${String(HOURS[hIdx]).padStart(2, "0")}:${String(MINUTES[mIdx]).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <WheelCol
          items={HOURS}
          selectedIdx={hIdx}
          onSelect={setHIdx}
          fmt={h => String(h).padStart(2, "0")}
          label="Hour"
        />
        <span style={{ fontSize: "1.75rem", fontWeight: "800", color: "#7c3aed", alignSelf: "center", marginTop: "1.2rem", lineHeight: 1 }}>:</span>
        <WheelCol
          items={MINUTES}
          selectedIdx={mIdx}
          onSelect={setMIdx}
          fmt={m => String(m).padStart(2, "0")}
          label="Min"
        />
      </div>
      <button
        type="button"
        onClick={() => onSave(result)}
        style={{
          width: "100%",
          padding: "0.55rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "linear-gradient(135deg,#7c3aed,var(--color-brand))",
          color: "white",
          fontWeight: "700",
          fontSize: "0.85rem",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Save — {result}
      </button>
    </div>
  );
}
