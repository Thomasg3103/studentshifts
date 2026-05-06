import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";

const CONTACT_EMAIL = "thomasgallagher3103@gmail.com";
const LAST_UPDATED  = "15 April 2026";

export default function PrivacyPolicyPage({ setPage }) {
  return (
    <><BackButton />
    <PageWrapper>
      <div style={{ maxWidth: "680px", margin: "0 auto", color: "#1e293b", fontFamily: "inherit" }}>

        <h1 style={h1}>Privacy Policy</h1>
        <p style={meta}>Last updated: {LAST_UPDATED}</p>

        <p style={body}>
          This Privacy Policy explains how StudentShifts ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>") collects, uses, stores and protects
          your personal data when you use the StudentShifts platform ("<strong>the Service</strong>").
          We are committed to protecting your privacy and complying with the General Data Protection Regulation (GDPR) and the Data Protection Acts 1988–2018 (Ireland).
        </p>

        <Section title="1. Who We Are">
          <p style={body}>
            StudentShifts is operated by Tom Stephens, Thomas Smith, Thomas Gallagher, John McCarthy, Liam Hyland based in Ireland.<br />
            For any data-related enquiries, contact us at: <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <p style={body}>We collect the following categories of personal data:</p>
          <Table rows={[
            ["Name", "Account creation", "Contract"],
            ["Email address", "Account creation, login, notifications", "Contract"],
            ["Password (hashed)", "Authentication — never stored in plain text", "Contract"],
            ["Role (Student / Company)", "Platform functionality", "Contract"],
            ["Student ID document", "Identity and student status verification", "Legal obligation / Legitimate interests"],
            ["Government ID document", "Identity verification", "Legal obligation / Legitimate interests"],
            ["CV / Cover letter", "Job applications", "Contract"],
            ["Profile photo", "Account display (optional)", "Consent"],
            ["LinkedIn URL, bio, skills", "Profile completeness (optional)", "Consent"],
            ["Location (lat/lng)", "Distance-to-job display (optional)", "Consent"],
            ["Job applications", "Connecting students with employers", "Contract"],
            ["Messages", "Communication between students and companies", "Contract"],
            ["IP address / device info", "Security and fraud prevention", "Legitimate interests"],
          ]} />
        </Section>

        <Section title="3. Legal Basis for Processing">
          <p style={body}>We rely on the following legal bases under GDPR Article 6:</p>
          <ul style={list}>
            <li><strong>Contract</strong> — processing necessary to provide the Service you signed up for.</li>
            <li><strong>Legal obligation</strong> — verifying student status and identity to comply with our obligations.</li>
            <li><strong>Legitimate interests</strong> — fraud prevention, platform security, and ensuring only eligible students use the Service.</li>
            <li><strong>Consent</strong> — optional features (profile photo, LinkedIn, location). You can withdraw consent at any time by removing the data from your account.</li>
          </ul>
        </Section>

        <Section title="4. How We Use Your Data">
          <ul style={list}>
            <li>Create and manage your account</li>
            <li>Verify your identity and student status before you can apply for jobs</li>
            <li>Match students with job opportunities posted by companies</li>
            <li>Enable communication between students and employers</li>
            <li>Send transactional emails (email confirmation, password reset, verification updates)</li>
            <li>Maintain platform security and prevent fraudulent accounts</li>
          </ul>
        </Section>

        <Section title="5. Data Sharing">
          <p style={body}>We do not sell your personal data. We share data only in the following limited circumstances:</p>
          <ul style={list}>
            <li><strong>Companies you apply to</strong> — when you apply for a job, the company can see your name, CV, and cover letter.</li>
            <li><strong>Supabase</strong> — our infrastructure provider stores your data on secure EU-based servers. Supabase acts as a data processor under a Data Processing Agreement.</li>
            <li><strong>Legal requirements</strong> — we may disclose data if required by law or to protect the rights, property, or safety of StudentShifts, our users, or others.</li>
          </ul>
          <p style={body}>Your verification documents (Student ID, Government ID) are only accessible to StudentShifts administrators for verification purposes and are never shared with employers.</p>
        </Section>

        <Section title="6. Data Retention">
          <ul style={list}>
            <li><strong>Active accounts</strong> — retained for as long as your account is active.</li>
            <li><strong>Inactive accounts</strong> — accounts with no login activity for 2 years will be deleted along with all associated data.</li>
            <li><strong>Deleted accounts</strong> — when you delete your account, your personal data is permanently removed within 30 days. Anonymised usage statistics may be retained.</li>
            <li><strong>Verification documents</strong> — deleted within 30 days of account verification or account deletion, whichever comes first.</li>
            <li><strong>Job applications</strong> — retained for 12 months after the application date, then deleted.</li>
          </ul>
        </Section>

        <Section title="7. Your Rights Under GDPR">
          <p style={body}>Under GDPR, you have the following rights:</p>
          <ul style={list}>
            <li><strong>Right of access</strong> — request a copy of all personal data we hold about you.</li>
            <li><strong>Right to rectification</strong> — correct inaccurate or incomplete data.</li>
            <li><strong>Right to erasure</strong> — request deletion of your data ("right to be forgotten"). You can also delete your account directly from the Account page.</li>
            <li><strong>Right to data portability</strong> — download a copy of your data from the Account page at any time.</li>
            <li><strong>Right to restriction</strong> — request that we limit processing of your data in certain circumstances.</li>
            <li><strong>Right to object</strong> — object to processing based on legitimate interests.</li>
            <li><strong>Right to withdraw consent</strong> — for consent-based processing (photo, location, LinkedIn), you can withdraw by removing the data from your profile.</li>
          </ul>
          <p style={body}>To exercise any of these rights, email us at <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>. We will respond within 30 days.</p>
        </Section>

        <Section title="8. Security">
          <ul style={list}>
            <li>All passwords are hashed and never stored in plain text.</li>
            <li>All data is transmitted over HTTPS (TLS encryption).</li>
            <li>Verification documents are stored in a private, access-controlled storage bucket.</li>
            <li>Database access is restricted by Row Level Security (RLS) policies — users can only access their own data.</li>
            <li>Admin access is limited to authorised personnel only.</li>
          </ul>
          <p style={body}>
            In the event of a data breach that poses a risk to your rights and freedoms, we will notify the Data Protection Commission within 72 hours and affected users without undue delay.
          </p>
        </Section>

        <Section title="9. Cookies">
          <p style={body}>
            StudentShifts uses only <strong>strictly necessary cookies</strong> for session management and authentication (provided by Supabase).
            These cookies are essential for the Service to function and do not require your consent under GDPR.
            We do not use analytics, advertising or tracking cookies.
          </p>
        </Section>

        <Section title="10. Children's Data">
          <p style={body}>
            StudentShifts is intended for users aged 17 and over. We do not knowingly collect data from anyone under 17.
            If you believe a minor has created an account, please contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p style={body}>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or by displaying a notice in the app.
            Continued use of the Service after changes constitutes acceptance of the updated policy.
          </p>
        </Section>

        <Section title="12. Complaints">
          <p style={body}>
            If you have a concern about how we handle your data, please contact us first at <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>.
            If you are not satisfied with our response, you have the right to lodge a complaint with the Data Protection Commission Ireland:
          </p>
          <ul style={list}>
            <li>Website: <a href="https://www.dataprotection.ie" style={link} target="_blank" rel="noopener noreferrer">www.dataprotection.ie</a></li>
            <li>Phone: +353 57 868 4800</li>
            <li>Email: info@dataprotection.ie</li>
          </ul>
        </Section>

        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "2rem", paddingTop: "1.25rem" }}>
          <p style={{ ...body, color: "#94a3b8", fontSize: "0.8rem" }}>
            StudentShifts · Ireland · <a href={`mailto:${CONTACT_EMAIL}`} style={{ ...link, color: "#94a3b8" }}>{CONTACT_EMAIL}</a>
          </p>
        </div>

      </div>
    </PageWrapper></>
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

