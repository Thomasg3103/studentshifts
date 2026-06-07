import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BREVO_API_KEY    = Deno.env.get("BREVO_API_KEY") ?? "";
const FRONTEND_URL     = Deno.env.get("FRONTEND_URL") ?? "https://studentshifts.onrender.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { email } = await req.json();
  if (!email) return new Response(JSON.stringify({ error: "Missing email" }), { status: 400 });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Generate a fresh confirmation link (bypasses rate limits)
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    options: { redirectTo: FRONTEND_URL },
  });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });

  const confirmUrl = data.properties?.action_link;
  if (!confirmUrl) return new Response(JSON.stringify({ error: "Could not generate link" }), { status: 500, headers: corsHeaders });

  const name = data.user?.user_metadata?.name ?? "";
  const firstName = name ? `, ${name.split(" ")[0]}` : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
        <p style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">StudentShifts</p>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
      </td></tr>
      <tr><td style="padding:36px 32px 28px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Confirm your email</p>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          Hi${firstName}! Click the button below to verify your email and activate your StudentShifts account.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
          <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;">
            Confirm Email Address
          </a>
        </td></tr></table>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Or copy and paste this link:</p>
        <p style="margin:0 0 24px;font-size:12px;color:#A21D54;word-break:break-all;">${confirmUrl}</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#f8fafc;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">This link expires in <strong style="color:#1e293b;">24 hours</strong>. If you didn't create an account, ignore this email.</p>
        </td></tr></table>
      </td></tr>
      <tr><td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
      to: [{ email }],
      subject: "Confirm your StudentShifts account",
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    return new Response(JSON.stringify({ error: err.message ?? "Email send failed" }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
