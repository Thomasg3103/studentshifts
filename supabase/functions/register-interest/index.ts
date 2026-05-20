import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * register-interest — public Edge Function
 * POST { name: string, email: string }
 * No auth required — called from the coming soon landing page.
 * Inserts into the signups table and sends a confirmation email via Brevo.
 */

const ALLOWED_ORIGINS = [
  "https://studentshifts.ie",
  "https://www.studentshifts.ie",
];

/** fetch() wrapper that aborts after `ms` milliseconds */
function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function corsHeaders(origin: string | null) {
  const allowed = ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowed,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  const origin  = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // S13: kill switch — set DISABLE_REGISTER_INTEREST=true in Supabase secrets to shut down
  if (Deno.env.get("DISABLE_REGISTER_INTEREST") === "true") {
    return new Response(JSON.stringify({ error: "Registration is now closed." }), {
      status: 410,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Survey update — patch existing signup row
    if (body.survey === true) {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email) {
        return new Response(JSON.stringify({ error: "Email required" }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const db          = createClient(supabaseUrl, serviceKey);
      const update: Record<string, string> = {};
      if (body.heard_about)    update.heard_about    = String(body.heard_about).slice(0, 200);
      if (body.frustration)    update.frustration    = String(body.frustration).slice(0, 500);
      if (body.work_type)      update.work_type      = String(body.work_type).slice(0, 200);
      if (body.hire_platforms) update.hire_platforms = String(body.hire_platforms).slice(0, 200);
      if (body.hire_roles)     update.hire_roles     = String(body.hire_roles).slice(0, 200);
      if (Object.keys(update).length) {
        await db.from("signups").update(update).eq("email", email);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const name  = typeof body.name  === "string" ? body.name.trim()  : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const type  = body.type === "employer" ? "employer" : "student";

    if (!name || name.length < 2 || name.length > 100) {
      return new Response(JSON.stringify({ error: "Please enter your name." }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db          = createClient(supabaseUrl, serviceKey);

    // Global rate limit: reject if more than 20 new signups in the last 60 seconds.
    // This guards against bot storms draining Brevo quota and filling the signups table.
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await db
      .from("signups")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneMinuteAgo);
    if ((recentCount ?? 0) >= 20) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again in a moment." }), {
        status: 429,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { error: insertError } = await db.from("signups").insert([{ name, email, type }]);

    if (insertError && insertError.code !== "23505") {
      // 23505 = unique violation (email already registered) — treat as success
      throw insertError;
    }

    // Send confirmation email via Brevo (fire-and-forget; don't fail the response if it errors)
    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (apiKey && insertError?.code !== "23505") {
      fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender:      { name: "StudentShifts", email: "hello@studentshifts.ie" },
          to:          [{ email, name }],
          subject:     `Thanks for registering, ${name}`,
          htmlContent: confirmationEmailHtml(name),
          textContent: `Hi ${name},\n\nThanks for registering your interest in StudentShifts.ie!\n\nWe'll email you the moment we launch so you can be one of the first to find flexible shifts around your college timetable.\n\nTalk soon,\nThomas\nStudentShifts.ie`,
        }),
      }).catch(e => console.error("Brevo error:", e));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("register-interest error:", e);
    return new Response(JSON.stringify({ error: "Something went wrong. Please try again." }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function confirmationEmailHtml(name: string): string {
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
      <h2 style="margin:0 0 1rem;font-size:1.2rem;font-weight:700;color:#1e293b;">You're on the list, ${esc(name)}!</h2>
      <p style="font-size:0.97rem;color:#374151;line-height:1.75;margin:0 0 1rem;">Thanks for signing up. We're putting the finishing touches on StudentShifts.ie — Ireland's first platform built for students to find flexible part-time work around their college timetable.</p>
      <p style="font-size:0.97rem;color:#374151;line-height:1.75;margin:0 0 1.5rem;">We'll email you the moment we go live. In the meantime, feel free to reply if you have any questions.</p>
      <p style="font-size:0.97rem;color:#1e293b;margin:0 0 2rem;">Talk soon,<br/><strong>StudentShifts Team</strong><br/><a href="https://www.studentshifts.ie" style="color:#A21D54;text-decoration:none;">StudentShifts.ie</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 1rem;"/>
      <p style="font-size:0.75rem;color:#94a3b8;margin:0;">© 2025 StudentShifts.ie</p>
    </div>
  </div>
</body>
</html>`;
}
