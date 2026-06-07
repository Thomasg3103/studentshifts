import { Helmet } from "react-helmet-async";
import BackButton from "../components/BackButton";

const SUPPORT_EMAIL = "support@studentshifts.ie";

const FAQ_SECTIONS = [
  {
    category: "Getting Started",
    faqs: [
      { q: "How do I sign up?", a: "Click Sign Up on the homepage, choose whether you're a Student or a Company, fill in your details, and verify your email address. Students must then complete the ID verification step before applying for jobs." },
      { q: "Is StudentShifts free to use?", a: "Yes — completely free for students. There are no fees, subscriptions, or hidden charges for student accounts at any time." },
      { q: "What types of jobs are on StudentShifts?", a: "StudentShifts focuses on part-time, short-term, and shift-based roles suited to students — hospitality, retail, events, administration, warehousing, and more. All jobs are based in Ireland." },
      { q: "Can I use StudentShifts if I'm not in college yet?", a: "You must be currently enrolled in a recognised educational institution to use the student side of the platform. If you're between courses, check back when you're enrolled." },
    ],
  },
  {
    category: "Student Verification",
    faqs: [
      { q: "How do I get verified as a student?", a: "After signing up, you'll be asked to upload your Student ID and a Government-issued photo ID (passport, driving licence, or age card). Our admin team reviews submissions within 24 hours on weekdays and sends you an email when you're cleared to apply." },
      { q: "What documents do I need to upload?", a: "You need two documents: (1) a valid Student ID card issued by your college or university, and (2) a government-issued photo ID — a passport, Irish driving licence, or Public Services Card with photo." },
      { q: "My verification was rejected — why?", a: "Common reasons include a blurry or low-resolution photo, a name mismatch between your two IDs, an expired document, or a student card that doesn't clearly show your institution. Re-upload clearer images from the Account page and our team will review again." },
      { q: "I uploaded the wrong documents — what do I do?", a: "Go to Account → Verification Documents and re-upload the correct files. Your verification will be reviewed again from scratch. There's no penalty for re-uploading." },
      { q: "How long does verification take?", a: "We aim to review all submissions within 24 hours on weekdays (Monday to Friday). You'll receive an email as soon as a decision is made." },
    ],
  },
  {
    category: "Applying for Jobs",
    faqs: [
      { q: "Can I apply to multiple jobs at the same time?", a: "Yes — there's no limit on the number of applications you can have open at once. We recommend tailoring your cover letter to each role to improve your chances." },
      { q: "What happens after I apply?", a: "The company reviews your application and moves it through their hiring pipeline: Applied → Shortlisted → Interview → Trial → Decision. You can see your live status in the Applied section at any time." },
      { q: "Can I withdraw an application?", a: "Yes. Open your Applied tab, find the application, and select Withdraw. Note that repeated last-minute withdrawals may affect your reliability score." },
      { q: "Can companies see my profile before I apply?", a: "If you've uploaded a CV or LinkedIn URL to your profile, verified companies can find you through the Browse Students feature. You can remove your CV or LinkedIn URL from your Account page at any time to opt out of this." },
      { q: "What is the hiring pipeline?", a: "The pipeline tracks your application through five stages: Applied (submitted), Shortlisted (company is interested), Interview (interview scheduled), Trial (trial shift arranged), and Decision (company has made a hire/no-hire decision)." },
    ],
  },
  {
    category: "Messaging",
    faqs: [
      { q: "How does messaging work?", a: "Once a company moves your application to the Shortlisted stage or beyond, a message thread opens between you and that company. Companies can also message verified students directly through the Browse Students feature, even without a prior application." },
      { q: "Can I message a company first?", a: "Currently, messaging is initiated by the company once they've reviewed your application. If you have a question about a job posting, the best approach is to apply and mention it in your cover letter." },
      { q: "I received a message I think is inappropriate — what should I do?", a: "Please report it to us at " + SUPPORT_EMAIL + " with details of the message. We take misuse of the messaging feature seriously and will investigate all reports promptly." },
    ],
  },
  {
    category: "Account & Profile",
    faqs: [
      { q: "How do I update my profile?", a: "Go to the Account page from the navigation bar. You can update your bio, skills, availability, job preferences, location, CV, cover letter, LinkedIn URL, and profile photo at any time." },
      { q: "How do I change my password?", a: "Go to Account → Settings → Change Password. You'll need to enter your current password and confirm a new one. If you've forgotten your password, use the Forgot Password link on the login page." },
      { q: "How do I delete my account?", a: "Go to Account → Settings → Delete Account. Your personal data will be permanently deleted within 30 days in accordance with our Privacy Policy. This action cannot be undone." },
      { q: "What is the reliability score?", a: "The reliability score is a platform metric calculated from your application history — completed shifts, withdrawals, interview attendance, and hiring outcomes. It's visible to companies as a supplementary indicator. You can view your own score on the Account page." },
    ],
  },
  {
    category: "For Companies",
    faqs: [
      { q: "How does company verification work?", a: "When you register as a company, our team verifies your CRO number against Companies Registration Office records before granting full access. This usually takes one business day." },
      { q: "How do I post a job?", a: "From your Company Dashboard, click Post a Job and fill in the job details — title, category, location, pay, hours, and description. Once submitted, the listing goes live immediately." },
      { q: "Can I message students I haven't hired yet?", a: "Yes — verified companies can message verified students through the Browse Students feature, even if the student hasn't applied to one of your jobs. Students can see and reply to these messages in their Messages tab." },
      { q: "How do I manage applications?", a: "Your Company Dashboard includes a full hiring pipeline (list and board view). Click any applicant to open their profile panel, review their CV and cover letter, move them through stages, schedule interviews and trials, and make hiring decisions." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <Helmet>
        <title>Help Centre — StudentShifts</title>
        <meta name="description" content="Get answers to common questions about StudentShifts — verification, applying for jobs, messaging, and more." />
        <link rel="canonical" href="https://studentshifts.ie/help" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content="Help Centre — StudentShifts" />
        <meta property="og:description" content="Get answers to common questions about StudentShifts — verification, applying for jobs, messaging, and more." />
        <meta property="og:url" content="https://studentshifts.ie/help" />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Help Centre — StudentShifts" />
        <meta name="twitter:description" content="Get answers to common questions about StudentShifts — verification, applying for jobs, messaging, and more." />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://studentshifts.ie/" }, { "@type": "ListItem", position: 2, name: "Help Centre", item: "https://studentshifts.ie/help" }] })}</script>
      </Helmet>
      <BackButton />

      <div style={{ width: "100%", backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", padding: "2rem 0 4rem" }}>
        {/* Header band */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", color: "white", padding: "3rem 2rem 2.5rem", marginBottom: "2.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>Support</p>
            <h1 style={{ margin: "0 0 0.5rem", fontWeight: "900", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.02em" }}>Help Centre</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.9rem" }}>
              Find answers to common questions, or get in touch with our team.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

          {/* FAQ sections */}
          {FAQ_SECTIONS.map(({ category, faqs }) => (
            <div key={category} style={{ marginBottom: "2rem" }}>
              <h2 style={{ margin: "0 0 0.85rem", fontWeight: "800", fontSize: "1.05rem", color: "var(--color-text-primary, #1e293b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{category}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(520px, 1fr))", gap: "0.65rem" }}>
                {faqs.map(({ q, a }) => (
                  <details key={q} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "0.9rem 1.1rem", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <summary style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--color-text-primary, #1e293b)", cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                      {q}
                      <span style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.7rem", flexShrink: 0 }}>▾</span>
                    </summary>
                    <p style={{ margin: "0.65rem 0 0", fontSize: "0.87rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.65 }}>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}

          {/* Contact strip */}
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "2rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginTop: "1rem" }}>
            <h2 style={{ margin: "0 0 0.4rem", fontWeight: "800", fontSize: "1.15rem", color: "var(--color-text-primary, #1e293b)" }}>Still need help?</h2>
            <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.88rem", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Can't find what you're looking for? Our team is happy to help.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1.75rem", borderRadius: "999px", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.9rem", textDecoration: "none" }}
            >
              Email {SUPPORT_EMAIL}
            </a>
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}>We aim to respond within one business day (Mon–Fri).</p>
          </div>

        </div>
      </div>
    </>
  );
}
