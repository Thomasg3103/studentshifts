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

-- ── RPCs (SECURITY DEFINER so only trusted server code runs them) ─────────

-- Approve a company
CREATE OR REPLACE FUNCTION approve_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE companies SET status = 'verified' WHERE id = company_id;
END;
$$;

-- Reject a company
CREATE OR REPLACE FUNCTION reject_company(company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE companies SET status = 'rejected' WHERE id = company_id;
END;
$$;
