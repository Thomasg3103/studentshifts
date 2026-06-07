import { Helmet } from "react-helmet-async";
import BackButton from "../components/BackButton";

const CONTACT_EMAIL = "hello@studentshifts.ie";
const LEGAL_EMAIL   = "legal@studentshifts.ie";
const LAST_UPDATED  = "7 June 2026";
const EFFECTIVE     = "7 June 2026";

export default function TermsOfServicePage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — StudentShifts</title>
        <meta name="description" content="StudentShifts comprehensive terms of service governing platform use, user obligations, intellectual property, liability, and dispute resolution." />
        <link rel="canonical" href="https://studentshifts.ie/terms" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Terms of Service — StudentShifts" />
        <meta property="og:url" content="https://studentshifts.ie/terms" />
      </Helmet>
      <BackButton />

      <div style={{ width: "100%", backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", padding: "2rem 0 4rem" }}>
        {/* Header band */}
        <div style={{ background: "linear-gradient(135deg, #1e293b, #334155)", color: "white", padding: "3rem 2rem 2.5rem", marginBottom: "2.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.55)" }}>Legal Documentation</p>
            <h1 style={{ margin: "0 0 0.5rem", fontWeight: "900", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.02em" }}>Terms of Service &amp; Platform Use Agreement</h1>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.65)", fontSize: "0.85rem" }}>
              Effective date: {EFFECTIVE} &nbsp;·&nbsp; Last updated: {LAST_UPDATED} &nbsp;·&nbsp; Version 4.2.1 &nbsp;·&nbsp; Jurisdiction: Republic of Ireland / European Union
            </p>
          </div>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 2rem" }}>

          {/* TOC */}
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.75rem", padding: "1.5rem 2rem", marginBottom: "2.5rem" }}>
            <p style={tocHead}>Table of Contents</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(14, auto)", gridAutoFlow: "column", gap: "0 1.5rem" }}>
              {[
                "1. Definitions & Interpretative Provisions",
                "2. Acceptance of Terms & Binding Agreement",
                "3. Eligibility & Capacity to Contract",
                "4. Account Registration & Security Obligations",
                "5. Student Verification Requirements",
                "6. Company Verification & Approval Process",
                "7. Platform Licence & Access Rights",
                "8. Acceptable Use Policy",
                "9. Prohibited Conduct & Restrictions",
                "10. Job Postings — Company Obligations",
                "11. Job Applications — Student Obligations",
                "12. Profile Visibility & Browse Students Feature",
                "13. Messaging & Direct Communications",
                "14. Interview, Trial Shift & Hiring Process",
                "15. Reliability Scoring & Conduct Metrics",
                "16. Intellectual Property Rights",
                "17. User-Generated Content & Licence Grant",
                "18. Third-Party Services & External Links",
                "19. Privacy, Data Protection & Cookies",
                "20. Fees, Payments & Commercial Terms",
                "21. Suspension, Termination & Account Deletion",
                "22. Disclaimer of Warranties",
                "23. Limitation of Liability & Damages Cap",
                "24. Indemnification",
                "25. Force Majeure",
                "26. Severability, Waiver & Entire Agreement",
                "27. Governing Law & Jurisdiction",
                "28. Amendments to These Terms",
              ].map(item => {
                const num = item.match(/^(\d+)\./)[1];
                return (
                  <a key={item} href={`#tos-section-${num}`}
                    onClick={e => {
                      e.preventDefault();
                      document.getElementById(`tos-section-${num}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={{ display: "block", margin: "0.2rem 0", fontSize: "0.82rem", color: "var(--color-brand)", textDecoration: "none", fontWeight: "500", cursor: "pointer" }}
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
              This Terms of Service and Platform Use Agreement ("<strong>Agreement</strong>" or "<strong>Terms</strong>") constitutes a legally binding contract between you ("<strong>User</strong>", "<strong>you</strong>", or "<strong>your</strong>") and the operators of StudentShifts (hereinafter collectively referred to as "<strong>StudentShifts</strong>", "<strong>the Operator</strong>", "<strong>we</strong>", "<strong>us</strong>", or "<strong>our</strong>") governing your access to and use of the StudentShifts platform, including all associated sub-pages, APIs, mobile applications, digital interfaces, features, functionality, and content accessible at studentshifts.ie and any successor domain or sub-domain thereto (collectively, "<strong>the Platform</strong>" or "<strong>the Service</strong>").
            </p>
            <p style={body}>
              By accessing, browsing, registering for, or otherwise making any use of the Platform in any capacity whatsoever — including without limitation as a visitor, a prospective registered user, a registered student user, a registered company user, or an administrative user — you irrevocably acknowledge that you have read, understood, and agree to be legally bound by these Terms in their entirety, together with our Privacy Policy and Data Processing Notice (available at studentshifts.ie/privacy), our Cookie Policy, and any supplementary policies, notices, guidelines, or rules that may be published by us from time to time and incorporated herein by reference (collectively, the "<strong>Platform Policies</strong>"). If you do not agree to any part of these Terms or the Platform Policies, you must immediately discontinue all use of the Platform and, if you have created an account, request deletion of your account in accordance with Section 21 of these Terms.
            </p>
            <p style={body}>
              These Terms, together with the Platform Policies, constitute the entire agreement between you and StudentShifts with respect to the subject matter hereof and supersede all prior or contemporaneous communications, representations, warranties, agreements, or understandings, whether written or oral, relating to such subject matter. Nothing in these Terms shall be construed to confer any third-party beneficiary rights on any person or entity other than the parties hereto except as expressly provided. The headings and section titles in these Terms are for convenience of reference only and shall not affect the interpretation hereof. References to statutory provisions shall be construed as references to those provisions as amended, extended, or re-enacted from time to time and shall include any subordinate legislation made thereunder.
            </p>
          </Card>

          <TosSection num="1" title="Definitions &amp; Interpretative Provisions">
            <p style={body}>In these Terms, unless the context otherwise requires or a contrary intention clearly appears, the following words and expressions shall bear the meanings ascribed to them below. Words importing the singular shall include the plural and vice versa; words importing one gender shall include all genders; and references to persons shall include natural persons, legal persons, partnerships, unincorporated associations, and any other entity recognised under applicable law:</p>
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {[
                ["Platform / Service", "The StudentShifts website, application, API, and all associated interfaces, features, content, and functionality accessible at studentshifts.ie, including any mobile application or successor platform operated by the Operator."],
                ["User", "Any natural person who accesses or uses the Platform in any capacity, including without limitation as a visitor, Student User, Company User, or Administrator."],
                ["Student User", "A natural person who has registered on the Platform in the student capacity and whose account has been or is pending verification in accordance with Section 5 hereof."],
                ["Company User", "A legal or natural person who has registered on the Platform in the company capacity and whose account has been or is pending verification in accordance with Section 6 hereof."],
                ["Administrator", "A person designated by the Operator with access to administrative functions of the Platform for the purposes of verification, moderation, and platform management."],
                ["Account", "A registered user profile created on the Platform, comprising login credentials and associated profile data."],
                ["Verification", "The process by which the Operator reviews and confirms, to the Operator's reasonable satisfaction, the identity and eligibility of a Student User or the legal existence and good standing of a Company User."],
                ["Job Posting", "A listing created by a Company User on the Platform describing a position, shift, or employment opportunity available to Student Users."],
                ["Application", "The submission by a Student User of their profile, CV, and/or cover letter to a Company User in respect of a Job Posting."],
                ["Pipeline", "The multi-stage application management process through which Company Users track and progress Applications from submission through to hiring decision."],
                ["Browse Students Feature", "The functionality of the Platform that permits verified Company Users to search and view the profiles of verified Student Users who have uploaded a CV or LinkedIn URL."],
                ["Content", "Any text, images, documents, data, or other material uploaded to, created on, transmitted through, or otherwise made available via the Platform by any User."],
                ["Intellectual Property Rights", "All patents, rights to inventions, copyright and related rights, trade marks, trade names and domain names, goodwill, rights in designs, database rights, and all other intellectual property rights of any nature, in each case whether registered or unregistered."],
                ["Force Majeure Event", "Any event beyond the reasonable control of the affected party including but not limited to acts of God, natural disasters, pandemics, war, terrorism, civil disturbance, actions of governmental authorities, infrastructure failures, or prolonged internet or telecommunications outages."],
                ["Irish Law", "The law of the Republic of Ireland, including all applicable statutes, statutory instruments, regulations, directives having direct effect, and common law principles."],
                ["GDPR", "Regulation (EU) 2016/679 of the European Parliament and of the Council of 27 April 2016 on the protection of natural persons with regard to the processing of personal data."],
                ["Business Day", "Any day other than a Saturday, Sunday, or public holiday in the Republic of Ireland."],
                ["Writing", "For the purposes of these Terms, includes email communication to the addresses specified herein, unless otherwise stated."],
              ].map(([term, def]) => (
                <div key={term} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.5rem", padding: "0.85rem 1rem", borderLeft: "3px solid var(--color-brand)" }}>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: "700", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)" }}>{term}</p>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{def}</p>
                </div>
              ))}
            </div>
          </TosSection>

          <TosSection num="2" title="Acceptance of Terms &amp; Binding Agreement">
            <p style={body}>
              Your access to and use of the Platform is expressly conditioned upon your acceptance of and compliance with these Terms. These Terms apply to all Users of the Platform, including without limitation Users who are visitors (i.e., Users who do not register an account), Students, and Companies. The act of accessing the Platform, clicking an "I agree", "Sign up", "Register", or equivalent button or checkbox, or completing the registration process constitutes your full and unconditional acceptance of these Terms and the Platform Policies and creates a binding legal agreement between you and the Operator.
            </p>
            <p style={body}>
              If you are entering into these Terms on behalf of a company, organisation, or other legal entity, you represent and warrant that you have the authority to bind such entity to these Terms, in which case the terms "you" or "your" shall refer to such entity. If you do not have such authority, or if you do not agree with these Terms, you must not accept these Terms and must not access or use the Platform.
            </p>
            <p style={body}>
              The Operator reserves the right, in its absolute discretion, to refuse access to the Platform to any person or entity for any reason, including but not limited to prior breach of these Terms, suspected fraudulent activity, or any other conduct that the Operator reasonably considers to be detrimental to the Platform or its users. Such refusal shall not give rise to any cause of action, claim, or liability against the Operator.
            </p>
            <p style={body}>
              You acknowledge that these Terms may be updated periodically pursuant to Section 28 hereof and that your continued use of the Platform following the publication of any revised Terms constitutes your acceptance of such revised Terms. It is your responsibility to review these Terms periodically and to familiarise yourself with any modifications. Your sole recourse if you do not agree to any revised Terms is to discontinue use of the Platform and to request deletion of your Account.
            </p>
          </TosSection>

          <TosSection num="3" title="Eligibility &amp; Capacity to Contract">
            <p style={body}>
              In order to use the Platform, you represent, warrant, and undertake that you meet all of the following eligibility requirements at the time of registration and continuously throughout your use of the Platform. Failure to meet any of the following requirements at any time constitutes a material breach of these Terms and may result in immediate suspension or termination of your Account without notice or liability:
            </p>
            <h3 style={h3}>3.1 General Requirements (All Users)</h3>
            <ul style={listS}>
              <li>You have the legal capacity to enter into a binding contract under the laws of the Republic of Ireland and any other jurisdiction applicable to you. Persons who lack legal capacity, including without limitation by reason of age, mental incapacity, or applicable legal restrictions, are not permitted to use the Platform.</li>
              <li>You are not a person barred from receiving services under Irish law or the laws of any other applicable jurisdiction.</li>
              <li>Your use of the Platform does not violate any applicable law or regulation, including but not limited to employment law, data protection law, anti-discrimination law, and consumer protection law.</li>
              <li>All information you provide to the Platform is and will remain accurate, complete, current, and not misleading at all times.</li>
              <li>You have not previously been suspended or permanently banned from the Platform.</li>
            </ul>
            <h3 style={h3}>3.2 Student User Requirements</h3>
            <ul style={listS}>
              <li>You are currently enrolled as a student in a recognised educational institution, college, university, or further education institution located in the Republic of Ireland, Northern Ireland, or such other jurisdictions as the Operator may designate from time to time.</li>
              <li>You are legally authorised to work in the Republic of Ireland under applicable immigration, work permit, and employment legislation.</li>
              <li>You are the genuine holder of any student identification or government-issued identification document that you submit for verification purposes.</li>
              <li>You are not simultaneously registered as a Company User or Administrator on the Platform.</li>
            </ul>
            <h3 style={h3}>3.3 Company User Requirements</h3>
            <ul style={listS}>
              <li>You are a legitimately incorporated and registered business entity, sole trader, partnership, or other commercial organisation operating within the Republic of Ireland, with a valid Companies Registration Office ("<strong>CRO</strong>") registration number (where applicable) or equivalent registration.</li>
              <li>You are not subject to any formal insolvency proceedings, winding-up order, receivership, or equivalent proceeding that would affect your ability to honour commitments made to Student Users through the Platform.</li>
              <li>You have full power and authority to post job listings and to engage with Student Users through the Platform in accordance with applicable employment law, including the Employment Equality Acts 1998–2015, the Organisation of Working Time Act 1997, the National Minimum Wage Act 2000, the Protection of Young Persons (Employment) Act 1996, and all other applicable Irish employment legislation.</li>
              <li>You are not simultaneously registered as a Student User on the Platform.</li>
            </ul>
          </TosSection>

          <TosSection num="4" title="Account Registration &amp; Security Obligations">
            <p style={body}>
              In order to access certain features of the Platform, you are required to register and create an Account. By creating an Account, you agree to the following obligations, which are continuing obligations for so long as your Account remains active:
            </p>
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
              {[
                ["Accurate Information", "You must provide accurate, current, complete, and truthful information at the time of registration and must promptly update such information whenever it changes. You must not impersonate any other person or entity or use a false identity, false email address, or false name."],
                ["Single Account Rule", "Each natural person or legal entity is permitted to maintain only one Account on the Platform. The creation of duplicate, multiple, or secondary Accounts for the purpose of circumventing these Terms, any suspension, or any restriction is expressly prohibited and constitutes a material breach of these Terms."],
                ["Credential Security", "You are solely responsible for maintaining the confidentiality and security of your Account login credentials, including your email address and password. You must not share your credentials with any other person or entity and must not permit any other person or entity to access the Platform through your Account."],
                ["Notification of Breach", "You must notify the Operator immediately upon becoming aware of or suspecting any unauthorised access to your Account, any disclosure of your credentials, or any other actual or suspected breach of Account security, by contacting us at " + CONTACT_EMAIL + "."],
                ["Responsibility for Account Activity", "You are fully and solely responsible for all activity that occurs under your Account, whether or not authorised by you. The Operator shall have no liability for any loss, damage, or harm arising from any use of your Account by a third party, whether with or without your knowledge or consent."],
                ["No Transfer", "Your Account is personal to you and may not be transferred, assigned, sold, gifted, or otherwise disposed of to any other person or entity. Any purported transfer shall be void and of no effect."],
                ["Email Verification", "You are required to verify your email address following registration before accessing the full functionality of the Platform. The Operator reserves the right to restrict access to unverified accounts."],
              ].map(([term, def]) => (
                <div key={term} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.5rem", padding: "0.85rem 1rem", borderLeft: "3px solid var(--color-brand)" }}>
                  <p style={{ margin: "0 0 0.25rem", fontWeight: "700", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)" }}>{term}</p>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{def}</p>
                </div>
              ))}
            </div>
            <p style={body}>
              The Operator reserves the right to reclaim usernames, email addresses, or account identifiers that are inactive, unused, abandoned, or in violation of these Terms, without any obligation to provide notice or compensation to the affected Account holder.
            </p>
          </TosSection>

          <TosSection num="5" title="Student Verification Requirements">
            <p style={body}>
              In order to apply for Job Postings on the Platform, Student Users must successfully complete the verification process ("<strong>Verification</strong>"). The Verification process is designed to protect the integrity of the Platform and to ensure that Company Users can engage with genuine, qualified student candidates. The following provisions govern the Verification process:
            </p>
            <h3 style={h3}>5.1 Required Documentation</h3>
            <p style={body}>Student Users must submit, through the designated secure upload mechanism on the Platform, all of the following documents:</p>
            <ul style={listS}>
              <li>A valid, current student identification card issued by your enrolled educational institution, clearly displaying your full name, photograph, institution name, and where applicable, your student identification number and/or academic year or course.</li>
              <li>A valid, current government-issued photographic identification document, being one of the following: (a) a passport issued by any national authority; (b) a national identity card issued by a member state of the European Economic Area; (c) a driving licence issued by the Road Safety Authority of Ireland or an equivalent authority in any other jurisdiction; or (d) such other form of government-issued photographic identification as the Operator may designate from time to time.</li>
            </ul>
            <h3 style={h3}>5.2 Representations & Warranties Regarding Documentation</h3>
            <p style={body}>By submitting documentation for Verification purposes, you irrevocably represent and warrant to the Operator that:</p>
            <ul style={listS}>
              <li>All documents submitted are genuine, authentic, unaltered, and unmodified and have not been tampered with in any way.</li>
              <li>All documents are currently valid and have not expired as of the date of submission.</li>
              <li>You are the genuine and lawful holder of all documents submitted and the documents accurately identify you.</li>
              <li>The submission of such documents does not violate any applicable law or the rights of any third party.</li>
              <li>You consent to the Operator storing and processing such documents for the purpose of Verification in accordance with the Privacy Policy.</li>
            </ul>
            <h3 style={h3}>5.3 Verification Outcomes & Consequences</h3>
            <ul style={listS}>
              <li>The Operator shall review submitted documentation and shall notify you of the Verification outcome by email.</li>
              <li>The Operator reserves the right to reject Verification applications where documents are unclear, expired, incomplete, inconsistent, or where the Operator has any reasonable grounds to suspect that the documents are not genuine.</li>
              <li>Until your Account is verified, you may browse the Platform but may not submit Applications for Job Postings.</li>
              <li>Submitting false, fraudulent, altered, or misleading documents constitutes a serious criminal offence and a material breach of these Terms and will result in immediate and permanent termination of your Account, reporting of the matter to the relevant authorities (including An Garda Síochána where appropriate), and such other remedies as may be available to the Operator at law or in equity.</li>
              <li>The Operator may, in its absolute discretion and without any obligation to provide reasons, request additional documentation or information from any Student User as part of the Verification process or at any subsequent time.</li>
            </ul>
          </TosSection>

          <TosSection num="6" title="Company Verification &amp; Approval Process">
            <p style={body}>
              Company Users must complete the Operator's company approval process before being granted full access to the Platform's company-side features, including the ability to post Job Listings and access student profiles. The following provisions govern the company approval process:
            </p>
            <ul style={listS}>
              <li>Company Users must provide their full legal company name, CRO registration number (or equivalent registration identifier), primary contact email address, company website URL (where available), and industry sector(s) of operation, together with such other information as the Operator may require from time to time.</li>
              <li>The Operator shall cross-reference submitted company information against publicly available records maintained by the Companies Registration Office of Ireland and such other sources as the Operator deems appropriate, including but not limited to the Revenue Commissioners and the Charities Regulator.</li>
              <li>The Operator reserves the right to refuse approval to any company for any reason, including where the Operator has reasonable grounds to believe that the company is not a legitimate business, is engaged in unlawful activity, has been the subject of regulatory sanction, or presents a risk to the safety or wellbeing of Student Users.</li>
              <li>Company Users represent and warrant that they are and will at all times remain in compliance with all applicable employment laws, including but not limited to the Employment Equality Acts 1998–2015, the Organisation of Working Time Act 1997, the National Minimum Wage Act 2000 (as amended by the National Minimum Wage (Amendment) Act 2015), the Protection of Young Persons (Employment) Act 1996, the Unfair Dismissals Acts 1977–2015, the Redundancy Payments Acts 1967–2014, the Terms of Employment (Information) Acts 1994–2014, and all applicable health and safety legislation.</li>
              <li>Approval of a Company User does not constitute any endorsement, recommendation, or validation by the Operator of the Company User's business, products, services, or conduct.</li>
            </ul>
          </TosSection>

          <TosSection num="7" title="Platform Licence &amp; Access Rights">
            <p style={body}>
              Subject to your full and ongoing compliance with these Terms and the Platform Policies, the Operator hereby grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Platform solely for its intended purposes as described herein and in accordance with these Terms. This licence does not include any right to:
            </p>
            <ul style={listS}>
              <li>Resell, sublicense, or otherwise commercially exploit the Platform or any content thereon;</li>
              <li>Copy, reproduce, duplicate, distribute, or publicly display any portion of the Platform (other than as expressly permitted by these Terms);</li>
              <li>Modify, adapt, translate, create derivative works of, disassemble, decompile, or reverse engineer any portion of the Platform;</li>
              <li>Use any data mining, robots, spiders, scrapers, or other automated means to access the Platform or collect data therefrom without the Operator's prior written consent;</li>
              <li>Frame or mirror any part of the Platform without the Operator's prior written consent;</li>
              <li>Use the Platform for any purpose other than its intended purpose as a job matching service connecting students and companies;</li>
              <li>Systematically retrieve data or other content from the Platform to create or compile, directly or indirectly, any collection, compilation, database, or directory.</li>
            </ul>
            <p style={body}>
              The Operator reserves the right to modify, suspend, discontinue, or restrict access to the Platform or any part thereof at any time, with or without notice, and without any liability to you. The Operator may implement technical or other measures to prevent violations of this Section, and you agree not to circumvent, disable, or otherwise interfere with any such measures.
            </p>
          </TosSection>

          <TosSection num="8" title="Acceptable Use Policy">
            <p style={body}>
              Your use of the Platform is subject to the following acceptable use standards, which are in addition to and not in derogation of any other restrictions set out in these Terms. You agree to use the Platform only in a manner that is lawful, professional, and consistent with the purposes for which it is designed. Without limitation, you agree that at all times:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              {[
                ["Lawfulness", "All your actions on the Platform comply with applicable Irish law, EU law, and any other law applicable to you, including employment law, data protection law, criminal law, and intellectual property law."],
                ["Accuracy", "All information, data, documents, and content you provide or upload to the Platform is and remains accurate, truthful, complete, and not misleading or deceptive."],
                ["Professionalism", "All communications made through the Platform's messaging feature are professional, courteous, respectful, and relevant to legitimate employment matters."],
                ["Integrity", "You do not attempt to manipulate, circumvent, or subvert any Platform feature, algorithm, scoring system, verification process, or application management system."],
                ["Respect for Others", "You do not harass, intimidate, discriminate against, defame, abuse, threaten, stalk, or otherwise harm any other User of the Platform."],
                ["Non-Commercial Spam", "You do not use the Platform's messaging or any other communication feature to send unsolicited promotional material, commercial solicitations, or communications unrelated to the employment purposes of the Platform."],
                ["Security", "You do not attempt to probe, scan, test, or breach the security of the Platform or any connected systems, and you report any security vulnerabilities you discover to the Operator promptly and in good faith."],
                ["Compliance", "You comply with all requests made by the Operator in connection with the enforcement of these Terms and the Platform Policies."],
              ].map(([term, def]) => (
                <div key={term} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.65rem", padding: "0.9rem 1rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: "700", fontSize: "0.83rem", color: "var(--color-text-primary, #1e293b)" }}>{term}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{def}</p>
                </div>
              ))}
            </div>
          </TosSection>

          <TosSection num="9" title="Prohibited Conduct &amp; Restrictions">
            <p style={body}>
              Without limiting the generality of Section 8, the following conduct is expressly prohibited and constitutes a material breach of these Terms. The Operator reserves the right to take immediate action, including without limitation suspension or termination of your Account, removal of Content, and/or referral to the appropriate authorities, upon becoming aware of any of the following:
            </p>
            <ul style={listS}>
              <li>Uploading, posting, transmitting, or otherwise making available any Content that is unlawful, harmful, threatening, abusive, harassing, tortious, defamatory, obscene, libellous, invasive of another's privacy, hateful, or racially, ethnically, or otherwise objectionable;</li>
              <li>Impersonating any person or entity, including without limitation any Operator employee, Administrator, or other User, or falsely stating or otherwise misrepresenting your affiliation with a person or entity;</li>
              <li>Forging headers or otherwise manipulating identifiers in order to disguise the origin of any Content transmitted through the Platform;</li>
              <li>Uploading any Content that you do not have a right to transmit under any law or under contractual or fiduciary relationships;</li>
              <li>Uploading any Content that infringes any patent, trade mark, trade secret, copyright, or other proprietary rights of any party;</li>
              <li>Uploading any unsolicited or unauthorised advertising, promotional materials, junk mail, spam, chain letters, pyramid schemes, or any other form of solicitation;</li>
              <li>Uploading any material that contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the functionality of any computer software or hardware or telecommunications equipment;</li>
              <li>Interfering with or disrupting the Platform or servers or networks connected to the Platform, or disobeying any requirements, procedures, policies, or regulations of networks connected to the Platform;</li>
              <li>Intentionally or unintentionally violating any applicable local, national, or international law or regulation;</li>
              <li>Collecting or storing personal data about other Users without their express consent and in contravention of the GDPR;</li>
              <li>Offering, soliciting, or accepting any form of payment, gift, or consideration outside the Platform in exchange for positive reviews, ratings, or actions on the Platform;</li>
              <li>Using the Platform in any manner that could damage, disable, overburden, or impair the Platform or interfere with any other party's use and enjoyment of the Platform;</li>
              <li>Accessing or attempting to access any Account, computer system, or network connected to the Platform through hacking, password mining, or any other unauthorised means;</li>
              <li>Obtaining or attempting to obtain any materials or information through any means not intentionally made available or provided by the Operator;</li>
              <li>Discriminating against any Student User on grounds of gender, civil status, family status, sexual orientation, religion, age, disability, race, colour, nationality, national or ethnic origin, membership of the Traveller community, or any other ground prohibited under the Employment Equality Acts 1998–2015 or any other applicable anti-discrimination legislation.</li>
            </ul>
          </TosSection>

          <TosSection num="10" title="Job Postings — Company Obligations">
            <p style={body}>
              Company Users who post Job Postings on the Platform accept full and sole responsibility for the content, accuracy, legality, and compliance of such Job Postings and for all commitments made to Student Users through the Platform. By submitting a Job Posting, Company Users represent, warrant, and agree to the following:
            </p>
            <ul style={listS}>
              <li>The Job Posting accurately and completely describes the role, location, hours, rate of pay, required skills, and any other material terms of the employment or engagement being offered, and does not contain any false, misleading, or deceptive statements.</li>
              <li>The role described in the Job Posting exists and is genuinely available for the period specified in the posting, and you have the intention and ability to fill the role.</li>
              <li>The rate of pay specified in the Job Posting complies with the National Minimum Wage Act 2000 (as amended) and any applicable sectoral employment orders or registered employment agreements.</li>
              <li>The Job Posting does not discriminate, either directly or indirectly, on any ground prohibited by the Employment Equality Acts 1998–2015 or any other applicable Irish or EU anti-discrimination legislation.</li>
              <li>The role described does not require or involve any activity that is unlawful, dangerous, or contrary to public policy.</li>
              <li>You will respond in a timely and professional manner to all Applications received through the Platform and will update Application statuses promptly to avoid misleading Applicants as to the status of their candidacy.</li>
              <li>Where a Student User is offered and accepts a position through the Platform, you will honour that commitment and will comply with all applicable legal requirements in relation to the employment or engagement, including the provision of a contract of employment or written statement of employment particulars as required by the Terms of Employment (Information) Acts 1994–2014.</li>
              <li>You acknowledge that the Operator reserves the right to remove any Job Posting that, in the Operator's reasonable opinion, violates these Terms, any applicable law, or is otherwise unsuitable for the Platform, without any obligation to provide prior notice or compensation to the Company User.</li>
            </ul>
            <FullTable headers={["Obligation", "Applicable Legislation", "Consequence of Non-Compliance"]} rows={[
              ["Minimum wage compliance", "National Minimum Wage Act 2000 (as amended)", "Account suspension; referral to Workplace Relations Commission"],
              ["Non-discrimination in job postings", "Employment Equality Acts 1998–2015", "Immediate removal of posting; account termination"],
              ["Working time compliance", "Organisation of Working Time Act 1997", "Removal of posting; regulatory referral"],
              ["Youth employment restrictions", "Protection of Young Persons (Employment) Act 1996", "Immediate removal; potential criminal referral"],
              ["Accurate job description", "Consumer Protection Act 2007 (by analogy)", "Removal of posting; account suspension"],
            ]} />
          </TosSection>

          <TosSection num="11" title="Job Applications — Student Obligations">
            <p style={body}>
              By submitting an Application through the Platform, Student Users agree to the following terms and obligations, which are in addition to and not in derogation of the general obligations set out elsewhere in these Terms:
            </p>
            <ul style={listS}>
              <li>All information contained in your Application, including without limitation your name, contact details, employment history, educational qualifications, skills, and any other information contained in your CV, cover letter, or profile, is accurate, complete, current, and not misleading.</li>
              <li>You consent to your profile information, CV, and cover letter being disclosed to the Company User to whom you are applying, for the purpose of the Application and any subsequent recruitment process.</li>
              <li>You will respond to communications from Company Users regarding your Application in a timely and professional manner.</li>
              <li>If you accept an offer of employment or engagement made through the Platform, you will honour that commitment and will communicate any change of circumstances to the relevant Company User as soon as reasonably practicable.</li>
              <li>You will not submit Applications in a speculative or indiscriminate manner, or submit Applications for roles for which you are materially unqualified or which you have no genuine intention of accepting.</li>
              <li>You acknowledge that the submission of an Application does not guarantee any interview, offer of employment, or employment outcome, and that the Operator provides no warranty as to the quality, lawfulness, or suitability of any Job Posting or any Company User.</li>
              <li>Where you withdraw from an Application after acceptance or at a late stage of the recruitment process without reasonable cause, the Operator may record this as a withdrawal event which may affect your Reliability Score as described in Section 15.</li>
            </ul>
          </TosSection>

          <TosSection num="12" title="Profile Visibility &amp; Browse Students Feature">
            <p style={body}>
              The Platform includes a Browse Students feature that enables verified Company Users to search and view the profiles of verified Student Users. The following provisions govern the Browse Students feature and Student User profile visibility:
            </p>
            <ul style={listS}>
              <li><strong>Consent to Visibility:</strong> By uploading a CV or LinkedIn URL to your profile, you expressly consent to verified Company Users being able to view that information through the Browse Students feature, irrespective of whether you have applied to any Job Posting by that Company User. You may withdraw this consent at any time by removing your CV and LinkedIn URL from your profile via the Account page, whereupon your profile will no longer appear in Browse Students searches.</li>
              <li><strong>Scope of Visibility:</strong> Company Users accessing the Browse Students feature may view your publicly displayed profile information, including your name, profile photograph (where uploaded), skills, job preferences, availability, location (at the level of precision you have specified), experience level, and CV and LinkedIn URL (where uploaded).</li>
              <li><strong>Company Limitations:</strong> Company Users may not use information accessed through the Browse Students feature for any purpose other than assessing your suitability for legitimate employment opportunities available through the Platform. Company Users may not export, copy, or store your profile information outside the Platform, and may not contact you through means other than the Platform's messaging feature in relation to opportunities discovered through the Browse Students feature.</li>
              <li><strong>No Guarantee of Opportunity:</strong> The fact that a Company User views your profile through the Browse Students feature does not create any obligation on that Company User to contact you or offer you employment.</li>
              <li><strong>Right to Restrict:</strong> The Operator reserves the right to restrict the Browse Students feature at any time, including without limitation to protect Student User privacy or to comply with applicable data protection obligations.</li>
            </ul>
          </TosSection>

          <TosSection num="13" title="Messaging &amp; Direct Communications">
            <p style={body}>
              The Platform provides an in-platform messaging feature through which verified Company Users and Student Users may communicate in connection with employment opportunities. The following provisions govern the use of the messaging feature:
            </p>
            <ul style={listS}>
              <li><strong>Eligibility to Message:</strong> The messaging feature is available to: (a) Student Users whose Applications have been accepted to the shortlisted stage or beyond by a Company User; and (b) verified Student Users who have been directly contacted by a Company User through the Browse Students feature or otherwise through the Platform.</li>
              <li><strong>Consent to Direct Contact:</strong> By creating and maintaining a verified Student Account on the Platform, you irrevocably acknowledge and agree that registered and verified Company Users may initiate direct contact with you through the Platform's messaging feature in connection with employment opportunities, without you having first applied to a Job Posting by that Company User. This consent is inherent in the use of the Platform as a matching service.</li>
              <li><strong>Content Restrictions:</strong> All messages transmitted through the Platform's messaging feature must: (a) be professional, courteous, and relevant to legitimate employment matters; (b) not constitute harassment, discrimination, or abuse; (c) not contain unsolicited promotional material or spam; (d) not contain any content that would violate Section 9 of these Terms; and (e) comply with all applicable laws.</li>
              <li><strong>No Privacy of Unlawful Communications:</strong> While the Operator does not routinely monitor the content of messages, the Operator reserves the right to review messages in response to a reported breach of these Terms, and to disclose message content to the appropriate authorities where required by law or where the Operator reasonably believes that messages contain evidence of criminal conduct or a serious breach of these Terms.</li>
              <li><strong>Reporting Mechanism:</strong> Users who receive messages that they believe violate these Terms are encouraged to report such messages to the Operator at <a href={`mailto:${CONTACT_EMAIL}`} style={lnk}>{CONTACT_EMAIL}</a>. The Operator will investigate all credible reports and will take appropriate action, which may include removal of messages and suspension or termination of the offending User's Account.</li>
              <li><strong>No Retention Guarantee:</strong> Messages stored on the Platform are subject to the data retention schedule set out in the Privacy Policy and may be deleted after the applicable retention period. Users should not rely on the Platform as a permanent archive of their communications.</li>
            </ul>
          </TosSection>

          <TosSection num="14" title="Interview, Trial Shift &amp; Hiring Process">
            <p style={body}>
              The Platform facilitates the coordination of interviews, trial shifts, and hiring decisions between Company Users and Student Users. The following provisions govern this process:
            </p>
            <ul style={listS}>
              <li><strong>Interview Scheduling:</strong> Company Users may invite shortlisted Student Users to interviews through the Platform. Student Users must respond to interview invitations in a timely manner. Repeated failure to respond to or attend scheduled interviews without reasonable notice may affect a Student User's Reliability Score as described in Section 15.</li>
              <li><strong>Trial Shifts:</strong> Company Users may invite Student Users to trial shifts as part of the recruitment process. Trial shifts must comply with applicable employment legislation, including the requirement to pay at least the national minimum wage for all hours worked. A trial shift does not create an employment relationship between the Student User and the Company User, unless and until a formal offer of employment is made and accepted.</li>
              <li><strong>Hiring Decisions:</strong> All hiring decisions are made exclusively by Company Users in their absolute discretion. The Operator does not participate in, influence, or guarantee any hiring outcome. Company Users must ensure that hiring decisions comply with the Employment Equality Acts 1998–2015 and are based on objective, non-discriminatory criteria.</li>
              <li><strong>Post-Hire Obligations:</strong> Following a hiring decision, the Company User and the Student User are responsible for completing the necessary employment formalities directly, including the execution of a contract of employment or written statement of particulars. The Operator is not a party to any employment contract and assumes no liability in respect of the employment relationship.</li>
              <li><strong>Cancellations:</strong> Where a Company User cancels a confirmed interview or trial shift without reasonable notice or justification, the Operator reserves the right to take action against the Company User's Account, including issuing a warning or restricting posting privileges.</li>
            </ul>
          </TosSection>

          <TosSection num="15" title="Reliability Scoring &amp; Conduct Metrics">
            <p style={body}>
              The Platform calculates an indicative reliability score ("<strong>Reliability Score</strong>") for Student Users based on their platform conduct and history. The following disclosures are made in the interests of transparency:
            </p>
            <ul style={listS}>
              <li>The Reliability Score is calculated automatically based on factors including but not limited to: the number of applications submitted; the number of applications withdrawn; the number of interviews accepted and attended; the number of trial shifts completed; and the ratio of positive hiring outcomes to total applications.</li>
              <li>The Reliability Score is visible to Company Users as a supplementary indicator when reviewing Student User profiles and Applications. It is intended to assist Company Users in assessing the likely reliability and professionalism of a candidate and does not constitute a binding representation by the Operator as to the quality or suitability of any candidate.</li>
              <li>The Reliability Score does not constitute a sole basis for any automated decision-making within the meaning of Article 22 GDPR. All hiring decisions are made by human Company Users based on their own assessment of all relevant information.</li>
              <li>Student Users may view their own Reliability Score via the Account page. Where a Student User believes that their Reliability Score is inaccurate or has been adversely affected by circumstances beyond their control, they may submit a written request for review to <a href={`mailto:${CONTACT_EMAIL}`} style={lnk}>{CONTACT_EMAIL}</a>.</li>
              <li>The Operator reserves the right to modify the factors, weighting, and calculation methodology of the Reliability Score at any time without notice. The Operator makes no representations as to the accuracy, completeness, or predictive value of the Reliability Score.</li>
            </ul>
          </TosSection>

          <TosSection num="16" title="Intellectual Property Rights">
            <p style={body}>
              The Platform and all of its content, features, and functionality — including without limitation all text, graphics, logos, button icons, images, audio clips, digital downloads, data compilations, software, and the compilation thereof — are and shall remain the exclusive property of the Operator and/or its licensors and are protected by Irish and international copyright law, trade mark law, patent law, database right, and such other intellectual property laws as may be applicable. The StudentShifts name, logo, trade marks, and service marks are the property of the Operator and may not be used without the prior written permission of the Operator in any case.
            </p>
            <p style={body}>
              Nothing in these Terms shall be construed as transferring, assigning, or otherwise conveying to you any right, title, or interest in or to the Operator's Intellectual Property Rights, except for the limited licence expressly granted to you in Section 7 of these Terms. All rights not expressly granted herein are reserved by the Operator.
            </p>
            <p style={body}>
              If you believe that any Content on the Platform infringes your copyright or other intellectual property rights, please notify the Operator in writing at <a href={`mailto:${LEGAL_EMAIL}`} style={lnk}>{LEGAL_EMAIL}</a>, providing full particulars of the alleged infringement, including a description of the copyrighted work, the location of the infringing material on the Platform, your contact information, and a statement of good faith belief that the use is not authorised. The Operator will investigate all credible complaints and will take appropriate action, which may include removal of the allegedly infringing content pending investigation.
            </p>
          </TosSection>

          <TosSection num="17" title="User-Generated Content &amp; Licence Grant">
            <p style={body}>
              The Platform permits Users to upload, post, or otherwise submit certain Content, including without limitation profile information, CVs, cover letters, profile photographs, job descriptions, company biographies, and in-platform messages ("<strong>User Content</strong>"). The following provisions apply to all User Content:
            </p>
            <ul style={listS}>
              <li><strong>Ownership:</strong> You retain ownership of your User Content. However, by submitting, posting, or uploading User Content to the Platform, you grant the Operator a worldwide, non-exclusive, royalty-free, sublicensable, irrevocable licence to use, reproduce, modify, adapt, publish, translate, distribute, and display such User Content solely to the extent necessary to operate, provide, improve, and promote the Platform and the Service. This licence terminates upon deletion of your Account and the associated User Content, subject to the data retention provisions of the Privacy Policy.</li>
              <li><strong>Representations & Warranties:</strong> You represent and warrant that: (a) you own all rights in your User Content or have obtained all necessary licences, permissions, and consents to grant the licence above; (b) your User Content does not infringe the Intellectual Property Rights of any third party; (c) your User Content does not contain any personal data of any third party without that third party's valid consent; and (d) your User Content complies with all applicable laws and these Terms.</li>
              <li><strong>No Endorsement:</strong> The Operator does not endorse, verify, or vouch for the accuracy or completeness of any User Content. You acknowledge that you may be exposed to User Content that is inaccurate, offensive, or otherwise objectionable, and you waive any legal or equitable rights or remedies you have or may have against the Operator with respect to such User Content to the maximum extent permitted by law.</li>
              <li><strong>Right to Remove:</strong> The Operator reserves the right, in its sole and absolute discretion and without prior notice, to review, monitor, edit, refuse, or remove any User Content that violates these Terms, the Platform Policies, or applicable law, or that the Operator otherwise finds objectionable.</li>
            </ul>
          </TosSection>

          <TosSection num="18" title="Third-Party Services &amp; External Links">
            <p style={body}>
              The Platform may contain hyperlinks to third-party websites, services, and resources that are not owned or controlled by the Operator. The Operator has no control over and assumes no responsibility for the content, privacy policies, practices, or terms of service of any third-party websites or services. The inclusion of any hyperlink on the Platform does not imply endorsement, sponsorship, or recommendation of the linked website or service by the Operator. You access third-party websites and services entirely at your own risk and subject to the terms and conditions of use for such websites and services.
            </p>
            <p style={body}>
              The Platform may also integrate with or rely on certain third-party service providers for the delivery of functionality, including without limitation Supabase (database and authentication infrastructure), Brevo (transactional email), Google Analytics 4 (web analytics), Microsoft Clarity (UX analytics), Sentry.io (error monitoring), and Firebase Cloud Messaging (push notifications). Your use of such integrated third-party services is subject to the respective terms of service and privacy policies of those providers, which are available on their respective websites. The Operator makes no representations as to the security, reliability, or availability of any third-party service and shall not be liable for any failure, outage, data breach, or other issue attributable to a third-party service provider.
            </p>
          </TosSection>

          <TosSection num="19" title="Privacy, Data Protection &amp; Cookies">
            <p style={body}>
              Your use of the Platform is subject to the Operator's Privacy Policy and Data Processing Notice, which is incorporated into these Terms by reference and forms an integral part of the agreement between you and the Operator. The Privacy Policy sets out how the Operator collects, processes, stores, and transfers your personal data, your rights as a data subject under the GDPR, and the Operator's obligations as data controller. You should read the Privacy Policy carefully before using the Platform. The Privacy Policy is available at <a href="/privacy" style={lnk}>studentshifts.ie/privacy</a>.
            </p>
            <p style={body}>
              The Platform uses cookies and similar tracking technologies. By continuing to use the Platform after being presented with the cookie notice, you consent to the use of non-essential cookies in accordance with the cookie notice and the Privacy Policy. You may withdraw your consent to non-essential cookies at any time by adjusting your browser settings; however, some features of the Platform may not function correctly if certain cookies are disabled. Strictly necessary cookies cannot be disabled without significantly impairing Platform functionality.
            </p>
          </TosSection>

          <TosSection num="20" title="Fees, Payments &amp; Commercial Terms">
            <p style={body}>
              The Platform is currently provided to both Student Users and Company Users free of charge. The Operator reserves the right, in its sole discretion, to introduce fees for access to certain features, tiers, or functionality of the Platform at any time, subject to providing reasonable advance notice to affected Users. The following provisions apply in respect of any fees that may be introduced in the future:
            </p>
            <ul style={listS}>
              <li>Any fees introduced will be clearly communicated to Users in advance of implementation, and Users will be provided with the opportunity to discontinue use of the Platform before any fees become payable.</li>
              <li>Where fees are introduced, all quoted prices will be inclusive of applicable Irish and EU VAT unless otherwise stated.</li>
              <li>The Operator reserves the right to offer promotional, discounted, or free access to certain features at its discretion, and any such offer shall be subject to such terms and conditions as the Operator may specify at the time of the offer.</li>
              <li>No refunds shall be payable in respect of any fees paid, except as required by applicable Irish consumer protection law or as otherwise expressly agreed in writing by the Operator.</li>
            </ul>
          </TosSection>

          <TosSection num="21" title="Suspension, Termination &amp; Account Deletion">
            <p style={body}>
              The following provisions govern suspension, termination, and deletion of Accounts on the Platform:
            </p>
            <h3 style={h3}>21.1 Termination by the Operator</h3>
            <p style={body}>
              The Operator may, in its sole and absolute discretion and without prior notice, immediately suspend, restrict, or permanently terminate your access to the Platform and/or your Account if: (a) you breach any provision of these Terms or the Platform Policies in any material respect; (b) you submit fraudulent, false, or misleading information or documents; (c) your conduct is harmful, abusive, or threatening to any other User or to the Operator; (d) you engage in any activity that may expose the Operator to legal liability; (e) the Operator is required to do so by applicable law or a competent authority; or (f) the Operator, in its reasonable opinion, considers that your continued use of the Platform is contrary to the interests of the Platform or its users.
            </p>
            <h3 style={h3}>21.2 Termination by the User</h3>
            <p style={body}>
              You may terminate your Account at any time by using the account deletion function available on the Account page of the Platform. Upon submission of an account deletion request, the Operator will initiate the deletion process within the timescale specified in the Privacy Policy. Certain data may be retained for limited periods following account deletion in accordance with the Operator's legal obligations and the data retention schedule set out in the Privacy Policy.
            </p>
            <h3 style={h3}>21.3 Consequences of Termination</h3>
            <ul style={listS}>
              <li>Upon termination of your Account for any reason, your right to access and use the Platform immediately ceases. Any pending Applications or Job Postings associated with your Account will be archived or removed.</li>
              <li>Termination of your Account does not affect any rights or obligations that accrued prior to the date of termination, and all provisions of these Terms which by their nature should survive termination shall so survive, including without limitation Sections 16 (Intellectual Property Rights), 17 (User-Generated Content), 22 (Disclaimer of Warranties), 23 (Limitation of Liability), 24 (Indemnification), and 27 (Governing Law and Jurisdiction).</li>
              <li>The Operator shall not be liable to you or any third party for any termination of your access to the Platform.</li>
            </ul>
          </TosSection>

          <TosSection num="22" title="Disclaimer of Warranties">
            <p style={body}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE IRISH AND EU LAW, THE PLATFORM IS PROVIDED ON AN "<strong>AS IS</strong>" AND "<strong>AS AVAILABLE</strong>" BASIS WITHOUT ANY REPRESENTATION, WARRANTY, OR CONDITION OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. THE OPERATOR EXPRESSLY DISCLAIMS, TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALL REPRESENTATIONS, WARRANTIES, AND CONDITIONS, INCLUDING WITHOUT LIMITATION:
            </p>
            <ul style={listS}>
              <li>Any implied warranty of merchantability, satisfactory quality, fitness for a particular purpose, non-infringement, title, or quiet enjoyment;</li>
              <li>Any warranty that the Platform will meet your requirements or that access thereto will be uninterrupted, timely, secure, or error-free;</li>
              <li>Any warranty as to the accuracy, completeness, currency, or reliability of any Content on the Platform, including without limitation any Job Postings, User Content, or information provided by Company Users or Student Users;</li>
              <li>Any warranty that defects in the Platform will be corrected;</li>
              <li>Any warranty that the Platform or the servers that make it available are free of viruses, worms, trojan horses, malware, or other harmful code;</li>
              <li>Any warranty as to the outcome of any Application, interview process, or hiring decision facilitated through the Platform.</li>
            </ul>
            <p style={body}>
              Nothing in these Terms excludes or limits the Operator's liability for: (a) death or personal injury caused by the Operator's negligence; (b) fraud or fraudulent misrepresentation; or (c) any other matter in respect of which liability cannot be excluded or restricted by law. The above disclaimer does not affect your statutory rights as a consumer under the Consumer Rights Act 2022 or any other applicable Irish consumer protection legislation.
            </p>
          </TosSection>

          <TosSection num="23" title="Limitation of Liability &amp; Damages Cap">
            <p style={body}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE IRISH AND EU LAW, IN NO EVENT SHALL THE OPERATOR, ITS DIRECTORS, EMPLOYEES, OFFICERS, AGENTS, CONTRACTORS, LICENSORS, OR SERVICE PROVIDERS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY OF THE FOLLOWING, WHETHER BASED ON CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL OR EQUITABLE THEORY, AND WHETHER OR NOT THE OPERATOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
              {[
                ["Loss of Profits", "Any loss of actual or anticipated profits, revenue, business, contracts, goodwill, or savings."],
                ["Consequential Loss", "Any indirect, incidental, special, exemplary, punitive, or consequential loss or damage of any kind."],
                ["Data Loss", "Any loss, corruption, or unauthorised access to data, including User Content stored on the Platform."],
                ["Opportunity Loss", "Any loss of job opportunities, career opportunities, or any failure to secure employment or engagement through the Platform."],
                ["Third-Party Conduct", "Any loss or damage arising from the conduct, acts, or omissions of any third party, including Company Users, Student Users, or third-party service providers."],
                ["Service Interruptions", "Any loss or damage arising from any interruption, suspension, or unavailability of the Platform, whether scheduled or unscheduled."],
              ].map(([term, def]) => (
                <div key={term} style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", borderRadius: "0.65rem", padding: "0.9rem 1rem", border: "1px solid var(--color-border-light, #e2e8f0)" }}>
                  <p style={{ margin: "0 0 0.3rem", fontWeight: "700", fontSize: "0.83rem", color: "var(--color-text-primary, #1e293b)" }}>{term}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.6 }}>{def}</p>
                </div>
              ))}
            </div>
            <p style={body}>
              Without prejudice to the foregoing, the Operator's total aggregate liability to you under or in connection with these Terms or your use of the Platform, howsoever arising, shall in no event exceed the greater of: (a) the total amount paid by you to the Operator in the twelve (12) months preceding the event giving rise to the claim; or (b) one hundred euro (€100), notwithstanding any failure of essential purpose of any limited remedy. The existence of more than one claim will not enlarge or extend this limit.
            </p>
          </TosSection>

          <TosSection num="24" title="Indemnification">
            <p style={body}>
              You agree to defend, indemnify, and hold harmless the Operator and its directors, officers, employees, agents, contractors, licensors, service providers, successors, and assigns from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including without limitation reasonable legal fees) arising from or in connection with: (a) your use of the Platform or any feature thereof; (b) your User Content; (c) your breach of any provision of these Terms or the Platform Policies; (d) your breach of any applicable law or the rights of any third party; (e) your fraud, wilful misconduct, or gross negligence; or (f) any claim by a third party arising from your use of or interaction through the Platform. This indemnification obligation will survive the termination of your Account and these Terms.
            </p>
            <p style={body}>
              The Operator reserves the right, at its own expense, to assume the exclusive defence and control of any matter subject to indemnification by you, in which case you agree to cooperate fully with the Operator in the assertion of any available defences.
            </p>
          </TosSection>

          <TosSection num="25" title="Force Majeure">
            <p style={body}>
              The Operator shall not be in breach of these Terms nor liable for any delay in performing, or any failure to perform, any of its obligations under these Terms if such delay or failure results from a Force Majeure Event. For the purposes of this Section, a "<strong>Force Majeure Event</strong>" means any circumstance beyond the Operator's reasonable control including but not limited to: acts of God; floods; lightning; drought; earthquake; subsidence; fire or explosion; terrorism; civil commotion or riots; war; threat of or preparation for war; invasion; hostilities (whether war is declared or not); armed conflict; imposition of sanctions; embargo; breaking off of diplomatic relations; governmental action; compliance with any law or governmental order, rule, regulation, or direction; actions of a national or local government; actions of regulatory authorities; nuclear, chemical, or biological contamination; sonic boom; collapse of buildings, fire, explosion or accident; any labour or trade dispute, strike, industrial action, or lockout (other than in each case by the party seeking to rely on this clause or companies in the same group as that party); interruption, failure, or non-availability of power supply; failure or malfunction of third-party software or cloud services; interruption or failure of the internet or telephone infrastructure; cyber-attacks or security breaches attributable to a third party; or any pandemic, epidemic, or outbreak of infectious disease.
            </p>
            <p style={body}>
              Where a Force Majeure Event occurs, the Operator will endeavour to notify affected Users as soon as reasonably practicable and will use commercially reasonable efforts to mitigate the effects of the Force Majeure Event. If a Force Majeure Event continues for a period of more than sixty (60) consecutive days, the Operator may, in its sole discretion, suspend or permanently discontinue the Platform or any feature thereof without liability to any User.
            </p>
          </TosSection>

          <TosSection num="26" title="Severability, Waiver &amp; Entire Agreement">
            <p style={body}>
              <strong>Severability:</strong> If any provision of these Terms is held by a court or tribunal of competent jurisdiction to be invalid, illegal, unenforceable, or void for any reason, that provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable, or if such modification is not possible, the provision shall be severed from these Terms. The invalidity or unenforceability of any provision shall not affect the validity and enforceability of the remaining provisions of these Terms, which shall continue in full force and effect.
            </p>
            <p style={body}>
              <strong>Waiver:</strong> No failure or delay by the Operator in exercising any right, power, or remedy under these Terms shall operate as a waiver thereof, nor shall any single or partial exercise of any right, power, or remedy preclude any other or further exercise thereof or the exercise of any other right, power, or remedy. No waiver by the Operator of any breach by you of any provision of these Terms shall be construed as a waiver of any subsequent breach of the same or any other provision.
            </p>
            <p style={body}>
              <strong>Entire Agreement:</strong> These Terms, together with the Platform Policies and any other documents expressly incorporated by reference herein, constitute the entire agreement between you and the Operator with respect to the subject matter hereof and supersede all prior or contemporaneous communications, representations, warranties, agreements, or understandings, whether written or oral, relating to such subject matter. You acknowledge that you have not relied on any representation, warranty, undertaking, or other statement made by or on behalf of the Operator that is not expressly set out in these Terms or the Platform Policies.
            </p>
            <p style={body}>
              <strong>Assignment:</strong> You may not assign, transfer, sub-licence, or otherwise deal with any of your rights or obligations under these Terms without the prior written consent of the Operator. The Operator may freely assign or transfer its rights and obligations under these Terms without your consent in connection with a merger, acquisition, reorganisation, sale of assets, or by operation of law.
            </p>
          </TosSection>

          <TosSection num="27" title="Governing Law &amp; Jurisdiction">
            <p style={body}>
              These Terms and any dispute or claim (including non-contractual disputes or claims) arising out of or in connection with them or their subject matter or formation shall be governed by and construed in accordance with the laws of the Republic of Ireland, without regard to its conflict of laws rules or principles that would cause the application of the laws of any other jurisdiction.
            </p>
            <p style={body}>
              Subject to the following paragraph, you and the Operator irrevocably submit to the exclusive jurisdiction of the courts of the Republic of Ireland (and in particular, the courts sitting in Dublin) for the determination of any dispute or claim arising out of or in connection with these Terms or your use of the Platform. Notwithstanding the foregoing, the Operator reserves the right to seek injunctive or other equitable relief in any court of competent jurisdiction to prevent or restrain any breach or threatened breach of these Terms where monetary damages would be an inadequate remedy.
            </p>
            <p style={body}>
              If you are accessing the Platform as a consumer resident in another member state of the European Union, you may also have rights under the mandatory consumer protection laws of your country of residence, which cannot be overridden by these Terms. Nothing in these Terms is intended to restrict or exclude such rights.
            </p>
          </TosSection>

          <TosSection num="28" title="Amendments to These Terms">
            <p style={body}>
              The Operator reserves the right to amend, modify, supplement, or replace these Terms at any time in its sole and absolute discretion. The Operator will notify registered Users of material changes to these Terms by: (a) displaying a prominent notice on the Platform for a period of not less than fourteen (14) days prior to the changes taking effect; and/or (b) sending an email notification to the email address registered to your Account. The "Last Updated" date at the top of these Terms will be updated to reflect the date of the most recent revision.
            </p>
            <p style={body}>
              Your continued use of the Platform after the effective date of any amended Terms constitutes your acceptance of such amended Terms in their entirety. If you do not agree with any amended Terms, your sole remedy is to discontinue your use of the Platform and to delete your Account in accordance with Section 21 of these Terms. It is your responsibility to review these Terms periodically to be aware of any changes.
            </p>
            <p style={body}>
              Notwithstanding the foregoing, where any amendment to these Terms is required by applicable law or a competent authority, such amendment may take immediate effect without any prior notice period.
            </p>
            <p style={body}>
              Previous versions of these Terms are available upon request by contacting <a href={`mailto:${LEGAL_EMAIL}`} style={lnk}>{LEGAL_EMAIL}</a>.
            </p>
          </TosSection>

          {/* Footer */}
          <div style={{ borderTop: "2px solid var(--color-border-light, #e2e8f0)", marginTop: "2.5rem", paddingTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "0 0 0.2rem", fontWeight: "700", fontSize: "0.85rem", color: "var(--color-text-primary, #1e293b)" }}>StudentShifts — Terms of Service &amp; Platform Use Agreement</p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}>
                Version 4.2.1 &nbsp;·&nbsp; Last updated {LAST_UPDATED} &nbsp;·&nbsp; Jurisdiction: Republic of Ireland / EU &nbsp;·&nbsp; <a href={`mailto:${LEGAL_EMAIL}`} style={lnk}>{LEGAL_EMAIL}</a>
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <a href="/privacy" style={{ ...lnk, fontSize: "0.82rem" }}>Privacy Policy</a>
              <a href="/help" style={{ ...lnk, fontSize: "0.82rem" }}>Help Centre</a>
              <a href="/contact" style={{ ...lnk, fontSize: "0.82rem" }}>Contact Us</a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

/* ── Layout helpers ──────────────────────────────────────────────────── */

function TosSection({ num, title, children }) {
  return (
    <div id={`tos-section-${num}`} style={{ marginBottom: "2rem", scrollMarginTop: "1.5rem" }}>
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

/* ── Styles ──────────────────────────────────────────────────────────── */
const body   = { margin: "0 0 0.85rem", fontSize: "0.88rem", color: "var(--color-text-body, #374151)", lineHeight: 1.75 };
const h3     = { margin: "1.25rem 0 0.5rem", fontWeight: "700", fontSize: "0.92rem", color: "var(--color-text-primary, #1e293b)" };
const listS  = { paddingLeft: "1.4rem", margin: "0 0 0.85rem", fontSize: "0.88rem", color: "var(--color-text-body, #374151)", lineHeight: 1.8 };
const lnk    = { color: "var(--color-brand)", textDecoration: "none", fontWeight: "600" };
const tocHead = { margin: "0 0 0.75rem", fontWeight: "800", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)", textTransform: "uppercase", letterSpacing: "0.06em" };
