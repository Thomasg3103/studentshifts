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
          sender:      { name: "StudentShifts", email: "hello@studentshifts.ie" },
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
            sender:      { name: "StudentShifts", email: "hello@studentshifts.ie" },
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
  <div style="max-width:560px;margin:2rem auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="background:#A21D54;padding:1.75rem 2.5rem;display:flex;align-items:center;gap:0.75rem;">
      <img src="https://www.studentshifts.ie/favicon.svg" width="40" height="40" alt="StudentShifts" style="border-radius:8px;display:block;" />
      <div>
        <p style="margin:0;font-size:1.2rem;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">StudentShifts.ie</p>
        <p style="margin:0.2rem 0 0;font-size:0.8rem;color:rgba(255,255,255,0.8);">Ireland's student job platform</p>
      </div>
    </div>
    <div style="padding:2rem 2.5rem;">
      <h2 style="margin:0 0 1rem;font-size:1.2rem;font-weight:700;color:#1e293b;">We're live, ${esc(name)}!</h2>
      <p style="font-size:0.97rem;color:#374151;line-height:1.75;margin:0 0 1rem;">The wait is over — StudentShifts.ie is now live. You can create your account and start finding flexible shifts that fit around your college timetable.</p>
      <p style="font-size:0.97rem;color:#374151;line-height:1.75;margin:0 0 1.5rem;">Before you sign up, make sure you have your <strong>Student ID</strong> and <strong>Government ID</strong> ready — you'll need them to verify your account.</p>
      <div style="text-align:center;margin-bottom:1.5rem;">
        <a href="${esc(signupUrl)}" style="display:inline-block;background:#A21D54;color:#fff;font-weight:700;font-size:1rem;padding:0.85rem 2.25rem;border-radius:2rem;text-decoration:none;">
          Create My Account &rarr;
        </a>
      </div>
      <p style="font-size:0.97rem;color:#374151;line-height:1.75;margin:0 0 2rem;">Feel free to reply to this email if you have any questions.</p>
      <p style="font-size:0.97rem;color:#1e293b;margin:0 0 2rem;">Talk soon,<br/><strong>StudentShifts Team</strong><br/><a href="https://www.studentshifts.ie" style="color:#A21D54;text-decoration:none;">StudentShifts.ie</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 1rem;"/>
      <p style="font-size:0.75rem;color:#94a3b8;margin:0;">© 2025 StudentShifts.ie</p>
    </div>
  </div>
</body>
</html>`;
}
