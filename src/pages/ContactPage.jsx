import { Helmet } from "react-helmet-async";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { useApp } from "../context/AppContext";

export default function ContactPage() {
  const { setPage } = useApp();

  return (
    <PageWrapper narrow>
      <Helmet>
        <title>Contact Us — StudentShifts</title>
        <meta name="description" content="Get in touch with the StudentShifts team. We're a small team based in Ireland and aim to reply within one working day." />
        <link rel="canonical" href="https://studentshifts.ie/contact" />
        <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://studentshifts.ie/" }, { "@type": "ListItem", position: 2, name: "Contact", item: "https://studentshifts.ie/contact" }] })}</script>
      </Helmet>
      <BackButton />

      <div style={{ maxWidth: "560px", margin: "0 auto" }}>

        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontWeight: 800, fontSize: "2rem", color: "#1e293b", margin: "0 0 0.4rem" }}>Contact Us</h1>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>We're a small team — we'll get back to you as soon as we can.</p>
        </div>

        {/* Email */}
        <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p style={labelStyle}>General enquiries</p>
          <a href="mailto:hello@studentshifts.ie" style={linkStyle}>hello@studentshifts.ie</a>
          <p style={hintStyle}>Jobs, partnerships, feedback, or anything else.</p>
        </div>

        <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem", marginBottom: "1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p style={labelStyle}>Privacy &amp; data requests</p>
          <a href="mailto:privacy@studentshifts.ie" style={linkStyle}>privacy@studentshifts.ie</a>
          <p style={hintStyle}>Data access, deletion requests, or GDPR queries.</p>
        </div>

        {/* Response time */}
        <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.85rem", padding: "0.9rem 1.1rem", marginBottom: "1.75rem" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#0369a1", lineHeight: 1.6 }}>
            <strong>Response time:</strong> we aim to reply within one working day (Mon–Fri). For urgent issues, mention it in your subject line.
          </p>
        </div>

        {/* Help shortcut */}
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.75rem" }}>
            Looking for answers to common questions?
          </p>
          <button
            onClick={() => setPage("help")}
            style={{ padding: "0.65rem 1.75rem", borderRadius: "2rem", border: "1.5px solid var(--color-brand)", backgroundColor: "transparent", color: "var(--color-brand)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
          >
            Visit Help Centre →
          </button>
        </div>

      </div>
    </PageWrapper>
  );
}

const labelStyle = { margin: "0 0 0.2rem", fontWeight: 700, fontSize: "0.78rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" };
const linkStyle  = { display: "block", color: "var(--color-brand)", fontWeight: 700, fontSize: "1rem", textDecoration: "none", marginBottom: "0.3rem" };
const hintStyle  = { margin: 0, fontSize: "0.8rem", color: "#64748b" };
