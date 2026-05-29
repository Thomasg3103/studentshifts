-- Fix approve_company and reject_company RPCs
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS approve_company(uuid);
CREATE FUNCTION approve_company(company_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rows_affected int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'verified' WHERE id = company_id AND status = 'pending_review';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    INSERT INTO audit_log (actor_id, action, target_id)
      VALUES (auth.uid(), 'approve_company', company_id);
  END IF;
  RETURN rows_affected > 0;
END;
$$;

DROP FUNCTION IF EXISTS reject_company(uuid);
CREATE FUNCTION reject_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'rejected' WHERE id = company_id AND status = 'pending_review';
  INSERT INTO audit_log (actor_id, action, target_id)
    VALUES (auth.uid(), 'reject_company', company_id);
END;
$$;
