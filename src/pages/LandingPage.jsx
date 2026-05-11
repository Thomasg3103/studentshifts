import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabase";
import AppFooter from "../components/AppFooter";
import { useApp } from "../context/AppContext";


const HOW_IT_WORKS = [
  { icon: "🎓", step: "1. Sign Up",        desc: "Create a free student account in under 2 minutes. Verify your student ID and you're in." },
  { icon: "🔍", step: "2. Browse Jobs",    desc: "Filter by day, time, location and pay. Find shifts that actually fit your timetable." },
  { icon: "📋", step: "3. Apply Instantly",desc: "One click to apply. Your CV is sent straight to the employer — no faff, no forms." },
  { icon: "🎉", step: "4. Get Hired",      desc: "Hear back fast. Start earning while you study. It's that simple." },
];


export default function LandingPage() {
  const { currentUser } = useApp();
  const navigate  = useNavigate();
  const [search,    setSearch]    = useState("");
  const [locations, setLocations] = useState([]);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [stats,     setStats]     = useState({ students: null, jobs: null, companies: null });
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

  const handleSearch = () => navigate("/login");

  const handleGoHome = () => {
    if (currentUser?.role === "company") navigate("/company");
    else if (currentUser?.role === "admin") navigate("/admin");
    else navigate("/login");
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <Helmet>
        <title>StudentShifts — Find Part-Time Jobs in Ireland</title>
        <meta name="description" content="StudentShifts connects Irish students with flexible part-time and short-term jobs. Browse verified employers, apply in minutes." />
        <link rel="canonical" href="https://studentshifts.ie/" />
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
        <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <LogoIcon />
          <span style={{ fontSize: "1.7rem", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
            StudentShifts<span style={{ opacity: 0.7 }}>.ie</span>
          </span>
        </div>

        {/* Account icon + Hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", position: "relative" }} ref={menuRef}>
          <button
            onClick={() => navigate("/login")}
            title="Login / Sign Up"
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "50%", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}
          >
            <PersonIcon />
          </button>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.5rem", width: "38px", height: "38px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer" }}
          >
            <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
            <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
            <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
          </button>

          {menuOpen && (
            <div style={{
              position: "absolute", top: "48px", right: 0,
              backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem",
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
                  style={{ display: "block", width: "100%", padding: "0.75rem 1.25rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #7b0d2e 100%)",
        color: "white", textAlign: "center", padding: "5rem 1.5rem 4.5rem",
      }}>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 1rem", letterSpacing: "-0.03em" }}>
          Find Flexible Shifts That<br />
          <span style={{ background: "linear-gradient(90deg,var(--color-brand),var(--color-brand-dark),#E57399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Fit Your Student Life
          </span>
        </h1>
        <p style={{ fontSize: "1.05rem", color: "rgba(255,255,255,0.65)", margin: "0 auto 2.5rem", maxWidth: "500px", lineHeight: 1.75 }}>
          Connecting students across Ireland with part-time work that fits around college — no experience needed.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", maxWidth: "560px", margin: "0 auto 1.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search jobs, shifts, locations…"
            style={{
              flex: 1, minWidth: "220px", padding: "0.9rem 1.4rem",
              borderRadius: "2rem", border: "none", fontSize: "0.95rem",
              fontFamily: "inherit", outline: "none",
              boxShadow: "0 2px 16px rgba(0,0,0,0.25)",
            }}
          />
          <button
            onClick={handleSearch}
            style={{ padding: "0.9rem 2rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg,#f43f5e,#e11d48)", color: "white", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(244,63,94,0.45)", whiteSpace: "nowrap" }}
          >
            Search Jobs
          </button>
        </div>

        <button
          onClick={handleGoHome}
          style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "0.87rem", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}
        >
          Already have an account? Go to Homepage →
        </button>
      </section>

      {/* ── Main sections ── */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>

        {/* How It Works */}
        <SectionHeading>How It Works</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "3.5rem" }}>
          {HOW_IT_WORKS.map(({ icon, step, desc }) => (
            <div key={step} style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.6rem" }}>{icon}</div>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", margin: "0 0 0.4rem" }}>{step}</p>
              <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Numbers */}
        <SectionHeading>StudentShifts by the Numbers</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "3.5rem" }}>
          {[
            { n: stats.students, label: "Verified Students" },
            { n: stats.jobs,     label: "Shifts Posted" },
            { n: stats.companies,label: "Verified Employers" },
          ].map(({ n, label }) => (
            <div key={label} style={{ backgroundColor: "#fce7f3", borderRadius: "1rem", padding: "1.75rem 1rem", textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: "2rem", color: "var(--color-brand)", margin: 0 }}>{n ?? "..."}</p>
              <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0.3rem 0 0", fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Download App */}
        <SectionHeading>Get the App</SectionHeading>
        <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1.25rem", padding: "2.5rem 2rem", display: "flex", gap: "3rem", alignItems: "center", flexWrap: "wrap", marginBottom: "3.5rem" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <h3 style={{ fontWeight: 800, fontSize: "1.4rem", color: "#1e293b", margin: "0 0 0.6rem" }}>StudentShifts on Mobile</h3>
            <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.75, margin: "0 0 1.25rem" }}>
              Browse and apply for jobs on the go. Get real-time notifications when employers respond. Coming soon to iOS and Android.
            </p>
            <span style={{ backgroundColor: "#fef3c7", color: "#d97706", fontWeight: 700, fontSize: "0.78rem", padding: "0.3rem 0.9rem", borderRadius: "999px" }}>
              Coming Soon
            </span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "120px", height: "120px", border: "3px dashed #cbd5e1", borderRadius: "1rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", color: "#94a3b8", fontSize: "0.72rem", fontWeight: 600, lineHeight: 1.6, margin: "0 auto 0.6rem" }}>
              📱<br />QR Code<br />Coming Soon
            </div>
            <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: 0 }}>Scan to download</p>
          </div>
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
                  <p style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.45)", margin: 0 }}>
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
  return (
    <h2 style={{ fontWeight: 800, fontSize: "1.5rem", color: light ? "white" : "#1e293b", margin: "0 0 1.25rem", letterSpacing: "-0.02em" }}>
      {children}
    </h2>
  );
}


function LogoIcon() {
  return (
    <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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

