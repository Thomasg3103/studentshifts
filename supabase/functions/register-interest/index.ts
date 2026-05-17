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
    const name  = typeof body.name  === "string" ? body.name.trim()  : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

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

    const { error: insertError } = await db.from("signups").insert([{ name, email }]);

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
          sender:      { name: "StudentShifts", email: "thomasgallagher3103@gmail.com" },
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
  <div style="max-width:560px;margin:2rem auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    <div style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:2rem;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:1.5rem;font-weight:800;letter-spacing:-0.3px;">StudentShifts.ie</h1>
      <p style="margin:0.5rem 0 0;color:rgba(255,255,255,0.85);font-size:0.9rem;">Ireland's student job platform</p>
    </div>
    <div style="padding:2rem 2.5rem;">
      <h2 style="margin:0 0 0.75rem;color:#1e293b;font-size:1.3rem;font-weight:800;">You're on the list, ${esc(name)}!</h2>
      <p style="color:#64748b;line-height:1.7;margin:0 0 1rem;">Thanks for registering your interest in StudentShifts.ie — Ireland's first platform built specifically for students looking for flexible part-time work.</p>
      <p style="color:#64748b;line-height:1.7;margin:0 0 1.5rem;">We'll send you an email the moment we launch, so you can be one of the first to start finding shifts that fit perfectly around your college timetable.</p>
      <div style="background:#fdf0f5;border-left:4px solid #A21D54;border-radius:0 10px 10px 0;padding:1rem 1.25rem;margin-bottom:1.5rem;">
        <p style="margin:0;color:#A21D54;font-size:0.9rem;font-weight:600;">Watch this space — we're launching very soon.</p>
      </div>
      <p style="color:#94a3b8;font-size:0.8rem;margin:0;">The StudentShifts Team &middot; studentshifts.ie</p>
    </div>
  </div>
</body>
</html>`;
}
