-- ================================================================
-- StudentShifts — Comprehensive Row Level Security (RLS) Policies
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to re-run: all DROP IF EXISTS before CREATE
-- ================================================================

-- ----------------------------------------------------------------
-- HELPER: is_admin()
-- Checks if the currently authenticated user is an admin.
-- SECURITY DEFINER so it bypasses RLS when reading profiles.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ----------------------------------------------------------------
-- HELPER: count_recent_applications(uid)
-- Counts how many applications a student submitted in the last hour.
-- SECURITY DEFINER so it can query applications without triggering
-- recursive RLS evaluation (42P17) from the INSERT policy.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION count_recent_applications(uid uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER VOLATILE AS $$
DECLARE
  cnt bigint;
BEGIN
  -- Serialise concurrent inserts from the same user so the rate-limit check
  -- is atomic. Without this lock, burst-concurrent requests could all pass
  -- the < 20 check before any of them commits.
  PERFORM pg_advisory_xact_lock(hashtext(uid::text));
  SELECT COUNT(*) INTO cnt FROM applications
  WHERE student_id = uid AND created_at > now() - interval '1 hour';
  RETURN cnt;
END;
$$;


-- ----------------------------------------------------------------
-- RATE LIMIT TABLE: email_sends_log
-- Tracks email sends per user for the send-email Edge Function.
-- Rate limit: 60 emails per 5-minute window per user.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_sends_log (
  id      BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_sends_log_user_time
  ON email_sends_log(user_id, sent_at);
ALTER TABLE email_sends_log ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (Edge Functions) can read/write this table


-- ================================================================
-- TABLE: profiles
-- Stores: id, name, role, created_at
-- (No email — that lives in auth.users)
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: authenticated read all"  ON profiles;
DROP POLICY IF EXISTS "profiles: own update"              ON profiles;
DROP POLICY IF EXISTS "profiles: admin all"               ON profiles;

-- Any signed-in user can read profiles (name + role only — no sensitive data here).
-- Needed for company/student conversation lists fetching names.
CREATE POLICY "profiles: authenticated read all" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only update their own profile; role column cannot be self-escalated
CREATE POLICY "profiles: own update" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Admin can do everything (read, insert, update, delete)
CREATE POLICY "profiles: admin all" ON profiles
  FOR ALL USING (is_admin());


-- ================================================================
-- TABLE: students
-- Stores: id, bio, skills, linkedin, cv_url, cover_letter_url,
--         profile_photo_url, student_id_url, gov_id_url,
--         status, location_lat, location_lng, location_display
-- ================================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students: own read"               ON students;
DROP POLICY IF EXISTS "students: own update"             ON students;
DROP POLICY IF EXISTS "students: admin read all"         ON students;
DROP POLICY IF EXISTS "students: admin update"           ON students;
DROP POLICY IF EXISTS "students: company read applicants" ON students;

-- Student reads their own row
CREATE POLICY "students: own read" ON students
  FOR SELECT USING (auth.uid() = id);

-- Student updates their own row; status column is locked except rejected→pending_review (re-submission).
CREATE POLICY "students: own update" ON students
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (
      -- Normal case: status unchanged
      status = (SELECT status FROM students WHERE id = auth.uid())
      OR
      -- F-H18: allow rejected students to re-submit verification docs
      (
        (SELECT status FROM students WHERE id = auth.uid()) = 'rejected'
        AND status = 'pending_review'
      )
    )
  );

-- Admin can read all students (pending review list, verification, etc.)
CREATE POLICY "students: admin read all" ON students
  FOR SELECT USING (is_admin());

-- Admin can update any student row (approve/reject — also covered by SECURITY DEFINER RPCs)
CREATE POLICY "students: admin update" ON students
  FOR UPDATE USING (is_admin());

-- Company read of student applicants is handled via get_company_applicant_profiles() RPC
-- (direct table access would expose gov_id_url / student_id_url verification document paths)


-- ================================================================
-- TABLE: companies
-- Stores: id, bio, website, etc.
-- ================================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies: own read"   ON companies;
DROP POLICY IF EXISTS "companies: own update" ON companies;
DROP POLICY IF EXISTS "companies: admin all"  ON companies;
DROP POLICY IF EXISTS "companies: student read" ON companies;

-- Company reads/updates their own row
CREATE POLICY "companies: own read" ON companies
  FOR SELECT USING (auth.uid() = id);

-- Company updates their own row; status column is locked (cannot self-approve)
CREATE POLICY "companies: own update" ON companies
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    status = (SELECT status FROM companies WHERE id = auth.uid())
  );

-- Students can read company info (for job detail pages)
CREATE POLICY "companies: student read" ON companies
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin full access
CREATE POLICY "companies: admin all" ON companies
  FOR ALL USING (is_admin());


