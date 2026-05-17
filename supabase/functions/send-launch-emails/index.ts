import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-launch-emails — admin-only Edge Function
 * POST {} (no body needed)
 * Emails every signup that hasn't received a launch email yet.
 * Marks launch_email_sent_at after each successful send.
 * Returns { sent: number, skipped: number, errors: string[] }
 */

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

/** fetch() wrapper that aborts after `ms` milliseconds */
function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const corsHeaders = {
  "Access-Control-Allow-Origin":  FRONTEND_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorised");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorised");

    const db = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") throw new Error("Unauthorised");

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("BREVO_API_KEY not set");

    // Test mode — send one email to the admin, don't touch any signups
    const body   = await req.json().catch(() => ({}));
    if (body.test === true) {
      const signupUrl = `${FRONTEND_URL}/signup?email=${encodeURIComponent(user.email!)}`;
      const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender:      { name: "StudentShifts", email: "thomasgallagher3103@gmail.com" },
          to:          [{ email: user.email!, name: "Admin" }],
          subject:     "[TEST] StudentShifts.ie is live — find your first shift!",
          htmlContent: launchEmailHtml("Test User", signupUrl),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Brevo error: ${err.message ?? res.status}`);
      }
      return new Response(JSON.stringify({ test: true, sent: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all signups that haven't been sent a launch email yet
    const { data: pending, error: fetchError } = await db
      .from("signups")
      .select("id, name, email")
      .is("launch_email_sent_at", null)
      .order("created_at");
    if (fetchError) throw fetchError;

    const signups = pending || [];
    let sent    = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const signup of signups) {
      const signupUrl =
        `${FRONTEND_URL}/signup` +
        `?email=${encodeURIComponent(signup.email)}` +
        `&name=${encodeURIComponent(signup.name)}`;

      try {
        const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender:      { name: "StudentShifts", email: "thomasgallagher3103@gmail.com" },
            to:          [{ email: signup.email, name: signup.name }],
            subject:     "StudentShifts.ie is live — find your first shift!",
            htmlContent: launchEmailHtml(signup.name, signupUrl),
          }),
        });

        if (res.ok) {
          await db
            .from("signups")
            .update({ launch_email_sent_at: new Date().toISOString() })
            .eq("id", signup.id);
          sent++;
        } else {
          const err = await res.json().catch(() => ({}));
          errors.push(`${signup.email}: ${err.message ?? res.status}`);
          skipped++;
        }
      } catch (e) {
        errors.push(`${signup.email}: ${e instanceof Error ? e.message : String(e)}`);
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ sent, skipped, total: signups.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isUnauth = msg === "Unauthorised";
    return new Response(
      JSON.stringify({ error: isUnauth ? msg : "Internal server error" }),
      {
        status: isUnauth ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function launchEmailHtml(name: string, signupUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:2rem auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:2rem;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:1.5rem;font-weight:800;letter-spacing:-0.3px;">We're Live!</h1>
      <p style="margin:0.5rem 0 0;color:rgba(255,255,255,0.85);font-size:0.9rem;">StudentShifts.ie is now open</p>
    </div>
    <div style="padding:2rem 2.5rem;">
      <h2 style="margin:0 0 0.75rem;color:#1e293b;font-size:1.3rem;font-weight:800;">Hey ${esc(name)}, we're live!</h2>
      <p style="color:#64748b;line-height:1.7;margin:0 0 1rem;">The wait is over — StudentShifts.ie is now live and you're one of the first to know. Find flexible shifts that fit around your college timetable, apply in seconds, and get hired faster.</p>
      <p style="color:#64748b;line-height:1.7;margin:0 0 1rem;">Before you log in, make sure you have the following ready to upload:</p>
      <ul style="color:#64748b;line-height:1.9;margin:0 0 1.5rem;padding-left:1.25rem;">
        <li><strong style="color:#1e293b;">Student ID</strong> — your college/university student card</li>
        <li><strong style="color:#1e293b;">Government ID</strong> — passport or driving licence</li>
      </ul>
      <div style="text-align:center;margin-bottom:1.5rem;">
        <a href="${esc(signupUrl)}"
           style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#fff;font-weight:700;font-size:1rem;padding:0.85rem 2rem;border-radius:2rem;text-decoration:none;box-shadow:0 4px 16px rgba(162,29,84,0.35);">
          Login to Account &rarr;
        </a>
      </div>
      <p style="color:#94a3b8;font-size:0.8rem;margin:0;text-align:center;">The StudentShifts Team &middot; studentshifts.ie</p>
    </div>
  </div>
</body>
</html>`;
}
