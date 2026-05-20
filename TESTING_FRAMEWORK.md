# StudentShifts — Comprehensive Testing Framework
**Date**: May 12, 2026 | **Scope**: 100 test cases across 20 quality dimensions

---

## 1. FRONT-END DESIGN (Visual Quality)

### Test 1.1: Visual Consistency
- [ ] Check all buttons use consistent styling (padding, border-radius, colors)
- [ ] Verify header/footer alignment across all pages
- [ ] Confirm typography hierarchy (font sizes, weights) follow design system
- [ ] Test color palette across light/dark content areas
- [ ] Validate spacing/padding consistency (8px grid system)

### Test 1.2: Job Card Design
- [ ] Job cards display image, title, location, pay, days, distance correctly
- [ ] Filled shifts appear with strikethrough styling
- [ ] Like/apply buttons are accessible and properly positioned
- [ ] Card hover effects are smooth and intentional
- [ ] Distance badge positioning is correct below days/times

### Test 1.3: Form & Input Design
- [ ] Form inputs have consistent height, padding, border styling
- [ ] Focus states are clearly visible (outline, color change)
- [ ] Error messages appear in red, validation success in green
- [ ] Placeholder text is appropriately visible
- [ ] Password strength meter colors are intuitive (red → green)

### Test 1.4: Dashboard Layouts
- [ ] Student dashboard: job feed layout, filter panel, sidebar positioning
- [ ] Company dashboard: tabs (Jobs, Students, Messages) switch smoothly
- [ ] Admin dashboard: student/company queue, heatmap visualization
- [ ] Applicants view: List/Kanban toggle displays correctly
- [ ] Detail panels slide in without layout shift

### Test 1.5: Typography & Readability
- [ ] All text meets 4.5:1 contrast ratio (WCAG AA minimum)
- [ ] Line-height provides adequate spacing (1.5+ for body text)
- [ ] Font sizes scale properly from mobile to desktop
- [ ] Headings are visually distinct from body text
- [ ] Link colors are distinguishable from regular text

---

## 2. USER EXPERIENCE (UX)

### Test 2.1: Navigation Flow
- [ ] Landing page → Signup/Login → Dashboard flows without confusion
- [ ] Back buttons appear on inner pages (JobDetails, Account, etc.)
- [ ] Breadcrumb or page title indicates current location
- [ ] Menu is accessible and dismissible
- [ ] Keyboard navigation (Tab) works correctly

### Test 2.2: Student Job Discovery
- [ ] Filter panel saves state when navigating back to dashboard
- [ ] Sorting (Pay H→L, Distance, Date) works and updates instantly
- [ ] Search by location returns relevant results
- [ ] "Liked" jobs persist after page refresh
- [ ] Job detail view loads from both search and direct URL

### Test 2.3: Application Flow
- [ ] Apply button is prominent and easy to find
- [ ] Multi-shift selection modal is clear (if job has 2+ shifts)
- [ ] Application confirmation gives clear feedback
- [ ] Applied jobs show status "Accepted", "Rejected", or "Pending"
- [ ] Withdraw application has confirmation dialog

### Test 2.4: Company Hiring Pipeline
- [ ] Pipeline stages are visually distinct (applied → shortlisted → interview → trial → decision)
- [ ] Drag-drop in Kanban view feels responsive
- [ ] Detail panel shows all applicant info without scrolling (on desktop)
- [ ] Quick actions (Hire, Decline, Move Stage) are obvious
- [ ] Applicant screening checklist is easy to understand

### Test 2.5: Messaging Experience
- [ ] Message threads load instantly
- [ ] New messages appear in real-time
- [ ] Message count badge updates without page refresh
- [ ] Thread list is sortable by recency
- [ ] Typing indicator or delivery status is shown

---

## 3. MOBILE EXPERIENCE

### Test 3.1: Responsive Layout
- [ ] All pages adapt to 375px (iPhone SE), 768px (tablet), 1024px (desktop)
- [ ] No horizontal scrolling on any viewport
- [ ] Font sizes scale appropriately (not too small on mobile)
- [ ] Touch targets are 44px minimum (WCAG guideline)
- [ ] Modals and dropdowns fit within viewport