-- ================================================================
-- TABLE: jobs
-- Stores: id, title, company, company_id, pay, location, days,
--         times, description, deadline, weekendRequired, photos, photoCrops
-- ================================================================
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs: public read"      ON jobs;
DROP POLICY IF EXISTS "jobs: company insert"   ON jobs;
DROP POLICY IF EXISTS "jobs: company update"   ON jobs;
DROP POLICY IF EXISTS "jobs: company delete"   ON jobs;
DROP POLICY IF EXISTS "jobs: admin all"        ON jobs;

-- Anyone (including unauthenticated) can view jobs — public job board
CREATE POLICY "jobs: public read" ON jobs
  FOR SELECT USING (true);

-- Company can only create jobs for themselves, and only if verified
CREATE POLICY "jobs: company insert" ON jobs
  FOR INSERT WITH CHECK (
    auth.uid() = company_id AND
    EXISTS (SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified')
  );

-- Company can only edit their own jobs; company_id cannot be reassigned
CREATE POLICY "jobs: company update" ON jobs
  FOR UPDATE USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

-- Company can only delete their own jobs
CREATE POLICY "jobs: company delete" ON jobs
  FOR DELETE USING (auth.uid() = company_id);

-- Admin full access
CREATE POLICY "jobs: admin all" ON jobs
  FOR ALL USING (is_admin());


-- ================================================================
-- TABLE: liked_jobs
-- Stores: student_id, job_id (composite PK)
-- ================================================================
ALTER TABLE liked_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "liked_jobs: own read"   ON liked_jobs;
DROP POLICY IF EXISTS "liked_jobs: own insert" ON liked_jobs;
DROP POLICY IF EXISTS "liked_jobs: own delete" ON liked_jobs;

CREATE POLICY "liked_jobs: own read" ON liked_jobs
  FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "liked_jobs: own insert" ON liked_jobs
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "liked_jobs: own delete" ON liked_jobs
  FOR DELETE USING (auth.uid() = student_id);


-- ================================================================
-- TABLE: applications
-- Stores: id, student_id, job_id, status (default 'Pending'), created_at
-- ================================================================
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- S-C3: Prevent duplicate applications via direct SQL (createApplication already guards this,
-- but the DB constraint is the last line of defence).
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_student_job_unique;
ALTER TABLE applications ADD CONSTRAINT applications_student_job_unique UNIQUE (student_id, job_id);

-- S-C4: Enforce valid status values at the DB level.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('Pending', 'Accepted', 'Rejected'));

DROP POLICY IF EXISTS "applications: student own read"      ON applications;
DROP POLICY IF EXISTS "applications: student own insert"    ON applications;
DROP POLICY IF EXISTS "applications: student own delete"    ON applications;
DROP POLICY IF EXISTS "applications: company read"          ON applications;
DROP POLICY IF EXISTS "applications: company update status" ON applications;
DROP POLICY IF EXISTS "applications: admin all"             ON applications;

-- Student reads their own applications (for Applied Jobs page)
CREATE POLICY "applications: student own read" ON applications
  FOR SELECT USING (auth.uid() = student_id);

-- Student can apply for a job, only if verified and within rate limit (max 20 per hour),
-- and only if the job is Active with a deadline that hasn't passed.
CREATE POLICY "applications: student own insert" ON applications
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (SELECT 1 FROM students WHERE id = auth.uid() AND status = 'verified') AND
    count_recent_applications(auth.uid()) < 20 AND
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = applications.job_id
        AND j.status = 'Active'
        AND (j.deadline IS NULL OR j.deadline >= current_date)
    )
  );

-- Student can only withdraw applications that are still Pending or Rejected (not Accepted)
CREATE POLICY "applications: student own delete" ON applications
  FOR DELETE USING (auth.uid() = student_id AND status IN ('Pending', 'Rejected'));

-- Company can read all applications to their own jobs
CREATE POLICY "applications: company read" ON applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = applications.job_id
        AND jobs.company_id = auth.uid()
    )
  );

-- Company can update application status, pipeline stage, notes, interview round, and trial schedule.
-- Self-referencing subqueries (to freeze student_id/job_id) are omitted: they trigger recursive RLS
-- evaluation that causes the subquery to return NULL, making WITH CHECK fail silently.
-- The USING clause already limits updates to the company's own job applications.
CREATE POLICY "applications: company update status" ON applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = applications.job_id
        AND jobs.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = applications.job_id
        AND jobs.company_id = auth.uid()
    ) AND
    status IN ('Pending', 'Accepted', 'Rejected') AND
    pipeline_stage IN ('applied', 'shortlisted', 'interview', 'trial', 'decision')
  );

-- Admin full access
CREATE POLICY "applications: admin all" ON applications
  FOR ALL USING (is_admin());


