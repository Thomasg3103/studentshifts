-- Referral system
-- Run this in the Supabase SQL Editor.

-- 1. Add referral_code column to profiles (unique short code per user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Create referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_email TEXT NOT NULL,
  referred_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by referrer
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- 3. RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can see their own referrals
DROP POLICY IF EXISTS "referrals_select_own" ON referrals;
CREATE POLICY "referrals_select_own"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid());

-- Anyone authenticated can insert a referral (called on signup)
DROP POLICY IF EXISTS "referrals_insert" ON referrals;
CREATE POLICY "referrals_insert"
  ON referrals FOR INSERT
  WITH CHECK (true);

-- 4. RPC: generate_referral_code — generates a unique 8-char code for the calling user
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  exists BOOL;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  UPDATE profiles SET referral_code = code WHERE id = auth.uid();
  RETURN code;
END;
$$;

-- 5. RPC: track_referral — called on signup when ?ref=CODE was present
CREATE OR REPLACE FUNCTION track_referral(p_referral_code TEXT, p_referred_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer UUID;
BEGIN
  SELECT id INTO referrer FROM profiles WHERE referral_code = p_referral_code;
  IF referrer IS NOT NULL AND referrer != auth.uid() THEN
    INSERT INTO referrals(referrer_id, referred_email, referred_id)
    VALUES (referrer, p_referred_email, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
