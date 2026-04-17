const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, magicLinkEmail, redirectTo } = await req.json();
    if (!to || !subject || !html) throw new Error("Missing required fields: to, subject, html");

    const apiKey = Deno.env.get("BREVO_API_KEY");
    if (!apiKey) throw new Error("BREVO_API_KEY not set");

    // If magicLinkEmail is provided, generate a one-click login link and inject it
    let finalHtml = html;
    if (magicLinkEmail) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
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
            options: { redirect_to: redirectTo || supabaseUrl },
          }),
        });
        const linkData = await linkRes.json();
        if (linkData.action_link) {
          finalHtml = html.replace("MAGIC_LINK_PLACEHOLDER", linkData.action_link);
        }
      }
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "StudentShifts", email: "thomasgallagher3103@gmail.com" },
        to: Array.isArray(to) ? to.map((email: string) => ({ email })) : [{ email: to }],
        subject,
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
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
