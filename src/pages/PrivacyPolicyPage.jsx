import { Helmet } from "react-helmet-async";
import BackButton from "../components/BackButton";

const CONTACT_EMAIL = "privacy@studentshifts.ie";
const LAST_UPDATED  = "7 June 2026";
const EFFECTIVE     = "7 June 2026";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — StudentShifts</title>
        <meta name="description" content="StudentShifts comprehensive privacy policy covering GDPR compliance, data collection, processing, retention and your rights." />
        <link rel="canonical" href="https://studentshifts.ie/privacy" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Privacy Policy — StudentShifts" />
        <meta property="og:url" content="https://studentshifts.ie/privacy" />
      </Helmet>
      <BackButton />

      <div style={{ width: "100%", backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", padding: "2rem 0 4rem" }}>
        {/* Header band */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", color: "white", padding: "3rem 2rem 2.5rem", marginBottom: "2.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>Legal Documentation</p>
            <h1 style={{ margin: "0 0 0.5rem", fontWeight: "900", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.02em" }}>Privacy Policy &amp; Data Processing Notice</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.85rem" }}>
              Effective date: {EFFECTIVE} &nbsp;·&nbsp; Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Version 3.1.0 &nbsp;·&nbsp; Jurisdiction: Republic of Ireland / European Union
            </p>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

          {/* TOC */}
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "1.5rem 2rem", marginBottom: "2.5rem" }}>
            <p style={tocHead}>Table of Contents</p>
            <div style={{ columns: "2 280px", gap: "1rem" }}>
              {[
                "1. Controller Identity & Contact Details",
                "2. Scope & Application of This Notice",
                "3. Definitions & Interpretative Provisions",
                "4. Categories of Personal Data Collected",
                "5. Purposes of Processing & Legal Bases",
                "6. Special Categories of Data",
                "7. Data Subject Rights",
                "8. Automated Decision-Making & Profiling",
                "9. Third-Party Processors & Sub-Processors",
                "10. International Data Transfers",
                "11. Data Retention & Erasure Schedule",
                "12. Security Measures & Breach Notification",
                "13. Cookies, Tracking & Analytics",
                "14. Children & Minors",
                "15. Legitimate Interests Assessment",
                "16. Consent Management",
                "17. Data Minimisation & Purpose Limitation",
                "18. Accountability & Governance",
                "19. Changes to This Notice",
                "20. Supervisory Authority & Complaints",
              ].map(item => {
                const num = item.match(/^(\d+)\./)[1];
                return (
                  <a key={item} href={`#section-${num}`} style={{ display: "block", margin: "0.2rem 0", fontSize: "0.82rem", color: "var(--color-brand)", textDecoration: "none", fontWeight: "500" }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >{item}</a>
                );
              })}
            </div>
          </div>

          {/* Intro */}
          <Card>
            <p style={body}>
              This Privacy Policy and Data Processing Notice ("<strong>Notice</strong>") is issued by the operators of StudentShifts (hereinafter collectively referred to as "<strong>StudentShifts</strong>", "<strong>the Controller</strong>", "<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") pursuant to and in accordance with Article 13 and Article 14 of Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data and on the free movement of such data, and repealing Directive 95/46/EC ("<strong>GDPR</strong>"), the Data Protection Acts 1988 to 2018 of Ireland ("<strong>DPA</strong>"), the ePrivacy Regulations (S.I. No. 336 of 2011) ("<strong>ePrivacy Regulations</strong>"), and any other applicable national implementing legislation or statutory instrument as may be amended or supplemented from time to time.
            </p>
            <p style={body}>
              This Notice applies to all natural persons ("<strong>Data Subjects</strong>") who access, use, browse, register on, or otherwise interact with the StudentShifts platform and associated sub-domains, mobile applications, application programming interfaces, or any digital surface operated by the Controller (collectively, "<strong>the Platform</strong>" or "<strong>the Service</strong>"). By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by this Notice in its entirety. If you do not agree with any part of this Notice, you should discontinue use of the Platform immediately and contact us at the address specified in Section 1 below to request deletion of any data already collected.
            </p>
            <p style={body}>
              This Notice should be read in conjunction with our Terms of Service, Cookie Policy, and any supplementary privacy notices or processing notices that may be provided to you at the point of collection of specific categories of personal data. In the event of any inconsistency or conflict between this Notice and any supplementary notice, the supplementary notice shall prevail to the extent of that inconsistency unless expressly stated otherwise.
            </p>
          </Card>

          <Section num="1" title="Controller Identity &amp; Contact Details">
            <p style={body}>
              For the purposes of the GDPR and the DPA, the Data Controller in respect of personal data collected and processed through the Platform is StudentShifts, a platform operated and maintained by its founding team, registered and principally operating within the jurisdiction of the Republic of Ireland ("<strong>the Controller</strong>").
            </p>
            <Grid cols={2}>
              <InfoBox label="Registered Jurisdiction" value="Republic of Ireland" />
              <InfoBox label="Data Protection Contact" value={CONTACT_EMAIL} />
              <InfoBox label="Postal Enquiries" value="Available upon written request" />
              <InfoBox label="Response Timeline" value="Within 30 calendar days of receipt" />
            </Grid>
            <p style={body}>
              The Controller has not appointed a formal Data Protection Officer ("<strong>DPO</strong>") at this time, as it does not meet the thresholds prescribed under Article 37(1) GDPR for mandatory DPO designation. Notwithstanding the foregoing, all data protection enquiries, subject access requests, objections, complaints, and other communications relating to the processing of personal data should be directed to the Controller using the contact details specified above. The Controller reserves the right to appoint a DPO in future and will update this Notice accordingly.
            </p>
            <p style={body}>
              Where the Controller engages third-party processors (as enumerated in Section 9 below), such processors act solely on documented instructions from the Controller and have entered into data processing agreements ("<strong>DPAs</strong>") incorporating the Standard Contractual Clauses ("<strong>SCCs</strong>") as approved by the European Commission where applicable. Details of all sub-processors are maintained in the Controller's internal Record of Processing Activities ("<strong>ROPA</strong>") maintained pursuant to Article 30 GDPR.
            </p>
          </Section>

          <Section num="2" title="Scope &amp; Application of This Notice">
            <p style={body}>
              This Notice applies in full to all of the following categories of Data Subjects, without limitation, who interact with the Platform in any capacity whatsoever, including but not limited to: (a) registered student users who have completed the registration process and received verification of their student status; (b) prospective student users who have initiated but not completed the registration process; (c) registered company users who have been approved by the Controller's administrative personnel; (d) prospective company users whose applications are pending administrative review; (e) visitors who access any publicly available portion of the Platform without creating an account; (f) any natural person whose personal data is incidentally processed as a result of another user's interactions with the Platform, including but not limited to persons referenced in uploaded documents or correspondence.
            </p>
            <p style={body}>
              This Notice does not apply to the processing of personal data of legal persons (corporations, partnerships, unincorporated associations). Where personal data of natural persons is embedded within organisational data provided by company users (including but not limited to named contact persons, authorised signatories, or company representatives), such data falls within the scope of this Notice to the extent that it constitutes personal data of an identifiable natural person.
            </p>
            <p style={body}>
              The Platform may contain hyperlinks to third-party websites, services, or resources not operated by the Controller. This Notice does not apply to such third-party services. The Controller accepts no responsibility or liability for the privacy practices, data collection methods, or policies of any third-party operator. Data Subjects are strongly encouraged to review the applicable privacy notices of any third-party services they access through the Platform.
            </p>
          </Section>

          <Section num="3" title="Definitions &amp; Interpretative Provisions">
            <p style={body}>In this Notice, unless the context otherwise requires, the following terms shall have the meanings ascribed to them below. Defined terms not otherwise defined herein shall have the meaning ascribed to them under the GDPR:</p>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {[
                ["Personal Data", "Any information relating to an identified or identifiable natural person (“Data Subject”); an identifiable natural person is one who can be identified, directly or indirectly, in particular by reference to an identifier such as a name, an identification number, location data, an online identifier or to one or more factors specific to the physical, physiological, genetic, mental, economic, cultural or social identity of that natural person, as defined under Article 4(1) GDPR."],
                ["Processing", "Any operation or set of operations which is performed on personal data or on sets of personal data, whether or not by automated means, such as collection, recording, organisation, structuring, storage, adaptation or alteration, retrieval, consultation, use, disclosure by transmission, dissemination or otherwise making available, alignment or combination, restriction, erasure or destruction, as defined under Article 4(2) GDPR."],
                ["Special Categories of Data", "Personal data referred to in Article 9(1) GDPR, including data revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, trade-union membership, genetic data, biometric data for the purposes of uniquely identifying a natural person, data concerning health, or data concerning a natural person's sex life or sexual orientation."],
                ["Consent", "Any freely given, specific, informed and unambiguous indication of the Data Subject's wishes by which he or she, by a statement or by a clear affirmative action, signifies agreement to the processing of personal data relating to him or her, as defined under Article 4(11) GDPR."],
                ["Legitimate Interests", "The legal basis for processing set out in Article 6(1)(f) GDPR, permitting processing where necessary for the purposes of the legitimate interests pursued by the Controller or by a third party, except where such interests are overridden by the interests or fundamental rights and freedoms of the Data Subject."],
                ["Data Processor", "A natural or legal person, public authority, agency or other body which processes personal data on behalf of the Controller, as defined under Article 4(8) GDPR."],
                ["Supervisory Authority", "The Data Protection Commission of Ireland (“DPC”), established under the Data Protection Acts 1988–2018, being the competent supervisory authority in the Republic of Ireland for the purposes of GDPR."],
                ["Platform", "The StudentShifts website accessible at studentshifts.ie, including all associated sub-pages, application programming interfaces, mobile applications, and digital interfaces operated by the Controller."],
                ["Pseudonymisation", "The processing of personal data in such a manner that the personal data can no longer be attributed to a specific Data Subject without the use of additional information, provided that such additional information is kept separately and is subject to technical and organisational measures to ensure that the personal data are not attributed to an identified or identifiable natural person."],
              ].map(([term, def]) => (
                <div key={term} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.5rem", padding: "0.85rem 1rem", borderLeft: "3px solid var(--color-brand)" }}>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: "700", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)" }}>{term}</p>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{def}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section num="4" title="Categories of Personal Data Collected">
            <p style={body}>The Controller collects, receives, generates, or otherwise processes the following categories of personal data, which are organised below according to the category of Data Subject and the mechanism by which such data is collected. The Controller does not collect any personal data beyond what is reasonably necessary for the purposes specified in Section 5 of this Notice.</p>
            <h3 style={h3}>4.1 Data Collected Directly from Data Subjects</h3>
            <FullTable headers={["Data Element", "Data Subject Category", "Collection Mechanism", "Necessity", "Legal Basis"]} rows={[
              ["Full legal name", "Student / Company", "Registration form", "Mandatory", "Contract (Art. 6(1)(b))"],
              ["Electronic mail address", "Student / Company", "Registration form", "Mandatory", "Contract (Art. 6(1)(b))"],
              ["Password (bcrypt-hashed, salted)", "Student / Company", "Registration form", "Mandatory", "Contract (Art. 6(1)(b))"],
              ["Role designation (Student / Company / Admin)", "All", "Registration form", "Mandatory", "Contract (Art. 6(1)(b))"],
              ["CRO registration number", "Company only", "Registration form", "Mandatory for companies", "Legal obligation (Art. 6(1)(c))"],
              ["Industry sector(s)", "Company only", "Registration form", "Optional", "Consent (Art. 6(1)(a))"],
              ["Biographical summary / 'bio'", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["LinkedIn profile URL", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Skill tags", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Job preference categories", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Availability schedule (days/times)", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Geographic location (address text + coordinates)", "Student", "Account settings / GPS prompt", "Optional", "Consent (Art. 6(1)(a))"],
              ["Curriculum Vitae (CV) document", "Student", "Account settings file upload", "Optional but affects functionality", "Consent (Art. 6(1)(a))"],
              ["Cover letter document", "Student", "Account settings file upload", "Optional", "Consent (Art. 6(1)(a))"],
              ["Profile photograph", "Student / Company", "Account settings file upload", "Optional", "Consent (Art. 6(1)(a))"],
              ["Company website URL", "Company", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Company biographical summary", "Company", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Transport mode preference", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Earliest available start date", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Work experience level", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Right-to-work status", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
              ["Driver's licence possession", "Student", "Account settings", "Optional", "Consent (Art. 6(1)(a))"],
            ]} />

            <h3 style={h3}>4.2 Identity Verification Documents</h3>
            <FullTable headers={["Document Type", "Data Subject", "Purpose", "Access Controls", "Legal Basis"]} rows={[
              ["Student identification card (photograph, name, institution, student number)", "Student", "Verification of enrolled student status", "Accessible only to authorised admin personnel; never shared with employers", "Legal obligation / Legitimate interests (Art. 6(1)(c)(f))"],
              ["Government-issued photographic identification (passport, national ID, driving licence)", "Student", "Identity verification to prevent fraud and protect platform integrity", "Accessible only to authorised admin personnel; stored in access-controlled private bucket", "Legal obligation / Legitimate interests (Art. 6(1)(c)(f))"],
            ]} />

            <h3 style={h3}>4.3 Transactional & Behavioural Data</h3>
            <FullTable headers={["Data Element", "Source", "Purpose", "Retention"]} rows={[
              ["Job application records (application date, job applied to, application status, pipeline stage)", "Platform activity", "Core service functionality", "12 months post-application"],
              ["Interview scheduling data (date, time, slot selections)", "Platform activity", "Interview coordination between students and companies", "6 months post-interview"],
              ["Trial shift records (date, time)", "Platform activity", "Trial coordination", "6 months post-trial"],
              ["In-platform messages (text content, timestamp, sender/recipient identifiers)", "Platform activity", "User communication", "Duration of account + 90 days"],
              ["Saved/liked job records", "Platform activity", "Personalised job recommendations", "Duration of account"],
              ["Company-saved student records", "Platform activity", "Company talent pool management", "Duration of account"],
              ["Job posting data (title, description, pay, location, dates, requirements)", "Company input", "Job marketplace", "Duration of posting + 12 months"],
              ["Withdrawal reasons", "Student input", "Platform analytics and improvement", "12 months"],
              ["Company internal notes on applicants", "Company input", "Internal hiring management", "Duration of company account"],
              ["Push notification subscription tokens", "Device/browser", "Delivery of platform notifications", "Until subscription revoked"],
            ]} />

            <h3 style={h3}>4.4 Technical & Automatically Collected Data</h3>
            <FullTable headers={["Data Element", "Collection Method", "Purpose", "Basis"]} rows={[
              ["Internet Protocol (IP) address", "Server logs / Supabase infrastructure", "Security, fraud prevention, rate-limiting", "Legitimate interests (Art. 6(1)(f))"],
              ["Browser type, version, and user-agent string", "Automatically on HTTP request", "Platform compatibility and security", "Legitimate interests (Art. 6(1)(f))"],
              ["Operating system type and version", "Automatically on HTTP request", "Platform compatibility", "Legitimate interests (Art. 6(1)(f))"],
              ["Session authentication tokens (JWT)", "Supabase Auth", "Maintaining authenticated sessions", "Contract (Art. 6(1)(b))"],
              ["Page views and navigation paths", "Google Analytics 4 (anonymised)", "Understanding usage patterns", "Consent (Art. 6(1)(a))"],
              ["Session duration and engagement metrics", "Google Analytics 4 (anonymised)", "Platform improvement", "Consent (Art. 6(1)(a))"],
              ["Heatmaps and scroll behaviour", "Microsoft Clarity (anonymised)", "UX improvement", "Consent (Art. 6(1)(a))"],
              ["Recorded session replays (anonymised)", "Microsoft Clarity", "Error diagnosis and UX improvement", "Consent (Art. 6(1)(a))"],
              ["Error events and stack traces", "Sentry.io", "Diagnosis and resolution of technical errors", "Legitimate interests (Art. 6(1)(f))"],
              ["Performance metrics (page load times)", "Web Vitals / analytics", "Platform performance optimisation", "Legitimate interests (Art. 6(1)(f))"],
              ["Referral codes and referral attribution", "URL query parameters at registration", "Referral programme tracking", "Legitimate interests (Art. 6(1)(f))"],
            ]} />
          </Section>

          <Section num="5" title="Purposes of Processing &amp; Legal Bases">
            <p style={body}>
              The Controller processes personal data for the purposes and on the legal bases set out below. Where processing is carried out on the basis of legitimate interests pursuant to Article 6(1)(f) GDPR, a summary of the balancing test conducted by the Controller is provided in Section 15. Where processing is carried out on the basis of consent pursuant to Article 6(1)(a) GDPR, the conditions for and withdrawal of consent are further described in Section 16.
            </p>
            {[
              {
                purpose: "Account Registration and Management",
                description: "Creating, maintaining, and managing user accounts on the Platform, including authentication, session management, email verification, and password recovery.",
                basis: "Performance of a contract to which the Data Subject is party (Article 6(1)(b) GDPR). The processing of name, email address, password, and role is strictly necessary to provide access to the Service.",
                data: ["Name", "Email address", "Password (hashed)", "Role designation", "Session tokens"],
              },
              {
                purpose: "Identity and Student Status Verification",
                description: "Verifying that registered student users are bona fide enrolled students and that their identity matches the information provided at registration, to protect the integrity of the Platform and prevent fraudulent use.",
                basis: "Compliance with a legal obligation (Article 6(1)(c) GDPR) and the legitimate interests of the Controller and other Platform users in preventing fraud (Article 6(1)(f) GDPR). Processing of verification documents may also engage Article 9(2)(b) GDPR insofar as government ID may reveal health or other special category data incidentally.",
                data: ["Student ID document", "Government-issued photo ID", "Name", "Email address"],
              },
              {
                purpose: "Company Verification and Approval",
                description: "Verifying the legal existence and good standing of company users through cross-referencing CRO registration numbers with publicly available Companies Registration Office records.",
                basis: "Legitimate interests of the Controller and student users in ensuring that only legitimate, law-abiding businesses operate on the Platform (Article 6(1)(f) GDPR).",
                data: ["Company name", "CRO number", "Email address"],
              },
              {
                purpose: "Job Matching and Applications",
                description: "Facilitating the discovery, application for, and management of job opportunities, including displaying job listings to eligible students, enabling application submission, and managing the end-to-end recruitment pipeline.",
                basis: "Performance of a contract (Article 6(1)(b) GDPR). Students applying to jobs creates a pre-contractual relationship with the posting company; the Controller processes personal data as necessary to facilitate this.",
                data: ["Student profile data", "CV", "Cover letter", "Application records", "Pipeline stage data"],
              },
              {
                purpose: "Communication Between Students and Companies",
                description: "Enabling in-platform messaging between verified students whose applications have been accepted and the companies to which they have applied, as well as direct messages sent by companies to students they have identified through Browse Students.",
                basis: "Performance of a contract (Article 6(1)(b) GDPR) for job-application-related messages; legitimate interests (Article 6(1)(f) GDPR) for direct company-initiated outreach.",
                data: ["Message content", "Sender/recipient identifiers", "Timestamps"],
              },
              {
                purpose: "Transactional Email Notifications",
                description: "Sending transactional emails including email address confirmation, password reset links, application status updates, interview invitations, trial shift confirmations, verification status updates, and platform-related administrative notices.",
                basis: "Performance of a contract (Article 6(1)(b) GDPR) for all transactional communications necessary to provide the Service. Legal obligation (Article 6(1)(c) GDPR) for security-related communications such as password reset.",
                data: ["Email address", "Name", "Application/interview/trial data"],
              },
              {
                purpose: "Push Notifications",
                description: "Delivering real-time push notifications to Data Subjects' browsers or devices to inform them of messages, application status changes, and other Platform events.",
                basis: "Consent (Article 6(1)(a) GDPR). Push notification permission is requested explicitly at the browser level and may be revoked at any time through browser settings or via the Account page.",
                data: ["Push subscription token", "User identifier", "Notification content"],
              },
              {
                purpose: "Analytics and Platform Improvement",
                description: "Understanding how the Platform is used, identifying areas for improvement, diagnosing technical issues, and monitoring platform performance.",
                basis: "Consent (Article 6(1)(a) GDPR) for analytics cookies and tracking (Google Analytics 4, Microsoft Clarity). Legitimate interests (Article 6(1)(f) GDPR) for error tracking (Sentry.io).",
                data: ["Anonymised usage data", "Error logs", "Performance metrics"],
              },
              {
                purpose: "Security, Fraud Prevention, and Platform Integrity",
                description: "Detecting, investigating, and preventing fraudulent activity, abuse of the Platform, unauthorised access, and other harmful or unlawful conduct.",
                basis: "Legitimate interests (Article 6(1)(f) GDPR). The Controller has a compelling legitimate interest in maintaining the security and integrity of the Platform and protecting its users from harm.",
                data: ["IP addresses", "Session data", "Behavioural signals"],
              },
              {
                purpose: "Legal Claims and Compliance",
                description: "Establishing, exercising, or defending legal claims, complying with applicable laws and regulatory obligations, and responding to lawful requests from competent authorities.",
                basis: "Compliance with a legal obligation (Article 6(1)(c) GDPR); legitimate interests in defending legal claims (Article 6(1)(f) GDPR); vital interests or public interest where applicable.",
                data: ["All categories as necessary"],
              },
            ].map(({ purpose, description, basis, data }) => (
              <div key={purpose} style={{ marginBottom: "1.25rem", backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.65rem", padding: "1.1rem 1.25rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
                <p style={{ margin: "0 0 0.4rem", fontWeight: "700", fontSize: "0.92rem", color: "var(--color-text-primary, #1e293b)" }}>{purpose}</p>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{description}</p>
                <p style={{ margin: "0 0 0.3rem", fontSize: "0.82rem", lineHeight: 1.6, color: "var(--color-text-body, #374151)" }}><strong>Legal basis:</strong> {basis}</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}><strong>Data processed:</strong> {data.join(", ")}</p>
              </div>
            ))}
          </Section>

          <Section num="6" title="Special Categories of Data">
            <p style={body}>
              Article 9 GDPR imposes heightened protections on "special categories" of personal data. The Controller does not intentionally or systematically collect special category data. However, government-issued identification documents uploaded by student users during the identity verification process ("<strong>Verification Documents</strong>") may incidentally contain or reveal special category data elements, including but not limited to: physical characteristics captured in photographic imagery that may reveal racial or ethnic origin; health information that may be apparent from the photograph or document annotations; or other data falling within the Article 9(1) categories.
            </p>
            <p style={body}>
              To the extent that Verification Documents incidentally contain special category data, the Controller relies upon Article 9(2)(b) GDPR (processing necessary for the purposes of carrying out the obligations and exercising specific rights of the Controller or of the Data Subject in the field of employment and social security and social protection law, in so far as it is authorised by Union or Member State law providing for appropriate safeguards for the fundamental rights and the interests of the Data Subject) and Article 9(2)(g) GDPR (processing necessary for reasons of substantial public interest, on the basis of Union or Member State law which shall be proportionate to the aim pursued, respect the essence of the right to data protection and provide for suitable and specific measures to safeguard the fundamental rights and the interests of the Data Subject).
            </p>
            <p style={body}>
              Verification Documents are subject to the following additional safeguards: (a) they are stored in a separate, access-controlled private storage bucket with no public read access; (b) access is limited exclusively to designated administrative personnel of the Controller; (c) Verification Documents are not shared with any third party (including employers, processors, or sub-processors) except as required by law; (d) Verification Documents are deleted within 30 days of completion of the verification review process, whether the outcome is approval, rejection, or abandonment of the verification; and (e) in all cases, Verification Documents are deleted upon deletion of the associated account, irrespective of verification status.
            </p>
          </Section>

          <Section num="7" title="Data Subject Rights">
            <p style={body}>
              Data Subjects resident within the European Economic Area and the United Kingdom are entitled to exercise the rights enumerated below in relation to personal data held by the Controller. The Controller will respond to all verified requests within one calendar month of receipt, and may extend this period by a further two months where requests are complex or numerous, in which case the Controller will notify the Data Subject of the extension and the reasons for it within one month of receipt of the request, in accordance with Article 12(3) GDPR. The Controller will not charge a fee for exercising these rights unless requests are manifestly unfounded, excessive, or repetitive, in which case the Controller may charge a reasonable administrative fee or may decline to respond, in accordance with Article 12(5) GDPR.
            </p>
            <Grid cols={2}>
              {[
                { right: "Right of Access (Article 15)", desc: "You have the right to obtain confirmation of whether personal data concerning you is being processed, and if so, to receive a copy of that personal data along with supplementary information including: the purposes of processing; the categories of data; recipients or categories of recipients; the envisaged retention period; the existence of the right to rectification, erasure, restriction, or objection; the right to lodge a complaint with a supervisory authority; the source of the data; and the existence of any automated decision-making including profiling. Requests may be made by emailing " + CONTACT_EMAIL + ". An 'Export My Data' function is also available via the Account page." },
                { right: "Right to Rectification (Article 16)", desc: "You have the right to obtain from the Controller, without undue delay, the rectification of inaccurate personal data concerning you. Taking into account the purposes of the processing, you also have the right to have incomplete personal data completed, including by means of providing a supplementary statement. Where technically feasible, you may correct most of your own data directly via the Account settings page." },
                { right: "Right to Erasure / 'Right to be Forgotten' (Article 17)", desc: "You have the right to obtain from the Controller the erasure of personal data concerning you without undue delay in circumstances including: where the personal data is no longer necessary in relation to the purposes for which it was collected or processed; where you withdraw consent on which processing is based and there is no other legal ground for processing; where you object to processing pursuant to Article 21 and there are no overriding legitimate grounds; where the data has been unlawfully processed; or where erasure is required for compliance with a legal obligation. You may delete your account directly from the Account page, which initiates automated deletion of your personal data within 30 days." },
                { right: "Right to Restriction of Processing (Article 18)", desc: "You have the right to obtain from the Controller restriction of processing where: the accuracy of the personal data is contested by you (for the period required to verify accuracy); the processing is unlawful and you oppose erasure and request restriction instead; the Controller no longer needs the personal data for the purposes of processing but it is required by you for the establishment, exercise, or defence of legal claims; or you have objected to processing pursuant to Article 21(1) pending verification of whether the Controller's legitimate grounds override yours." },
                { right: "Right to Data Portability (Article 20)", desc: "Where processing is based on consent or contract and is carried out by automated means, you have the right to receive the personal data concerning you in a structured, commonly used, and machine-readable format, and to transmit that data to another controller without hindrance. An 'Export My Data' function providing a JSON export of your profile, applications, liked jobs, and messages is available on the Account page." },
                { right: "Right to Object (Article 21)", desc: "You have the right to object, on grounds relating to your particular situation, at any time to processing of personal data concerning you which is based on Article 6(1)(e) or (f) GDPR, including profiling based on those provisions. The Controller shall no longer process the personal data unless it can demonstrate compelling legitimate grounds for the processing which override the interests, rights, and freedoms of the Data Subject, or for the establishment, exercise, or defence of legal claims." },
                { right: "Right to Withdraw Consent (Article 7(3))", desc: "Where processing is based on your consent, you have the right to withdraw that consent at any time without affecting the lawfulness of processing based on consent before its withdrawal. Consent-based data elements (profile photograph, LinkedIn URL, CV, cover letter, location data) may be removed directly from the Account settings page, which constitutes withdrawal of consent in relation to those specific data elements." },
                { right: "Rights Related to Automated Decision-Making (Article 22)", desc: "You have the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal effects concerning you or similarly significantly affects you. Please refer to Section 8 of this Notice for full details of any automated processing carried out by the Controller." },
              ].map(({ right, desc }) => (
                <div key={right} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.65rem", padding: "1rem 1.1rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
                  <p style={{ margin: "0 0 0.35rem", fontWeight: "700", fontSize: "0.85rem", color: "var(--color-text-primary, #1e293b)" }}>{right}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.65 }}>{desc}</p>
                </div>
              ))}
            </Grid>
            <p style={{ ...body, marginTop: "1rem" }}>To exercise any of the above rights, or to make an enquiry about the processing of your personal data, please contact the Controller at: <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>. Please provide sufficient information to allow the Controller to verify your identity and locate your records. The Controller may request additional identification documentation where there is reasonable doubt as to the identity of the person making the request.</p>
          </Section>

          <Section num="8" title="Automated Decision-Making &amp; Profiling">
            <p style={body}>
              The Platform employs certain automated processing mechanisms that analyse personal data to generate outputs used in the operation of the Service. In the interest of full transparency, the Controller provides the following disclosure:
            </p>
            <p style={body}>
              <strong>Job Matching and Filtering:</strong> The Platform utilises automated algorithms to match student profiles with job listings based on parameters including but not limited to: declared skills, job preference categories, geographic proximity (where location data has been provided), declared availability, and job requirements specified by employers. This matching process affects the order and prominence with which job listings are displayed to individual student users. Whilst this constitutes profiling within the meaning of Article 4(4) GDPR, it does not produce legal effects or similarly significantly affect Data Subjects within the meaning of Article 22(1) GDPR, as students retain full access to all available job listings regardless of the matching algorithm's output.
            </p>
            <p style={body}>
              <strong>Reliability Scoring:</strong> The Platform calculates an indicative "reliability score" for student users based on their platform history, including but not limited to: number of completed shifts, hiring outcomes, and withdrawal patterns. This score is visible to company users as a supplementary indicator and does not constitute a sole basis for any automated decision-making within the meaning of Article 22 GDPR; company users make hiring decisions based on their own assessment. Students may view their own reliability score (where applicable) via their Account page.
            </p>
            <p style={body}>
              <strong>No Solely Automated Consequential Decisions:</strong> The Controller does not make any decisions that produce legal effects or similarly significantly affect Data Subjects based solely on automated processing without human review. All verification approvals and rejections are carried out by human administrators. All hiring decisions are made by human company users.
            </p>
          </Section>

          <Section num="9" title="Third-Party Processors &amp; Sub-Processors">
            <p style={body}>The Controller engages the following third-party data processors and sub-processors in connection with the operation of the Platform. All such processors have entered into Data Processing Agreements with the Controller that comply with the requirements of Chapter IV GDPR. The Controller undertakes to maintain and update this list as the processor landscape changes and to provide at least 30 days' notice of material additions where reasonably practicable.</p>
            <FullTable headers={["Processor", "Role", "Data Processed", "Location", "Safeguard"]} rows={[
              ["Supabase Inc.", "Infrastructure provider (database, authentication, storage, real-time, edge functions)", "All personal data stored on the Platform", "EU (AWS eu-west-1, Frankfurt)", "EU hosting; DPA in place"],
              ["Brevo (Sendinblue SAS)", "Transactional email delivery", "Email address, name, and content of transactional emails", "EU (France)", "DPA in place; SCCs where applicable"],
              ["Google LLC (Google Analytics 4)", "Web analytics", "Anonymised usage data; IP addresses (truncated)", "USA", "SCCs; Data Processing Amendment; IP anonymisation enabled"],
              ["Microsoft Corporation (Microsoft Clarity)", "UX analytics and session recording", "Anonymised session data; masked form inputs", "USA", "SCCs; DPA in place; PII masking configured"],
              ["Sentry.io (Functional Software Inc.)", "Error monitoring and diagnostics", "Error events, stack traces, limited contextual data", "USA", "SCCs; DPA in place; PII scrubbing configured"],
              ["OpenStreetMap Foundation / Photon (Komoot GmbH)", "Geocoding service", "Address text provided by student users for location conversion", "Germany / EU", "Privacy-by-design; no account creation; no persistent retention"],
              ["Cloudflare Inc.", "CDN, DNS, and DDoS protection (planned)", "IP addresses, HTTP metadata", "Global / EU where applicable", "SCCs; DPA in place"],
              ["Render Inc.", "Static site hosting and deployment", "Build artefacts only; no personal data directly processed", "USA (AWS)", "DPA in place"],
              ["Google LLC (Firebase Cloud Messaging)", "Web push notification delivery", "Push subscription tokens; notification payload", "USA / Global", "SCCs; DPA in place"],
            ]} />
            <p style={body}>The Controller does not sell, rent, lease, or otherwise transfer personal data to third parties for the purposes of those third parties' own marketing or commercial activities. Any disclosure of personal data to third parties beyond the processors listed above will be made only in accordance with a specific legal basis and with prior notification to the affected Data Subjects where required by law.</p>
          </Section>

          <Section num="10" title="International Data Transfers">
            <p style={body}>
              The GDPR restricts the transfer of personal data to countries outside the European Economic Area ("<strong>EEA</strong>") unless adequate protections are in place pursuant to Chapter V GDPR. Several of the Controller's processors are headquartered in or operate infrastructure within the United States of America, which is not currently the subject of an adequacy decision pursuant to Article 45 GDPR in respect of all types of data transfers following the invalidation of the EU-US Privacy Shield by the Court of Justice of the European Union in <em>Data Protection Commissioner v. Facebook Ireland Limited and Maximillian Schrems</em> (Case C-311/18, "<em>Schrems II</em>").
            </p>
            <p style={body}>
              For all transfers of personal data to processors in the United States or other third countries without an applicable adequacy decision, the Controller relies on the Standard Contractual Clauses ("<strong>SCCs</strong>") adopted by the European Commission pursuant to Article 46(2)(c) GDPR (Commission Implementing Decision (EU) 2021/914 of 4 June 2021) as the appropriate safeguard. The Controller has conducted and maintains Transfer Impact Assessments ("<strong>TIAs</strong>") in respect of all significant third-country transfers to assess the effectiveness of the SCCs in light of the legal environment in the destination country. Where TIAs indicate that SCCs alone may be insufficient, the Controller has implemented supplementary technical, organisational, and contractual measures as appropriate.
            </p>
            <p style={body}>
              Data Subjects may obtain copies of the applicable SCCs and related transfer documentation by submitting a written request to <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>. The Controller will provide such documentation within 30 days of receipt of the request, subject to any necessary redaction of commercially sensitive information.
            </p>
          </Section>

          <Section num="11" title="Data Retention &amp; Erasure Schedule">
            <p style={body}>The Controller retains personal data only for as long as is necessary to fulfil the purposes for which it was collected, to comply with applicable legal obligations, and to resolve disputes and enforce agreements. The following retention schedule applies:</p>
            <FullTable headers={["Data Category", "Retention Period", "Trigger Event", "Basis for Retention", "Post-Expiry Action"]} rows={[
              ["Account data (name, email, role)", "Duration of account + 30 days", "Account deletion request or inactivity trigger", "Contract; legal obligation", "Permanent deletion"],
              ["Authentication credentials (password hash)", "Duration of account + 30 days", "Account deletion", "Contract; security", "Permanent deletion"],
              ["Student verification documents", "30 days from verification completion OR account deletion (whichever is earlier)", "Verification outcome or account deletion", "Legal obligation; legitimate interests", "Secure, certified deletion"],
              ["CV and cover letter documents", "Duration of account or until manually removed", "Account deletion or manual removal", "Consent", "Deletion from storage bucket"],
              ["Profile photographs", "Duration of account or until manually removed", "Account deletion or manual removal", "Consent", "Deletion from storage bucket"],
              ["Job application records", "12 months from application date", "Application date", "Legitimate interests", "Anonymisation then deletion"],
              ["Interview and trial scheduling data", "6 months from interview/trial date", "Scheduled date", "Legitimate interests", "Permanent deletion"],
              ["In-platform messages", "Duration of account + 90 days", "Account deletion", "Contract; legitimate interests", "Permanent deletion"],
              ["Push notification tokens", "Until revoked by user or account deletion", "Token revocation or account deletion", "Consent", "Deletion from push_subscriptions table"],
              ["Analytics data (Google Analytics, Clarity)", "26 months (GA4 default) / 90 days (Clarity)", "Data collection date", "Consent; legitimate interests", "Automatic expiry per processor retention settings"],
              ["Error logs (Sentry)", "90 days", "Error event date", "Legitimate interests", "Automatic deletion by Sentry"],
              ["Server/infrastructure logs", "30 days", "Log generation date", "Legitimate interests; legal obligation", "Automatic rotation and deletion"],
              ["Inactive accounts (no login for 24 consecutive months)", "2 years of inactivity then deleted", "Last login date", "Legitimate interests (data minimisation)", "30-day notice email then permanent deletion"],
              ["Legal hold data (where applicable)", "Duration of legal hold + 6 months", "Resolution of relevant legal matter", "Legal obligation; legitimate interests", "Review and deletion upon hold release"],
            ]} />
            <p style={body}>Where erasure of personal data is not technically feasible (for example, where data has been incorporated into backup media), the Controller will ensure that such data is pseudonymised or rendered inaccessible pending its natural deletion through scheduled backup rotation, and will not use such data for any further processing purpose.</p>
          </Section>

          <Section num="12" title="Security Measures &amp; Breach Notification">
            <p style={body}>
              The Controller implements technical and organisational measures ("<strong>TOMs</strong>") appropriate to the risk presented by its processing activities, having regard to the state of the art, the costs of implementation, and the nature, scope, context, and purposes of processing as well as the risk of varying likelihood and severity for the rights and freedoms of natural persons, as required by Article 32 GDPR. The measures implemented include but are not limited to the following:
            </p>
            <Grid cols={2}>
              {[
                ["Encryption in Transit", "All data transmitted between the user's browser or device and the Platform is encrypted using Transport Layer Security (TLS) version 1.2 or higher. The Platform enforces HTTPS on all connections and implements HTTP Strict Transport Security (HSTS)."],
                ["Password Security", "User passwords are never stored in plaintext. All passwords are hashed using industry-standard adaptive hashing algorithms (bcrypt with appropriate work factor) before storage. Password hashes are salted to prevent rainbow table attacks."],
                ["Row-Level Security (RLS)", "The Controller's database infrastructure implements Row-Level Security policies that ensure each user can only access data they are authorised to access. Database queries are scoped to the authenticated user's context."],
                ["Access Controls", "Administrative access to the Platform's data infrastructure is restricted to authorised personnel only, subject to multi-factor authentication requirements and role-based access controls. Access logs are maintained."],
                ["Verification Document Storage", "Student verification documents are stored in a private, access-controlled storage bucket with no public read access. Signed URLs with limited expiry are used for authorised access."],
                ["Data Minimisation", "The Controller collects only the minimum personal data necessary for each specified purpose. Optional data fields are clearly identified. Users may remove optional data at any time."],
                ["Pseudonymisation", "Where technically feasible, the Controller applies pseudonymisation techniques to analytics and logging data to reduce re-identification risk."],
                ["Third-Party Security Reviews", "Key infrastructure providers (Supabase, Brevo) undergo their own independent security audits and certifications (including ISO 27001 and SOC 2 Type II where applicable)."],
                ["Secure Development Practices", "The Platform is developed in accordance with secure development lifecycle principles, including dependency vulnerability scanning and code review processes."],
                ["Incident Response", "The Controller maintains an internal incident response procedure for identifying, containing, assessing, and reporting personal data breaches in accordance with Article 33 and Article 34 GDPR."],
              ].map(([measure, desc]) => (
                <div key={measure} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.65rem", padding: "0.9rem 1rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: "700", fontSize: "0.83rem", color: "var(--color-text-primary, #1e293b)" }}>{measure}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </Grid>
            <p style={{ ...body, marginTop: "1.25rem" }}>
              <strong>Data Breach Notification:</strong> In the event of a personal data breach that is likely to result in a risk to the rights and freedoms of natural persons, the Controller will notify the Data Protection Commission of Ireland without undue delay and, where feasible, within 72 hours of becoming aware of the breach, in accordance with Article 33 GDPR. Where the breach is likely to result in a high risk to the rights and freedoms of natural persons, the Controller will also notify affected Data Subjects without undue delay, in accordance with Article 34 GDPR, unless one of the exceptions provided for in Article 34(3) applies. All personal data breaches will be documented internally in accordance with Article 33(5) GDPR.
            </p>
          </Section>

          <Section num="13" title="Cookies, Tracking &amp; Analytics">
            <p style={body}>
              The Platform uses cookies and similar tracking technologies to enable core functionality, maintain authenticated sessions, and (with your consent) to analyse usage patterns. A cookie is a small text file that is stored on your device when you visit a website. Some cookies are strictly necessary for the Platform to function; others are used for analytics and can be declined without affecting core functionality.
            </p>
            <FullTable headers={["Cookie / Technology", "Type", "Purpose", "Duration", "Basis"]} rows={[
              ["Supabase Auth session token (sb-*-auth-token)", "Strictly Necessary", "Maintaining authenticated user sessions across page loads", "Session / up to 7 days (refresh token)", "Contract / Legitimate interests"],
              ["Theme preference (ss_theme)", "Functional", "Remembering the user's light/dark mode preference", "1 year", "Legitimate interests"],
              ["Cookie notice dismissed (ss_cookie_notice_dismissed)", "Functional", "Recording that the user has acknowledged the cookie notice", "1 year", "Legitimate interests"],
              ["Google Analytics 4 (_ga, _ga_*)", "Analytics", "Tracking anonymised website usage patterns (page views, session duration, navigation paths)", "2 years / 1 year", "Consent"],
              ["Microsoft Clarity (_clck, _clsk, CLID, ANONCHK, MR, MUID, SM)", "Analytics", "Session recording and heatmap generation (PII masked)", "1 day to 1 year", "Consent"],
              ["Sentry session (optional)", "Technical", "Correlating error events with sessions for diagnosis", "Session", "Legitimate interests"],
            ]} />
            <p style={body}>
              You can manage your cookie preferences through your browser settings. Most browsers allow you to refuse cookies, delete existing cookies, or configure them to warn you when a cookie is being set. Please note that disabling certain cookies may impair the functionality of the Platform. For further information on managing cookies, visit <a href="https://www.aboutcookies.org" style={linkStyle} target="_blank" rel="noopener noreferrer">www.aboutcookies.org</a>.
            </p>
          </Section>

          <Section num="14" title="Children &amp; Minors">
            <p style={body}>
              The Platform is intended for use by persons who are aged 17 years or older. The Controller does not knowingly collect, solicit, or process personal data from or in relation to any person under the age of 17 years. If the Controller becomes aware that personal data has been collected from a person under the age of 17, it will take immediate steps to delete that data from its systems. If you believe that a minor has created an account or provided personal data to the Platform without appropriate parental or guardian consent, please notify the Controller immediately at <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
            </p>
            <p style={body}>
              Notwithstanding the foregoing, persons aged 16 may be eligible to use the Platform subject to the provision of appropriate parental or guardian consent, which must be communicated to the Controller in writing prior to registration. The Controller reserves the right to request evidence of such consent and to delete any account where valid consent cannot be demonstrated.
            </p>
          </Section>

          <Section num="15" title="Legitimate Interests Assessment">
            <p style={body}>
              Where the Controller relies on the legitimate interests basis under Article 6(1)(f) GDPR, it has conducted and documented a three-part legitimate interests assessment ("<strong>LIA</strong>") for each such processing activity, comprising: (1) a purpose test (identifying a genuine legitimate interest); (2) a necessity test (confirming that the processing is necessary for that purpose and that less privacy-intrusive means are not reasonably available); and (3) a balancing test (confirming that the Controller's legitimate interests are not overridden by the interests, rights, and freedoms of the Data Subject). A summary of the key balancing considerations is set out below:
            </p>
            <p style={body}>
              <strong>Security and Fraud Prevention:</strong> The Controller has a compelling legitimate interest in maintaining the security and integrity of the Platform and protecting its users from fraudulent, abusive, or harmful activity. This interest is shared by all legitimate users of the Platform. The processing of IP addresses, session data, and behavioural signals for security purposes is technically necessary and proportionate. Data Subjects have a reasonable expectation that platforms they use will maintain appropriate security measures. The Controller considers that this interest is not overridden by the interests or fundamental rights of Data Subjects, given the minimal privacy impact of the data processed and the critical importance of platform security.
            </p>
            <p style={body}>
              <strong>Company Verification:</strong> The Controller and its student users have a legitimate interest in ensuring that only legitimate, law-abiding businesses operate on the Platform. Verification of CRO numbers against publicly available Companies Registration Office data is technically necessary and minimally privacy-intrusive. The Controller considers that this interest is not overridden by the interests of company Data Subjects, given that CRO numbers are publicly registered information.
            </p>
            <p style={body}>
              <strong>Error Monitoring (Sentry.io):</strong> The Controller has a legitimate interest in diagnosing and resolving technical errors that affect the user experience. Error monitoring is technically necessary for platform maintenance. Sentry.io is configured to minimise the collection of personal data through PII scrubbing. The Controller considers that this interest is not overridden by user privacy interests given the minimal data processed and the direct benefit to users of a stable platform.
            </p>
            <p style={body}>
              Data Subjects have the right to object to processing carried out on the basis of legitimate interests at any time, as described in Section 7 above. Upon receipt of a valid objection, the Controller will cease the relevant processing unless it can demonstrate compelling legitimate grounds that override the Data Subject's interests, rights, and freedoms.
            </p>
          </Section>

          <Section num="16" title="Consent Management">
            <p style={body}>
              Where the Controller relies on consent as the legal basis for processing, consent is obtained in accordance with Article 7 GDPR and the following requirements: (a) consent is freely given — it is not a condition of access to the core Service (except where the data is strictly necessary for the Service); (b) consent is specific — it is sought separately for each distinct processing purpose; (c) consent is informed — it is accompanied by clear information about the processing; and (d) consent is unambiguous — it is obtained through a clear affirmative action.
            </p>
            <p style={body}>
              <strong>Analytics Consent:</strong> Consent for analytics cookies (Google Analytics 4, Microsoft Clarity) is obtained through the cookie notice displayed on first visit to the Platform. Declining analytics consent does not affect access to the Platform's core functionality.
            </p>
            <p style={body}>
              <strong>Profile Data Consent:</strong> Provision of optional profile data elements (profile photograph, LinkedIn URL, CV, cover letter, location, skills, availability, job preferences) constitutes consent to the processing of that data for the purposes described in this Notice. Users may withdraw consent for any or all of these data elements at any time by removing the data from their Account settings page.
            </p>
            <p style={body}>
              <strong>Push Notification Consent:</strong> Consent for push notifications is obtained through the browser's native permission dialogue. This consent may be revoked at any time through the browser's notification settings or via the Account page.
            </p>
            <p style={body}>
              The Controller maintains records of consent in accordance with Article 7(1) GDPR. Withdrawal of consent does not affect the lawfulness of processing carried out prior to withdrawal.
            </p>
          </Section>

          <Section num="17" title="Data Minimisation &amp; Purpose Limitation">
            <p style={body}>
              The Controller is committed to the principles of data minimisation (Article 5(1)(c) GDPR) and purpose limitation (Article 5(1)(b) GDPR). Personal data is collected only to the extent that is adequate, relevant, and limited to what is necessary in relation to the specified, explicit, and legitimate purposes for which it is processed. Personal data is not processed in a manner that is incompatible with those purposes. Optional data fields are clearly identified as optional, and users are not required to provide them to access core Platform functionality.
            </p>
            <p style={body}>
              Where the Controller wishes to process personal data for a purpose other than that for which it was collected, it will assess whether the new purpose is compatible with the original purpose having regard to: (a) any link between the purposes; (b) the context in which the data was collected; (c) the nature of the personal data, in particular whether special category data is involved; (d) the possible consequences of the intended further processing for Data Subjects; and (e) the existence of appropriate safeguards. Where the further processing is incompatible with the original purpose, the Controller will obtain fresh consent or identify an alternative legal basis before proceeding.
            </p>
          </Section>

          <Section num="18" title="Accountability &amp; Governance">
            <p style={body}>
              The Controller implements the following accountability and governance measures in accordance with Article 5(2) and Chapter IV GDPR:
            </p>
            <ul style={listStyle}>
              <li><strong>Record of Processing Activities (ROPA):</strong> The Controller maintains a ROPA pursuant to Article 30 GDPR documenting all processing activities carried out by the Controller, including purposes, legal bases, data categories, recipients, transfers, and retention periods.</li>
              <li><strong>Privacy by Design and by Default:</strong> The Controller seeks to integrate data protection principles into the design and operation of the Platform from the outset, in accordance with Article 25 GDPR. By default, only the personal data necessary for each specific purpose is processed.</li>
              <li><strong>Data Protection Impact Assessments (DPIAs):</strong> The Controller conducts DPIAs pursuant to Article 35 GDPR in respect of processing activities that are likely to result in a high risk to the rights and freedoms of natural persons, including in relation to the processing of identity verification documents and the implementation of new processing activities.</li>
              <li><strong>Processor Due Diligence:</strong> The Controller conducts due diligence on all third-party processors before engagement and ensures that appropriate DPAs are in place. Processor arrangements are reviewed periodically.</li>
              <li><strong>Staff Awareness:</strong> Personnel with access to personal data are made aware of their data protection obligations and the Controller's policies and procedures.</li>
              <li><strong>Policy Review:</strong> This Notice and related data protection policies and procedures are reviewed at least annually and following any significant change to processing activities or applicable law.</li>
            </ul>
          </Section>

          <Section num="19" title="Changes to This Notice">
            <p style={body}>
              The Controller reserves the right to amend, update, or replace this Notice at any time. The Controller will notify registered users of material changes to this Notice by: (a) displaying a prominent notice on the Platform; and/or (b) sending an email notification to the email address registered to the user's account. The "Last Updated" date at the top of this Notice will be updated to reflect the date of the most recent revision. Continued use of the Platform following notification of changes constitutes acceptance of the revised Notice. Data Subjects who do not accept the revised Notice should discontinue use of the Platform and may request deletion of their account in accordance with Section 7 of this Notice.
            </p>
            <p style={body}>
              Previous versions of this Notice are available upon request by contacting <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>.
            </p>
          </Section>

          <Section num="20" title="Supervisory Authority &amp; Complaints">
            <p style={body}>
              If you are dissatisfied with how the Controller has handled your personal data or has responded to a request you have made pursuant to Section 7, you have the right to lodge a complaint with the relevant supervisory authority without prejudice to any other administrative or judicial remedy. The supervisory authority with jurisdiction over the Controller's processing activities is:
            </p>
            <Grid cols={2}>
              <InfoBox label="Supervisory Authority" value="Data Protection Commission (An Coimisiún um Chosaint Sonraí)" />
              <InfoBox label="Website" value="www.dataprotection.ie" link="https://www.dataprotection.ie" />
              <InfoBox label="Postal Address" value="21 Fitzwilliam Square South, Dublin 2, D02 RD28, Ireland" />
              <InfoBox label="Telephone" value="+353 57 868 4800" />
              <InfoBox label="Email" value="info@dataprotection.ie" />
              <InfoBox label="Online Complaint Form" value="Available via www.dataprotection.ie" link="https://www.dataprotection.ie/en/report-a-concern" />
            </Grid>
            <p style={body}>
              The Controller encourages Data Subjects to contact it directly at <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a> in the first instance, as many concerns can be resolved quickly without the need for supervisory authority involvement. The Controller is committed to engaging constructively with all complaints and to providing a substantive response within 30 calendar days.
            </p>
          </Section>

          {/* Footer */}
          <div style={{ borderTop: "2px solid var(--color-border-light, #e2e8f0)", marginTop: "2.5rem", paddingTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 0.2rem", fontWeight: "700", fontSize: "0.85rem", color: "var(--color-text-primary, #1e293b)" }}>StudentShifts — Privacy &amp; Data Protection</p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}>
                Version 3.1.0 &nbsp;·&nbsp; Last updated {LAST_UPDATED} &nbsp;·&nbsp; Jurisdiction: Republic of Ireland / EU &nbsp;·&nbsp; <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a href="/terms" style={{ ...linkStyle, fontSize: "0.82rem" }}>Terms of Service</a>
              <a href="/help" style={{ ...linkStyle, fontSize: "0.82rem" }}>Help Centre</a>
              <a href="/contact" style={{ ...linkStyle, fontSize: "0.82rem" }}>Contact Us</a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

/* ── Layout helpers ─────────────────────────────────────────────── */

function Section({ num, title, children }) {
  return (
    <div id={`section-${num}`} style={{ marginBottom: "2rem", scrollMarginTop: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.85rem" }}>
        <span style={{ flexShrink: 0, width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "var(--color-brand)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: "800" }}>{num}</span>
        <h2 style={{ margin: 0, fontWeight: "800", fontSize: "1.15rem", color: "var(--color-text-primary, #1e293b)" }} dangerouslySetInnerHTML={{ __html: title }} />
      </div>
      <Card>{children}</Card>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "0.85rem", padding: "1.5rem 1.75rem", border: "1px solid var(--color-border-light, #e2e8f0)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {children}
    </div>
  );
}

function Grid({ cols = 2, children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "0.75rem", marginBottom: "1rem" }}>
      {children}
    </div>
  );
}

function InfoBox({ label, value, link }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.5rem", padding: "0.75rem 1rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
      <p style={{ margin: "0 0 0.2rem", fontSize: "0.72rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      {link
        ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, fontSize: "0.85rem" }}>{value}</a>
        : <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "600", color: "var(--color-text-primary, #1e293b)" }}>{value}</p>
      }
    </div>
  );
}

function FullTable({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)" }}>
            {headers.map(h => (
              <th key={h} style={{ textAlign: "left", padding: "0.6rem 0.85rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", borderBottom: "2px solid var(--color-border-light, #e2e8f0)", whiteSpace: "nowrap", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid var(--color-border-light, #e2e8f0)`, backgroundColor: i % 2 === 0 ? "transparent" : "var(--color-bg-subtle, #fafafa)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "0.6rem 0.85rem", color: j === 0 ? "var(--color-text-primary, #1e293b)" : "var(--color-text-secondary, #64748b)", fontWeight: j === 0 ? "600" : "400", lineHeight: 1.5, verticalAlign: "top" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────── */
const body      = { margin: "0 0 0.85rem", fontSize: "0.88rem", color: "var(--color-text-body, #374151)", lineHeight: 1.75 };
const h3        = { margin: "1.25rem 0 0.5rem", fontWeight: "700", fontSize: "0.92rem", color: "var(--color-text-primary, #1e293b)" };
const listStyle = { paddingLeft: "1.4rem", margin: "0 0 0.85rem", fontSize: "0.88rem", color: "var(--color-text-body, #374151)", lineHeight: 1.8 };
const linkStyle = { color: "var(--color-brand)", textDecoration: "none", fontWeight: "600" };
const tocHead   = { margin: "0 0 0.75rem", fontWeight: "800", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)", textTransform: "uppercase", letterSpacing: "0.06em" };
