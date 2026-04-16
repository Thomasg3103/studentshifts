// StudentShifts — Transactional Email Edge Function
// Uses your existing SMTP credentials (same ones configured in Supabase Auth settings).
//
// Deploy from Supabase Dashboard → Edge Functions → New Function → name it "send-email" → paste this code → Deploy
//
// Then set secrets in Dashboard → Edge Functions → Manage Secrets:
//   SMTP_HOST  — e.g. smtp.gmail.com / smtp.sendgrid.net / smtp-relay.brevo.com
//   SMTP_PORT  — usually 587
//   SMTP_USER  — your SMTP username / email
//   SMTP_PASS  — your SMTP password / API key
//   SMTP_FROM  — e.g. StudentShifts <noreply@yourdomain.com>

import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) throw new Error("Missing required fields: to, subject, html");

    const transporter = nodemailer.createTransport({
      host: Deno.env.get("SMTP_HOST"),
      port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
      secure: Deno.env.get("SMTP_PORT") === "465",
      auth: {
        user: Deno.env.get("SMTP_USER"),
        pass: Deno.env.get("SMTP_PASS"),
      },
    });

    await transporter.sendMail({
      from: Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER"),
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
    });

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