-- ================================================================
-- TABLE: chat_messages
-- Stores: id, job_id, student_id, company_id, sender_id, text, created_at
-- ================================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages: student read"   ON chat_messages;
DROP POLICY IF EXISTS "chat_messages: company read"   ON chat_messages;
DROP POLICY IF EXISTS "chat_messages: student insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages: company insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_messages: admin all"      ON chat_messages;

-- Student can read messages in their conversations
CREATE POLICY "chat_messages: student read" ON chat_messages
  FOR SELECT USING (auth.uid() = student_id);

-- Company can read messages for their jobs
CREATE POLICY "chat_messages: company read" ON chat_messages
  FOR SELECT USING (auth.uid() = company_id);

-- Student can only send messages in conversations they belong to.
-- For direct messages (job_id IS NULL): only if the company messaged them first, or they have an accepted application with that company.
-- For job messages (job_id IS NOT NULL): only if they have an accepted application for that job.
CREATE POLICY "chat_messages: student insert" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    auth.uid() = sender_id AND
    (
      (
        job_id IS NULL AND (
          EXISTS (
            SELECT 1 FROM chat_messages cm
            WHERE cm.job_id IS NULL
              AND cm.student_id = auth.uid()
              AND cm.company_id = chat_messages.company_id
              AND cm.sender_id = chat_messages.company_id
          ) OR
          EXISTS (
            SELECT 1 FROM applications a
            JOIN jobs j ON j.id = a.job_id
            WHERE j.company_id = chat_messages.company_id
              AND a.student_id = auth.uid()
              AND a.status = 'Accepted'
          )
        )
      ) OR
      (
        job_id IS NOT NULL AND
        EXISTS (
          SELECT 1 FROM applications a
          JOIN jobs j ON j.id = a.job_id
          WHERE a.student_id = auth.uid()
            AND a.job_id = chat_messages.job_id
            AND j.company_id = chat_messages.company_id
            AND a.status = 'Accepted'
        )
      )
    )
  );

-- Company can send messages only to students with an accepted application for the job (job messages),
-- or to any verified student for direct outreach (job_id IS NULL).
CREATE POLICY "chat_messages: company insert" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = company_id AND
    auth.uid() = sender_id AND
    (
      (
        job_id IS NOT NULL AND
        EXISTS (SELECT 1 FROM jobs WHERE id = chat_messages.job_id AND company_id = auth.uid()) AND
        EXISTS (
          SELECT 1 FROM applications a
          WHERE a.job_id = chat_messages.job_id
            AND a.student_id = chat_messages.student_id
            AND a.status = 'Accepted'
        )
      ) OR
      (
        job_id IS NULL AND
        EXISTS (SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified') AND
        EXISTS (SELECT 1 FROM students WHERE id = chat_messages.student_id AND status = 'verified' AND allow_company_dm = TRUE)
      )
    )
  );

-- Admin full access
CREATE POLICY "chat_messages: admin all" ON chat_messages
  FOR ALL USING (is_admin());


-- ================================================================
-- STORAGE: avatars bucket
-- Public profile photos — readable by everyone, writable by owner
-- Bucket must be marked public so <img> tags load without auth headers
-- ================================================================
UPDATE storage.buckets SET public = true WHERE id = 'avatars';

DROP POLICY IF EXISTS "avatars: public read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: own upload"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: own update"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: own delete"   ON storage.objects;

-- Anyone can view avatars (they are public profile photos)
CREATE POLICY "avatars: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Users can upload to their own folder only (folder = their user ID)
CREATE POLICY "avatars: own upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "avatars: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "avatars: own delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ================================================================
-- STORAGE: documents bucket (CVs, cover letters)
-- Private — only owner + companies they applied to
-- ================================================================
DROP POLICY IF EXISTS "documents: own read"                    ON storage.objects;
DROP POLICY IF EXISTS "documents: own upload"                  ON storage.objects;
DROP POLICY IF EXISTS "documents: own update"                  ON storage.objects;
DROP POLICY IF EXISTS "documents: own delete"                  ON storage.objects;
DROP POLICY IF EXISTS "documents: company read applicant docs" ON storage.objects;

-- Students can read their own documents
CREATE POLICY "documents: own read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Students can upload to their own folder
CREATE POLICY "documents: own upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "documents: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "documents: own delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Companies can read CVs/cover letters of students who applied to their jobs
-- (storage paths are structured as userId/cv.ext or userId/cover-letter.ext)
-- Restricted to Accepted applications only — rejected applicants' docs are not accessible.
CREATE POLICY "documents: company read applicant docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    (split_part(name, '/', 2) LIKE 'cv.%' OR split_part(name, '/', 2) LIKE 'cover-letter.%') AND
    EXISTS (
      SELECT 1 FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE j.company_id = auth.uid()
        AND a.student_id::text = (storage.foldername(name))[1]
        AND a.status = 'Accepted'
    )
  );


