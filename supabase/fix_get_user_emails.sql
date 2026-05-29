-- Fix get_user_emails: add SET search_path = public so table references
-- (profiles, companies, applications, jobs, rpc_rate_log) resolve correctly
-- when the function runs as SECURITY DEFINER.
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql SECURITY DEFINER VOLATILE
SET search_path = public AS $$
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

NOTIFY pgrst, 'reload schema';
