# StudentShifts — Claude Code Context

## What this app is
StudentShifts is a job platform for students in Ireland. Students sign up, get verified (student ID + government ID reviewed by admin), then browse and apply for short-term/part-time jobs posted by verified companies.

## Tech stack
- **Frontend**: React (Vite), inline styles (no CSS framework), React Router v6
- **Backend**: Supabase (Postgres + RLS + Edge Functions + Storage + Realtime)
- **Email**: Brevo (transactional emails via Supabase Edge Function)
- **Hosting**: Render (static site deploy from GitHub main branch)
- **Auth**: Supabase Auth (email/password, email verification required)

## Key files
- `src/StudentShiftsWeb.jsx` — root router, auth state, page routing
- `src/pages/CompanyDashboard.jsx` — company's full dashboard (jobs, applicants pipeline, browse students, messaging)
- `src/pages/StudentDashboard.jsx` — student job feed with map/distance
- `src/pages/AccountPage.jsx` — profile, CV upload, availability, settings
- `src/pages/AdminPage.jsx` — admin verification queue for students + companies
- `src/pages/VerifyDocsPage.jsx` — student ID document upload at signup
- `src/lib/auth.js` — all Supabase calls (auth, DB, storage, RPC)
- `src/lib/supabase.js` — Supabase client + withTimeout helper
- `supabase/rls_policies.sql` — ALL RLS policies, run this in Supabase SQL Editor (idempotent, safe to re-run)

## Supabase tables
- `profiles` — id, name, role (student/company/admin)
- `students` — id, bio, skills[], linkedin, cv_url, cover_letter_url, profile_photo_url, status (pending/verified/rejected), availability (jsonb), job_preferences[], location_*
- `companies` — id, bio, website, cro_number, status (pending/verified/rejected)
- `jobs` — id, title, category, company_id, pay, location, days[], times{}, description, deadline, status (Active/Closed/Expired), photos[], filled_shifts text[]
- `applications` — id, student_id, job_id, status (Pending/Accepted/Rejected), pipeline_stage (applied/shortlisted/interview/trial/decision), company_notes, interview_round, trial_date, trial_time, preferred_shift text
- `liked_jobs` — student_id, job_id
- `company_liked_students` — company_id, student_id
- `chat_messages` — id, job_id, student_id, company_id, sender_id, text, created_at

## Supabase storage buckets
- `avatars` — public profile photos
- `documents` — private CVs + cover letters (student owns, company reads via signed URL)
- `verification-docs` — student ID + gov ID (admin only reads)
- `job-photos` — job banner images (public read)

## RLS approach
- All policies in `supabase/rls_policies.sql` — always edit there, never in dashboard directly
- SECURITY DEFINER RPCs: `get_company_applicant_profiles`, `get_all_verified_students`, `approve_student`, `reject_student`, `delete_account`, `get_user_emails`
- Companies read student profiles via RPC only (no direct table access to sensitive columns)

## Company Dashboard — hiring pipeline
Pipeline stages: applied → shortlisted → interview → trial → decision
- List view (tabs per stage) and Board view (kanban columns) toggle
- Detail panel slides in on click — shows profile, CV, cover letter, notes, stage actions
- Applied stage: shows Application Screening checklist (CV, cover letter, bio, skills, LinkedIn)
- Interview stage: Next Round button (increments interview_round counter)
- Trial stage: date + time pickers (saved on blur to trial_date/trial_time)
- Decision stage: Hire ✓ / Decline ✕ buttons in both the list row and the detail panel; Close Job modal (Found Student / Hired Elsewhere / No Longer Needed)
- Shortlisted tab also shows "Saved Students" (liked via Browse Students, haven't applied yet)
- Applicant preferred shift (e.g. "Monday · 20:00") shown in list row and panel header
- Hiring a student marks that shift day as filled on the job (jobs.filled_shifts); only same-shift applicants are auto-declined
- Filled shifts shown as greyed-out strikethrough pills on job cards

## Roles
- `student` — browse jobs, apply, chat with companies after acceptance
- `company` — post jobs, manage applicants pipeline, browse + message students
- `admin` — verify students and companies, no job/application access

## Always do after every code change
Commit and push to `origin/main`. Render auto-deploys from main.

## Git user
ThomasGallagher1 / thomasgallagher3103@gmail.com

## Outstanding tasks

### Multi-shift hiring logic
- If a job has 2+ shifts and company hires a student for one shift, keep job Active until all shifts are filled
- If a student applied to all shifts (no preferred_shift) and company hires them, auto-decline all others

### Security & infrastructure
- Rate limiting, JWT sessions, encryption — verify these are in place
- RLS audit — students can't read each other's data

### Student Dashboard
- Move distance badge to below Days & Times on job card
- Filters sidebar (desktop) / toggle button (mobile)
- Sort by: Best Match, Pay H→L, Pay L→H, Date Newest/Oldest, Distance Near/Far
- Saved searches feature
- Job card: horizontal layout, square image left, info middle, view+like right
- Back button below header on all inner screens
- Time filter fix: use >= not exact match

### Company Dashboard
- Email revamp: Interview stage sends email with company note + timeslot + optional Teams invite
- Layout revamp / CSS update

### Later (before full launch)
- Send all emails from Brevo account (not thomasgallagher3103@gmail.com) — waiting on Brevo login
- Update contact emails in pages (privacy@studentshifts.ie / hello@studentshifts.ie) — set up forwarding first
- Student & Government ID verification API (third-party)
- JWT sessions review
- Buy studentshifts.ie domain
- Solicitor review of Privacy Policy + Terms; register with DPC at dataprotection.ie
- Mobile app (separate project)

### Future features
- Help Centre, FAQs, Contact Us, Cookies, Ad Choices pages
- Disability section
- Landing page: header, hero + search, Companies Hiring, How It Works, By The Numbers, Download App, Jobs by Location, global footer

### Not our job (legal/compliance — needs solicitor)
- Privacy Policy (full GDPR Art. 13 — data table, legal bases, retention, rights, DPC contact)
- Terms of Service (eligibility, verification rules, acceptable use, liability, Irish law)
- Cookie banner (fixed bottom bar, dismissible, links to Privacy Policy)
- Download My Data button (Account page — exports profile, applications, liked jobs, messages as JSON)
