import { Helmet } from "react-helmet-async";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import { useApp } from "../context/AppContext";

const FAQS = [
  {
    q: "How do I get verified as a student?",
    a: "After signing up, you'll be asked to upload your Student ID and Government ID. Our admin team reviews submissions within 24 hours (Mon–Fri) and sends you an email once you're cleared to apply.",
  },
  {
    q: "Is StudentShifts free to use?",
    a: "Yes — completely free for students. Companies pay to post jobs.",
  },
  {
    q: "Can I apply to multiple jobs at the same time?",
    a: "Yes. You can apply to as many jobs as you like. We recommend tailoring your cover letter to each role.",
  },
  {
    q: "What happens after I apply?",
    a: "The company reviews your application and moves it through their hiring pipeline (Applied → Shortlisted → Interview → Trial → Decision). You'll see live status updates in the Applied section.",
  },
  {
    q: "I uploaded the wrong documents — what do I do?",
    a: "Go to Account and re-upload the correct files. Your verification will be reviewed again by our team.",
  },
  {
    q: "How does messaging work?",
    a: "Companies can message you after accepting your application, or (if you've opted in) before you apply. You can reply from the Messages tab.",
  },
  {
    q: "My verification was rejected — why?",
    a: "Common reasons: blurry photo, name mismatch between IDs, expired document, or unclear student ID. Re-upload clearer images from the Account page.",
  },
];

export default function HelpPage() {
  const { setPage } = useApp();
  return (
    <>
      <Helmet>
        <title>Help Centre — StudentShifts</title>
        <meta name="description" content="Get answers to common questions about StudentShifts — verification, applying for jobs, messaging, and more." />
        <link rel="canonical" href="https://studentshifts.ie/help" />
        <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://studentshifts.ie/" }, { "@type": "ListItem", position: 2, name: "Help Centre", item: "https://studentshifts.ie/help" }] })}</script>
      </Helmet>
      <BackButton />
      <PageWrapper narrow>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>

          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <h1 style={{ fontWeight: 800, fontSize: "2rem", color: "#1e293b", marginBottom: "0.5rem" }}>Help Centre</h1>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6 }}>
              Find answers to common questions, or get in touch with our team.
            </p>
          </div>

          {/* FAQs */}
          <h2 style={{ fontWeight: 700, fontSize: "1.15rem", color: "#1e293b", marginBottom: "1rem" }}>Frequently Asked Questions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2.5rem" }}>
            {FAQS.map(({ q, a }) => (
              <details key={q} style={{ backgroundColor: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "0.85rem 1rem" }}>
                <summary style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {q} <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>▾</span>
                </summary>
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.88rem", color: "#64748b", lineHeight: 1.6 }}>{a}</p>
              </details>
            ))}
          </div>

          {/* Contact */}
          <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem", textAlign: "center" }}>
            <h2 style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1e293b", marginBottom: "0.5rem" }}>Contact Us</h2>
            <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "1rem" }}>
              Can't find what you're looking for? We're happy to help.
            </p>
            <a
              href="mailto:hello@studentshifts.ie"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1.5rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}
            >
              Email hello@studentshifts.ie
            </a>
            <p style={{ margin: "1rem 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>We aim to respond within one business day.</p>
          </div>

        </div>
      </PageWrapper>
    </>
  );
}
