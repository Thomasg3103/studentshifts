-- Applicant Filtering — Option B (structured student profile) + Option A (screening questions)
-- Run in Supabase SQL Editor after urgent_shifts.sql and forum.sql.

-- ── Option B: Structured student profile fields ────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS transport       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS can_start       TEXT,
  ADD COLUMN IF NOT EXISTS work_experience TEXT,
  ADD COLUMN IF NOT EXISTS right_to_work   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_licence  BOOLEAN NOT NULL DEFAULT false;

-- ── Option A: Screening questions on jobs ─────────────────────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS screening_questions JSONB NOT NULL DEFAULT '[]';

-- ── Option A: Screening answers on applications ───────────────────────────
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS screening_answers JSONB NOT NULL DEFAULT '[]';

-- ── Updated get_company_applicant_profiles — includes structured fields ────
DROP FUNCTION IF EXISTS get_company_applicant_profiles(uuid[]);
CREATE FUNCTION get_company_applicant_profiles(student_ids uuid[])
RETURNS TABLE (
  id                uuid,
  bio               text,
  skills            text[],
  linkedin          text,
  cv_url            text,
  cover_letter_url  text,
  profile_photo_url text,
  transport         text[],
  can_start         text,
  work_experience   text,
  right_to_work     boolean,
  driver_licence    boolean
)
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE call_count bigint;
BEGIN
  SELECT COUNT(*) INTO call_count FROM rpc_rate_log
  WHERE user_id = auth.uid() AND rpc_name = 'get_company_applicant_profiles'
    AND called_at > now() - interval '1 minute';
  IF call_count >= 60 THEN
    RAISE EXCEPTION 'Rate limit exceeded — too many profile requests';
  END IF;
  INSERT INTO rpc_rate_log (user_id, rpc_name) VALUES (auth.uid(), 'get_company_applicant_profiles');
  RETURN QUERY
    SELECT s.id, s.bio, s.skills, s.linkedin, s.cv_url, s.cover_letter_url, s.profile_photo_url,
           s.transport, s.can_start, s.work_experience, s.right_to_work, s.driver_licence
    FROM students s
    WHERE s.id = ANY(student_ids)
      AND EXISTS (
        SELECT 1 FROM applications a
        JOIN jobs j ON j.id = a.job_id
        WHERE j.company_id = auth.uid()
          AND a.student_id = s.id
      );
END;
$$;
