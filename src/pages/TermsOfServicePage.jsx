import PageWrapper from "../components/PageWrapper";

const CONTACT_EMAIL = "thomasgallagher3103@gmail.com";
const LAST_UPDATED  = "15 April 2026";

export default function TermsOfServicePage({ setPage }) {
  return (
    <PageWrapper>
      <div style={{ maxWidth: "680px", margin: "0 auto", color: "#1e293b", fontFamily: "inherit" }}>

        <button onClick={() => setPage("studentDashboard")} style={backBtn}>← Back</button>

        <h1 style={h1}>Terms of Service</h1>
        <p style={meta}>Last updated: {LAST_UPDATED}</p>

        <p style={body}>
          These Terms of Service ("<strong>Terms</strong>") govern your use of the StudentShifts platform
          ("<strong>the Service</strong>") operated by StudentShifts ("<strong>we</strong>", "<strong>us</strong>").
          By creating an account or using the Service, you agree to these Terms.
          If you do not agree, do not use the Service.
        </p>

        <Section title="1. Eligibility">
          <ul style={list}>
            <li><strong>Students</strong> must be aged 17–26 and currently enrolled in a recognised educational institution in Ireland.</li>
            <li><strong>Companies</strong> must be a legitimately registered business operating in Ireland.</li>
            <li>You must provide accurate, truthful information when creating your account.</li>
            <li>One person or entity may hold one account. Creating duplicate accounts is not permitted.</li>
          </ul>
        </Section>

        <Section title="2. Account Responsibilities">
          <ul style={list}>
            <li>You are responsible for keeping your login credentials confidential.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a> if you suspect unauthorised access to your account.</li>
            <li>You must not share your account with others or allow others to use it.</li>
          </ul>
        </Section>

        <Section title="3. Student Verification">
          <ul style={list}>
            <li>Students must submit a valid Student ID and Government-issued ID (Age Card, Passport, or Driver's Licence) for verification.</li>
            <li>You confirm that all submitted documents are genuine and belong to you. Submitting false or fraudulent documents is a serious violation and may result in immediate account suspension and referral to the appropriate authorities.</li>
            <li>Until your account is verified by our team, you may not apply for jobs.</li>
            <li>We reserve the right to reject applications where documents are unclear, expired, or do not meet our requirements.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use">
          <p style={body}>You agree not to:</p>
          <ul style={list}>
            <li>Use the Service for any unlawful purpose or in violation of any applicable laws.</li>
            <li>Submit false, misleading, or fraudulent information including fake CVs or job postings.</li>
            <li>Harass, abuse, or harm other users through the messaging feature.</li>
            <li>Attempt to gain unauthorised access to other users' accounts or data.</li>
            <li>Scrape, copy, or reproduce any content from the Service without permission.</li>
            <li>Use the Service to send unsolicited commercial communications (spam).</li>
            <li>Attempt to reverse-engineer, decompile, or interfere with the platform's operation.</li>
          </ul>
        </Section>

        <Section title="5. Job Postings (Companies)">
          <ul style={list}>
            <li>Companies are responsible for ensuring all job postings are accurate, lawful, and comply with Irish employment law.</li>
            <li>Job postings must not discriminate on grounds of gender, age, race, religion, disability, or any other protected characteristic under Irish law.</li>
            <li>Companies must honour commitments made to students they contact or accept through the platform.</li>
            <li>We reserve the right to remove any job posting that violates these Terms or applicable law.</li>
          </ul>
        </Section>

        <Section title="6. Job Applications (Students)">
          <ul style={list}>
            <li>By applying for a job, you consent to your name, CV, and cover letter being shared with the relevant employer.</li>
            <li>You confirm that all information in your application is truthful and accurate.</li>
            <li>StudentShifts does not guarantee any job offer or employment outcome.</li>
          </ul>
        </Section>

        <Section title="7. Messaging">
          <ul style={list}>
            <li>The messaging feature is available only to students who have been accepted for a job by a company.</li>
            <li>All messages must be professional and relevant to the job.</li>
            <li>We reserve the right to review messages where a breach of these Terms is reported.</li>
          </ul>
        </Section>

        <Section title="8. Intellectual Property">
          <ul style={list}>
            <li>The StudentShifts name, logo, and platform design are owned by StudentShifts and may not be used without permission.</li>
            <li>Content you upload (CV, cover letter, profile photo) remains yours. You grant us a limited licence to store and display it as necessary to provide the Service.</li>
          </ul>
        </Section>

        <Section title="9. Suspension and Termination">
          <ul style={list}>
            <li>We may suspend or terminate your account immediately if you breach these Terms, submit fraudulent documents, or engage in harmful behaviour.</li>
            <li>You may delete your own account at any time from the Account page.</li>
            <li>Upon termination, your personal data will be deleted in accordance with our <span onClick={() => setPage("privacy")} style={{ ...link, cursor: "pointer" }}>Privacy Policy</span>.</li>
          </ul>
        </Section>

        <Section title="10. Disclaimer of Warranties">
          <p style={body}>
            The Service is provided "<strong>as is</strong>" without warranty of any kind. We do not guarantee continuous, uninterrupted access to the Service.
            We are not responsible for the accuracy of job postings or the conduct of employers or students using the platform.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p style={body}>
            To the maximum extent permitted by Irish law, StudentShifts shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service,
            including but not limited to loss of earnings, missed job opportunities, or data loss.
            Our total liability to you shall not exceed €100.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p style={body}>
            These Terms are governed by the laws of Ireland. Any disputes shall be subject to the exclusive jurisdiction of the courts of Ireland.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p style={body}>
            We may update these Terms from time to time. We will notify you of material changes by email or in-app notice at least 14 days before they take effect.
            Continued use of the Service after changes take effect constitutes your acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="14. Contact Us">
          <p style={body}>
            For questions about these Terms, contact us at: <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>
          </p>
        </Section>

        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "2rem", paddingTop: "1.25rem" }}>
          <p style={{ ...body, color: "#94a3b8", fontSize: "0.8rem" }}>
            StudentShifts · Ireland · <a href={`mailto:${CONTACT_EMAIL}`} style={{ ...link, color: "#94a3b8" }}>{CONTACT_EMAIL}</a>
          </p>
        </div>

      </div>
    </PageWrapper>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <h2 style={h2}>{title}</h2>
      {children}
    </div>
  );
}

const h1     = { margin: "0.5rem 0 0.25rem", fontWeight: "800", fontSize: "2rem", color: "#1e293b" };
const h2     = { margin: "0 0 0.6rem", fontWeight: "700", fontSize: "1.1rem", color: "#1e293b" };
const meta   = { margin: "0 0 2rem", fontSize: "0.82rem", color: "#94a3b8" };
const body   = { margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", lineHeight: 1.7 };
const list   = { paddingLeft: "1.25rem", margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", lineHeight: 1.8 };
const link   = { color: "#6366f1", textDecoration: "none", fontWeight: "600" };
const backBtn = { marginBottom: "1.5rem", padding: "0.45rem 1rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
