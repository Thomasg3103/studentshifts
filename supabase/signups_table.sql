-- ================================================================
-- StudentShifts — Pre-launch Signups Table
-- Run in Supabase SQL Editor (idempotent, safe to re-run).
-- ================================================================

CREATE TABLE IF NOT EXISTS signups (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  email                text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  launch_email_sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS signups_email_unique ON signups (lower(email));

ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

-- Anyone (anon) can insert — used by the coming soon landing page
DROP POLICY IF EXISTS "signups_insert_anon" ON signups;
CREATE POLICY "signups_insert_anon"
  ON signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- No direct SELECT — use get_signups() RPC (admin only)
-- The register-interest edge function uses the service key and bypasses RLS.

-- Admin-only RPC: fetch all signups ordered by newest first
CREATE OR REPLACE FUNCTION get_signups()
RETURNS TABLE(
  id                   uuid,
  name                 text,
  email                text,
  created_at           timestamptz,
  launch_email_sent_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised: admin only';
  END IF;
  RETURN QUERY
    SELECT s.id, s.name::text, s.email::text, s.created_at, s.launch_email_sent_at
    FROM signups s
    ORDER BY s.created_at DESC;
END;
$$;
