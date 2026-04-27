import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const MOCK_COMPANIES = [
  { name: "Supermac's",    tagline: "Ireland's favourite fast food",      bg: "#fef3c7", accent: "#d97706", initials: "SM" },
  { name: "SuperValu",     tagline: "Fresh food & great everyday value",  bg: "#dcfce7", accent: "#16a34a", initials: "SV" },
  { name: "Dunnes Stores", tagline: "Better value beats them all",        bg: "#fee2e2", accent: "#dc2626", initials: "DS" },
  { name: "Centra",        tagline: "Live every day",                     bg: "#ffedd5", accent: "#ea580c", initials: "CE" },
  { name: "McDonald's",    tagline: "I'm lovin' it",                      bg: "#fef9c3", accent: "#ca8a04", initials: "MC" },
  { name: "Penneys",       tagline: "Amazing quality, amazing prices",    bg: "#ede9fe", accent: "#7c3aed", initials: "PE" },
];

const HOW_IT_WORKS = [
  { icon: "🎓", step: "1. Sign Up",        desc: "Create a free student account in under 2 minutes. Verify your student ID and you're in." },
  { icon: "🔍", step: "2. Browse Jobs",    desc: "Filter by day, time, location and pay. Find shifts that actually fit your timetable." },
  { icon: "📋", step: "3. Apply Instantly",desc: "One click to apply. Your CV is sent straight to the employer — no faff, no forms." },
  { icon: "🎉", step: "4. Get Hired",      desc: "Hear back fast. Start earning while you study. It's that simple." },
];

const STATS = [
  { n: "500+", label: "Students Registered" },
  { n: "200+", label: "Shifts Posted" },
  { n: "40+",  label: "Local Employers" },
  { n: "4.8★", label: "Average Rating" },
];

