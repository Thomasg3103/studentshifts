import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * send-email — Edge Function
 * POST { to: string|string[], subject: string, html: string, magicLinkEmail?: string, redirectTo?: string }
 *   OR { type: "new-applicant", jobId: string } — sends new-applicant notification to the company
 * Auth: company or admin JWT (Authorization header)
 * Rate limit: 60 emails per 5 minutes per user (email_sends_log table)
 *   new-applicant path: tighter limit of 10 per hour per student caller.
 * magicLinkEmail: if provided, generates a Supabase magic link and injects it at MAGIC_LINK_PLACEHOLDER in html
 * redirectTo: must start with an allowed origin (FRONTEND_URL or studentshifts.ie)
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, BREVO_API_KEY, FRONTEND_URL
 */
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

/** UUID v4 regex — used to validate IDs before passing to DB queries */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** fetch() wrapper that aborts after `ms` milliseconds */
function fetchWithTimeout(url: string, init: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailCompanyInterested(studentName: string, companyName: string): string {
  const sName = escapeHtml(studentName);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">StudentShifts</p>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">A company is interested in you!</p>
          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
            Hi ${sName},<br/><br/>
            <strong style="color:#1e293b;">${cName}</strong> is interested in hiring you and has sent you a message on StudentShifts. Log in to read their message and reply.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
            <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;">Read Message →</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function emailNewApplicant(companyName: string, jobTitle: string, applicantName: string, dashboardUrl: string): string {
  const cName = escapeHtml(companyName);
  const jTitle = escapeHtml(jobTitle);
  const aName = escapeHtml(applicantName);
  const safeUrl = /^https?:\/\//i.test(dashboardUrl) ? escapeHtml(dashboardUrl) : "#";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">New applicant!</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${cName},<br/><br/>
              <strong style="color:#1e293b;">${aName}</strong> has applied for your <strong style="color:#1e293b;">${jTitle}</strong> posting on StudentShifts.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    View Applicant →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorised");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorised");

    // Check the caller's role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!["admin", "company", "student"].includes(profile?.role)) throw new Error("Unauthorised");

    const body = await req.json();

    // ── new-applicant notification (student caller) ──
    if (body.type === "new-applicant") {
      if (profile?.role !== "student") throw new Error("Unauthorised");
      const { jobId } = body;
      if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
        throw new Error("Missing required field: jobId");
      }

      // Rate limit: max 10 new-applicant notifications per student per hour.
      // This is intentionally tighter than the company/admin 60/5-min bucket to
      // prevent a student from spamming many companies with notification emails.
      const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: studentCount } = await adminClient
        .from("email_sends_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("sent_at", windowStart);
      if ((studentCount ?? 0) >= 10) {
        throw new Error("Rate limit exceeded. Please wait before sending more emails.");
      }

      // Verify the student actually has an application for this job (prevents notification spam
      // by sending new-applicant for jobs the caller never applied to)
      const { data: appCheck } = await adminClient
        .from("applications")
        .select("id")
        .eq("job_id", jobId)
        .eq("student_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!appCheck) throw new Error("Unauthorised");

      // Look up job title and company_id
      const { data: job, error: jobErr } = await adminClient
        .from("jobs")
        .select("title, company_id")
        .eq("id", jobId)
        .single();
      if (jobErr || !job) throw new Error("Unauthorised");

      // Get company email from auth.users (service_role access)
      const { data: companyAuthUser, error: companyAuthErr } = await adminClient.auth.admin.getUserById(job.company_id);
      if (companyAuthErr || !companyAuthUser?.user?.email) throw new Error("Unauthorised");
      const companyEmail = companyAuthUser.user.email;

      // Get company name from profiles
      const { data: companyProfile } = await adminClient
        .from("profiles")
        .select("name")
        .eq("id", job.company_id)
        .single();
      const companyName = companyProfile?.name || "there";

      // Get student name from profiles
      const { data: studentProfile } = await adminClient
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      const studentName = studentProfile?.name || "A student";

      const apiKey = Deno.env.get("BREVO_API_KEY");
      if (!apiKey) throw new Error("BREVO_API_KEY not set");

      const dashboardUrl = FRONTEND_URL;
      const html = emailNewApplicant(companyName, job.title, studentName, dashboardUrl);
      // Strip newlines from job title to prevent SMTP header injection
      const safeSubject = `New applicant for ${String(job.title).replace(/[\r\n]/g, "")}`;

      // L4: log BEFORE send so Brevo timeout can't skip the rate-limit increment
      await adminClient.from("email_sends_log").insert({ user_id: user.id }).catch(() => {});

      const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
          to: [{ email: companyEmail }],
          subject: safeSubject,
          htmlContent: html,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Brevo API error");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── company_interested template (company caller, S5) ──
    // Companies cannot pass arbitrary html — use this template type instead.
    if (body.templateType === "company_interested") {
      if (profile?.role !== "company") throw new Error("Unauthorised");
      const { to: toField, magicLinkEmail: mle, redirectTo: rto } = body;
      const recipient = typeof toField === "string" ? toField : (Array.isArray(toField) ? toField[0] : null);
      if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        throw new Error("Missing required fields: to");
      }
      // Verify recipient is an applicant of this company
      const { data: allowedRows } = await adminClient.rpc("get_company_applicant_emails", { company_uuid: user.id });
      const allowedSet = new Set<string>((allowedRows || []).map((r: { email: string }) => r.email));
      if (!allowedSet.has(recipient)) throw new Error("Unauthorised: recipient is not an applicant of this company");

      // Look up student name from their email
      let studentName = "there";
      try {
        const { data: { user: studentUser } } = await adminClient.auth.admin.getUserByEmail(recipient);
        if (studentUser?.id) {
          const { data: sp } = await adminClient.from("profiles").select("name").eq("id", studentUser.id).single();
          if (sp?.name) studentName = sp.name as string;
        }
      } catch { /* best-effort — fall back to "there" */ }

      const apiKey = Deno.env.get("BREVO_API_KEY");
      if (!apiKey) throw new Error("BREVO_API_KEY not set");

      // Validate redirectTo
      if (rto) {
        const allowed = [FRONTEND_URL, "https://studentshifts.ie", "https://www.studentshifts.ie"];
        let redirectOrigin: string;
        try { redirectOrigin = new URL(rto).origin; } catch { throw new Error("Unauthorised: invalid redirectTo"); }
        if (!allowed.some(o => { try { return new URL(o).origin === redirectOrigin; } catch { return false; } })) {
          throw new Error("Unauthorised: invalid redirectTo");
        }
      }

      const html = emailCompanyInterested(studentName, companyName);
      // Generate magic link if requested
      let finalHtml = html;
      if (mle && mle === recipient) {
        try {
          const linkRes = await fetchWithTimeout(`${supabaseUrl}/auth/v1/admin/generate_link`, {
            method: "POST",
            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ type: "magiclink", email: mle, options: { redirect_to: rto || FRONTEND_URL } }),
          });
          const linkData = await linkRes.json();
          finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", linkData.action_link || FRONTEND_URL);
        } catch {
          finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", FRONTEND_URL);
        }
      } else {
        finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", FRONTEND_URL);
      }

      // L4: log BEFORE send
      await adminClient.from("email_sends_log").insert({ user_id: user.id }).catch(() => {});

      const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
          to: [{ email: recipient }],
          subject: `${String(companyName).replace(/[\r\n]/g, "")} is interested in hiring you`,
          htmlContent: finalHtml,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Brevo API error ${res.status}: ${(err as { message?: string }).message || "unknown"}`);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── job-closed notification (company caller) ──
    if (body.type === "job-closed") {
      if (profile?.role !== "company") throw new Error("Unauthorised");
      const { jobId } = body;
      if (!jobId || typeof jobId !== "string" || !UUID_RE.test(jobId)) {
        throw new Error("Missing required field: jobId");
      }
      const { data: job } = await adminClient.from("jobs")
        .select("title").eq("id", jobId).eq("company_id", user.id).single();
      if (!job) throw new Error("Unauthorised");

      const { data: apps } = await adminClient.from("applications")
        .select("student_id").eq("job_id", jobId).eq("status", "Rejected");
      const studentIds = [...new Set((apps || []).map((a: { student_id: string }) => a.student_id))];
      if (!studentIds.length) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: emailRows } = await adminClient.rpc("get_user_emails", { user_ids: studentIds.slice(0, 50) });
      const emails: string[] = (emailRows || []).map((r: { email: string }) => r.email).filter(Boolean);
      if (!emails.length) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const apiKey = Deno.env.get("BREVO_API_KEY");
      if (!apiKey) throw new Error("BREVO_API_KEY not set");
      const jobTitle = escapeHtml(String(job.title));
      const closedHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">StudentShifts</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            Thank you for applying for <strong style="color:#1e293b;">${jobTitle}</strong>.<br/><br/>
            Unfortunately this position is no longer available. We appreciate your interest and encourage you to keep applying — new shifts are posted every day on StudentShifts.
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
      // L4: log BEFORE send
      await adminClient.from("email_sends_log").insert({ user_id: user.id }).catch(() => {});

      await Promise.allSettled(emails.map((email: string) =>
        fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
            to: [{ email }],
            subject: `Update on your ${String(job.title).replace(/[\r\n]/g, "")} application`,
            htmlContent: closedHtml,
          }),
        }).catch(e => console.warn("job-closed email failed:", e))
      ));
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── standard email send (admin caller only — companies must use templateType) ──
    // S5: reject raw html from company callers to prevent phishing via our Brevo account.
    if (profile?.role === "company") throw new Error("Unauthorised: companies must use templateType");
    if (!["admin"].includes(profile?.role)) throw new Error("Unauthorised");

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

    const { to, subject, html, magicLinkEmail, redirectTo } = body;
    if (!to || !subject || !html) throw new Error("Missing required fields: to, subject, html");

    // Validate email format for all recipients
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.isArray(to) ? to : [to];
    if (!recipients.every((r: string) => typeof r === "string" && emailRegex.test(r))) {
      throw new Error("Invalid email address in recipients");
    }

    // For company callers, verify every recipient is a student who applied to their jobs.
    // Admins can email any address (verification notices, support, etc.).
    if (profile?.role === "company") {
      const { data: allowedRows } = await adminClient.rpc("get_company_applicant_emails", { company_uuid: user.id });
      const allowedSet = new Set<string>((allowedRows || []).map((r: { email: string }) => r.email));
      if (!recipients.every((r: string) => allowedSet.has(r))) {
        throw new Error("Unauthorised: recipient is not an applicant of this company");
      }
    }

    // Validate redirectTo against known origins to prevent open redirect
    if (redirectTo) {
      const allowed = [FRONTEND_URL, "https://studentshifts.ie", "https://www.studentshifts.ie"];
      let redirectOrigin: string;
      try { redirectOrigin = new URL(redirectTo).origin; } catch { throw new Error("Unauthorised: invalid redirectTo"); }
      if (!allowed.some(o => { try { return new URL(o).origin === redirectOrigin; } catch { return false; } })) {
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
      const linkRes = await fetchWithTimeout(`${supabaseUrl}/auth/v1/admin/generate_link`, {
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

    // L4: log BEFORE send
    await adminClient.from("email_sends_log").insert({ user_id: user.id });

    const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
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
    const SAFE_PREFIXES = [
      "Unauthorised",
      "Missing required fields",
      "Missing required field",
      "Invalid redirectTo",
      "Failed to generate magic link",
      "Rate limit exceeded",
      "Invalid email address",
    ];
    const safe = SAFE_PREFIXES.some(prefix => msg.startsWith(prefix)) ? msg : "Internal server error";
    console.error("send-email error:", msg);
    return new Response(JSON.stringify({ error: safe }), {
      status: safe === "Internal server error" ? 500 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
