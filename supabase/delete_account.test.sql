 -- delete_account RPC — pgTAP test suite
--
-- HOW TO RUN
-- 1. Make sure pgTAP is available (enabled by default on Supabase projects).
-- 2. Open the Supabase SQL Editor and paste + execute this entire file.
-- 3. All lines in the output should show "ok N - <description>".
-- 4. The final line shows the overall pass/fail count.
--
-- These tests create a real auth user, populate all related tables, call
-- delete_account(), then assert that every row has been deleted.
-- Everything runs inside a transaction that is rolled back at the end so
-- the test has zero side-effects on your data.
--
-- Subject = company user (exercises the full cascade: jobs → applications,
--           liked_jobs, chat_messages, company_liked_students).
-- Bystander = student user whose core rows must survive.

BEGIN;

SELECT plan(19);

-- ─── helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _test_create_user(p_email text, p_role text DEFAULT 'student')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data,
    raw_user_meta_data, is_super_admin, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    json_build_object('role', p_role, 'company_name', 'Test Co ' || p_role)::jsonb,
    false, '', '', '', ''
  );
  RETURN v_id;
END;
$$;

-- ─── test setup ───────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_uid  uuid;    -- subject: company (to be deleted)
  v_uid2 uuid;    -- bystander: student (must NOT be deleted)
  v_job  bigint;
BEGIN
  v_uid  := _test_create_user('_test_delete@example.com',    'company');
  v_uid2 := _test_create_user('_test_bystander@example.com', 'student');

  -- Profiles — trigger may have already created these rows
  INSERT INTO public.profiles (id, role, name)
    VALUES (v_uid,  'company', 'Test Delete Company'),
           (v_uid2, 'student', 'Test Bystander')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

  -- Company row for subject (trigger already created it)
  UPDATE public.companies SET status = 'verified' WHERE id = v_uid;

  -- Student row for bystander (trigger already created it)
  INSERT INTO public.students (id, status)
    VALUES (v_uid2, 'pending')
    ON CONFLICT DO NOTHING;

  -- Job owned by subject company
  INSERT INTO public.jobs (company_id, title, status, days)
    VALUES (v_uid, 'Barista', 'Active', ARRAY['Monday'])
    RETURNING id INTO v_job;

  -- Bystander student applies to subject's job
  INSERT INTO public.applications (job_id, student_id, status)
    VALUES (v_job, v_uid2, 'Pending');

  -- Bystander likes subject's job
  INSERT INTO public.liked_jobs (student_id, job_id)
    VALUES (v_uid2, v_job);

  -- Subject company saved the bystander student
  INSERT INTO public.company_liked_students (company_id, student_id)
    VALUES (v_uid, v_uid2);

  -- Chat message between them (company sent it)
  INSERT INTO public.chat_messages (student_id, company_id, sender_id, text)
    VALUES (v_uid2, v_uid, v_uid, 'Welcome!');

  -- Audit log entry
  INSERT INTO public.audit_log (actor_id, action, target_id)
    VALUES (v_uid, 'test_action', v_uid);

  -- Rate-limit / log tables
  INSERT INTO public.rpc_rate_log (user_id, rpc_name)
    VALUES (v_uid, 'test_rpc')
    ON CONFLICT DO NOTHING;

  INSERT INTO public.email_sends_log (user_id)
    VALUES (v_uid)
    ON CONFLICT DO NOTHING;

  -- Push subscription for subject
  INSERT INTO public.push_subscriptions (user_id, endpoint, subscription)
    VALUES (v_uid, 'https://fcm.example.com/test-endpoint',
      '{"endpoint":"https://fcm.example.com/test-endpoint","keys":{"p256dh":"test","auth":"test"}}'::jsonb);

  -- Store uuid ids so assertions can reference them
  CREATE TEMP TABLE _test_ids (key text PRIMARY KEY, val uuid);
  INSERT INTO _test_ids VALUES
    ('uid',  v_uid),
    ('uid2', v_uid2);
END;
$$;

-- ─── set session to act as the subject user ───────────────────────────────────
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT val FROM _test_ids WHERE key = 'uid'))::text,
  true
);

-- ─── assertions BEFORE deletion ───────────────────────────────────────────────

SELECT ok(
  EXISTS (SELECT 1 FROM auth.users WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'auth.users row exists before deletion'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'profiles row exists before deletion'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.jobs WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'subject-owned job exists before deletion'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE j.company_id = (SELECT val FROM _test_ids WHERE key = 'uid')
  ),
  'application to subject job exists before deletion'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.liked_jobs lj
    JOIN public.jobs j ON j.id = lj.job_id
    WHERE j.company_id = (SELECT val FROM _test_ids WHERE key = 'uid')
  ),
  'liked_jobs for subject job exists before deletion'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.company_liked_students WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'company_liked_students row exists before deletion'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.chat_messages WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'chat_messages row exists before deletion'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'push_subscriptions row exists before deletion'
);

-- ─── call delete_account() ────────────────────────────────────────────────────
SELECT lives_ok(
  $$ SELECT delete_account() $$,
  'delete_account() executes without error'
);

-- ─── assertions AFTER deletion ────────────────────────────────────────────────

SELECT ok(
  NOT EXISTS (SELECT 1 FROM auth.users WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'auth.users row deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'profiles row deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.jobs WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'jobs owned by subject deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.applications WHERE student_id = (SELECT val FROM _test_ids WHERE key = 'uid2')),
  'application to subject job cascade-deleted'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.liked_jobs lj
    JOIN public.jobs j ON j.id = lj.job_id
    WHERE j.company_id = (SELECT val FROM _test_ids WHERE key = 'uid')
  ),
  'liked_jobs for subject job cascade-deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.company_liked_students WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'company_liked_students deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.chat_messages WHERE company_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'chat_messages deleted'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = (SELECT val FROM _test_ids WHERE key = 'uid')),
  'push_subscriptions deleted'
);

-- Bystander data must be untouched
SELECT ok(
  EXISTS (SELECT 1 FROM auth.users WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid2')),
  'bystander auth.users row is intact'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT val FROM _test_ids WHERE key = 'uid2')),
  'bystander profiles row is intact'
);

-- ─── finish ───────────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
