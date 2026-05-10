import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorised");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorised");

    // Check the caller is an admin
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!["admin", "company"].includes(profile?.role)) throw new Error("Unauthorised");

    // Rate limit: 60 emails per 5 minutes per user
    const windowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from("email_sends_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("sent_at", windowStart);
    if ((count ?? 0) >= 60) {
      throw new Error("Rate limit exceeded. Please wait before sending more emails.");
    }
    await adminClient.from("email_sends_log").insert({ user_id: user.id });

    const { to, subject, html, magicLinkEmail, redirectTo } = await req.json();
    if (!to || !subject || !html) throw new Error("Missing required fields: to, subject, html");

    // Validate redirectTo against known origins to prevent open redirect
    if (redirectTo) {
      const allowed = [FRONTEND_URL, "https://studentshifts.ie", "https://www.studentshifts.ie"];
      if (!allowed.some(o => redirectTo.startsWith(o))) {
        throw new Error("Unauthorised: invalid redirectTo");
      }
    }

    // Ensure magic links are only generated for the actual recipient.
    // All addresses in `to` must match magicLinkEmail to prevent sending
    // the login link to a second attacker-controlled address.
    if (magicLinkEmail) {
      const recipients = Array.isArray(to) ? to : [to];
      if (!recipients.every((r: string) => r === magicLinkEmail)) {
        throw new Error("Unauthorised: all recipients must match magicLinkEmail");
      }
    }

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("BREVO_API_KEY not set");

    // If magicLinkEmail is provided, generate a one-click login link and inject it
    let finalHtml = html;
    if (magicLinkEmail) {
      const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "magiclink",
          email: magicLinkEmail,
          options: { redirect_to: redirectTo || FRONTEND_URL },
        }),
      });
      const linkData = await linkRes.json();
      if (!linkData.action_link) throw new Error("Failed to generate magic link");
      finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", linkData.action_link);
    }

    // Strip newlines from subject to prevent SMTP header injection
    const safeSubject = String(subject).replace(/[\r\n]/g, "");

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "StudentShifts", email: "thomasgallagher3103@gmail.com" },
        to: Array.isArray(to) ? to.map((email: string) => ({ email })) : [{ email: to }],
        subject: safeSubject,
        htmlContent: finalHtml,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Brevo API error");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Only surface expected user-facing errors; swallow internal details
    const safe = ["Unauthorised", "Missing required fields", "Invalid redirectTo", "Failed to generate magic link", "Rate limit exceeded"]
      .some(prefix => msg.startsWith(prefix)) ? msg : "Internal server error";
    console.error("send-email error:", msg);
    return new Response(JSON.stringify({ error: safe }), {
      status: safe === "Internal server error" ? 500 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
