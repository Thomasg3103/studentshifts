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

-- Student updates their own row; status column is locked (cannot self-verify)
CREATE POLICY "students: own update" ON students
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    status = (SELECT status FROM students WHERE id = auth.uid())
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

DROP POLICY IF EXISTS "applications: student own read"      ON applications;
DROP POLICY IF EXISTS "applications: student own insert"    ON applications;
DROP POLICY IF EXISTS "applications: student own delete"    ON applications;
DROP POLICY IF EXISTS "applications: company read"          ON applications;
DROP POLICY IF EXISTS "applications: company update status" ON applications;
DROP POLICY IF EXISTS "applications: admin all"             ON applications;

-- Student reads their own applications (for Applied Jobs page)
CREATE POLICY "applications: student own read" ON applications
  FOR SELECT USING (auth.uid() = student_id);

-- Student can apply for a job, but only if their account is verified
CREATE POLICY "applications: student own insert" ON applications
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (SELECT 1 FROM students WHERE id = auth.uid() AND status = 'verified')
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

-- Company can update application status; immutable columns (student_id, job_id) are frozen
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
    student_id = (SELECT student_id FROM applications a2 WHERE a2.id = applications.id) AND
    job_id    = (SELECT job_id    FROM applications a2 WHERE a2.id = applications.id)
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
        EXISTS (SELECT 1 FROM students WHERE id = chat_messages.student_id AND status = 'verified')
      )
    )
  );

-- Admin full access
CREATE POLICY "chat_messages: admin all" ON chat_messages
  FOR ALL USING (is_admin());


-- ================================================================
-- STORAGE: avatars bucket
-- Public profile photos — readable by everyone, writable by owner
-- ================================================================
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
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
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
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents: own delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Companies can read CVs/cover letters of students who applied to their jobs
-- (storage paths are structured as userId/filename)
CREATE POLICY "documents: company read applicant docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    EXISTS (
      SELECT 1 FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE j.company_id = auth.uid()
        AND a.student_id::text = (storage.foldername(name))[1]
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
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Students can re-upload (upsert) their docs
CREATE POLICY "verification-docs: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'verification-docs' AND
    auth.uid()::text = (storage.foldername(name))[1]
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
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "job-photos: own update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'job-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
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
CREATE OR REPLACE FUNCTION approve_student(student_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE students SET status = 'verified' WHERE id = student_id;
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
END;
$$;

-- Returns emails only for users who have a relationship with the caller
-- (applied to the company's jobs, or is the caller themselves).
CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
    AND (
      -- The caller is asking about themselves
      u.id = auth.uid()
      OR
      -- Student applied to a job owned by the calling company
      EXISTS (
        SELECT 1 FROM applications a
        JOIN jobs j ON j.id = a.job_id
        WHERE j.company_id = auth.uid()
          AND a.student_id = u.id
      )
    );
$$;

-- Delete the currently authenticated user's own account.
CREATE OR REPLACE FUNCTION delete_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


-- ================================================================
-- FIX #8: Company applicant read — safe columns only (no gov_id_url / student_id_url)
-- Replaces the dropped "students: company read applicants" RLS policy.
-- Only returns rows where the student actually applied to a job owned by the caller.
-- ================================================================
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
-- Only callable by verified companies.
-- ================================================================
CREATE OR REPLACE FUNCTION get_all_verified_students()
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
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT p.id, p.name, s.bio, s.skills, s.linkedin, s.profile_photo_url,
         s.location_display, s.availability, s.job_preferences
  FROM students s
  JOIN profiles p ON p.id = s.id
  WHERE s.status = 'verified'
    AND EXISTS (SELECT 1 FROM companies c WHERE c.id = auth.uid() AND c.status = 'verified');
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
    status IN ('Active', 'Closed')
  );


-- ================================================================
-- FIX #17: Only one accepted application per job (unique partial index)
-- ================================================================
CREATE UNIQUE INDEX IF NOT EXISTS applications_one_accepted_per_job
  ON applications (job_id) WHERE status = 'Accepted';


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