### Test 3.2: Mobile Navigation
- [ ] Hamburger menu opens/closes smoothly on mobile
- [ ] Menu items are tappable without accidental clicks
- [ ] Header logo/branding visible on all mobile pages
- [ ] Back button is reachable with one hand (bottom third of screen)
- [ ] Tab navigation (for students) is horizontal scrollable or stacked

### Test 3.3: Mobile Form Input
- [ ] Keyboard doesn't cover input fields (auto-scroll)
- [ ] Email inputs open email keyboard
- [ ] Number inputs (CRO, skill count) open numeric keyboard
- [ ] Password fields show "show/hide" toggle
- [ ] Form validation messages don't obscure inputs

### Test 3.4: Mobile Performance
- [ ] Images lazy-load below the fold
- [ ] Job feed scrolls smoothly (60fps)
- [ ] Filter/sort operations don't stall
- [ ] Bottom navigation is sticky and accessible
- [ ] Modal close button is accessible on small screens

### Test 3.5: Mobile Specific Features
- [ ] Location "Use Current Location" works on mobile
- [ ] Share job functionality (if applicable)
- [ ] Dark mode toggle works on mobile
- [ ] Notification badges are visible on mobile header
- [ ] Account menu is accessible from small screens

---

## 4. WEBSITE SPEED & PERFORMANCE

### Test 4.1: Page Load Speed
- [ ] Landing page loads in <3 seconds (3G throttling)
- [ ] StudentDashboard loads in <2 seconds after auth
- [ ] Job detail page loads in <2 seconds
- [ ] CompanyDashboard loads in <3 seconds
- [ ] AdminPage loads in <2 seconds

### Test 4.2: Code Splitting & Lazy Loading
- [ ] Vendor bundles are split (react, router, supabase, sentry)
- [ ] Pages load lazily (StudentDashboard, CompanyDashboard, etc.)
- [ ] PDF viewer (react-pdf) loads only when CV is opened
- [ ] Initial JS bundle is <150KB (gzipped)
- [ ] No unused dependencies in production build

### Test 4.3: Image Optimization
- [ ] Job photos use WebP format with PNG fallback
- [ ] Profile avatars are optimized (<100KB each)
- [ ] Images lazy-load with proper dimensions to prevent layout shift
- [ ] Unused images don't load (above the fold only)
- [ ] Image CDN caching headers are set (Cache-Control: public, max-age)

### Test 4.4: Network Requests
- [ ] Duplicate API requests are avoided (deduped session checks)
- [ ] Real-time subscriptions don't create memory leaks
- [ ] Pagination is implemented for large lists (if applicable)
- [ ] Search/filter requests are debounced (not on every keystroke)
- [ ] Failed requests retry with exponential backoff

### Test 4.5: Browser Caching
- [ ] Service Worker caches static assets
- [ ] CSS/JS files have content hash in filenames (for cache busting)
- [ ] API responses use appropriate cache headers
- [ ] LocalStorage doesn't grow unbounded
- [ ] Session tokens refresh without full page reload

---

## 5. BACKEND QUALITY

### Test 5.1: API Reliability
- [ ] All Supabase queries return results within 10 seconds
- [ ] Rate limiting (20 applications/hour) is enforced
- [ ] Email send limits (60/5min) are respected
- [ ] Database triggers auto-create profiles on signup
- [ ] RLS policies prevent unauthorized data access

### Test 5.2: Data Validation
- [ ] Email format is validated (both client & server)
- [ ] Password strength is enforced (8+ chars)
- [ ] CRO number format is validated (1-8 digits)
- [ ] Job posting validates dates (deadline >= today)
- [ ] CV file size is limited to 10MB, images to 5MB

### Test 5.3: Error Handling
- [ ] Timeout errors (10s) are caught and shown to user
- [ ] Database constraint violations (duplicate applications) are handled
- [ ] RLS violations return meaningful error messages
- [ ] Edge Function failures are logged to Sentry
- [ ] Fallback values prevent null/undefined crashes

### Test 5.4: Database Consistency
- [ ] Application count in job.applicant_count stays in sync
- [ ] Filled shifts array updates when student is hired
- [ ] Student status changes trigger real-time updates
- [ ] Message count doesn't double-count in real-time
- [ ] Cascading deletes (delete account → remove all data)