-- ================================================================
-- STORAGE: verification-docs bucket
-- Sensitive ID documents — only owner upload, admin read
-- ================================================================
DROP POLICY IF EXISTS "verification-docs: own upload" ON storage.objects;
DROP POLICY IF EXISTS "verification-docs: own read"   ON storage.objects;
DROP POLICY IF EXISTS "verification-docs: own update" ON storage.objects;
DROP POLICY IF EXISTS "verification-docs: admin read" ON storage.objects;

-- Students can upload their own verification docs
CREATE POLICY "verification-docs: own upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

-- Students can re-upload (upsert) their docs
CREATE POLICY "verification-docs: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

-- Students can read their own docs (e.g. to confirm upload)
CREATE POLICY "verification-docs: own read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admin can read all verification docs for review
CREATE POLICY "verification-docs: admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'verification-docs' AND
    is_admin()
  );


-- ================================================================
-- STORAGE: job-photos bucket
-- Job banner images — public read, writable only by the owning company
-- ================================================================
DROP POLICY IF EXISTS "job-photos: public read"  ON storage.objects;
DROP POLICY IF EXISTS "job-photos: own upload"   ON storage.objects;
DROP POLICY IF EXISTS "job-photos: own update"   ON storage.objects;
DROP POLICY IF EXISTS "job-photos: own delete"   ON storage.objects;

CREATE POLICY "job-photos: public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'job-photos');

-- Companies can only upload/update/delete photos in their own folder (folder = their user ID)
CREATE POLICY "job-photos: own upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "job-photos: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    name NOT LIKE '%..%'
  );

CREATE POLICY "job-photos: own delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ================================================================
-- RPC FUNCTIONS (SECURITY DEFINER — admin-only, bypass RLS safely)
-- ================================================================

-- Approve a student: sets status = 'verified'. Admin only.
-- Blocks approval if the student has not uploaded both verification documents.
CREATE OR REPLACE FUNCTION approve_student(student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_id
      AND s.student_id_url IS NOT NULL
      AND s.gov_id_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot approve: student has not uploaded verification documents';
  END IF;
  UPDATE students SET status = 'verified', student_id_url = NULL, gov_id_url = NULL WHERE id = student_id;
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'approve_student', student_id);
END;
$$;

-- Reject a student: sets status = 'rejected'. Admin only.
CREATE OR REPLACE FUNCTION reject_student(student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE students SET status = 'rejected' WHERE id = student_id;
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'reject_student', student_id);
END;
$$;

-- Approve a company: sets status = 'verified'. Admin only.
CREATE OR REPLACE FUNCTION approve_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'verified' WHERE id = company_id;
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'approve_company', company_id);
END;
$$;

-- Reject a company: sets status = 'rejected'. Admin only.
CREATE OR REPLACE FUNCTION reject_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'rejected' WHERE id = company_id;
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'reject_company', company_id);
END;
$$;

