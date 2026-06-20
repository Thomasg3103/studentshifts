import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabase";
import AppFooter from "../components/AppFooter";
import { useApp } from "../context/AppContext";

// #23 — count-up hook driven by IntersectionObserver
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (target == null) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const step = (now) => {
        const p = Math.min((now - start) / duration, 1);
        setValue(Math.floor(p * target));
        if (p < 1) requestAnimationFrame(step);
        else setValue(target);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return [value, ref];
}


const HOW_IT_WORKS = [
  { icon: "🎓", step: "1. Sign Up",        desc: "Create a free student account in under 2 minutes. Verify your student ID and you're in." },
  { icon: "🔍", step: "2. Browse Jobs",    desc: "Filter by day, time, location and pay. Find shifts that actually fit your timetable." },
  { icon: "📋", step: "3. Apply Instantly",desc: "One click to apply. Your CV is sent straight to the employer — no faff, no forms." },
  { icon: "🎉", step: "4. Get Hired",      desc: "Hear back fast. Start earning while you study. It's that simple." },
];


export default function LandingPage() {
  const { currentUser, darkMode, toggleDarkMode } = useApp();
  const navigate  = useNavigate();
  const [locations, setLocations] = useState([]);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [stats,     setStats]     = useState({ students: null, jobs: null, companies: null });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const [studentsCount, studentsRef] = useCountUp(stats.students);
  const [jobsCount,     jobsRef]     = useCountUp(stats.jobs);
  const [companiesCount,companiesRef]= useCountUp(stats.companies);
  const menuRef = useRef(null);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("location")
      .eq("status", "Active")
      .then(({ data }) => {
        if (!data) return;
        const groups = {};
        data.forEach(j => {
          const city = (j.location || "").split(",")[0].trim() || "Other";
          groups[city] = (groups[city] || 0) + 1;
        });
        setLocations(Object.entries(groups).sort((a, b) => b[1] - a[1]));
      });

    Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "verified"),
      supabase.from("jobs").select("id", { count: "exact", head: true }),
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("status", "verified"),
    ]).then(([{ count: students }, { count: jobs }, { count: companies }]) => {
      setStats({ students, jobs, companies });
    });
  }, []);

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: "var(--color-bg-subtle)", minHeight: "100vh" }}>
      <Helmet>
        <title>StudentShifts — Part-Time Jobs for Irish Students</title>
        <meta name="description" content="Find flexible part-time work that fits your college timetable. Apply to verified Irish employers in one click — no cover letter, no experience needed. Free to join." />
        <link rel="canonical" href="https://studentshifts.ie/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content="StudentShifts — Part-Time Jobs for Irish Students" />
        <meta property="og:description" content="Find flexible part-time work that fits your college timetable. Apply to verified Irish employers in one click — free to join." />
        <meta property="og:url" content="https://studentshifts.ie/" />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="StudentShifts — Part-Time Jobs for Irish Students" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="StudentShifts — Part-Time Jobs for Irish Students" />
        <meta name="twitter:description" content="Find flexible part-time work that fits your college timetable. Apply to verified Irish employers in one click — free to join." />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
      </Helmet>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 2.5rem",
        background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        boxShadow: "0 4px 20px rgba(162,29,84,0.35)",
        position: "sticky", top: 0, zIndex: 200,
      }}>
        {/* Logo */}
        <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem", flexShrink: 1, minWidth: 0, overflow: "hidden" }}>
          {windowWidth >= 480 && <LogoIcon />}
          <span style={{ fontSize: windowWidth < 480 ? "1.4rem" : "1.7rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
            Student<span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Shifts{windowWidth >= 480 ? ".ie" : ""}</span>
          </span>
        </div>

        {/* Account icon + Hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", position: "relative", flexShrink: 0 }} ref={menuRef}>
          <button
            onClick={() => navigate("/login")}
            title="Login / Sign Up"
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "50%", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}
          >
            <PersonIcon />
          </button>
          <button
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleDarkMode}
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.5rem", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem" }}
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.5rem", width: "38px", height: "38px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
          >
            <span style={{ width: "18px", height: "2px", background: "var(--color-bg-elevated, white)", borderRadius: "1px", display: "block" }} />
            <span style={{ width: "18px", height: "2px", background: "var(--color-bg-elevated, white)", borderRadius: "1px", display: "block" }} />
            <span style={{ width: "18px", height: "2px", background: "var(--color-bg-elevated, white)", borderRadius: "1px", display: "block" }} />
          </button>

          {menuOpen && (
            <div style={{
              position: "absolute", top: "48px", right: 0,
              backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 300, minWidth: "180px", overflow: "hidden",
            }}>
              {[
                { label: "Login",       path: "/login" },
                { label: "Sign Up",     path: "/signup" },
                { label: "About",       path: "/about" },
                { label: "Help Centre", path: "/help" },
                { label: "Contact Us",  path: "/contact" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setMenuOpen(false); navigate(item.path); }}
                  style={{ display: "block", width: "100%", padding: "0.75rem 1.25rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text-primary, #1e293b)" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--color-bg-surface, #f8fafc)"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {item.label}
                </button>
              ))}
              <hr style={{ border: "none", borderTop: "1px solid var(--color-border-light, #e2e8f0)", margin: "0.25rem 0" }} />
              <button
                onClick={() => { setMenuOpen(false); toggleDarkMode(); }}
                style={{ display: "block", width: "100%", padding: "0.75rem 1.25rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text-primary, #1e293b)" }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--color-bg-surface, #f8fafc)"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                {darkMode ? "☀️  Light Mode" : "🌙  Dark Mode"}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #7b0d2e 100%)",
        color: "white", textAlign: "center", padding: "5rem 1.5rem 4.5rem",
        position: "relative", overflow: "hidden",
      }}>
        {/* #2 — subtle noise grain overlay */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", opacity: 0.06, pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "999px", padding: "0.3rem 0.9rem", marginBottom: "1.5rem", fontSize: "0.78rem", fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.03em" }}>
          🇮🇪 Built for Irish Students
        </div>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 1rem", letterSpacing: "-0.03em" }}>
          Find Part-Time Work That<br />
          <span style={{ background: "linear-gradient(90deg,var(--color-brand),var(--color-brand-dark),#E57399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Fits Your Timetable
          </span>
        </h1>
        <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.65)", margin: "0 auto 2.5rem", maxWidth: "480px", lineHeight: 1.75 }}>
          Apply to verified employers in one click. No cover letter. No faff.
          Start earning around your college schedule.
        </p>

        {/* Primary CTAs — student + employer */}
        <div style={{ display: "flex", gap: "0.75rem", maxWidth: "420px", margin: "0 auto 1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => navigate("/signup")}
            style={{ flex: 1, minWidth: "170px", padding: "0.95rem 1.5rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(244,63,94,0.45)", whiteSpace: "nowrap" }}
          >
            Find Shifts — It's Free →
          </button>
          <button
            onClick={() => navigate("/signup?role=company")}
            style={{ flex: 1, minWidth: "170px", padding: "0.95rem 1.5rem", borderRadius: "2rem", border: "1.5px solid rgba(255,255,255,0.35)", background: "transparent", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            I'm Hiring Students →
          </button>
        </div>

        {/* Already have an account */}
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.83rem", color: "rgba(255,255,255,0.5)" }}>
          Already have an account?{" "}
          <button
            onClick={() => navigate("/login")}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", padding: 0 }}
          >
            Sign in
          </button>
        </p>

        {/* Trust line */}
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.02em" }}>
          {stats.students ? `${stats.students} verified students` : "Hundreds of students"} · {stats.companies ? `${stats.companies} verified employers` : "Verified employers"} · 100% free to join
        </p>
        </div>{/* /noise inner */}
      </section>

      {/* ── Main sections ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>

        {/* How It Works */}
        <SectionHeading>How It Works</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "3.5rem" }}>
          {HOW_IT_WORKS.map(({ icon, step, desc }) => (
            <div key={step} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.6rem" }}>{icon}</div>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-text-primary, #1e293b)", margin: "0 0 0.4rem" }}>{step}</p>
              <p style={{ fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Numbers — #23 count-up animation */}
        <SectionHeading>StudentShifts by the Numbers</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "3.5rem" }}>
          {[
            { count: studentsCount,  ref: studentsRef,  raw: stats.students,  label: "Verified Students" },
            { count: jobsCount,      ref: jobsRef,      raw: stats.jobs,      label: "Shifts Posted" },
            { count: companiesCount, ref: companiesRef, raw: stats.companies, label: "Verified Employers" },
          ].map(({ count, ref, raw, label }) => (
            <div key={label} ref={ref} style={{ backgroundColor: "#fce7f3", borderRadius: "1rem", padding: "1.75rem 1rem", textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: "2rem", color: "var(--color-brand)", margin: 0 }}>
                {raw == null ? "..." : (count ?? raw)}
              </p>
              <p style={{ fontSize: "0.82rem", color: "#475569", margin: "0.3rem 0 0", fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Employer pitch */}
        <SectionHeading>Hiring Students?</SectionHeading>
        <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "1.25rem", padding: "2rem 2rem", display: "flex", gap: "2.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "3.5rem" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <h3 style={{ fontWeight: 800, fontSize: "1.3rem", color: "var(--color-text-primary, #1e293b)", margin: "0 0 0.6rem" }}>Post shifts, find reliable students</h3>
            <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem", lineHeight: 1.75, margin: "0 0 1.25rem" }}>
              StudentShifts gives you access to a pool of verified, motivated students looking for exactly the flexible work you're offering.
              Post a shift in minutes — no recruitment agency fees, ever.
            </p>
            <button
              onClick={() => navigate("/signup?role=company")}
              style={{ padding: "0.75rem 1.75rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(162,29,84,0.3)" }}
            >
              Post Your First Job Free →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flexShrink: 0 }}>
            {["✅ Verified student profiles", "📋 One-click application review", "💬 Direct message candidates", "🆓 Free to post — always"].map(point => (
              <div key={point} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text-body, #374151)" }}>{point}</div>
            ))}
          </div>
        </div>

        {/* Bottom CTA band */}
        <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #7b0d2e 100%)", borderRadius: "1.25rem", padding: windowWidth < 480 ? "2rem 1.25rem" : "3rem 2rem", textAlign: "center", marginBottom: "0.5rem" }}>
          <h2 style={{ fontWeight: 800, fontSize: windowWidth < 480 ? "1.3rem" : "1.6rem", color: "white", margin: "0 0 0.6rem", letterSpacing: "-0.02em" }}>Ready to start earning?</h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", margin: "0 0 1.5rem", lineHeight: 1.6 }}>
            Sign up free in under 2 minutes. No experience needed.
          </p>
          <button
            onClick={() => navigate("/signup")}
            style={{ padding: windowWidth < 480 ? "0.75rem 1.5rem" : "0.9rem 2.5rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "white", fontWeight: 700, fontSize: windowWidth < 480 ? "0.88rem" : "1rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(244,63,94,0.45)", whiteSpace: "nowrap" }}
          >
            Create My Free Account →
          </button>
          <p style={{ margin: "0.85rem 0 0", fontSize: "0.83rem", color: "rgba(255,255,255,0.5)" }}>
            Already have an account?{" "}
            <button onClick={() => navigate("/login")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline", padding: 0 }}>
              Sign in
            </button>
          </p>
        </div>

      </div>

      {/* ── Jobs by Location — dark band ── */}
      <section style={{ backgroundColor: "#1e293b", padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <SectionHeading light>Jobs by Location</SectionHeading>
          {locations.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem 0" }}>No active jobs at the moment — check back soon.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "0.85rem" }}>
              {locations.map(([city, count]) => (
                <button
                  key={city}
                  onClick={() => navigate("/login")}
                  style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: "0.9rem", padding: "1.1rem 1rem", textAlign: "center", cursor: "pointer", color: "white", fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(162,29,84,0.22)"; e.currentTarget.style.borderColor = "rgba(162,29,84,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>📍</div>
                  <p style={{ fontWeight: 700, fontSize: "0.9rem", margin: "0 0 0.2rem" }}>{city}</p>
                  <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                    {count} job{count !== 1 ? "s" : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <AppFooter currentUser={currentUser} />
    </div>
  );
}

function SectionHeading({ children, light }) {
  if (light) {
    return (
      <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: "white", margin: "0 0 1.25rem", letterSpacing: "-0.02em" }}>
        {children}
      </h2>
    );
  }
  /* #3 — brand gradient text on dark-on-light headings */
  return (
    <h2 style={{ fontWeight: 800, fontSize: "1.5rem", margin: "0 0 1.25rem", letterSpacing: "-0.02em", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", display: "inline-block" }}>
      {children}
    </h2>
  );
}


function LogoIcon() {
  return (
    <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "var(--color-bg-elevated, white)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <polygon points="12,3 22,8 12,13 2,8" fill="var(--color-brand)" />
        <path d="M6 10.5v4.5c0 1.93 2.69 3.5 6 3.5s6-1.57 6-3.5v-4.5" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        <line x1="20" y1="8" x2="20" y2="14" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="15.5" r="1.5" fill="var(--color-brand)" />
      </svg>
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