### Test 5.5: Scalability & Load
- [ ] 1000 concurrent jobs can be browsed without slowdown
- [ ] 100+ applicants per job don't cause UI lag
- [ ] Heatmap calculation is fast for 1000+ students
- [ ] Pagination for student browse keeps load constant
- [ ] Real-time subscriptions scale without memory leaks

---

## 6. SECURITY

### Test 6.1: Authentication
- [ ] Email verification is required before login
- [ ] Passwords are hashed (Supabase handles)
- [ ] Session tokens expire and refresh automatically
- [ ] JWT tokens are stored securely (not in localStorage for sensitive data)
- [ ] Magic link emails expire after 24 hours

### Test 6.2: Authorization (RLS)
- [ ] Student cannot read other students' CVs
- [ ] Student cannot access company job posting form
- [ ] Company cannot read other companies' job data
- [ ] Company cannot approve their own applications
- [ ] Admin role is not self-elevatable by users

### Test 6.3: Data Protection
- [ ] Verification documents (student ID, gov ID) are admin-only
- [ ] CVs have signed URLs that expire after 60 seconds
- [ ] Password reset links don't reveal whether email exists
- [ ] Account export includes only user's own data
- [ ] Deleted accounts fully purge files from storage

### Test 6.4: Input & Upload Validation
- [ ] MIME type validation (not just extension) on file upload
- [ ] Path traversal attempts (../) are blocked
- [ ] XSS prevention: HTML is sanitized in messages
- [ ] SQL injection prevention: parameterized queries used
- [ ] File upload limits are enforced (10MB docs, 5MB images)

### Test 6.5: API Security
- [ ] CORS headers allow only studentshifts.ie origin
- [ ] Rate limiting prevents brute-force login attempts
- [ ] Email send function requires authenticated user
- [ ] Admin-only RPCs check is_admin() first
- [ ] Sensitive operations (delete account) require password re-entry

---

## 7. ACCESSIBILITY (Very Important)

### Test 7.1: Keyboard Navigation
- [ ] Tab order is logical (left-to-right, top-to-bottom)
- [ ] Skip links bypass navigation (skip-to-content)
- [ ] Modals trap focus (Tab loops within modal)
- [ ] Form submission works with Enter key
- [ ] Dropdown menus open/close with Enter/Escape

### Test 7.2: Screen Reader Compatibility
- [ ] Page titles clearly identify current page
- [ ] Images have descriptive alt text (job photos, avatars)
- [ ] Form labels are associated with inputs (htmlFor)
- [ ] ARIA landmarks (main, nav, aside) structure the page
- [ ] Dynamic content updates announced (aria-live)

### Test 7.3: Color & Contrast
- [ ] All text meets 4.5:1 contrast ratio (WCAG AA)
- [ ] Alerts/errors aren't conveyed by color alone (also use icons, text)
- [ ] Links aren't distinguishable by color alone
- [ ] Focus indicator is visible (not just outline, at least 2px)
- [ ] Filled shift styling has pattern (strikethrough) not just color

### Test 7.4: Motion & Animation
- [ ] Animations respect prefers-reduced-motion
- [ ] Transitions are <300ms (don't feel sluggish)
- [ ] Auto-playing content (carousel) can be paused
- [ ] Parallax/scroll effects don't cause vestibular issues
- [ ] Page transitions don't cause disorientation

### Test 7.5: Mobile & Vision Accessibility
- [ ] Font size can be increased to 200% without breaking layout
- [ ] Zoom to 200% is possible without horizontal scroll
- [ ] Text spacing can be increased (line-height, letter-spacing)
- [ ] Touch targets are 44px minimum
- [ ] High contrast mode is readable

---

## 8. SEO (Search Engine Optimization)

### Test 8.1: Meta Tags & Structured Data
- [ ] Each page has unique <title> (StudentShifts — [Page Name])
- [ ] Meta descriptions are 155-160 chars (not auto-generated)
- [ ] Canonical URLs prevent duplicate content
- [ ] Open Graph tags for social sharing (og:title, og:image, og:description)
- [ ] JSON-LD schema markup for Organization/Job postings (if applicable)

### Test 8.2: URL Structure & Canonicalization
- [ ] URLs are descriptive and lowercase (e.g., /jobs/barista-galway)
- [ ] No URL parameters for essential content (SEO-friendly)
- [ ] 301 redirects for old URLs
- [ ] Trailing slashes are consistent
- [ ] Robots.txt and sitemap.xml exist and are correct

### Test 8.3: Content Quality
- [ ] Each page has 300+ words of unique content (if applicable)
- [ ] Heading hierarchy is correct (H1, then H2, H3)
- [ ] Keywords are naturally incorporated (not keyword stuffing)
- [ ] Internal linking strategy guides users to key pages
- [ ] Outdated content is regularly refreshed

### Test 8.4: Mobile & Core Web Vitals
- [ ] Mobile-first indexing: mobile version is primary
- [ ] Core Web Vitals: LCP <2.5s, FID <100ms, CLS <0.1
- [ ] Responsive design works on all devices
- [ ] Mobile usability report has no errors
- [ ] Page speed insights score is >90

### Test 8.5: Technical SEO
- [ ] XML sitemap lists all pages and job postings
- [ ] Robots.txt allows crawling (except /admin, /verify)
- [ ] No redirect chains (A → B → C, should be A → C)
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] Hreflang tags if multi-region (e.g., .ie vs .com)

