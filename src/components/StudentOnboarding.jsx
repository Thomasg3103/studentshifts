import { useState, useRef, useEffect } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useApp } from "../context/AppContext";

const STORAGE_KEY = (id) => `ss_onboarding_done_${id}`;

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

const STEPS = [
  { key: "welcome",      label: "Welcome",      icon: "🎉" },
  { key: "location",     label: "Location",     icon: "📍" },
  { key: "availability", label: "Availability", icon: "📅" },
];

function StepDots({ step }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "1.5rem" }}>
      {STEPS.map((s, i) => (
        <div key={s.key} style={{
          width: i === step ? "20px" : "8px",
          height: "8px",
          borderRadius: "999px",
          backgroundColor: i <= step ? "var(--color-brand)" : "#e2e8f0",
          transition: "all 0.2s",
        }} />
      ))}
    </div>
  );
}

/* ── Step 0: Welcome ── */
function WelcomeStep({ onNext, onSkip, name }) {
  return (
    <>
      <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎓</div>
      <h2 style={{ margin: "0 0 0.5rem", fontWeight: 800, fontSize: "1.4rem", color: "var(--color-text-primary, #1e293b)" }}>
        You're verified, {name?.split(" ")[0] || "there"}!
      </h2>
      <p style={{ margin: "0 0 1.5rem", fontSize: "0.9rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>
        Let's spend 60 seconds setting up your profile so companies can find you and see when you're available.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button onClick={onNext} style={btnPrimary}>Set Up My Profile →</button>
        <button onClick={onSkip} style={btnGhost}>Skip for now</button>
      </div>
    </>
  );
}

/* ── Step 1: Location ── */
function LocationStep({ onNext, onBack, onSkip }) {
  const { currentUser, setStudentLocation } = useApp();
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    if (currentUser?.savedLocation?.displayName) {
      setInput(currentUser.savedLocation.displayName);
      setSaved(true);
    }
  }, []);

  const geocode = async () => {
    const q = input.trim();
    if (!q) { setError("Enter a town, city or Eircode."); return; }
    setLoading(true); setError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Ireland")}&format=json&limit=1&countrycodes=ie`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data = await res.json();
      if (!data?.[0]) { setError("Location not found. Try a different town or Eircode."); return; }
      const { lat, lon, display_name } = data[0];
      const loc = { lat: parseFloat(lat), lng: parseFloat(lon), displayName: display_name.split(",").slice(0, 2).join(", ") };
      setStudentLocation(loc);
      // Persist to DB via AccountPage pattern — just update context, parent handles save
      setSaved(true);
      setInput(loc.displayName);
    } catch {
      setError("Couldn't look up that location. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📍</div>
      <h2 style={{ margin: "0 0 0.35rem", fontWeight: 800, fontSize: "1.25rem", color: "var(--color-text-primary, #1e293b)" }}>Where are you based?</h2>
      <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.55 }}>
        Companies see your distance from them — it helps them find local students.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setSaved(false); }}
          onKeyDown={e => e.key === "Enter" && geocode()}
          placeholder="e.g. Cork, Dublin 2, D02 XY45"
          style={{ flex: 1, padding: "0.65rem 0.9rem", borderRadius: "0.65rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" }}
        />
        <button onClick={geocode} disabled={loading} style={{ ...btnSmall, opacity: loading ? 0.6 : 1 }}>
          {loading ? "…" : "Set"}
        </button>
      </div>
      {error && <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#e11d48", fontWeight: 500 }}>{error}</p>}
      {saved && <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "#16a34a", fontWeight: 600 }}>✓ Location saved</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={onNext} style={btnPrimary}>Continue →</button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={onBack} style={{ ...btnOutline, flex: 1 }}>← Back</button>
          <button onClick={onSkip} style={{ ...btnGhost, flex: 1 }}>Skip</button>
        </div>
      </div>
    </>
  );
}

