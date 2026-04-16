import { supabase, withTimeout } from "./supabase";

export async function signUp({ email, password, name, role, croNumber }) {
  const meta = { name, role };
  if (role === "company" && croNumber) meta.cro_number = croNumber.trim();
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password, options: { data: meta } }),
    15000, "Sign up timed out — please try again."
  );
  if (error) throw error;
  return data.user;
}

// Called on first SIGNED_IN for a company — persists cro_number from
// auth metadata into the companies table (only if not already set).
export async function saveCompanyCroNumber(userId, croNumber) {
  if (!croNumber) return;
  const { error } = await supabase
    .from("companies")
    .update({ cro_number: croNumber })
    .eq("id", userId)
    .is("cro_number", null);
  if (error) console.warn("CRO save failed:", error.message);
}

export async function signIn({ email, password }) {
  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000, "Login timed out — please try again."
  );
  if (error) {
    if (error.message?.toLowerCase().includes("email not confirmed"))
      throw new Error("Please verify your email before logging in. Check your inbox for the confirmation link.");
    throw error;
  }
  return data.user;
}

export async function signOut() {
  const { error } = await withTimeout(
    supabase.auth.signOut(),
    10000, "Sign out timed out."
  );
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await withTimeout(
    supabase.from("profiles").select("*, students(*), companies(*)").eq("id", userId).single(),
    10000, "Failed to load profile — please refresh."
  );
  if (error) throw error;
  return data;
}

export async function updateStudentProfile(userId, updates) {
  const { error } = await withTimeout(
    supabase.from("students").update(updates).eq("id", userId),
    10000, "Save timed out — please try again."
  );
  if (error) throw error;
}

// Requires these tables:
//   create table liked_jobs (
//     student_id uuid references profiles(id) on delete cascade not null,
//     job_id     uuid references jobs(id)     on delete cascade not null,
//     primary key (student_id, job_id)
//   );
//   create table applications (
//     id         uuid primary key default gen_random_uuid(),
//     student_id uuid references profiles(id) on delete cascade not null,
//     job_id     uuid references jobs(id)     on delete cascade not null,
//     status     text not null default 'Pending',
//     created_at timestamptz not null default now(),
//     unique(student_id, job_id)
//   );