---

## 9. CONTENT QUALITY

### Test 9.1: Copy & Messaging
- [ ] Signup page clearly explains role differences (Student vs Company)
- [ ] Job descriptions are complete (no placeholder text)
- [ ] Error messages are helpful and actionable
- [ ] Onboarding guidance for first-time users
- [ ] Privacy Policy and Terms clearly link from footer

### Test 9.2: Job Posting Guidelines
- [ ] Job titles are standardized (not random capitalization)
- [ ] Job descriptions follow a template (Role, Responsibilities, Requirements)
- [ ] Pay information is always included
- [ ] Location is clear and accurate
- [ ] Deadline is realistic (at least 3 days notice)

### Test 9.3: Tone & Brand Voice
- [ ] All copy is professional yet friendly
- [ ] Language is inclusive (not ageist, gendered, or biased)
- [ ] Calls-to-action are clear and compelling
- [ ] Consistent terminology (e.g., "Shifts" vs "Jobs")
- [ ] Brand voice matches across all pages

### Test 9.4: Help & Documentation
- [ ] Help Centre explains how to apply, browse, and manage applications
- [ ] FAQ answers common questions (e.g., "How do I verify my account?")
- [ ] Contact form is easy to find
- [ ] Email templates (approval, rejection) are clear
- [ ] In-app tooltips guide users on complex features

### Test 9.5: Proofreading & Localization
- [ ] No spelling or grammar errors
- [ ] Irish-specific references are correct (e.g., Eircode format)
- [ ] Dates follow Irish format (DD/MM/YYYY)
- [ ] Jargon is explained or avoided
- [ ] Tone is appropriate for Irish student audience

---

## 10. TRUST & PROFESSIONALISM

### Test 10.1: Visual Trust Signals
- [ ] Logo is professional and consistently placed
- [ ] Color scheme is modern and cohesive
- [ ] No broken links or 404 errors
- [ ] Images are high-quality (no pixelation, blurring)
- [ ] Page load is smooth (no janky transitions)

### Test 10.2: Credibility & Authority
- [ ] About page explains StudentShifts mission clearly
- [ ] Company information is visible (location, contact)
- [ ] Team/leadership information is provided (if applicable)
- [ ] Media mentions or press coverage shown (if applicable)
- [ ] Third-party verification (e.g., "Verified by CRO") visible

### Test 10.3: Privacy & Security
- [ ] Privacy Policy is detailed and GDPR-compliant
- [ ] Security practices are explained (encryption, RLS)
- [ ] Data deletion is easy (Account page → Delete Account)
- [ ] Data export is available (GDPR Art. 20)
- [ ] SSL/HTTPS is enforced (green lock in browser)

### Test 10.4: Testimonials & Social Proof
- [ ] Student testimonials/reviews displayed (if applicable)
- [ ] Employer testimonials displayed (if applicable)
- [ ] Active user metrics visible ("1000+ jobs posted", "5000+ students")
- [ ] Success stories or case studies available
- [ ] Social media links are visible and functional

