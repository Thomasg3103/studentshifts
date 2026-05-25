-- Urgent/Instant shifts
-- Run this in the Supabase SQL Editor.

-- Add is_urgent column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false;

-- Index for fast feed queries that sort urgent first
CREATE INDEX IF NOT EXISTS idx_jobs_is_urgent ON jobs(is_urgent) WHERE is_urgent = true;
