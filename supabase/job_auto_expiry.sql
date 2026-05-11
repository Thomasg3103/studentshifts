-- ================================================================
-- StudentShifts — Job Auto-Expiry
-- Automatically sets jobs to 'Expired' once their deadline passes.
--
-- Prerequisites:
--   1. Enable pg_cron in Supabase Dashboard:
--      Database → Extensions → search "pg_cron" → Enable
--   2. Run this script in SQL Editor
-- ================================================================

-- Function: sets status = 'Expired' on any Active job past its deadline.
-- Callable only by pg_cron (postgres superuser); revoked from all other roles.
CREATE OR REPLACE FUNCTION expire_past_deadline_jobs()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE jobs
  SET status = 'Expired'
  WHERE status = 'Active'
    AND deadline IS NOT NULL
    AND deadline < now();
$$;

-- Prevent any authenticated or anonymous user from calling this directly
REVOKE EXECUTE ON FUNCTION expire_past_deadline_jobs() FROM anon, authenticated;

-- Remove existing schedule if re-running (R3-C12: cron.unschedule throws on first run if job
-- doesn't exist yet — wrap in a DO block so it's a no-op rather than an error)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-past-deadline-jobs');
EXCEPTION WHEN OTHERS THEN
  NULL; -- job didn't exist yet on first run
END $$;

-- Schedule: runs at the top of every hour
SELECT cron.schedule(
  'expire-past-deadline-jobs',
  '0 * * * *',
  $$SELECT expire_past_deadline_jobs()$$
);
