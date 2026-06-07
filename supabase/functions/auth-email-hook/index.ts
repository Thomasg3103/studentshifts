/**
 * auth-email-hook — Supabase Send Email Auth Hook
 *
 * Supabase calls this function instead of sending auth emails itself.
 * Configure in: Supabase Dashboard → Authentication → Hooks → Send Email Hook
 *
 * Handles: signup confirmation, password reset, email change.
 * Sends all emails via Brevo using the same branded templates.
 *
 * Env vars required: BREVO_API_KEY, FRONTEND_URL, AUTH_HOOK_SECRET (whsec_... value from dashboard)
 */
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const BREVO_API_KEY  = Deno.env.get("BREVO_API_KEY") ?? "";
const FRONTEND_URL   = Deno.env.get("FRONTEND_URL")  ?? "https://studentshifts.onrender.com";
const HOOK_SECRET    = Deno.env.get("AUTH_HOOK_SECRET") ?? "";

const FROM = { name: "StudentShifts", email: "noreply@studentshifts.ie" };

function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function sendBrevo(to: string, subject: string, html: string): Promise<void> {
  const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: FROM, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Brevo error ${res.status}: ${err.message ?? "unknown"}`);
  }
}

function confirmationEmail(confirmUrl: string, name: string): string {
  const safeName = name ? `, ${name.split(" ")[0]}` : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
        <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
      </td></tr>
      <tr><td style="padding:36px 32px 28px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Confirm your email</p>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          Thanks for joining StudentShifts${safeName}! Click the button below to verify your email address and activate your account.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
          <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
            Confirm Email Address
          </a>
        </td></tr></table>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Or copy and paste this link:</p>
        <p style="margin:0 0 24px;font-size:12px;color:#A21D54;word-break:break-all;">${confirmUrl}</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
            This link expires in <strong style="color:#1e293b;">24 hours</strong>. If you didn't create an account, you can safely ignore this email.
          </p>
        </td></tr></table>
      </td></tr>
      <tr><td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function resetEmail(resetUrl: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
        <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
        <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
      </td></tr>
      <tr><td style="padding:36px 32px 28px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Reset your password</p>
        <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
          We received a request to reset your StudentShifts password. Click the button below to choose a new one.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
            Reset Password
          </a>
        </td></tr></table>
        <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Or copy and paste this link:</p>
        <p style="margin:0 0 24px;font-size:12px;color:#A21D54;word-break:break-all;">${resetUrl}</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
            This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password won't change.
          </p>
        </td></tr></table>
      </td></tr>
      <tr><td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const rawBody = await req.text();

  let body: {
    user: { email: string; user_metadata?: { name?: string } };
    email_data: {
      token: string;
      token_hash: string;
      redirect_to: string;
      email_action_type: string;
      site_url: string;
    };
  };

  try {
    const wh = new Webhook(HOOK_SECRET);
    body = wh.verify(rawBody, {
      "webhook-id":        req.headers.get("webhook-id") ?? "",
      "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": req.headers.get("webhook-signature") ?? "",
    }) as typeof body;
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { user, email_data } = body;
  const { token_hash, email_action_type, site_url, redirect_to } = email_data;

  // Build the verification URL — Supabase verifies the token and redirects
  const supabaseUrl = site_url || Deno.env.get("SUPABASE_URL") || "";
  const redirectTarget = redirect_to || FRONTEND_URL;
  const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirectTarget)}`;

  const toEmail  = user.email;
  const userName = user.user_metadata?.name ?? "";

  try {
    if (email_action_type === "signup" || email_action_type === "email_change") {
      await sendBrevo(
        toEmail,
        "Confirm your StudentShifts account",
        confirmationEmail(verifyUrl, userName)
      );
    } else if (email_action_type === "recovery") {
      await sendBrevo(
        toEmail,
        "Reset your StudentShifts password",
        resetEmail(verifyUrl)
      );
    } else {
      // Fallback for invite or other types — send a plain confirmation
      await sendBrevo(
        toEmail,
        "Your StudentShifts link",
        confirmationEmail(verifyUrl, userName)
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auth-email-hook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Send failed" }),
      { status: 500 }
    );
  }
});
