-- ============================================================
-- Verification Documents & Account Approval Setup
-- Run these in the Supabase SQL Editor (supabase.com/dashboard)
-- Safe to re-run — uses IF NOT EXISTS / DROP IF EXISTS throughout
-- ============================================================

-- 1. Ensure the students table has the required columns.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS student_id_url text,
  ADD COLUMN IF NOT EXISTS gov_id_url     text,
  ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'unverified';

-- ============================================================
-- 2. Create the storage bucket via the Supabase Dashboard:
--    Storage → New bucket
--      Name:   verification-docs
--      Public: OFF  (keep private)
--
-- Then run the policies below:
-- ============================================================

-- Storage policies (drop first so this script is safe to re-run)
DROP POLICY IF EXISTS "Students can upload their own verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Students can read their own verification docs"   ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all verification docs"           ON storage.objects;

CREATE POLICY "Students can upload their own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students can read their own verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can read all verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-docs'
  AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================
-- 3. RLS policies on the students table for admin access
-- ============================================================

DROP POLICY IF EXISTS "Admins can read all student profiles" ON students;
DROP POLICY IF EXISTS "Admins can update student status"     ON students;

CREATE POLICY "Admins can read all student profiles"
ON students FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can update student status"
ON students FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 4. Create your admin account
--    a) Sign up normally via the app (as any user)
--    b) Run this to promote the account to admin:
-- ============================================================

UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'thomasgallagher3103@gmail.com'
);
