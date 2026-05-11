-- ================================================================
-- StudentShifts — Company Verification
-- Adds a verification status to companies so admin must approve
-- them before they can post jobs.
--
-- Run this script in the Supabase SQL Editor.
-- ================================================================

-- Add status column to companies (default 'pending_review' for new signups)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_review';

-- Backfill: mark all existing companies as already verified
UPDATE companies SET status = 'verified' WHERE status = 'pending_review';

-- NOTE (R3-C5): approve_company and reject_company are defined in rls_policies.sql
-- (with audit log inserts). Do NOT redefine them here — this file runs after
-- rls_policies.sql and would silently overwrite the audited versions.
