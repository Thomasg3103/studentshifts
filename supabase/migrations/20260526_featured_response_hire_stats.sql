-- Run this in Supabase SQL Editor to enable:
--   1. Featured employer badge (is_featured column + admin RPCs)
--   2. Company hire stats (get_company_hire_stats)
--   3. Company response rate (get_company_response_rate, get_companies_response_rates)

-- ── 1. Featured employer ──────────────────────────────────────────────────────

ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Admin: list all verified companies with their featured status
CREATE OR REPLACE FUNCTION get_verified_companies()
RETURNS TABLE(id uuid, name text, is_featured boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, COALESCE(c.is_featured, false)
  FROM profiles p
  JOIN companies c ON c.id = p.id
  WHERE p.role = 'company' AND c.status = 'verified'
  ORDER BY c.is_featured DESC NULLS LAST, p.name;
$$;
GRANT EXECUTE ON FUNCTION get_verified_companies() TO authenticated;

-- Admin: toggle featured (admin role check inside)
CREATE OR REPLACE FUNCTION set_company_featured(p_company_id uuid, p_featured boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  UPDATE companies SET is_featured = p_featured WHERE id = p_company_id;
END;
$$;
GRANT EXECUTE ON FUNCTION set_company_featured(uuid, boolean) TO authenticated;

-- Public: return all featured company IDs (for student job feed)
CREATE OR REPLACE FUNCTION get_featured_company_ids()
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM companies c WHERE c.is_featured = true;
$$;
GRANT EXECUTE ON FUNCTION get_featured_company_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_featured_company_ids() TO anon;

-- ── 2. Hire stats ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_company_hire_stats(p_company_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_hired',      COUNT(a.id),
    'hired_this_month', COUNT(CASE WHEN a.created_at >= date_trunc('month', now()) THEN 1 END)
  )
  FROM applications a
  JOIN jobs j ON a.job_id = j.id
  WHERE j.company_id = p_company_id AND a.status = 'Accepted';
$$;
GRANT EXECUTE ON FUNCTION get_company_hire_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_hire_stats(uuid) TO anon;

-- ── 3. Response rate ──────────────────────────────────────────────────────────

-- Single-company version (for company profile page)
CREATE OR REPLACE FUNCTION get_company_response_rate(p_company_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_student AS (
    SELECT job_id, student_id, MIN(created_at) AS sent_at
    FROM chat_messages
    WHERE company_id = p_company_id AND sender_id != p_company_id
    GROUP BY job_id, student_id
  ),
  first_reply AS (
    SELECT m.job_id, m.student_id, MIN(m.created_at) AS replied_at
    FROM chat_messages m
    JOIN first_student fs ON m.job_id = fs.job_id AND m.student_id = fs.student_id
    WHERE m.company_id = p_company_id
      AND m.sender_id = p_company_id
      AND m.created_at > fs.sent_at
    GROUP BY m.job_id, m.student_id
  ),
  stats AS (
    SELECT
      COUNT(fs.*)                                                     AS total_received,
      COUNT(fr.*)                                                     AS total_replied,
      AVG(EXTRACT(EPOCH FROM (fr.replied_at - fs.sent_at)) / 3600.0) AS avg_hours
    FROM first_student fs
    LEFT JOIN first_reply fr ON fs.job_id = fr.job_id AND fs.student_id = fr.student_id
  )
  SELECT json_build_object(
    'total_received',    total_received,
    'total_replied',     total_replied,
    'avg_hours',         ROUND(avg_hours::numeric, 1),
    'response_rate_pct', CASE WHEN total_received > 0
                              THEN ROUND(100.0 * total_replied / total_received)
                              ELSE null END
  )
  FROM stats;
$$;
GRANT EXECUTE ON FUNCTION get_company_response_rate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_response_rate(uuid) TO anon;

-- Batch version (for student job feed — one call for all visible companies)
CREATE OR REPLACE FUNCTION get_companies_response_rates(p_company_ids uuid[])
RETURNS TABLE(company_id uuid, avg_hours numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH first_student AS (
    SELECT company_id, job_id, student_id, MIN(created_at) AS sent_at
    FROM chat_messages
    WHERE company_id = ANY(p_company_ids) AND sender_id != company_id
    GROUP BY company_id, job_id, student_id
  ),
  first_reply AS (
    SELECT m.company_id, m.job_id, m.student_id, MIN(m.created_at) AS replied_at
    FROM chat_messages m
    JOIN first_student fs
      ON m.company_id = fs.company_id
     AND m.job_id     = fs.job_id
     AND m.student_id = fs.student_id
    WHERE m.sender_id = m.company_id AND m.created_at > fs.sent_at
    GROUP BY m.company_id, m.job_id, m.student_id
  )
  SELECT
    fs.company_id,
    ROUND(AVG(EXTRACT(EPOCH FROM (fr.replied_at - fs.sent_at)) / 3600.0)::numeric, 1) AS avg_hours
  FROM first_student fs
  JOIN first_reply fr
    ON fs.company_id = fr.company_id
   AND fs.job_id     = fr.job_id
   AND fs.student_id = fr.student_id
  GROUP BY fs.company_id;
$$;
GRANT EXECUTE ON FUNCTION get_companies_response_rates(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_companies_response_rates(uuid[]) TO anon;
