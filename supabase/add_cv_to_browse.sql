-- Add cv_url to Browse Students RPC + allow verified companies to view student CVs.
-- Run this in Supabase SQL Editor.

-- 1. Update RPC to return cv_url
DROP FUNCTION IF EXISTS get_all_verified_students(int, int);
CREATE FUNCTION get_all_verified_students(p_limit int DEFAULT 200, p_offset int DEFAULT 0)
RETURNS TABLE (
  id                uuid,
  name              text,
  bio               text,
  skills            text[],
  linkedin          text,
  cv_url            text,
  profile_photo_url text,
  location_display  text,
  availability      jsonb,
  job_preferences   text[],
  allow_company_dm  boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE call_count bigint;
BEGIN
  IF NOT is_admin() AND NOT EXISTS (
    SELECT 1 FROM companies WHERE companies.id = auth.uid() AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Unauthorised: verified company or admin required';
  END IF;
  IF p_limit > 200 THEN
    RAISE EXCEPTION 'p_limit cannot exceed 200';
  END IF;
  IF NOT is_admin() THEN
    SELECT COUNT(*) INTO call_count FROM rpc_rate_log
    WHERE user_id = auth.uid() AND rpc_name = 'get_all_verified_students'
      AND called_at > now() - interval '1 minute';
    IF call_count >= 30 THEN
      RAISE EXCEPTION 'Rate limit exceeded — too many student browse requests';
    END IF;
    INSERT INTO rpc_rate_log (user_id, rpc_name) VALUES (auth.uid(), 'get_all_verified_students');
  END IF;
  RETURN QUERY
    SELECT p.id, p.name, s.bio, s.skills, s.linkedin, s.cv_url, s.profile_photo_url,
           s.location_display, s.availability, s.job_preferences,
           COALESCE(s.allow_company_dm, TRUE)
    FROM students s
    JOIN profiles p ON p.id = s.id
    WHERE s.status = 'verified'
      AND COALESCE(s.allow_company_dm, TRUE) = TRUE
    ORDER BY p.id
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 2. Allow verified companies to view CVs of verified students via Browse Students
DROP POLICY IF EXISTS "documents: company browse student cv" ON storage.objects;
CREATE POLICY "documents: company browse student cv" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND
    split_part(name, '/', 2) LIKE 'cv.%' AND
    EXISTS (
      SELECT 1 FROM companies c WHERE c.id = auth.uid() AND c.status = 'verified'
    ) AND
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.id::text = (storage.foldername(name))[1] AND s.status = 'verified'
    )
  );

NOTIFY pgrst, 'reload schema';