export async function fetchLikedJobIds(userId) {
  const { data, error } = await withTimeout(
    supabase.from("liked_jobs").select("job_id").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return (data || []).map(r => r.job_id);
}

export async function likeJob(userId, jobId) {
  const { error } = await supabase.from("liked_jobs").insert({ student_id: userId, job_id: jobId });
  if (error && error.code !== "23505") throw error;
}

export async function unlikeJob(userId, jobId) {
  const { error } = await supabase.from("liked_jobs").delete().eq("student_id", userId).eq("job_id", jobId);
  if (error) throw error;
}

export async function fetchAppliedJobIds(userId) {
  const { data, error } = await withTimeout(
    supabase.from("applications").select("job_id").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return (data || []).map(r => r.job_id);
}

export async function createApplication(userId, jobId) {
  const { error } = await supabase.from("applications").insert({ student_id: userId, job_id: jobId });
  if (error && error.code !== "23505") throw error;
}

export async function fetchApplicationStatuses(userId) {
  const { data, error } = await withTimeout(
    supabase.from("applications").select("job_id, status").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  // Returns { [jobId]: status }
  return Object.fromEntries((data || []).map(r => [r.job_id, r.status]));
}

export async function removeApplication(userId, jobId) {
  const { error } = await supabase.from("applications").delete().eq("student_id", userId).eq("job_id", jobId);
  if (error) throw error;
}

// Requires a Supabase SQL function:
//   create or replace function delete_account()
//   returns void language plpgsql security definer as $$
//   begin
//     delete from auth.users where id = auth.uid();
//   end;
//   $$;
export async function sendPasswordReset(email) {
  const { error } = await withTimeout(
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    }),
    15000, "Password reset timed out — please try again."
  );
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await withTimeout(
    supabase.auth.updateUser({ password: newPassword }),
    15000, "Password update timed out — please try again."
  );
  if (error) throw error;
}

export async function exportMyData(userId) {
  const [profileRes, studentRes, applicationsRes, likedRes, messagesRes] = await Promise.all([
    supabase.from("profiles").select("id, name, role, created_at").eq("id", userId).single(),
    supabase.from("students").select("bio, skills, linkedin, location_display, cv_url, cover_letter_url, status").eq("id", userId).single(),
    supabase.from("applications").select("job_id, status, created_at, jobs(title, company)").eq("student_id", userId),
    supabase.from("liked_jobs").select("job_id, jobs(title, company)").eq("student_id", userId),
    supabase.from("chat_messages").select("text, created_at, sender_id").eq("student_id", userId).order("created_at"),
  ]);
  return {
    exportedAt:   new Date().toISOString(),
    profile:      profileRes.data  || {},
    student:      studentRes.data  || {},
    applications: applicationsRes.data || [],
    likedJobs:    likedRes.data    || [],
    messages:     messagesRes.data || [],
  };
}

export async function deleteAccount() {
  const { error } = await withTimeout(
    supabase.rpc("delete_account"),
    15000, "Account deletion timed out — please try again."
  );
  if (error) throw error;
}

// Uploads a document (CV, cover letter, ID) to the given storage bucket.
// Returns the public URL.
export async function uploadDocument(userId, file, bucket, fileName) {
  const ext  = file.name.split(".").pop();
  const path = `${userId}/${fileName}.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from(bucket).upload(path, file, { upsert: true }),
    15000, `${fileName} upload timed out — please try again.`
  );
  if (error) throw error;
  // Store the storage path, not a public URL — we generate signed URLs on demand
  return path;
}

export async function uploadVerificationDocs(userId, studentIdFile, governmentIdFile) {
  const [studentIdPath, govIdPath] = await Promise.all([
    uploadDocument(userId, studentIdFile, "verification-docs", "student_id"),
    uploadDocument(userId, governmentIdFile, "verification-docs", "government_id"),
  ]);
  const { error } = await withTimeout(
    supabase.from("students").update({
      student_id_url: studentIdPath,
      gov_id_url: govIdPath,
      status: "pending_review",
    }).eq("id", userId),
    10000, "Failed to save document details — please try again."
  );
  if (error) throw error;
}

export async function fetchPendingStudents() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_pending_students"),
    10000
  );
  if (error) throw error;
  return (data || []).map(s => ({
    id:           s.id,
    name:         s.name          || "Unknown",
    email:        s.email         || null,
    studentIdUrl: s.student_id_url,
    govIdUrl:     s.gov_id_url,
    status:       s.status,
  }));
}

export async function fetchPendingCompanies() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_pending_companies"),
    10000
  );
  if (error) throw error;
  return (data || []).map(c => ({
    id:        c.id,
    name:      c.name      || "Unknown",
    email:     c.email     || null,
    croNumber: c.cro_number || null,
    status:    c.status,
  }));
}

export async function approveCompany(companyId) {
  const { error } = await withTimeout(
    supabase.rpc("approve_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
}

export async function rejectCompany(companyId) {
  const { error } = await withTimeout(
    supabase.rpc("reject_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
}

// Sends a transactional email via the Render email server.
// Set VITE_EMAIL_API_URL and VITE_EMAIL_API_KEY in .env
export async function sendEmail({ to, subject, html }) {
  const apiUrl = import.meta.env.VITE_EMAIL_API_URL;
  const apiKey = import.meta.env.VITE_EMAIL_API_KEY;
  if (!apiUrl) { console.warn("VITE_EMAIL_API_URL not set"); return; }
  const res = await fetch(`${apiUrl}/send-email`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey || "" },
    body:    JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Email API returned ${res.status}`);
  }
}

// ── Email HTML templates ──────────────────────────────────────────────────

