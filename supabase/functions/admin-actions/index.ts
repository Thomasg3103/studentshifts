import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * admin-actions — Edge Function
 * POST { action: "revoke_session", userId: string }
 * Auth: admin JWT (Authorization header)
 * Revokes all active sessions for the target user via the Supabase admin API.
 * Called after reject_student / reject_company so the rejected user is
 * force-signed-out rather than continuing with a valid JWT.
 */

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorised" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  // Validate caller is an admin using their own JWT (anon key enforces RLS)
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorised" }), {
    status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: profile } = await anonClient.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const body = await req.json().catch(() => null);
  if (!body?.action || !body?.userId) {
    return new Response(JSON.stringify({ error: "Missing required fields: action, userId" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Service role client for admin auth operations
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  if (body.action === "revoke_session") {
    const { error } = await adminClient.auth.admin.signOut(body.userId);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
