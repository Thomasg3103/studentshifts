-- ================================================================
-- StudentShifts — Admin Pending RPCs
-- Self-contained: adds required columns then creates the RPCs.
-- Run this in the Supabase SQL Editor.
-- ================================================================

-- Ensure companies has status + cro_number columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cro_number text;

-- Backfill: any company that existed before this migration is already verified
UPDATE companies SET status = 'verified' WHERE status = 'pending_review';

-- Approve / reject RPCs
CREATE OR REPLACE FUNCTION approve_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'verified' WHERE id = company_id;
END;
$$;

CREATE OR REPLACE FUNCTION reject_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  UPDATE companies SET status = 'rejected' WHERE id = company_id;
END;
$$;

-- Fetch pending students (joins auth.users for email) — admin only
CREATE OR REPLACE FUNCTION get_pending_students()
RETURNS TABLE(id uuid, name text, email text, student_id_url text, gov_id_url text, status text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  RETURN QUERY
    SELECT s.id, p.name::text, u.email::text, s.student_id_url::text, s.gov_id_url::text, s.status::text
    FROM students s
    JOIN profiles p ON p.id = s.id
    JOIN auth.users u ON u.id = s.id
    WHERE s.status = 'pending_review';
END;
$$;

-- Fetch pending companies (joins auth.users for email) — admin only
CREATE OR REPLACE FUNCTION get_pending_companies()
RETURNS TABLE(id uuid, name text, email text, cro_number text, status text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  RETURN QUERY
    SELECT c.id, p.name::text, u.email::text, c.cro_number::text, c.status::text
    FROM companies c
    JOIN profiles p ON p.id = c.id
    JOIN auth.users u ON u.id = c.id
    WHERE c.status = 'pending_review';
END;
$$;
