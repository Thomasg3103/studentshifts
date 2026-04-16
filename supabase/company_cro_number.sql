-- ================================================================
-- StudentShifts — Company CRO Number
-- Adds a CRO (Companies Registration Office) number field to the
-- companies table so admins can verify companies on cro.ie.
--
-- Run this in the Supabase SQL Editor.
-- ================================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS cro_number text;
