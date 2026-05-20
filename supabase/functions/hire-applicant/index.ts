import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * hire-applicant — Edge Function
 * POST { applicationId: string, action: "accept"|"reject", idempotencyKey?: string }
 * Auth: company JWT (Authorization header)
 * Rate limit: 10 actions/min per company (hire_action_log table)
 * Idempotency: duplicate (applicationId+action) within 60s returns cached result
 * Side-effects: updates applications.status, jobs.filled_shifts, sends Brevo emails
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, BREVO_API_KEY, FRONTEND_URL
 */
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

/** UUID v4 regex */
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
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailAccepted(studentName: string, jobTitle: string, companyName: string, shift: string | null): string {
  const sName = escapeHtml(studentName), jTitle = escapeHtml(jobTitle), cName = escapeHtml(companyName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td align="center" style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 24px 32px;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">StudentShifts</p>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You got the job! 🎉</p>
          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
            Congratulations ${sName}!<br/><br/>
            <strong style="color:#1e293b;">${cName}</strong> has hired you for <strong style="color:#1e293b;">${jTitle}</strong>.<br/>
            Log in to StudentShifts to send a message to your new employer and get started.
          </p>
          ${shift ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td style="background-color:#dcfce7;border:1.5px solid #86efac;border-radius:10px;padding:14px 20px;"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#16a34a;text-transform:uppercase;">Your Shift</p><p style="margin:0;font-size:15px;font-weight:700;color:#15803d;">${escapeHtml(shift)}</p></td></tr></table>` : ""}
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 28px;">
            <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;">Open Messages →</a>
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

function emailDeclined(studentName: string, jobTitle: string, companyName: string, shift: string | null, remainingShifts: string[]): string {
  const sName = escapeHtml(studentName), jTitle = escapeHtml(jobTitle), cName = escapeHtml(companyName);
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
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            Hi ${sName},<br/><br/>
            Thank you for applying for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
            ${shift ? `Unfortunately your application for the <strong style="color:#1e293b;">${escapeHtml(shift)}</strong> shift was unsuccessful.` : "Unfortunately your application was unsuccessful."}
            ${remainingShifts.length ? `<br/><br/>You are still being considered for other available shifts: <strong style="color:#1e293b;">${remainingShifts.map(s => escapeHtml(s)).join(", ")}</strong>.` : ""}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                ${remainingShifts.length ? "Keep an eye on your StudentShifts account for updates on your remaining applications." : "Good luck with your search! There are plenty more opportunities on StudentShifts."}
              </p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function emailShiftFilled(studentName: string, jobTitle: string, companyName: string, filledShift: string, remainingShifts: string[]): string {
  const sName = escapeHtml(studentName), jTitle = escapeHtml(jobTitle), cName = escapeHtml(companyName);
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
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            Hi ${sName},<br/><br/>
            Just a quick update on your application for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
            The <strong style="color:#1e293b;">${escapeHtml(filledShift)}</strong> shift has been filled, but your application is still active for the remaining shift${remainingShifts.length > 1 ? "s" : ""}: <strong style="color:#1e293b;">${remainingShifts.map(s => escapeHtml(s)).join(", ")}</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
              <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">Keep an eye on your StudentShifts account for updates on your application.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function emailInterviewRejection(studentName: string, jobTitle: string, companyName: string): string {
  const sName = escapeHtml(studentName), jTitle = escapeHtml(jobTitle), cName = escapeHtml(companyName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td align="center" style="background:linear-gradient(135deg,#A21D54,#C2185B);padding:36px 24px 32px;">
          <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">StudentShifts</p>
        </td></tr>
        <tr><td style="padding:36px 32px 28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Interview update</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
            Hi ${sName},<br/><br/>
            Thank you for interviewing for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
            Unfortunately, you have not been selected to progress to the next stage. We appreciate the time you took and encourage you to keep applying.
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function emailTrialRejection(studentName: string, jobTitle: string, companyName: string): string {
  const sName = escapeHtml(studentName), jTitle = escapeHtml(jobTitle), cName = escapeHtml(companyName);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/></head>
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
            Hi ${sName},<br/><br/>
            Thank you for completing a trial shift for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
            Unfortunately, your application was unsuccessful on this occasion. We encourage you to keep applying — new shifts are posted every day.
          </p>
        </td></tr>
        <tr><td style="border-top:1px solid #fafafa;padding:20px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendBrevoEmail(
  apiKey: string,
  supabaseUrl: string,
  serviceKey: string,
  to: string,
  subject: string,
  html: string,
  magicLinkEmail?: string,
): Promise<void> {
  let finalHtml = html;
  if (magicLinkEmail) {
    // F2: wrap in try-catch so email is always sent — fall back to direct frontend URL
    // if magic link generation fails rather than dropping the email entirely.
    try {
      const linkRes = await fetchWithTimeout(`${supabaseUrl}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "magiclink", email: magicLinkEmail, options: { redirect_to: FRONTEND_URL } }),
      });
      const linkData = await linkRes.json();
      finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", linkData.action_link || FRONTEND_URL);
    } catch {
      finalHtml = html.replaceAll("MAGIC_LINK_PLACEHOLDER", FRONTEND_URL);
    }
  }
  const safeSubject = String(subject).replace(/[\r\n]/g, "");
  const res = await fetchWithTimeout("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "StudentShifts", email: "noreply@studentshifts.ie" },
      to: [{ email: to }],
      subject: safeSubject,
      htmlContent: finalHtml,
    }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Brevo API error ${res.status}: ${(errData as { message?: string }).message || "unknown"}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorised");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const brevoKey    = Deno.env.get("BREVO_API_KEY");
    if (!brevoKey) throw new Error("BREVO_API_KEY not set");

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorised");

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: companyProfile } = await adminClient
      .from("profiles").select("role, name").eq("id", user.id).single();
    if (companyProfile?.role !== "company") throw new Error("Unauthorised");
    const companyName = (companyProfile.name as string) || "a company";

    const { applicationId, action, idempotencyKey: rawIdempotencyKey } = await req.json();
    if (!applicationId || typeof applicationId !== "string" || !UUID_RE.test(applicationId)) {
      throw new Error("Missing required fields: applicationId, action");
    }
    if (!["accept", "reject"].includes(action)) {
      throw new Error("Missing required fields: applicationId, action");
    }
    // Cap idempotency key length to prevent oversized DB writes
    const idempotencyKey = typeof rawIdempotencyKey === "string"
      ? rawIdempotencyKey.slice(0, 256)
      : undefined;

    // Rate limit: max 10 hire/reject actions per company per minute
    const { count: recentCount } = await adminClient
      .from("hire_action_log")
      .select("*", { count: "exact", head: true })
      .eq("company_id", user.id)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((recentCount ?? 0) >= 10) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded — max 10 hire actions per minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // S2: INSERT-first idempotency — the unique index idx_hire_action_log_ikey serialises
    // duplicate requests at the DB level, eliminating the SELECT-first TOCTOU race.
    const iKey = idempotencyKey || `${applicationId}:${action}`;
    const { error: iKeyErr } = await adminClient.from("hire_action_log").insert({
      company_id: user.id, action, idempotency_key: iKey, result: null,
    });
    if (iKeyErr?.code === "23505") {
      const { data: cached } = await adminClient.from("hire_action_log")
        .select("result").eq("company_id", user.id).eq("idempotency_key", iKey).single();
      return new Response(JSON.stringify({ success: true, idempotent: true, cached: cached?.result ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (iKeyErr) throw iKeyErr;

    // Fetch application
    const { data: app } = await adminClient
      .from("applications")
      .select("id, student_id, job_id, preferred_shift, pipeline_stage, status")
      .eq("id", applicationId).single();
    if (!app) throw new Error("Application not found");

    // Fetch job and verify company ownership
    const { data: job } = await adminClient
      .from("jobs")
      .select("id, company_id, title, days, times, filled_shifts, status")
      .eq("id", app.job_id).single();
    if (!job || job.company_id !== user.id) throw new Error("Unauthorised");

    // Fetch student name + email
    const { data: studentProfile } = await adminClient
      .from("profiles").select("name").eq("id", app.student_id).single();
    const studentName = (studentProfile?.name as string) || "there";
    const { data: emailRows } = await adminClient
      .rpc("get_user_emails", { user_ids: [app.student_id] });
    const studentEmail: string | undefined = emailRows?.[0]?.email;

    if (action === "accept") {
      // S3: atomic accept + filled_shifts + auto-decline in one DB transaction
      type RpcRow = {
        winner_student_id: string; winner_preferred_shift: string | null;
        declined_student_ids: string[]; notify_student_ids: string[];
        all_shifts_filled: boolean; new_filled_shifts: string[];
        out_job_id: string; out_job_title: string;
      };
      let rpcRow: RpcRow;
      try {
        const { data: rpcData, error: rpcErr } = await adminClient.rpc("accept_and_decline_applicants", {
          p_application_id: applicationId,
          p_company_id: user.id,
        });
        if (rpcErr) throw rpcErr;
        if (!rpcData?.[0]) throw new Error("Application not found");
        rpcRow = rpcData[0] as RpcRow;
      } catch (rpcEx) {
        // Clean up idempotency key so client can retry with a fresh request
        await adminClient.from("hire_action_log").delete()
          .eq("company_id", user.id).eq("idempotency_key", iKey).catch(() => {});
        throw rpcEx;
      }

      const { winner_student_id, winner_preferred_shift, declined_student_ids,
        notify_student_ids, all_shifts_filled, new_filled_shifts } = rpcRow;

      const hiredShiftWithTime = (winner_preferred_shift as string | null)?.trim() || null;
      const hiredDay = hiredShiftWithTime?.split(" · ")[0]?.trim() ?? null;
      const remainingShiftsAfterHire = ((job.days as string[]) || [])
        .filter(d => !(new_filled_shifts as string[]).includes(d))
        .map(d => {
          const t = (job.times as Record<string, string | string[]> | null)?.[d];
          const tLabel = Array.isArray(t) ? t[0] : t;
          return tLabel ? `${d} · ${tLabel}` : d;
        });

      // Fetch emails + names for winner, declined, and notify students in one batch
      const uniqStudentIds = [...new Set([winner_student_id, ...(declined_student_ids || []), ...(notify_student_ids || [])])];
      const { data: emailProfiles } = await adminClient.rpc("get_user_emails", { user_ids: uniqStudentIds.slice(0, 50) });
      const emailMap: Record<string, string> = Object.fromEntries(
        ((emailProfiles || []) as { id: string; email: string }[]).map(p => [p.id, p.email])
      );
      const { data: nameProfiles } = await adminClient.from("profiles").select("id, name").in("id", uniqStudentIds);
      const nameMap: Record<string, string> = Object.fromEntries(
        ((nameProfiles || []) as { id: string; name: string }[]).map(p => [p.id, p.name || "there"])
      );

      // Send emails best-effort
      const winnerEmail = emailMap[winner_student_id] || studentEmail;
      if (winnerEmail) {
        sendBrevoEmail(brevoKey, supabaseUrl, serviceKey, winnerEmail,
          `You've been hired – ${job.title} at ${companyName}`,
          emailAccepted(nameMap[winner_student_id] || studentName, job.title, companyName, hiredShiftWithTime),
          winnerEmail
        ).catch(e => console.warn("Acceptance email failed:", e));
      }
      for (const sid of (declined_student_ids || [])) {
        const em = emailMap[sid]; if (!em) continue;
        sendBrevoEmail(brevoKey, supabaseUrl, serviceKey, em,
          `Update on your ${job.title} application`,
          emailDeclined(nameMap[sid] || "there", job.title, companyName, hiredShiftWithTime, remainingShiftsAfterHire)
        ).catch(e => console.warn("Decline email failed:", e));
      }
      for (const sid of (notify_student_ids || [])) {
        const em = emailMap[sid]; if (!em) continue;
        const filledLabel = hiredShiftWithTime ?? hiredDay ?? "a shift";
        sendBrevoEmail(brevoKey, supabaseUrl, serviceKey, em,
          `Update on your ${job.title} application`,
          emailShiftFilled(nameMap[sid] || "there", job.title, companyName, filledLabel, remainingShiftsAfterHire)
        ).catch(e => console.warn("Notify email failed:", e));
      }

      const acceptResult = { filledShifts: new_filled_shifts, closedJob: all_shifts_filled, declinedIds: declined_student_ids };
      await adminClient.from("audit_log").insert({
        actor_id: user.id, action: "hire_accept", target_id: winner_student_id,
        metadata: { application_id: applicationId, job_id: app.job_id, job_title: job.title },
      }).catch(() => {});
      await adminClient.from("hire_action_log").update({ result: acceptResult })
        .eq("company_id", user.id).eq("idempotency_key", iKey).catch(() => {});
      return new Response(JSON.stringify({ success: true, ...acceptResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "reject" — only update if still Pending
    const { data: rejectedRows, error: rejectErr } = await adminClient
      .from("applications").update({ status: "Rejected" })
      .eq("id", applicationId).eq("status", "Pending").select("id");
    if (rejectErr) {
      await adminClient.from("hire_action_log").delete()
        .eq("company_id", user.id).eq("idempotency_key", iKey).catch(() => {});
      throw rejectErr;
    }
    if (!rejectedRows?.length) {
      await adminClient.from("hire_action_log").delete()
        .eq("company_id", user.id).eq("idempotency_key", iKey).catch(() => {});
      throw new Error("Application already processed");
    }
    // (idempotency key already inserted at the start — no second INSERT needed)
    if (studentEmail) {
      const stage = (app.pipeline_stage as string) || "applied";
      const subject = `Update on your ${job.title} application`;
      const html = stage === "interview"
        ? emailInterviewRejection(studentName, job.title, companyName)
        : stage === "trial"
        ? emailTrialRejection(studentName, job.title, companyName)
        : emailDeclined(studentName, job.title, companyName, null, []);
      sendBrevoEmail(brevoKey, supabaseUrl, serviceKey, studentEmail, subject, html)
        .catch(e => console.warn("Rejection email failed:", e));
    }
    await adminClient.from("audit_log").insert({
      actor_id: user.id, action: "hire_reject", target_id: app.student_id,
      metadata: { application_id: applicationId, job_id: app.job_id, stage: app.pipeline_stage },
    }).catch(() => {});
    await adminClient.from("hire_action_log").update({ result: { applicationId } })
      .eq("company_id", user.id).eq("idempotency_key", iKey).catch(() => {});
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const safe = ["Unauthorised", "Missing required fields", "Application not found"]
      .some(p => msg.startsWith(p)) ? msg : "Internal server error";
    console.error("hire-applicant error:", msg);
    return new Response(JSON.stringify({ error: safe }), {
      status: safe === "Internal server error" ? 500 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