### Test 10.5: Support & Responsiveness
- [ ] Contact form has confirmation message
- [ ] Email responses are timely (24-48 hours expected)
- [ ] Support ticket system or help desk available
- [ ] FAQ covers 80%+ of common issues
- [ ] Chatbot or AI assistant available (optional)

---

## 11. FUNCTIONALITY

### Test 11.1: Student Features
- [ ] Signup creates student profile with status "pending_review"
- [ ] Document upload triggers verification workflow
- [ ] Job search/filter returns accurate results
- [ ] Apply for job with/without shift selection
- [ ] Like/unlike job works and persists
- [ ] Track application status in real-time

### Test 11.2: Company Features
- [ ] Create job posting with all required fields
- [ ] Edit job posting (title, description, pay, deadline)
- [ ] Delete job (removes all applications)
- [ ] View applicants in list/kanban view
- [ ] Move applicant through pipeline stages
- [ ] Schedule interview/trial with date/time

### Test 11.3: Admin Features
- [ ] View pending students queue
- [ ] Download/view verification documents
- [ ] Approve/reject student (with email notification)
- [ ] View pending companies queue
- [ ] Verify CRO number and approve company
- [ ] View availability heatmap

### Test 11.4: Messaging
- [ ] Send message in job thread (student to company)
- [ ] Send direct message (company to student)
- [ ] Message history loads chronologically
- [ ] Real-time message delivery (no page refresh needed)
- [ ] Message count badge updates accurately

### Test 11.5: Account Management
- [ ] Update profile (bio, skills, LinkedIn)
- [ ] Upload/update CV and cover letter
- [ ] Set availability schedule
- [ ] Save location for distance filtering
- [ ] Download personal data (GDPR export)
- [ ] Delete account (with password confirmation)

---

## 12. SCALABILITY

### Test 12.1: Database Scalability
- [ ] Job query returns results within 2s for 10,000 jobs
- [ ] Student browse works smoothly for 100,000+ students
- [ ] Heatmap calculation completes in <5s for 50,000 students
- [ ] Application status update doesn't slow under load
- [ ] Message pagination handles 10,000+ messages per thread

### Test 12.2: File Storage Scalability
- [ ] Upload 1000 CVs without slowdown
- [ ] Generate signed URLs instantly for 100 files
- [ ] Storage quota doesn't grow unbounded
- [ ] Old/unused files can be cleaned up
- [ ] Multi-region storage replication (if applicable)

### Test 12.3: Concurrent Users
- [ ] 1000 concurrent browsing students don't cause lag
- [ ] 100 companies posting jobs simultaneously works
- [ ] Real-time message delivery with 1000+ active chats
- [ ] Admin approval workflow handles 100+ pending items
- [ ] Real-time notifications don't miss updates

### Test 12.4: Data Growth
- [ ] Database grows linearly (no exponential backups)
- [ ] Old data is archived or pruned (e.g., expired jobs)
- [ ] Indexes are optimized for common queries
- [ ] No N+1 query problems on dashboard loads
- [ ] Pagination prevents loading entire datasets

### Test 12.5: Infrastructure Scaling
- [ ] Render auto-scales based on traffic
- [ ] Supabase connection pooling prevents exhaustion
- [ ] CDN caches static assets globally
- [ ] Database read replicas (if needed for scale)
- [ ] Load testing shows no single point of failure

---

## 13. RELIABILITY & STABILITY

### Test 13.1: Uptime & Availability
- [ ] 99.9% uptime target maintained
- [ ] Zero-downtime deployments (blue-green or canary)
- [ ] Database backups automated daily
- [ ] Disaster recovery plan documented
- [ ] Status page shows real-time service status

### Test 13.2: Error Recovery
- [ ] Session timeout redirects to login gracefully
- [ ] Network errors show retry button (not silent fail)
- [ ] Partially submitted forms don't lose data
- [ ] Failed uploads can be retried without starting over
- [ ] Crash/reload doesn't lose unsaved work

### Test 13.3: Data Integrity
- [ ] Concurrent edits don't overwrite each other
- [ ] Transaction isolation prevents race conditions
- [ ] Soft deletes preserve referential integrity
- [ ] Cascade deletes clean up related records
- [ ] Data backups are tested and restorable

