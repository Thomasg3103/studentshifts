-- Fix STABLE functions that contain INSERT statements
-- PostgreSQL forbids DML inside STABLE/IMMUTABLE functions.
-- Both of these insert into rpc_rate_log for rate limiting.
-- Run this in Supabase SQL Editor.

ALTER FUNCTION get_all_verified_students(int, int) VOLATILE;
ALTER FUNCTION get_company_applicant_profiles(uuid[]) VOLATILE;

NOTIFY pgrst, 'reload schema';
