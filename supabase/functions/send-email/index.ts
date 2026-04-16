// StudentShifts — Transactional Email Edge Function
// Uses Resend (https://resend.com) to send emails.
//
// Deploy:
//   supabase functions deploy send-email
//
// Set secret in Supabase Dashboard → Settings → Edge Functions → Secrets:
//   RESEND_API_KEY = re_xxxxxxxxxxxx
//
// Also set your verified sender domain in Resend and update FROM_EMAIL below.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "StudentShifts <noreply@studentshifts.ie>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      throw new Error("RESEND_API_KEY is not configured in Edge Function secrets.");
    }

    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      throw new Error("Missing required fields: to, subject, html");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || `Resend API returned ${res.status}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
