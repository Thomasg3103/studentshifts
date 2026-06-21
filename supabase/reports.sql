-- ================================================================
-- StudentShifts — Reports table
-- Allows authenticated users to flag students, companies, or posts.
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('student', 'company', 'post')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_target     ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_unresolved ON reports(target_type, resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports: authenticated insert" ON reports;
DROP POLICY IF EXISTS "reports: admin read all"       ON reports;
DROP POLICY IF EXISTS "reports: admin update"         ON reports;

-- Any signed-in user can file a report for themselves
CREATE POLICY "reports: authenticated insert" ON reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = reporter_id);

-- Only admins can read reports
CREATE POLICY "reports: admin read all" ON reports
  FOR SELECT USING (is_admin());

-- Only admins can resolve (update) reports
CREATE POLICY "reports: admin update" ON reports
  FOR UPDATE USING (is_admin());

-- admin_delete_user cascade already deletes rows referencing auth.users;
-- reports.reporter_id is SET NULL, target_id is unlinked so no FK needed.
