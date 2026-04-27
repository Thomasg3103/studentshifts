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
- `jobs` — id, title, category, company_id, pay, location, days[], times{}, description, deadline, status (Active/Closed/Expired), photos[]
- `applications` — id, student_id, job_id, status (Pending/Accepted/Rejected), pipeline_stage (applied/shortlisted/interview/trial/decision), company_notes, interview_round, trial_date, trial_time
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
- Decision stage: Hire / Decline buttons; Close Job modal (Found Student / Hired Elsewhere / No Longer Needed)
- Shortlisted tab also shows "Saved Students" (liked via Browse Students, haven't applied yet)

## Roles
- `student` — browse jobs, apply, chat with companies after acceptance
- `company` — post jobs, manage applicants pipeline, browse + message students
- `admin` — verify students and companies, no job/application access

## Always do after every code change
Commit and push to `origin/main`. Render auto-deploys from main.

## Git user
ThomasGallagher1 / thomasgallagher3103@gmail.com

## Outstanding tasks

### Company Dashboard additions
- Drag-to-move in kanban board view
- Interview stage: send email with company note + timeslot + optional Teams invite
- Interview stage: multiple rounds as separate columns/sub-stages
- "Advance to Trial" pre-fills trial time from interview timeslot
- Applied stage: show full profile by default; other stages collapse profile behind "View Profile" button

### Landing page (brand new — doesn't exist)
- Header: logo left, account icon + hamburger right
- Hero: headline + job search bar
- Sections: Companies Hiring (mock), How It Works, By The Numbers, Download App, Jobs by Location
- Global footer: About, Jobs, Login, Sign Up, Help Centre, Advertise a Job, social links, FAQs, Contact

### Student Dashboard revamp
- Header: add Liked/Applied/Messages icons between account + hamburger
- Filters sidebar (desktop) / toggle button (mobile)
- Sort by: Best Match, Pay H→L, Pay L→H, Date Newest/Oldest, Distance Near/Far
- Saved searches feature
- Job card: horizontal layout, square image left, info middle, view+like right, distance shown
- Back button below header on all inner screens
- Time filter fix: use >= not exact match
- Time slot selection: student picks ONE slot if job has multiple

### Later (before full launch, not yet)
- Brevo sender email — waiting on mate with Brevo login
- Contact emails (privacy@/hello@) — waiting on new addresses being created
- Third-party ID verification API
- Buy studentshifts.ie domain
- Solicitor review of Privacy Policy + Terms; register with DPC
- Mobile app (separate project)