### Test 13.4: Monitoring & Logging
- [ ] Sentry captures all errors and exceptions
- [ ] Error rate alerts trigger on threshold (e.g., >1%)
- [ ] Database queries are logged (for debugging)
- [ ] User sessions can be traced (for support)
- [ ] Performance metrics are tracked (FCP, LCP, CLS)

### Test 13.5: Graceful Degradation
- [ ] Missing images show placeholder (not broken link icon)
- [ ] Unavailable feature shows helpful message (not crash)
- [ ] Network offline shows notification (not silent fail)
- [ ] Supabase down shows friendly error (not technical stack trace)
- [ ] Edge Function timeout shows retry option

---

## 14. MAINTAINABILITY

### Test 14.1: Code Organization
- [ ] src/lib/ directory is well-organized by domain (auth, jobs, etc.)
- [ ] Component imports are relative and clear
- [ ] No circular dependencies
- [ ] Constants are centralized (not magic numbers)
- [ ] Naming conventions are consistent (camelCase, PascalCase)

### Test 14.2: Code Quality
- [ ] ESLint passes with no warnings
- [ ] Functions have JSDoc comments
- [ ] Complex logic is explained with inline comments
- [ ] No console.log() statements left in production
- [ ] Code follows React best practices (hooks, keys, dependencies)

### Test 14.3: Documentation
- [ ] README explains how to run locally and deploy
- [ ] API documentation lists all fetch functions
- [ ] Database schema is documented (column types, relationships)
- [ ] RLS policies are explained inline in SQL
- [ ] Environment variables are listed in .env.example

### Test 14.4: Testing Coverage
- [ ] Unit tests for utility functions (geo.js, job slugs)
- [ ] Component tests for complex pages (LoginPage, SignupPage)
- [ ] Integration tests for auth flow
- [ ] E2E tests for critical paths (signup → apply → hire)
- [ ] Test coverage >70% (src/ files)

### Test 14.5: Refactoring & Tech Debt
- [ ] No deprecated dependencies
- [ ] React version is current (19.x)
- [ ] Supabase SDK is latest (2.x)
- [ ] Type safety could be improved with TypeScript (future)
- [ ] Unused code is removed (DRY principle)

---

## 15. ANALYTICS & DATA TRACKING

### Test 15.1: Google Analytics
- [ ] GA4 event tracking: signup, login, apply, hire
- [ ] Page views tracked for all routes
- [ ] User ID set after login (for cohort analysis)
- [ ] Session duration tracked
- [ ] Conversion funnel: signup → verify → apply → accept

### Test 15.2: Event Tracking
- [ ] "signup" event logged when student creates account
- [ ] "apply" event logged when job application submitted
- [ ] "hire" event logged when company accepts applicant
- [ ] "login" event logged on successful sign-in
- [ ] Custom event properties capture context (job_id, company_id)

### Test 15.3: User Behavior Insights
- [ ] Funnel analysis: signup → email verified → apply job
- [ ] Cohort analysis: students signed up in May 2026
- [ ] Retention: % of students active after 1 week
- [ ] Average time-to-apply after signup
- [ ] Drop-off points identified in critical flows

### Test 15.4: Performance Metrics
- [ ] Page load time tracked (Google Analytics)
- [ ] Core Web Vitals monitored (LCP, FID, CLS)
- [ ] Error rate tracked by page
- [ ] API response times tracked
- [ ] User session duration analyzed

### Test 15.5: Business Metrics
- [ ] Total jobs posted (per month)
- [ ] Total applications (per month)
- [ ] Total hires/successful matches
- [ ] Average time-to-hire
- [ ] Company and student sign-up trend

---

## 16. CONVERSION OPTIMIZATION

### Test 16.1: Signup Conversion
- [ ] Signup page CTA is clear ("Create Account →")
- [ ] Step indicator shows progress (Step 1 of 2)
- [ ] Minimal required fields on signup (email, password, name)
- [ ] Field validation gives real-time feedback
- [ ] Password strength meter encourages strong password

### Test 16.2: Login Conversion
- [ ] Login page is simple (email, password, submit)
- [ ] "Forgot password?" link is visible
- [ ] Email/password errors are non-specific (prevent enumeration)
- [ ] Magic links don't require typing (click from email)
- [ ] Session timeout warning before logout