function Table({ rows }) {
  return (
    <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#fafafa" }}>
            {["Data", "Purpose", "Legal Basis"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "0.6rem 0.75rem", fontWeight: "700", color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([data, purpose, basis], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #fafafa" }}>
              <td style={{ padding: "0.55rem 0.75rem", color: "#1e293b", fontWeight: "600" }}>{data}</td>
              <td style={{ padding: "0.55rem 0.75rem", color: "#475569" }}>{purpose}</td>
              <td style={{ padding: "0.55rem 0.75rem", color: "#A21D54", fontWeight: "600" }}>{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const h1     = { margin: "0.5rem 0 0.25rem", fontWeight: "800", fontSize: "2rem", color: "#1e293b" };
const h2     = { margin: "0 0 0.6rem", fontWeight: "700", fontSize: "1.1rem", color: "#1e293b" };
const meta   = { margin: "0 0 2rem", fontSize: "0.82rem", color: "#94a3b8" };
const body   = { margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", lineHeight: 1.7 };
const list   = { paddingLeft: "1.25rem", margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#475569", lineHeight: 1.8 };
const link   = { color: "#A21D54", textDecoration: "none", fontWeight: "600" };
const backBtn = { marginBottom: "1.5rem", padding: "0.45rem 1rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", backgroundColor: "white", color: "#64748b", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