-- Tracks daily calls to get_user_emails for rate-limiting.
CREATE TABLE IF NOT EXISTS rpc_rate_log (
  id        BIGSERIAL PRIMARY KEY,
  user_id   UUID NOT NULL,
  rpc_name  TEXT NOT NULL,
  called_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rpc_rate_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rpc_rate_log_user_rpc ON rpc_rate_log(user_id, rpc_name, called_at);

-- Returns emails only for users who have a relationship with the caller.
-- Limited to 50 IDs per call and 200 calls per day per user.
CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE AS $$
DECLARE
  caller_role text;
  daily_count bigint;
BEGIN
  IF array_length(user_ids, 1) > 50 THEN
    RAISE EXCEPTION 'Too many user IDs requested (max 50)';
  END IF;
  SELECT p.role INTO caller_role FROM profiles p WHERE p.id = auth.uid();
  -- Daily rate limit: 200 calls per day per user (prevents bulk enumeration across many calls)
  SELECT COUNT(*) INTO daily_count FROM rpc_rate_log
    WHERE user_id = auth.uid() AND rpc_name = 'get_user_emails'
      AND called_at > now() - interval '24 hours';
  IF daily_count >= 200 THEN
    RAISE EXCEPTION 'Daily rate limit exceeded for email lookup';
  END IF;
  INSERT INTO rpc_rate_log(user_id, rpc_name) VALUES (auth.uid(), 'get_user_emails');
  RETURN QUERY
    SELECT u.id, u.email::text
    FROM auth.users u
    WHERE u.id = ANY(user_ids)
      AND (
        caller_role = 'admin'
        OR
        u.id = auth.uid()
        OR
        (caller_role = 'company' AND
          EXISTS (SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified') AND
          EXISTS (
            SELECT 1 FROM applications a
            JOIN jobs j ON j.id = a.job_id
            WHERE j.company_id = auth.uid()
              AND a.student_id = u.id
          )
        )
      );
END;
$$;

-- Returns emails for all students who have applied to any of a company's jobs.
-- Called server-side from the send-email Edge Function to validate recipients.
-- SECURITY DEFINER + explicit company_uuid param (no auth.uid() dependency).
CREATE OR REPLACE FUNCTION get_company_applicant_emails(company_uuid uuid)
RETURNS TABLE(email text)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF company_uuid <> auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;
  RETURN QUERY
    SELECT u.email::text
    FROM auth.users u
    WHERE u.id IN (
      SELECT a.student_id FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE j.company_id = company_uuid
    );
END;
$$;

-- Delete the currently authenticated user's own account.
CREATE OR REPLACE FUNCTION delete_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'delete_account', auth.uid());
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


-- ================================================================
-- FIX #8: Company applicant read — safe columns only (no gov_id_url / student_id_url)
-- Replaces the dropped "students: company read applicants" RLS policy.
-- Only returns rows where the student actually applied to a job owned by the caller.
-- ================================================================
DROP FUNCTION IF EXISTS get_company_applicant_profiles(uuid[]);
CREATE OR REPLACE FUNCTION get_company_applicant_profiles(student_ids uuid[])
RETURNS TABLE (
  id               uuid,
  bio              text,
  skills           text[],
  linkedin         text,
  cv_url           text,
  cover_letter_url text,
  profile_photo_url text
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT s.id, s.bio, s.skills, s.linkedin, s.cv_url, s.cover_letter_url, s.profile_photo_url
  FROM students s
  WHERE s.id = ANY(student_ids)
    AND EXISTS (
      SELECT 1 FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE j.company_id = auth.uid()
        AND a.student_id = s.id
    );
$$;


-- ================================================================
-- FIX #9: get_all_verified_students — safe columns only (no lat/lng GPS coordinates)
-- Only callable by verified companies or admins; raises for all others.
-- Paginated: p_limit (max 200) and p_offset to cap data exposure per call.
-- ================================================================
DROP FUNCTION IF EXISTS get_all_verified_students();
DROP FUNCTION IF EXISTS get_all_verified_students(int, int);
CREATE OR REPLACE FUNCTION get_all_verified_students(p_limit int DEFAULT 200, p_offset int DEFAULT 0)
RETURNS TABLE (
  id                uuid,
  name              text,
  bio               text,
  skills            text[],
  linkedin          text,
  profile_photo_url text,
  location_display  text,
  availability      jsonb,
  job_preferences   text[]
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT is_admin() AND NOT EXISTS (
    SELECT 1 FROM companies WHERE companies.id = auth.uid() AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Unauthorised: verified company or admin required';
  END IF;
  IF p_limit > 200 THEN
    RAISE EXCEPTION 'p_limit cannot exceed 200';
  END IF;
  RETURN QUERY
    SELECT p.id, p.name, s.bio, s.skills, s.linkedin, s.profile_photo_url,
           s.location_display, s.availability, s.job_preferences
    FROM students s
    JOIN profiles p ON p.id = s.id
    WHERE s.status = 'verified'
    ORDER BY p.id
    LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ================================================================
-- get_profile_photos — returns id + profile_photo_url for any list of user IDs.
-- Profile photos are stored as public URLs (avatars bucket is public),
-- so exposing them to any authenticated caller is safe.
-- Used by the messaging pages to show student/company avatars in conversation lists.
-- ================================================================
DROP FUNCTION IF EXISTS get_profile_photos(uuid[]);
CREATE OR REPLACE FUNCTION get_profile_photos(user_ids uuid[])
RETURNS TABLE (id uuid, profile_photo_url text)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;
  RETURN QUERY
    SELECT s.id, s.profile_photo_url FROM students s WHERE s.id = ANY(user_ids)
    UNION ALL
    SELECT c.id, c.profile_photo_url FROM companies c WHERE c.id = ANY(user_ids);
END;
$$;


-- ================================================================
-- FIX #14: Prevent cv_url/cover_letter_url path injection
-- Students cannot set their document URL to another student's storage path.
-- ================================================================
DROP POLICY IF EXISTS "students: own update" ON students;

CREATE POLICY "students: own update" ON students
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    status = (SELECT status FROM students WHERE id = auth.uid()) AND
    (cv_url IS NULL OR cv_url LIKE auth.uid()::text || '/%') AND
    (cover_letter_url IS NULL OR cover_letter_url LIKE auth.uid()::text || '/%')
  );


-- ================================================================
-- FIX #16: Job status must be 'Active' or 'Closed' — no arbitrary strings
-- ================================================================
DROP POLICY IF EXISTS "jobs: company insert" ON jobs;
DROP POLICY IF EXISTS "jobs: company update" ON jobs;

CREATE POLICY "jobs: company insert" ON jobs
  FOR INSERT WITH CHECK (
    auth.uid() = company_id AND
    EXISTS (SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified') AND
    status IN ('Active', 'Closed')
  );

CREATE POLICY "jobs: company update" ON jobs
  FOR UPDATE USING (auth.uid() = company_id)
  WITH CHECK (
    auth.uid() = company_id AND
    status IN ('Active', 'Closed', 'Expired')
  );


-- FIX #17 removed: multi-shift jobs allow multiple Accepted applications (one per shift)
DROP INDEX IF EXISTS applications_one_accepted_per_job;

-- ================================================================
-- CONSTRAINT: filled_shifts must be a subset of days
-- Prevents companies from forging filled_shifts with invalid days.
-- ================================================================
CREATE OR REPLACE FUNCTION validate_filled_shifts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.filled_shifts IS NOT NULL AND array_length(NEW.filled_shifts, 1) > 0
     AND NEW.days IS NOT NULL AND array_length(NEW.days, 1) > 0
  THEN
    IF NOT (NEW.filled_shifts <@ NEW.days) THEN
      RAISE EXCEPTION 'filled_shifts must be a subset of days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_filled_shifts ON jobs;
CREATE TRIGGER trg_validate_filled_shifts
  BEFORE INSERT OR UPDATE OF filled_shifts ON jobs
  FOR EACH ROW EXECUTE FUNCTION validate_filled_shifts();


-- ================================================================
-- FIX #19: CRO number — unique constraint and format validation (1-8 digits)
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cro_number_unique'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_cro_number_unique UNIQUE (cro_number);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_cro_number_format'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_cro_number_format
      CHECK (cro_number IS NULL OR cro_number ~ '^[0-9]{1,8}$');
  END IF;
END $$;


-- ================================================================
-- FIX #22: Chat message length — no message longer than 4000 characters
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_text_length'
  ) THEN
    ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_text_length
      CHECK (char_length(text) <= 4000);
  END IF;
END $$;


-- ================================================================
-- PIPELINE: Hiring pipeline columns on applications table
-- pipeline_stage tracks where in the hiring funnel each applicant is.
-- company_notes stores private notes visible only to the company.
-- ================================================================
DO $$
BEGIN
  -- Add pipeline_stage with valid-stage constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'pipeline_stage'
  ) THEN
    ALTER TABLE applications
      ADD COLUMN pipeline_stage text NOT NULL DEFAULT 'applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_pipeline_stage_check'
  ) THEN
    ALTER TABLE applications
      ADD CONSTRAINT applications_pipeline_stage_check
        CHECK (pipeline_stage IN ('applied', 'shortlisted', 'interview', 'trial', 'decision'));
  END IF;

  -- Add company_notes (nullable free text, no length limit needed — not public-facing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'company_notes'
  ) THEN
    ALTER TABLE applications
      ADD COLUMN company_notes text;
  END IF;

  -- Interview round counter (incremented each time company advances to next interview round)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_round'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_round integer NOT NULL DEFAULT 1;
  END IF;

  -- Trial shift schedule
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'trial_date'
  ) THEN
    ALTER TABLE applications ADD COLUMN trial_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'trial_time'
  ) THEN
    ALTER TABLE applications ADD COLUMN trial_time text;
  END IF;

  -- Interview schedule (date + time for sending invite to student)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_date'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_time'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_time text;
  END IF;

  -- Per-round schedule array: [{date, time}, ...] indexed by round (0-based)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_rounds_data'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_rounds_data jsonb NOT NULL DEFAULT '[]';
  END IF;

  -- Student's preferred shift (e.g. "Monday · 09:00"), null if applied to all shifts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'preferred_shift'
  ) THEN
    ALTER TABLE applications ADD COLUMN preferred_shift text;
  END IF;

  -- Days that have been filled (hired) on a job posting, e.g. ARRAY['Monday','Wednesday']
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'filled_shifts'
  ) THEN
    ALTER TABLE jobs ADD COLUMN filled_shifts text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;


