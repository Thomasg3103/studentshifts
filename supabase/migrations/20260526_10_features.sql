-- 10 new features
-- Run each block separately in Supabase SQL Editor if batching causes issues.

-- ── 1. Withdraw reason on applications ───────────────────────────────────────
ALTER TABLE applications ADD COLUMN IF NOT EXISTS withdraw_reason text;

-- ── 2. Job templates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_templates (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  data       jsonb       NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_company_all" ON job_templates;
CREATE POLICY "templates_company_all"
  ON job_templates FOR ALL
  USING (company_id = auth.uid())
  WITH CHECK (company_id = auth.uid());

-- ── 3. Shift-full waitlist ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_waitlist (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id     bigint      NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  student_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (job_id, student_id)
);
ALTER TABLE job_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_student_select" ON job_waitlist;
CREATE POLICY "waitlist_student_select"
  ON job_waitlist FOR SELECT USING (student_id = auth.uid());
DROP POLICY IF EXISTS "waitlist_student_insert" ON job_waitlist;
CREATE POLICY "waitlist_student_insert"
  ON job_waitlist FOR INSERT WITH CHECK (student_id = auth.uid());
DROP POLICY IF EXISTS "waitlist_student_delete" ON job_waitlist;
CREATE POLICY "waitlist_student_delete"
  ON job_waitlist FOR DELETE USING (student_id = auth.uid());

-- Company can read waitlist for their jobs
DROP POLICY IF EXISTS "waitlist_company_select" ON job_waitlist;
CREATE POLICY "waitlist_company_select"
  ON job_waitlist FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs j WHERE j.id = job_waitlist.job_id AND j.company_id = auth.uid()
    )
  );

-- ── 4. Interview slots (self-scheduling) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_slots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  slot_time      timestamptz NOT NULL,
  selected       boolean     DEFAULT false,
  created_at     timestamptz DEFAULT now()
);
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;

-- Company: full access to slots on their jobs
DROP POLICY IF EXISTS "slots_company_all" ON interview_slots;
CREATE POLICY "slots_company_all"
  ON interview_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = interview_slots.application_id AND j.company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = interview_slots.application_id AND j.company_id = auth.uid()
    )
  );

-- Student: read slots for their applications
DROP POLICY IF EXISTS "slots_student_select" ON interview_slots;
CREATE POLICY "slots_student_select"
  ON interview_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = interview_slots.application_id AND a.student_id = auth.uid()
    )
  );

-- Student: can mark a slot as selected
DROP POLICY IF EXISTS "slots_student_update" ON interview_slots;
CREATE POLICY "slots_student_update"
  ON interview_slots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      WHERE a.id = interview_slots.application_id AND a.student_id = auth.uid()
    )
  );

-- ── 5. Notification preferences ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type    text    NOT NULL,
  push_enabled  boolean DEFAULT true,
  email_enabled boolean DEFAULT true,
  PRIMARY KEY (user_id, event_type)
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_prefs_own" ON notification_preferences;
CREATE POLICY "notif_prefs_own"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 6. Student reliability score RPC ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_student_reliability_score(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_apps  int;
  withdrawals int;
  accepted    int;
  lbl         text;
BEGIN
  SELECT COUNT(*) INTO total_apps  FROM applications WHERE student_id = p_student_id;
  SELECT COUNT(*) INTO withdrawals FROM applications WHERE student_id = p_student_id AND withdraw_reason IS NOT NULL;
  SELECT COUNT(*) INTO accepted    FROM applications WHERE student_id = p_student_id AND status = 'Accepted';

  IF total_apps = 0 THEN
    lbl := 'New';
  ELSIF withdrawals >= 3 OR (total_apps >= 5 AND withdrawals::float / total_apps >= 0.4) THEN
    lbl := 'Flagged';
  ELSIF accepted >= 2 OR (total_apps >= 5 AND withdrawals = 0) THEN
    lbl := 'Reliable';
  ELSE
    lbl := 'New';
  END IF;

  RETURN jsonb_build_object(
    'label',       lbl,
    'total_apps',  total_apps,
    'withdrawals', withdrawals,
    'accepted',    accepted
  );
END;
$$;
GRANT EXECUTE ON FUNCTION get_student_reliability_score(uuid) TO authenticated;

-- ── 7. Skills gap preview RPC ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION count_matching_students(p_skills text[], p_category text)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT s.id)::int
  FROM students s
  WHERE s.status = 'verified'
    AND (
      p_skills IS NULL
      OR array_length(p_skills, 1) IS NULL
      OR s.skills && p_skills
    )
    AND (
      p_category IS NULL
      OR p_category = ''
      OR p_category = ANY(s.job_preferences)
    );
$$;
GRANT EXECUTE ON FUNCTION count_matching_students(text[], text) TO authenticated;

-- ── 8. Job expiry reminder function (called by pg_cron) ──────────────────────
-- This marks which jobs are expiring soon and logs them; actual email is sent
-- by the send-email Edge Function when it detects type 'expiry-reminders'.
-- The frontend CompanyDashboard also shows a banner for jobs expiring in 48h.
CREATE OR REPLACE FUNCTION get_jobs_expiring_soon(hours_ahead int DEFAULT 48)
RETURNS TABLE(job_id bigint, company_id uuid, title text, deadline date, applicant_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.id, j.company_id, j.title, j.deadline,
         COUNT(a.id) AS applicant_count
  FROM jobs j
  LEFT JOIN applications a ON a.job_id = j.id AND a.status = 'Pending'
  WHERE j.status = 'Active'
    AND j.deadline IS NOT NULL
    AND j.deadline::date = (now() + (hours_ahead || ' hours')::interval)::date
  GROUP BY j.id, j.company_id, j.title, j.deadline;
$$;
GRANT EXECUTE ON FUNCTION get_jobs_expiring_soon(int) TO authenticated;