### Test 16.3: Job Application Conversion
- [ ] Apply button is prominent and high-contrast
- [ ] Multi-step apply modal (verify → CV → confirm) is clear
- [ ] Shift selection is intuitive (radio buttons, not dropdown)
- [ ] Confirmation message shows job title and shift
- [ ] Post-apply nudge: "Message the employer" or "Browse similar jobs"

### Test 16.4: Student Verification Conversion
- [ ] Verification modal explains why required
- [ ] Document upload is simple (drag-drop or file picker)
- [ ] Clear indication of upload progress
- [ ] Estimated verification time is shown ("usually 24 hours")
- [ ] Post-verification email celebrates completion

### Test 16.5: Company Job Posting Conversion
- [ ] New job form is not overwhelming
- [ ] Help text explains each field
- [ ] Job preview shows how it will appear to students
- [ ] Publish button is clear (not "Save" or "Draft")
- [ ] Post-publish: "View job on platform" button

---

## 17. CROSS-BROWSER COMPATIBILITY

### Test 17.1: Desktop Browsers
- [ ] Chrome 120+ (latest version)
- [ ] Firefox 121+ (latest version)
- [ ] Safari 17+ (latest version)
- [ ] Edge 120+ (latest version)
- [ ] No console errors or warnings

### Test 17.2: Mobile Browsers
- [ ] Chrome Android (latest)
- [ ] Safari iOS 16+ (latest)
- [ ] Firefox Mobile (latest)
- [ ] Samsung Internet (latest)
- [ ] No crashes on rotation (portrait/landscape)

### Test 17.3: CSS Compatibility
- [ ] CSS Grid works on all browsers
- [ ] Flexbox works on all browsers
- [ ] CSS variables (--color-brand) are supported
- [ ] CSS animations are smooth (no jank)
- [ ] Media queries work (no hardcoded breakpoints)

### Test 17.4: JavaScript Compatibility
- [ ] ES2020 features work on all browsers (async/await, optional chaining)
- [ ] Fetch API is used (not XMLHttpRequest)
- [ ] Promise/Promise.all work correctly
- [ ] Array methods (.map, .filter, .find) work
- [ ] No polyfills needed (Vite targets es2020)

### Test 17.5: Feature Detection
- [ ] Geolocation API with fallback if denied
- [ ] Local storage with fallback (SessionStorage, IndexedDB)
- [ ] Clipboard API with manual fallback
- [ ] IntersectionObserver for lazy loading (polyfill if needed)
- [ ] Service Worker with graceful fallback if not supported

---

## 18. LEGAL COMPLIANCE

### Test 18.1: GDPR Compliance
- [ ] Privacy Policy includes Art. 13/14 info (legal basis, data retention, etc.)
- [ ] Consent is explicit (cookie banner, not auto-tracking)
- [ ] Data subject rights implemented (export, delete, rectify)
- [ ] Data breach notification plan documented
- [ ] Data Processing Agreement with Supabase (EU region)

### Test 18.2: Cookie & Tracking Consent
- [ ] Cookie banner appears before GA4 loads
- [ ] GA4 only loads after cookie consent
- [ ] Essential cookies (session) don't require consent
- [ ] "Reject" button is equally prominent as "Accept"
- [ ] Consent is stored for 1 year

### Test 18.3: Accessibility Compliance
- [ ] WCAG 2.1 Level AA conformance targeted
- [ ] Manual accessibility audit performed
- [ ] Accessibility statement published
- [ ] A11y fixes tracked and remediated
- [ ] Third-party widgets are accessible (or alternatives provided)

### Test 18.4: Terms of Service
- [ ] Terms include eligibility (students must be verified)
- [ ] Code of conduct for job postings
- [ ] Liability limitations
- [ ] Dispute resolution process
- [ ] Termination policy (suspension for abuse)

### Test 18.5: Data Localization & Regulations
- [ ] Data stored in EU region (Ireland) for GDPR
- [ ] Student ID/Gov ID not stored in logs (PII protection)
- [ ] No third-party trackers beyond GA4 and Sentry
- [ ] CRO number not stored in plain text (or encrypted)
- [ ] Compliance with Irish Data Protection Commissioner

---

## 19. API QUALITY (If Applicable)

