/* ─── Shared constants and small utility components ─────────────────────── */

export const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
export const DAY_ABBR = { Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu", Friday: "Fri", Saturday: "Sat", Sunday: "Sun" };

// Used by AvailabilityHeatmap
export const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export function StudentAvailabilityRow({ availability }) {
  if (!availability || Object.keys(availability).length === 0) return null;
  const hasAny = weekdays.some(d => availability[d]?.length > 0);
  if (!hasAny) return null;

  return (
    <div>
      <p style={{ fontSize: "0.7rem", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.3rem" }}>Availability</p>
      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
        {weekdays.map(day => {
          const slots = availability[day] || [];
          const isWeekend = day === "Saturday" || day === "Sunday";
          const hasSlots = slots.length > 0;
          if (!hasSlots) return null;
          const earliest = slots.reduce((a, b) => a < b ? a : b);
          const latest   = slots.reduce((a, b) => a > b ? a : b);
          // Convert "09:00" → "9am" style
          const fmt = (t) => { const [h] = t.split(":"); const n = parseInt(h); return n < 12 ? `${n}am` : n === 12 ? "12pm" : `${n - 12}pm`; };
          return (
            <div
              key={day}
              title={`${day}: ${slots.join(", ")}`}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                backgroundColor: isWeekend ? "#fef3c7" : "#fce7f3",
                border: `1.5px solid ${isWeekend ? "#fcd34d" : "#fce7f3"}`,
                borderRadius: "0.45rem", padding: "0.2rem 0.4rem", minWidth: "34px",
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: "800", color: isWeekend ? "#d97706" : "var(--color-brand)" }}>{DAY_ABBR[day]}</span>
              <span style={{ fontSize: "0.6rem", color: isWeekend ? "#b45309" : "var(--color-brand)", fontWeight: "600", whiteSpace: "nowrap" }}>
                {earliest === latest ? fmt(earliest) : `${fmt(earliest)}–${fmt(latest)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatCard({ label, value }) {
  return (
    <div style={{
      flex: "1", minWidth: "110px",
      backgroundColor: "white", border: "1px solid #e2e8f0",
      borderRadius: "0.75rem", padding: "1rem 1.25rem",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <p style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.4rem" }}>{label}</p>
      <p style={{ fontSize: "1.85rem", fontWeight: "800", color: "#0f172a", margin: 0, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</p>
    </div>
  );
}

export function Section({ label, children }) {
  return (
    <div>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.65rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      {children}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "1rem",
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "white", borderRadius: "1rem",
          width: "100%", maxWidth: "520px", maxHeight: "85vh",
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ padding: "1.5rem 1.5rem 0", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontWeight: "700", fontSize: "1.1rem", margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: "#6b7280", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 1.5rem 1.5rem" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Availability Heatmap ───────────────────────────────────────────────── */

const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

export function AvailabilityHeatmap({ data }) {
  const allCounts = DAYS.flatMap(d => SLOTS.map(s => data[d]?.[s] || 0));
  const max = Math.max(...allCounts, 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: "0.65rem", width: "100%", minWidth: "480px" }}>
        <thead>
          <tr>
            <th style={{ padding: "0 0.4rem 0.4rem 0", textAlign: "left", color: "#94a3b8", fontWeight: "600", minWidth: "72px" }}></th>
            {SLOTS.map(s => (
              <th key={s} style={{ padding: "0 2px 0.4rem", textAlign: "center", color: "#94a3b8", fontWeight: "600", whiteSpace: "nowrap" }}>
                {s.slice(0,2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map(day => {
            const isWeekend = day === "Saturday" || day === "Sunday";
            return (
              <tr key={day}>
                <td style={{ padding: "2px 0.4rem 2px 0", fontWeight: "600", color: isWeekend ? "#d97706" : "#374151", whiteSpace: "nowrap" }}>
                  {day.slice(0, 3)}
                </td>
                {SLOTS.map(slot => {
                  const count = data[day]?.[slot] || 0;
                  const intensity = count / max;
                  const bg = count === 0 ? "#fafafa"
                    : isWeekend
                      ? `rgba(245,158,11,${0.15 + intensity * 0.75})`
                      : `rgba(162,29,84,${0.15 + intensity * 0.75})`;
                  return (
                    <td key={slot} title={`${day} ${slot} — ${count} student${count !== 1 ? "s" : ""}`} style={{ padding: "2px", textAlign: "center" }}>
                      <div style={{ width: "100%", minWidth: "20px", height: "20px", borderRadius: "3px", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", color: intensity > 0.5 ? "white" : "#64748b", fontWeight: "700", fontSize: "0.6rem" }}>
                        {count > 0 ? count : ""}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.5rem", marginBottom: 0 }}>
        Numbers show how many verified students are free at each time. Hover a cell for details.
      </p>
    </div>
  );
}
