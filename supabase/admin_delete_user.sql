-- Admin-only RPC: delete any user (student or company) and all their data.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Unauthorised: admin only'; END IF;

  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'admin_delete_user', target_id);

  DELETE FROM chat_messages          WHERE student_id = target_id OR company_id = target_id;
  DELETE FROM liked_jobs             WHERE student_id = target_id;
  DELETE FROM company_liked_students WHERE company_id = target_id OR student_id = target_id;
  DELETE FROM applications           WHERE student_id = target_id;
  DELETE FROM hire_action_log        WHERE company_id = target_id;
  DELETE FROM applications WHERE job_id IN (SELECT id FROM jobs WHERE company_id = target_id);
  DELETE FROM liked_jobs   WHERE job_id IN (SELECT id FROM jobs WHERE company_id = target_id);
  DELETE FROM jobs                   WHERE company_id = target_id;
  DELETE FROM push_subscriptions     WHERE user_id    = target_id;
  DELETE FROM export_log             WHERE user_id    = target_id;
  DELETE FROM email_sends_log        WHERE user_id    = target_id;
  DELETE FROM rpc_rate_log           WHERE user_id    = target_id;
  DELETE FROM beta_suggestions       WHERE user_id    = target_id;
  DELETE FROM students               WHERE id         = target_id;
  DELETE FROM companies              WHERE id         = target_id;
  DELETE FROM profiles               WHERE id         = target_id;
  DELETE FROM auth.users             WHERE id         = target_id;
END;
$$;
