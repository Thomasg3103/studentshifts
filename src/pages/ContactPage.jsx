import { Helmet } from "react-helmet-async";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";

export default function ContactPage() {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Contact Us — StudentShifts</title>
        <meta name="description" content="Get in touch with the StudentShifts team. We're a small team based in Ireland and aim to reply within one working day." />
        <link rel="canonical" href="https://studentshifts.ie/contact" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content="Contact Us — StudentShifts" />
        <meta property="og:description" content="Get in touch with the StudentShifts team. We're a small team based in Ireland and aim to reply within one working day." />
        <meta property="og:url" content="https://studentshifts.ie/contact" />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact Us — StudentShifts" />
        <meta name="twitter:description" content="Get in touch with the StudentShifts team. We're a small team based in Ireland and aim to reply within one working day." />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://studentshifts.ie/" }, { "@type": "ListItem", position: 2, name: "Contact", item: "https://studentshifts.ie/contact" }] })}</script>
      </Helmet>
      <BackButton />

      <div style={{ width: "100%", backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", padding: "2rem 0 4rem" }}>
        {/* Header band */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", color: "white", padding: "3rem 2rem 2.5rem", marginBottom: "2.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>Get in Touch</p>
            <h1 style={{ margin: "0 0 0.5rem", fontWeight: "900", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.02em" }}>Contact Us</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.9rem" }}>
              We're a small team based in Ireland — we'll get back to you as soon as we can.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

          {/* Contact cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <ContactCard
              label="General Enquiries"
              email="hello@studentshifts.ie"
              description="Jobs, partnerships, feedback, press, or anything else."
            />
            <ContactCard
              label="Student Support"
              email="support@studentshifts.ie"
              description="Verification issues, application questions, or account help."
            />
            <ContactCard
              label="Privacy & Data Requests"
              email="privacy@studentshifts.ie"
              description="Data access requests, deletion requests, or GDPR queries."
            />
            <ContactCard
              label="Legal"
              email="legal@studentshifts.ie"
              description="Legal notices, IP claims, or compliance matters."
            />
          </div>

          {/* Response time banner */}
          <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.85rem", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#0369a1", lineHeight: 1.6 }}>
              <strong>Response time:</strong> we aim to reply within one working day (Mon–Fri). For urgent issues, please mention it in your subject line.
            </p>
          </div>

          {/* Help Centre shortcut */}
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "1.75rem 2rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h2 style={{ margin: "0 0 0.4rem", fontWeight: "800", fontSize: "1.1rem", color: "var(--color-text-primary, #1e293b)" }}>Looking for quick answers?</h2>
            <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "1.1rem" }}>
              Our Help Centre covers verification, applications, messaging, and more.
            </p>
            <button
              onClick={() => navigate("/help")}
              style={{ padding: "0.65rem 1.75rem", borderRadius: "2rem", border: "1.5px solid var(--color-brand)", backgroundColor: "transparent", color: "var(--color-brand)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
            >
              Visit Help Centre →
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

function ContactCard({ label, email, description }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <p style={{ margin: "0 0 0.25rem", fontWeight: 700, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <a href={`mailto:${email}`} style={{ display: "block", color: "var(--color-brand)", fontWeight: 700, fontSize: "0.95rem", textDecoration: "none", marginBottom: "0.4rem" }}>{email}</a>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.55 }}>{description}</p>
    </div>
  );
}