### Test 19.1: Supabase RPC Functions
- [ ] `get_company_applicant_profiles()` returns sanitized student data
- [ ] `approve_student()` requires admin role and sends email
- [ ] `approve_company()` verifies CRO number
- [ ] `count_recent_applications()` is atomic (no race conditions)
- [ ] `delete_account()` cascades deletes properly

### Test 19.2: Edge Functions
- [ ] `send-email()` requires authentication and rate limiting
- [ ] `hire-applicant()` handles multi-shift logic correctly
- [ ] `register-interest()` validates email before inserting
- [ ] `send-launch-emails()` tracks sent timestamps
- [ ] Error responses include meaningful error messages

### Test 19.3: Real-time Subscriptions
- [ ] Chat message subscription works without polling
- [ ] Application status changes appear in real-time
- [ ] Message count updates without page refresh
- [ ] Verification status changes trigger redirect
- [ ] Multiple tabs sync without conflicts

### Test 19.4: Error Handling & Status Codes
- [ ] 400 Bad Request for invalid input
- [ ] 401 Unauthorized for missing auth token
- [ ] 403 Forbidden for RLS violations
- [ ] 404 Not Found for missing resource
- [ ] 429 Too Many Requests for rate limits
- [ ] 500 Server Error with Sentry tracking

### Test 19.5: API Documentation
- [ ] All fetch functions have JSDoc comments
- [ ] Parameter types are documented
- [ ] Return types are documented
- [ ] Examples included for complex queries
- [ ] Timeout behavior documented (10s default)

---

## 20. INNOVATION / WOW FACTOR

### Test 20.1: Unique Features
- [ ] Availability heatmap for admin (visual insight into student availability)
- [ ] Distance-based job filtering (haversine calculation)
- [ ] Kanban hiring pipeline view (modern UX for HR)
- [ ] Real-time application status (students see changes instantly)
- [ ] Multi-shift job scheduling (handle 2+ shifts per job)

### Test 20.2: Polish & Delight
- [ ] Smooth page transitions (no janky jumps)
- [ ] Micro-interactions (button hover, form focus)
- [ ] Empty state messaging (not just blank page)
- [ ] Success toasts for important actions
- [ ] Easter eggs or branding personality (optional)

### Test 20.3: Emerging Technologies
- [ ] Mobile app planned (or PWA for offline support)
- [ ] AI-powered job recommendations (future)
- [ ] Video interview integration (future)
- [ ] Blockchain verification of credentials (future, optional)
- [ ] AR job previews (future, optional)

### Test 20.4: User Experience Innovations
- [ ] One-click apply (don't repeat CV upload)
- [ ] Favorite jobs with smart recommendations
- [ ] Instant job notifications (real-time alert on match)
- [ ] Verified employer badges (build trust)
- [ ] Social features (referral program, student network)

### Test 20.5: Future Roadmap
- [ ] Mobile app launch (iOS + Android)
- [ ] Expand beyond Ireland (UK, EU)
- [ ] Advanced analytics for companies
- [ ] AI matching between students and employers
- [ ] Payment integration (for premium features)

---

## Test Execution Plan

### Phase 1: Static Analysis (Days 1-2)
- Code review for quality issues
- Security audit of RLS policies and Edge Functions
- Performance profiling with Lighthouse

### Phase 2: Automated Testing (Days 3-5)
- Run unit tests: `npm run test`
- Run linting: `npm run lint`
- Build optimization: `npm run build && npm run preview`

### Phase 3: Manual Testing (Days 6-10)
- Test on Chrome, Firefox, Safari, Edge (desktop)
- Test on iOS Safari, Chrome Android (mobile)
- Test accessibility with screen reader (NVDA/JAWS)
- Test on 3G throttling (Network tab)

### Phase 4: Load Testing (Days 11-12)
- Simulate 100 concurrent users browsing jobs
- Simulate 50 job applications simultaneously
- Monitor database query times under load

### Phase 5: User Acceptance Testing (Days 13-14)
- Real student signup and application flow
- Real company job posting and hiring flow
- Real admin verification workflow

---

## Issues & Recommendations (To be populated during testing)

| Category | Issue | Severity | Status | Notes |
|----------|-------|----------|--------|-------|
| (To be filled) | | | | |

---

**Last Updated**: May 12, 2026  
**Tester**: Quality Assurance Team  
**Target Release Date**: TBD
