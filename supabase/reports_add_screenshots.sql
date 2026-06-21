-- ================================================================
-- Add screenshot_urls column to reports table.
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS screenshot_urls text[];

-- ================================================================
-- Storage bucket: report-screenshots
-- Create this bucket MANUALLY in Supabase Dashboard → Storage:
--   Name: report-screenshots
--   Public: YES (URLs are unguessable UUIDs; only stored in reports
--           table which admins-only can read)
-- Then run the RLS policies below in SQL Editor.
-- ================================================================

-- Allow authenticated users to upload their own screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-screenshots', 'report-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "report-screenshots: auth upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Public read (bucket is public, so this is the default; explicit policy for clarity)
CREATE POLICY "report-screenshots: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'report-screenshots');