export default function LandingPage({ currentUser }) {
  const navigate  = useNavigate();
  const [search,    setSearch]    = useState("");
  const [locations, setLocations] = useState([]);
  const [menuOpen,  setMenuOpen]  = useState(false);
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
    <div style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: "#f8fafc", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 2.5rem",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        position: "sticky", top: 0, zIndex: 200,
      }}>
        {/* Logo */}
        <div onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <LogoIcon />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, background: "linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>Student</div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              <span style={{ color: "white" }}>Shifts</span><span style={{ color: "#6366f1" }}>.ie</span>
            </div>
          </div>
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
                { label: "Help Centre", path: "/about" },
                { label: "Contact Us",  path: "/about" },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setMenuOpen(false); navigate(item.path); }}
                  style={{ display: "block", width: "100%", padding: "0.75rem 1.25rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: "#1e293b" }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f1f5f9"}
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
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)",
        color: "white", textAlign: "center", padding: "5rem 1.5rem 4.5rem",
      }}>
        <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.6rem)", fontWeight: 900, lineHeight: 1.12, margin: "0 0 1rem", letterSpacing: "-0.03em" }}>
          Find Flexible Shifts That<br />
          <span style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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

        {/* Companies Hiring */}
        <SectionHeading>Companies Hiring Now</SectionHeading>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: "1rem", marginBottom: "3.5rem" }}>
          {MOCK_COMPANIES.map(c => (
            <div
              key={c.name}
              style={{ backgroundColor: c.bg, border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem 1.25rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)"; }}
            >
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: `linear-gradient(135deg,${c.accent},${c.accent}bb)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.8rem", color: "white", fontWeight: 800, fontSize: "0.82rem" }}>
                {c.initials}
              </div>
              <p style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b", margin: "0 0 0.25rem" }}>{c.name}</p>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 0.75rem", lineHeight: 1.5 }}>{c.tagline}</p>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: c.accent, backgroundColor: `${c.accent}22`, padding: "0.2rem 0.65rem", borderRadius: "999px" }}>Hiring Now</span>
            </div>
          ))}
        </div>

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
          {STATS.map(({ n, label }) => (
            <div key={label} style={{ backgroundColor: "#eef2ff", borderRadius: "1rem", padding: "1.75rem 1rem", textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: "2rem", color: "#6366f1", margin: 0 }}>{n}</p>
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
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "rgba(99,102,241,0.22)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)"; }}
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
      <LandingFooter navigate={navigate} currentUser={currentUser} />
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

function LandingFooter({ navigate, currentUser }) {
  const handleAdvertise = () => {
    if (currentUser?.role === "company") navigate("/company");
    else navigate("/login");
  };

  return (
    <footer style={{ backgroundColor: "#0f172a", color: "rgba(255,255,255,0.55)", fontFamily: "'Poppins', sans-serif", padding: "3.5rem 1.5rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "2.5rem", marginBottom: "2.5rem" }}>

          <div>
            <p style={fHead}>Navigate</p>
            <FLink onClick={() => navigate("/about")}>About Us</FLink>
            <FLink onClick={() => navigate("/login")}>Jobs</FLink>
            <FLink onClick={() => navigate("/login")}>Login</FLink>
            <FLink onClick={() => navigate("/signup")}>Sign Up</FLink>
          </div>

          <div>
            <p style={fHead}>Support</p>
            <FLink onClick={() => navigate("/about")}>Help Centre</FLink>
            <FLink onClick={handleAdvertise}>Advertise a Job</FLink>
            <FLink onClick={() => navigate("/about")}>FAQs</FLink>
            <FLink onClick={() => navigate("/about")}>Contact Us</FLink>
          </div>

          <div>
            <p style={fHead}>Legal</p>
            <FLink onClick={() => navigate("/privacy")}>Privacy Policy</FLink>
            <FLink onClick={() => navigate("/terms")}>Terms & Conditions</FLink>
            <FLink onClick={() => {}}>Cookies</FLink>
            <FLink onClick={() => {}}>Ad Choices</FLink>
          </div>

          <div>
            <p style={fHead}>Let's Connect</p>
            <FLink onClick={() => {}}>Instagram</FLink>
            <FLink onClick={() => {}}>TikTok</FLink>
            <FLink onClick={() => {}}>LinkedIn</FLink>
            <FLink onClick={() => {}}>Twitter / X</FLink>
            <button style={{ marginTop: "0.9rem", padding: "0.5rem 1.2rem", borderRadius: "2rem", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "0.78rem" }}>
              Download App
            </button>
          </div>

        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem" }}>
          <span>© {new Date().getFullYear()} StudentShifts · Ireland</span>
          <span>Made with ❤️ for students across Ireland</span>
        </div>
      </div>
    </footer>
  );
}

function FLink({ onClick, children }) {
  return (
    <p
      onClick={onClick}
      style={{ margin: "0.45rem 0", fontSize: "0.83rem", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}
      onMouseEnter={e => e.currentTarget.style.color = "white"}
      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.5)"}
    >
      {children}
    </p>
  );
}

function LogoIcon() {
  return (
    <svg width="52" height="58" viewBox="0 0 46 52" fill="none">
      <defs>
        <linearGradient id="landingLogoGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <clipPath id="landingLogoClip">
          <path d="M23 48 C23 48 3 36 3 22 C3 14 9 8 16.5 8 C19.8 8 22.5 9.6 23 12 C23.5 9.6 26.2 8 29.5 8 C37 8 43 14 43 22 C43 36 23 48 23 48Z" />
        </clipPath>
      </defs>
      <path d="M23 48 C23 48 3 36 3 22 C3 14 9 8 16.5 8 C19.8 8 22.5 9.6 23 12 C23.5 9.6 26.2 8 29.5 8 C37 8 43 14 43 22 C43 36 23 48 23 48Z" fill="url(#landingLogoGrad)" />
      <g clipPath="url(#landingLogoClip)">
        <line x1="3" y1="20" x2="43" y2="20" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <line x1="3" y1="28" x2="43" y2="28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <line x1="3" y1="36" x2="43" y2="36" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      </g>
      <rect x="14" y="3" width="4" height="9" rx="2" fill="white" opacity="0.8" />
      <rect x="28" y="3" width="4" height="9" rx="2" fill="white" opacity="0.8" />
    </svg>
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

const fHead = {
  fontWeight: 700, fontSize: "0.78rem", color: "white",
  textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 0.75rem",
};
