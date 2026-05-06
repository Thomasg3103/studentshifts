import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";

export default function AboutPage({ setPage }) {
  return (
    <><BackButton />
    <PageWrapper>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
        <div style={{ width: "72px", height: "72px", borderRadius: "1.25rem", background: "linear-gradient(135deg, #f43f5e, #e11d48)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", boxShadow: "0 8px 24px rgba(244,63,94,0.35)" }}>
          <img src="/favicon.svg" alt="StudentShifts" style={{ width: "40px", height: "45px" }} />
        </div>
        <h1 style={{ fontWeight: "800", fontSize: "2rem", color: "#1e293b", marginBottom: "0.5rem" }}>About StudentShifts</h1>
        <p style={{ color: "#64748b", fontSize: "1rem", maxWidth: "520px", margin: "0 auto", lineHeight: "1.7" }}>
          We connect students in Galway with flexible part-time work that fits around their studies, lifestyle, and ambitions.
        </p>
      </div>

      {/* Mission */}
      <Section title="Our Mission">
        <p style={bodyText}>
          StudentShifts was built with one goal in mind — making it dead simple for students aged 17–26 to find flexible shifts that actually work around college hours. No CVs lost in email chains, no ghost employers. Just real jobs, real shifts, real fast.
        </p>
      </Section>

      {/* How it works */}
      <Section title="How It Works">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
          {[
            { icon: "🎓", step: "1. Sign Up", desc: "Create a free student account in under 2 minutes. Verify your student ID and you're in." },
            { icon: "🔍", step: "2. Browse Jobs", desc: "Filter by day, time, location and pay. Find shifts that actually fit your timetable." },
            { icon: "📋", step: "3. Apply Instantly", desc: "One click to apply. Your CV is sent straight to the employer — no faff, no forms." },
            { icon: "🎉", step: "4. Get Hired", desc: "Hear back fast. Start earning while you study. It's that simple." },
          ].map(({ icon, step, desc }) => (
            <div key={step} style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.6rem" }}>{icon}</div>
              <p style={{ fontWeight: "700", fontSize: "0.9rem", color: "#1e293b", marginBottom: "0.4rem" }}>{step}</p>
              <p style={{ fontSize: "0.82rem", color: "#64748b", lineHeight: "1.6", margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Stats */}
      <Section title="StudentShifts by the Numbers">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
          {[
            { n: "500+", label: "Students Registered" },
            { n: "200+", label: "Shifts Posted" },
            { n: "40+",  label: "Local Employers" },
            { n: "4.8★", label: "Average Rating" },
          ].map(({ n, label }) => (
            <div key={label} style={{ backgroundColor: "#fce7f3", borderRadius: "1rem", padding: "1.25rem", textAlign: "center" }}>
              <p style={{ fontWeight: "800", fontSize: "1.6rem", color: "#A21D54", margin: 0 }}>{n}</p>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "0.3rem 0 0", fontWeight: "600" }}>{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Team */}
      <Section title="Meet the Team">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
          {[
            { name: "Tom Stephens",      role: "Co-Founder & CEO", photo: "/Team/tom.jpg",              pos: "50% 25%" },
            { name: "Thomas Smith",      role: "Co-Founder & CFO", photo: "/Team/thomas-smith.jpg",    pos: "top" },
            { name: "Thomas Gallagher",  role: "Co-Founder & CTO", photo: "/Team/thomas-gallagher.jpg", pos: "50% 60%" },
            { name: "Liam Hyland",       role: "Co-Founder & CMO", photo: "/Team/liam.jpg",            pos: "top" },
            { name: "John McCarthy",     role: "Co-Founder & CMO", photo: "/Team/john.jpg",             pos: "top" },
          ].map(({ name, role, photo, pos }) => (
            <div key={name} style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem", textAlign: "center" }}>
              <img src={photo} alt={name} style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", objectPosition: pos, marginBottom: "0.65rem", border: "3px solid #e2e8f0" }} />
              <p style={{ fontWeight: "700", fontSize: "0.9rem", color: "#1e293b", margin: 0 }}>{name}</p>
              <p style={{ fontSize: "0.78rem", color: "#A21D54", fontWeight: "600", margin: "0.2rem 0 0" }}>{role}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <div style={{ textAlign: "center", marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => setPage("studentDashboard")}
          style={{ padding: "0.85rem 2.5rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #f43f5e, #e11d48)", color: "white", fontWeight: "700", fontSize: "1rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(244,63,94,0.35)" }}
        >
          ← Back to Home
        </button>
        <button
          onClick={() => setPage("signup")}
          style={{ padding: "0.85rem 2.5rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #A21D54, #C2185B)", color: "white", fontWeight: "700", fontSize: "1rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(162,29,84,0.35)" }}
        >
          Get Started Free →
        </button>
      </div>

    </PageWrapper></>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem 1.75rem", marginBottom: "1.25rem" }}>
      <h2 style={{ fontWeight: "800", fontSize: "1.1rem", color: "#1e293b", marginBottom: "0.85rem" }}>{title}</h2>
      {children}
    </div>
  );
}

const bodyText = { fontSize: "0.92rem", color: "#374151", lineHeight: "1.75", margin: 0 };