-- ================================================================
-- PIPELINE: Company liked students
-- Stores students a company has saved from Browse Students.
-- Surfaced alongside shortlisted applicants so companies have one
-- place to see everyone they're interested in.
-- ================================================================
CREATE TABLE IF NOT EXISTS company_liked_students (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_id, student_id)
);
ALTER TABLE company_liked_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_liked: own read"   ON company_liked_students;
DROP POLICY IF EXISTS "company_liked: own insert" ON company_liked_students;
DROP POLICY IF EXISTS "company_liked: own delete" ON company_liked_students;
DROP POLICY IF EXISTS "company_liked: admin all"  ON company_liked_students;

CREATE POLICY "company_liked: own read" ON company_liked_students
  FOR SELECT USING (auth.uid() = company_id);

CREATE POLICY "company_liked: own insert" ON company_liked_students
  FOR INSERT WITH CHECK (
    auth.uid() = company_id AND
    EXISTS (SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified')
  );

CREATE POLICY "company_liked: own delete" ON company_liked_students
  FOR DELETE USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "company_liked: own update" ON company_liked_students;
CREATE POLICY "company_liked: own update" ON company_liked_students
  FOR UPDATE USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "company_liked: admin all" ON company_liked_students
  FOR ALL USING (is_admin());


-- ================================================================
-- SECURITY: Lock application identity fields (student_id, job_id)
--
-- The "applications: company update status" policy cannot use a
-- self-referencing WITH CHECK subquery to freeze student_id/job_id
-- because PostgreSQL evaluates it with RLS active, making the
-- subquery return NULL and silently failing (see FIX #16 comment).
--
-- Without this trigger a verified company could reassign student_id
-- on one of their application rows to a student who never applied,
-- which would satisfy the "documents: company read applicant docs"
-- storage policy and grant access to that student's CV / cover letter.
--
-- A BEFORE UPDATE trigger has no such restriction and is the correct
-- layer for immutable-column enforcement.
-- ================================================================
CREATE OR REPLACE FUNCTION lock_application_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.student_id <> OLD.student_id THEN
    RAISE EXCEPTION 'application.student_id is immutable';
  END IF;
  IF NEW.job_id <> OLD.job_id THEN
    RAISE EXCEPTION 'application.job_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_identity_lock ON applications;
CREATE TRIGGER applications_identity_lock
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION lock_application_identity();


-- ================================================================
-- SECURITY: hire_action_log — rate limiting + idempotency for hire-applicant Edge Function
-- ================================================================
CREATE TABLE IF NOT EXISTS hire_action_log (
  id              BIGSERIAL PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES auth.users(id),
  action          TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  result          JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hire_action_log_company ON hire_action_log(company_id, created_at);
-- created_at intentionally excluded: idempotency must be per-key, not per-key-per-millisecond
DROP INDEX IF EXISTS idx_hire_action_log_ikey;
CREATE UNIQUE INDEX IF NOT EXISTS idx_hire_action_log_ikey ON hire_action_log(company_id, idempotency_key);

ALTER TABLE hire_action_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hire_action_log: company insert" ON hire_action_log;
CREATE POLICY "hire_action_log: company insert" ON hire_action_log
  FOR INSERT WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "hire_action_log: company select" ON hire_action_log;
CREATE POLICY "hire_action_log: company select" ON hire_action_log
  FOR SELECT USING (auth.uid() = company_id);


-- ================================================================
-- GDPR: audit_log table
-- Tracks sensitive data actions (approve/reject student, delete
-- account, hire applicant) for accountability under GDPR Art. 5(2).
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  target_id  UUID,
  metadata   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, created_at);

-- Only admins can read audit_log; no one can delete entries
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log: admin read" ON audit_log;
CREATE POLICY "audit_log: admin read" ON audit_log
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "audit_log: service insert" ON audit_log;
-- No INSERT policy: only service_role (SECURITY DEFINER RPCs + Edge Functions) can write audit_log
-- Authenticated users must never be able to self-insert audit entries


-- ================================================================
-- PRIVACY: allow_company_dm column on students
-- Controls whether companies can initiate DMs before a student applies.
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'allow_company_dm'
  ) THEN
    ALTER TABLE students ADD COLUMN allow_company_dm BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- ================================================================
-- PROFILE: profile_photo_url on companies
-- Mirrors the students.profile_photo_url column so company avatars
-- can be shown in the student-side messaging conversation list.
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN profile_photo_url text;
  END IF;
END $$;


-- ================================================================
-- SECURITY: data export rate limit — 1 per 24 hours per user
-- Tracked via a lightweight table queried by the export RPC.
-- ================================================================
CREATE TABLE IF NOT EXISTS export_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_export_log_user ON export_log(user_id, exported_at);

ALTER TABLE export_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "export_log: own insert" ON export_log;
CREATE POLICY "export_log: own insert" ON export_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "export_log: own select" ON export_log;
CREATE POLICY "export_log: own select" ON export_log
  FOR SELECT USING (auth.uid() = user_id);


-- ================================================================
-- get_job_applicant_counts — returns non-rejected application count per job.
-- SECURITY DEFINER so students can see counts without accessing others' rows.
-- Safe to expose: returns aggregate counts only, no personal data.
-- ================================================================
-- ================================================================
-- OBSERVABILITY: slow_queries view
-- Run this in Supabase SQL Editor to surface queries averaging > 200ms.
-- Requires pg_stat_statements (enabled by default on Supabase).
-- Reset stats with: SELECT pg_stat_statements_reset();
-- ================================================================
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  round(mean_exec_time::numeric, 1)  AS avg_ms,
  calls,
  round(total_exec_time::numeric, 0) AS total_ms,
  left(query, 300)                   AS query_preview
FROM pg_stat_statements
WHERE mean_exec_time > 200
ORDER BY mean_exec_time DESC
LIMIT 25;


DROP FUNCTION IF EXISTS get_job_applicant_counts(uuid[]);
DROP FUNCTION IF EXISTS get_job_applicant_counts(bigint[]);
CREATE OR REPLACE FUNCTION get_job_applicant_counts(job_ids bigint[])
RETURNS TABLE(job_id bigint, applicant_count bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;
  RETURN QUERY
    SELECT a.job_id, COUNT(*) AS applicant_count
    FROM applications a
    WHERE a.job_id = ANY(job_ids)
      AND a.status != 'Rejected'
    GROUP BY a.job_id;
END;
$$;


-- ================================================================
-- BUG FIX #1: handle_new_user trigger
-- Creates profiles + students/companies rows when a new auth user
-- signs up. Without this, getProfile() fails for every new user.
-- Metadata passed via supabase.auth.signUp options.data:
--   name, role, cro_number (companies only)
-- ================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  user_role text := NEW.raw_user_meta_data->>'role';
  user_name text := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
BEGIN
  -- Prevent admin self-assignment: only 'student' and 'company' are valid signup roles
  IF user_role NOT IN ('student', 'company') THEN
    user_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, name, role)
    VALUES (NEW.id, user_name, user_role)
    ON CONFLICT (id) DO NOTHING;

  IF user_role = 'student' THEN
    -- 'pending' means docs not yet uploaded; becomes 'pending_review' after VerifyDocsPage upload
    INSERT INTO public.students (id, status)
      VALUES (NEW.id, 'pending')
      ON CONFLICT (id) DO NOTHING;
  ELSIF user_role = 'company' THEN
    -- Companies have no doc upload step; go straight to admin review queue
    INSERT INTO public.companies (id, cro_number, status)
      VALUES (NEW.id, NEW.raw_user_meta_data->>'cro_number', 'pending_review')
      ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ================================================================
-- BUG FIX: close_reason column on jobs
-- Records why a job was closed: 'found_student' | 'hired_elsewhere' | 'no_longer_needed'
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'close_reason'
  ) THEN
    ALTER TABLE jobs ADD COLUMN close_reason text;
  END IF;