export function emailStudentApproved(name, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You're verified! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${name}, your identity has been verified and your StudentShifts account is now active.<br/><br/>
              Browse hundreds of flexible student jobs across Ireland and apply in seconds.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(99,102,241,0.4);">
                    Find your Shift →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailCompanyApproved(name, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Company verified! ✅</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${name}, your company account on StudentShifts has been verified.<br/><br/>
              You can now post job listings and start receiving applications from students across Ireland.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(99,102,241,0.4);">
                    Post a Job →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailApplicantAccepted(studentName, jobTitle, companyName, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#10b981,#059669);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You got the job! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Congratulations ${studentName}!<br/><br/>
              <strong style="color:#1e293b;">${companyName}</strong> has accepted your application for <strong style="color:#1e293b;">${jobTitle}</strong>.<br/><br/>
              Log in to StudentShifts to send a message to your new employer and get started.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(16,185,129,0.4);">
                    Open Messages →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailApplicantDeclined(studentName, jobTitle, companyName) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${studentName},<br/><br/>
              Thank you for applying for <strong style="color:#1e293b;">${jobTitle}</strong> at <strong style="color:#1e293b;">${companyName}</strong>.<br/><br/>
              Unfortunately the position has been filled. We encourage you to keep applying — new shifts are added every day.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#f8fafc;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
                    Good luck with your search! There are plenty more opportunities on StudentShifts.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f1f5f9;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">StudentShifts &mdash; helping students find flexible work in Ireland</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function approveStudent(studentId) {
  const { error } = await withTimeout(
    supabase.rpc("approve_student", { student_id: studentId }),
    10000
  );
  if (error) throw error;
}

export async function rejectStudent(studentId) {
  const { error } = await withTimeout(
    supabase.rpc("reject_student", { student_id: studentId }),
    10000
  );
  if (error) throw error;
}

export async function getSignedDocumentUrl(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchMessages(jobId, studentId) {
  const { data, error } = await withTimeout(
    supabase.from("chat_messages")
      .select("id, sender_id, text, created_at")
      .eq("job_id", jobId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
    10000
  );
  if (error) throw error;
  return data || [];
}

export async function sendMessage(jobId, studentId, companyId, senderId, text) {
  const { error } = await supabase.from("chat_messages").insert({
    job_id: jobId, student_id: studentId, company_id: companyId, sender_id: senderId, text,
  });
  if (error) throw error;
}

export async function fetchCompanyConversations(companyId) {
  const { data: jobs, error: jobsErr } = await withTimeout(
    supabase.from("jobs").select("id, title").eq("company_id", companyId),
    10000
  );
  if (jobsErr) throw jobsErr;
  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map(j => j.id);
  const { data: apps, error: appsErr } = await withTimeout(
    supabase.from("applications").select("job_id, student_id").in("job_id", jobIds).eq("status", "Accepted"),
    10000
  );
  if (appsErr) throw appsErr;
  if (!apps || apps.length === 0) return [];

  const studentIds = [...new Set(apps.map(a => a.student_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", studentIds),
    10000
  );
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  const jobMap  = Object.fromEntries(jobs.map(j => [j.id, j]));

  return apps.map(a => ({
    jobId:       a.job_id,
    studentId:   a.student_id,
    title:       jobMap[a.job_id]?.title || "Job",
    studentName: nameMap[a.student_id]  || "Student",
  }));
}

export async function fetchAcceptedConversations(userId) {
  const { data: apps, error: appsErr } = await withTimeout(
    supabase.from("applications").select("job_id").eq("student_id", userId).eq("status", "Accepted"),
    10000
  );
  if (appsErr) throw appsErr;
  if (!apps || apps.length === 0) return [];

  const jobIds = apps.map(a => a.job_id);
  const { data: jobs, error: jobsErr } = await withTimeout(
    supabase.from("jobs").select("id, title, company_id").in("id", jobIds),
    10000
  );
  if (jobsErr) throw jobsErr;

  const companyIds = [...new Set((jobs || []).map(j => j.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds),
    10000
  );
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  const jobMap  = Object.fromEntries((jobs || []).map(j => [j.id, j]));

  return jobIds.map(jid => ({
    jobId:       jid,
    title:       jobMap[jid]?.title       || "Job",
    companyId:   jobMap[jid]?.company_id  || null,
    companyName: nameMap[jobMap[jid]?.company_id] || "Company",
  }));
}

export async function uploadAvatar(userId, file) {
  const ext  = file.name.split(".").pop();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Photo upload timed out — profile saved without new photo."
  );
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
}
