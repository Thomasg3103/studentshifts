-- Student Community Forum
-- Run this in the Supabase SQL Editor.

-- 1. Forum posts table
CREATE TABLE IF NOT EXISTS forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'General',
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  upvotes     INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);

-- 2. Forum votes table (one vote per user per post)
CREATE TABLE IF NOT EXISTS forum_votes (
  post_id   UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- 3. RLS
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts
DROP POLICY IF EXISTS "forum_posts_select" ON forum_posts;
CREATE POLICY "forum_posts_select"
  ON forum_posts FOR SELECT USING (true);

-- Verified students can create posts
DROP POLICY IF EXISTS "forum_posts_insert" ON forum_posts;
CREATE POLICY "forum_posts_insert"
  ON forum_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM students WHERE id = auth.uid() AND status = 'verified'
    )
  );

-- Author can delete their own posts
DROP POLICY IF EXISTS "forum_posts_delete" ON forum_posts;
CREATE POLICY "forum_posts_delete"
  ON forum_posts FOR DELETE USING (author_id = auth.uid());

-- Anyone can read votes
DROP POLICY IF EXISTS "forum_votes_select" ON forum_votes;
CREATE POLICY "forum_votes_select"
  ON forum_votes FOR SELECT USING (true);

-- Authenticated users can vote
DROP POLICY IF EXISTS "forum_votes_insert" ON forum_votes;
CREATE POLICY "forum_votes_insert"
  ON forum_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own vote
DROP POLICY IF EXISTS "forum_votes_delete" ON forum_votes;
CREATE POLICY "forum_votes_delete"
  ON forum_votes FOR DELETE USING (user_id = auth.uid());

-- 4. RPC: toggle_forum_vote — atomically votes/unvotes and updates post upvote count
CREATE OR REPLACE FUNCTION toggle_forum_vote(p_post_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing BOOL;
  new_count INT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM forum_votes WHERE post_id = p_post_id AND user_id = auth.uid()) INTO existing;

  IF existing THEN
    DELETE FROM forum_votes WHERE post_id = p_post_id AND user_id = auth.uid();
    UPDATE forum_posts SET upvotes = GREATEST(0, upvotes - 1) WHERE id = p_post_id RETURNING upvotes INTO new_count;
  ELSE
    INSERT INTO forum_votes(post_id, user_id) VALUES (p_post_id, auth.uid()) ON CONFLICT DO NOTHING;
    UPDATE forum_posts SET upvotes = upvotes + 1 WHERE id = p_post_id RETURNING upvotes INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;
