-- Add tutor_subject column for Tutoring category jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tutor_subject text;