END $$;


-- ================================================================
-- BUG FIX: verification-docs own-delete policy
-- Students must be able to delete their own verification documents
-- so that delete_account() achieves full GDPR Art. 17 erasure.
-- ================================================================
DROP POLICY IF EXISTS "verification-docs: own delete" ON storage.objects;
CREATE POLICY "verification-docs: own delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- ================================================================
-- FIX #18: Server-side file size + MIME type enforcement on buckets
-- Mirrors the client-side checks in uploads.js so a rogue API call
-- cannot bypass them by uploading directly to the storage API.
-- ================================================================
UPDATE storage.buckets SET
  file_size_limit   = 5242880,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'avatars';

UPDATE storage.buckets SET
  file_size_limit   = 10485760,  -- 10 MB
  allowed_mime_types = ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'documents';

UPDATE storage.buckets SET
  file_size_limit   = 10485760,  -- 10 MB
  allowed_mime_types = ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'verification-docs';

UPDATE storage.buckets SET
  file_size_limit   = 5242880,  -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'job-photos';


-- ================================================================
-- FIX #20: DB CHECK constraints for user-supplied text fields
-- Prevents oversized inputs from being stored even if client
-- validation is bypassed via the API.
-- ================================================================
DO $$
BEGIN
  -- Student bio: max 500 characters
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_bio_length'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_bio_length
      CHECK (bio IS NULL OR char_length(bio) <= 500);
  END IF;

  -- Student LinkedIn: must look like a URL if set.
  -- NOT VALID skips the check on existing rows (some may lack the scheme prefix)
  -- but enforces the constraint on all future inserts and updates.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_linkedin_format'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_linkedin_format
      CHECK (linkedin IS NULL OR linkedin ~ '^https?://') NOT VALID;
  END IF;

  -- Student skills: max 50 items in the array
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_skills_count'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_skills_count
      CHECK (skills IS NULL OR cardinality(skills) <= 50);
  END IF;

  -- Job description: max 10,000 characters
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_description_length'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_description_length
      CHECK (description IS NULL OR char_length(description) <= 10000);
  END IF;
END $$;

-- ================================================================
-- Availability heatmap — aggregate student availability by day/slot
-- Used by CompanyDashboard to show when students are generally free.
-- Returns one row per (day, slot) pair with a count of verified students.
-- ================================================================
CREATE OR REPLACE FUNCTION get_availability_heatmap()
RETURNS TABLE (day text, slot text, student_count bigint)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF NOT is_admin() AND NOT EXISTS (
    SELECT 1 FROM companies WHERE id = auth.uid() AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Unauthorised: verified company or admin required';
  END IF;
  RETURN QUERY
    SELECT
      kv.key   AS day,
      slot_val AS slot,
      COUNT(*) AS student_count
    FROM students,
         jsonb_each(availability)              AS kv,
         jsonb_array_elements_text(kv.value)   AS slot_val
    WHERE status = 'verified'
    GROUP BY 1, 2;
END;
$$;