/* ── Step 2: Availability ── */
function AvailabilityStep({ onDone, onBack }) {
  const { currentUser, setCurrentUser } = useApp();
  const [selected, setSelected] = useState({});
  const [expanded, setExpanded] = useState({});
  const [saving, setSaving]     = useState(false);

  const toggle = (day, slot) => {
    setSelected(prev => {
      const cur = prev[day] || [];
      const next = cur.includes(slot) ? cur.filter(s => s !== slot) : [...cur, slot];
      return { ...prev, [day]: next };
    });
  };

  const toggleExpanded = (day) => {
    setExpanded(prev => ({ ...prev, [day]: !prev[day] }));
  };

  const hasAny = Object.values(selected).some(v => v.length > 0);

  const handleDone = async () => {
    if (hasAny) {
      setSaving(true);
      try {
        const { updateStudentProfile } = await import("../lib/auth");
        await updateStudentProfile(currentUser.id, { availability: selected });
        setCurrentUser(prev => ({ ...prev, availability: selected }));
      } catch (e) {
        console.warn("Could not save availability:", e);
      }
      setSaving(false);
    }
    onDone();
  };

  return (
    <>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📅</div>
      <h2 style={{ margin: "0 0 0.35rem", fontWeight: 800, fontSize: "1.25rem", color: "var(--color-text-primary, #1e293b)" }}>When can you work?</h2>
      <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.55 }}>
        Tap a day to expand it, then select your available time slots. You can update this any time in Account.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1rem" }}>
        {weekdays.map(day => {
          const daySlots = selected[day] || [];
          const isOpen   = !!expanded[day];
          const isActive = daySlots.length > 0;
          return (
            <div key={day} style={{ border: `1.5px solid ${isActive ? "var(--color-brand)" : "#e2e8f0"}`, borderRadius: "0.6rem", overflow: "hidden", backgroundColor: isActive ? "#fdf2f8" : "white" }}>
              <button
                onClick={() => toggleExpanded(day)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.8rem", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.875rem", color: isActive ? "var(--color-brand)" : "#374151" }}>{day}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>
                  {isActive ? `${daySlots.length} selected` : isOpen ? "—" : "Off"}
                </span>
              </button>
              {(isOpen || isActive) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", padding: "0 0.8rem 0.6rem" }}>
                  {timeSlots.map(slot => (
                    <button key={slot} onClick={() => toggle(day, slot)}
                      style={{ padding: "0.4rem 0.55rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: 600, minHeight: "32px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${daySlots.includes(slot) ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: daySlots.includes(slot) ? "var(--color-brand)" : "white", color: daySlots.includes(slot) ? "white" : "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button onClick={handleDone} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving…" : hasAny ? "Save Availability & Finish" : "Finish Without Setting Availability"}
        </button>
        <button onClick={onBack} style={btnOutline}>← Back</button>
      </div>
    </>
  );
}

/* ── Main component ── */
export default function StudentOnboarding() {
  const { currentUser } = useApp();
  const [step, setStep]       = useState(0);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  useFocusTrap(panelRef, () => dismiss(), visible);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== "student") return;
    if (currentUser.verificationStatus !== "verified") return;
    const done = localStorage.getItem(STORAGE_KEY(currentUser.id));
    if (done) return;
    // Small delay so page renders first
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [currentUser?.id, currentUser?.verificationStatus]);

  const dismiss = () => {
    if (currentUser?.id) localStorage.setItem(STORAGE_KEY(currentUser.id), "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      onClick={dismiss}
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Profile setup"
        style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "400px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", textAlign: "center", maxHeight: "90vh", overflowY: "auto" }}
      >
        <StepDots step={step} />

        {step === 0 && (
          <WelcomeStep
            name={currentUser?.name}
            onNext={() => setStep(1)}
            onSkip={dismiss}
          />
        )}
        {step === 1 && (
          <LocationStep
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onSkip={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <AvailabilityStep
            onDone={dismiss}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </div>
  );
}

const btnPrimary = { width: "100%", padding: "0.75rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.95rem", boxShadow: "0 4px 18px rgba(162,29,84,0.3)" };
const btnOutline = { width: "100%", padding: "0.7rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem" };
const btnGhost   = { background: "none", border: "none", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem", padding: "0.4rem" };
const btnSmall   = { padding: "0.65rem 1rem", borderRadius: "0.65rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", whiteSpace: "nowrap" };
