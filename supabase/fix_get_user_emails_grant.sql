-- Grant EXECUTE on get_user_emails to authenticated role.
-- PostgREST requires this to call the function via RPC.
-- Run this in the Supabase SQL Editor.

GRANT EXECUTE ON FUNCTION get_user_emails(uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
