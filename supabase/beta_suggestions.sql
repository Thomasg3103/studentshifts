-- BETA ONLY — drop this table before full launch:
--   DROP TABLE IF EXISTS beta_suggestions;

CREATE TABLE IF NOT EXISTS beta_suggestions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name       TEXT,
  role       TEXT,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE beta_suggestions ENABLE ROW LEVEL SECURITY;

-- Any logged-in user can submit their own suggestion
CREATE POLICY "Users can insert own suggestions"
  ON beta_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admins can read suggestions
CREATE POLICY "Admins can read suggestions"
  ON beta_suggestions FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
