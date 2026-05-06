import { supabase, withTimeout } from "./supabase";

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toJobSlug(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function fromJobSlug(slug) {
  return slug.replace(/-/g, ' ');
}

function escapeIlike(str) {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function normaliseJobRow(job, companyName) {
  return {
    id:              job.id,
    title:           job.title,
    company:         companyName || "Unknown Company",
    location:        job.location,
    lat:             job.lat,
    lng:             job.lng,
    pay:             job.pay,
    description:     job.description || "",
    deadline:        job.deadline || null,
    days:            job.days || [],
    times:           Object.fromEntries(Object.entries(job.times || {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
    weekendRequired: job.weekend_required || false,
    photos:          job.photos || [],
    photoCrops:      job.photo_crops || [],
    filledShifts:    job.filled_shifts || [],
    status:          job.status,
  };
}

// Fetch a single job by title + company name (used for direct URL access)
export async function fetchJobBySlug(titleSlug, companySlug) {
  const title   = fromJobSlug(titleSlug);
  const company = fromJobSlug(companySlug);

  // Fetch jobs matching the title (case-insensitive)
  const { data: jobs, error } = await withTimeout(
    supabase.from("jobs").select("*").ilike("title", escapeIlike(title)).eq("status", "Active"),
    10000
  );
  if (error) throw error;
  if (!jobs?.length) throw new Error("Job not found");

  // Fetch company names for the candidates
  const companyIds = [...new Set(jobs.map(j => j.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds),
    8000
  ).catch(() => ({ data: [] }));
  const nameMap = {};
  if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });

  // Find the job whose company name matches the slug
  const match = jobs.find(j => (nameMap[j.company_id] || "").toLowerCase() === company.toLowerCase())
    ?? jobs[0]; // fallback to first title match if company name diverges slightly

  return normaliseJobRow(match, nameMap[match.company_id]);
}

export async function signUp({ email, password, name, role, croNumber, industries }) {
  if (role !== 'student' && role !== 'company') throw new Error('Invalid role');
  const meta = { name, role };
  if (role === "company" && croNumber) meta.cro_number = croNumber.trim();
  if (role === "company" && industries?.length) meta.industries = industries;
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

// Called on first SIGNED_IN for a company — persists industries from metadata.
export async function saveCompanyIndustries(userId, industries) {
  if (!industries?.length) return;
  const { error } = await supabase
    .from("companies")
    .update({ industries })
    .eq("id", userId);
  if (error) console.warn("Industries save failed:", error.message);
}

export async function updateCompanyProfile(userId, updates) {
  const { error } = await withTimeout(
    supabase.from("companies").update(updates).eq("id", userId),
    10000, "Save timed out — please try again."
  );
  if (error) throw error;
}

export async function fetchAllVerifiedStudents() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_all_verified_students"),
    10000
  );
  if (error) throw error;
  return data || [];
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

export async function fetchAvailabilityHeatmap() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_availability_heatmap"),
    10000, "Timed out loading availability."
  );
  if (error) throw error;
  // Convert rows → { Monday: { "09:00": 5, "10:00": 3 }, ... }
  const map = {};
  for (const { day, slot, student_count } of data || []) {
    if (!map[day]) map[day] = {};
    map[day][slot] = Number(student_count);
  }
  return map;
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

export async function fetchJobsByIds(ids) {
  if (!ids.length) return [];
  const { data: jobs, error } = await withTimeout(
    supabase.from("jobs").select("*").in("id", ids),
    10000
  );
  if (error || !jobs?.length) return [];
  const companyIds = [...new Set(jobs.map(j => j.company_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", companyIds);
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  return jobs.map(j => normaliseJobRow(j, nameMap[j.company_id]));
}

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

export async function createApplication(userId, jobId, preferredShift = null) {
  const payload = { student_id: userId, job_id: jobId };
  if (preferredShift) payload.preferred_shift = preferredShift;
  const { error } = await supabase.from("applications").insert(payload);
  if (!error) return;
  // Column doesn't exist yet — retry without it so the apply still succeeds
  if (error.code === "42703" && preferredShift) {
    const { error: e2 } = await supabase.from("applications").insert({ student_id: userId, job_id: jobId });
    if (!e2 || e2.code === "23505") return;
    throw e2;
  }
  if (error.code === "23505") return;
  if (error.code === "42501") throw new Error("You've applied to too many jobs this hour. Please try again later.");
  throw error;
}

export async function updateApplicationStage(applicationId, stage) {
  const { data, error } = await supabase
    .from("applications")
    .update({ pipeline_stage: stage })
    .eq("id", applicationId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Stage update failed — row not found or permission denied");
}

export async function saveApplicationNotes(applicationId, notes) {
  const { error } = await supabase
    .from("applications")
    .update({ company_notes: notes })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function incrementInterviewRound(applicationId, currentRound) {
  const { data, error } = await supabase
    .from("applications")
    .update({ interview_round: currentRound + 1 })
    .eq("id", applicationId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Round update failed — row not found or permission denied");
}

export async function saveTrialSchedule(applicationId, trialDate, trialTime) {
  const { error } = await supabase
    .from("applications")
    .update({ trial_date: trialDate || null, trial_time: trialTime || null })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function saveInterviewSchedule(applicationId, date, time) {
  const { error } = await supabase
    .from("applications")
    .update({ interview_date: date || null, interview_time: time || null })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function saveInterviewRoundsData(applicationId, rounds) {
  const { error } = await supabase
    .from("applications")
    .update({ interview_rounds_data: rounds })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function moveToInterviewRound(applicationId, round) {
  const { data, error } = await supabase
    .from("applications")
    .update({ pipeline_stage: "interview", interview_round: round })
    .eq("id", applicationId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Move failed — row not found or permission denied");
}

export async function fetchLikedStudentIds(companyId) {
  const { data, error } = await supabase
    .from("company_liked_students")
    .select("student_id")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data || []).map(r => r.student_id);
}

export async function likeStudent(companyId, studentId) {
  const { error } = await supabase
    .from("company_liked_students")
    .insert({ company_id: companyId, student_id: studentId });
  if (error && error.code !== "23505") throw error;
}

export async function unlikeStudent(companyId, studentId) {
  const { error } = await supabase
    .from("company_liked_students")
    .delete()
    .eq("company_id", companyId)
    .eq("student_id", studentId);
  if (error) throw error;
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

export async function verifyPassword(email, password) {
  const { error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    15000, "Verification timed out."
  );
  if (error) throw new Error("Incorrect password");
}

export async function deleteAccount() {
  const { error } = await withTimeout(
    supabase.rpc("delete_account"),
    15000, "Account deletion timed out — please try again."
  );
  if (error) throw error;
}

const ALLOWED_DOC_TYPES  = new Set(["pdf", "doc", "docx"]);
const ALLOWED_IMAGE_TYPES = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_DOC_BYTES   = 10 * 1024 * 1024;  // 10 MB
const MAX_IMAGE_BYTES =  5 * 1024 * 1024;  //  5 MB

// Uploads a document (CV, cover letter, ID) to the given storage bucket.
// Returns the public URL.
export async function uploadDocument(userId, file, bucket, fileName) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const isVerificationDoc = bucket === "verification-docs";
  const allowedExts = isVerificationDoc ? new Set([...ALLOWED_DOC_TYPES, ...ALLOWED_IMAGE_TYPES]) : ALLOWED_DOC_TYPES;
  if (!allowedExts.has(ext)) throw new Error(`File type .${ext} is not allowed. Please upload a PDF${isVerificationDoc ? ", image," : ""} or Word document.`);
  if (file.size > MAX_DOC_BYTES) throw new Error("File is too large. Maximum size is 10 MB.");
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

// Sends a transactional email via the Supabase Edge Function.
export async function sendEmail({ to, subject, html, magicLinkEmail, redirectTo }) {
  const { error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, html, magicLinkEmail, redirectTo },
  });
  if (error) throw new Error(error.message || "Email send failed");
}

// ── Email HTML templates ──────────────────────────────────────────────────

export function emailStudentApproved(name) {
  const safeName = escapeHtml(name);
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You're verified! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName}, your identity has been verified and your StudentShifts account is now active.<br/><br/>
              Browse hundreds of flexible student jobs across Ireland and apply in seconds.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Find your Shift →
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

export function emailCompanyApproved(name, appUrl) {
  const safeName = escapeHtml(name);
  const safeUrl  = /^https?:\/\//i.test(appUrl) ? escapeHtml(appUrl) : '#';
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Company verified! ✅</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${safeName}, your company account on StudentShifts has been verified.<br/><br/>
              You can now post job listings and start receiving applications from students across Ireland.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Post a Job →
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

export function emailApplicantAccepted(studentName, jobTitle, companyName) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
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
              Congratulations ${sName}!<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> has accepted your application for <strong style="color:#1e293b;">${jTitle}</strong>.<br/><br/>
              Log in to StudentShifts to send a message to your new employer and get started.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(16,185,129,0.4);">
                    Open Messages →
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

export function emailApplicantDeclined(studentName, jobTitle, companyName) {
  const sName = escapeHtml(studentName);
  const jTitle = escapeHtml(jobTitle);
  const cName = escapeHtml(companyName);
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Application update</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              Thank you for applying for <strong style="color:#1e293b;">${jTitle}</strong> at <strong style="color:#1e293b;">${cName}</strong>.<br/><br/>
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

export function emailCompanyInterested(studentName, companyName) {
  const sName = escapeHtml(studentName);
  const cName = escapeHtml(companyName);
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
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">A company wants to hire you! 🎉</p>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> is interested in hiring you and has sent you a message on StudentShifts.<br/><br/>
              Log in to read their message and reply.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#A21D54,#C2185B);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(162,29,84,0.4);">
                    Read Message →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;">You're receiving this because your profile is visible to verified companies on StudentShifts.</p>
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

export function emailInterviewInvite(studentName, companyName, date, time, note, teamsLink) {
  const sName   = escapeHtml(studentName);
  const cName   = escapeHtml(companyName);
  const safeNote = note ? escapeHtml(note) : "";
  const safeTeams = teamsLink && /^https?:\/\//i.test(teamsLink) ? escapeHtml(teamsLink) : "";
  const whenLine = date && time ? `${escapeHtml(date)} at ${escapeHtml(time)}`
    : date ? escapeHtml(date)
    : time ? escapeHtml(time)
    : "To be confirmed";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr>
          <td align="center" style="background:linear-gradient(135deg,#7c3aed,#A21D54);padding:36px 24px 32px;">
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">StudentShifts</p>
            <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Find your next shift</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">You've been invited to interview! 🗓️</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${sName},<br/><br/>
              <strong style="color:#1e293b;">${cName}</strong> would like to invite you for an interview on StudentShifts.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="background-color:#fce7f3;border:1.5px solid #e9d5ff;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.05em;">Interview Details</p>
                  <p style="margin:0 0 4px;font-size:14px;color:#1e293b;"><strong>When:</strong> ${whenLine}</p>
                  ${safeNote ? `<p style="margin:8px 0 0;font-size:14px;color:#374151;line-height:1.5;"><strong>Note from ${cName}:</strong><br/>${safeNote}</p>` : ""}
                  ${safeTeams ? `<p style="margin:10px 0 0;font-size:14px;color:#1e293b;"><strong>Teams Link:</strong> <a href="${safeTeams}" style="color:#A21D54;">${safeTeams}</a></p>` : ""}
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 28px;">
                  <a href="MAGIC_LINK_PLACEHOLDER" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#A21D54);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:50px;box-shadow:0 4px 18px rgba(124,58,237,0.4);">
                    Open StudentShifts →
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

export async function fetchMessages(jobId, studentId, companyId = null) {
  let query = supabase.from("chat_messages")
    .select("id, sender_id, text, created_at");
  if (jobId === null) {
    query = query.is("job_id", null).eq("student_id", studentId).eq("company_id", companyId);
  } else {
    query = query.eq("job_id", jobId).eq("student_id", studentId);
  }
  const { data, error } = await withTimeout(
    query.order("created_at", { ascending: true }),
    10000
  );
  if (error) throw error;
  return data || [];
}

export async function sendMessage(jobId, studentId, companyId, senderId, text) {
  const { error } = await supabase.from("chat_messages").insert({
    job_id: jobId ?? null, student_id: studentId, company_id: companyId, sender_id: senderId, text,
  });
  if (error) throw error;
}

export async function fetchCompanyDirectConversations(companyId) {
  const { data, error } = await withTimeout(
    supabase.from("chat_messages").select("student_id").eq("company_id", companyId).is("job_id", null),
    10000
  );
  if (error) throw error;
  if (!data?.length) return [];
  const studentIds = [...new Set(data.map(m => m.student_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", studentIds), 10000
  );
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  return studentIds.map(sid => ({ jobId: null, studentId: sid, studentName: nameMap[sid] || "Student", title: "Direct Message" }));
}

export async function fetchStudentDirectConversations(studentId) {
  const { data, error } = await withTimeout(
    supabase.from("chat_messages").select("company_id").eq("student_id", studentId).is("job_id", null),
    10000
  );
  if (error) throw error;
  if (!data?.length) return [];
  const companyIds = [...new Set(data.map(m => m.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds), 10000
  );
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  return companyIds.map(cid => ({ jobId: null, companyId: cid, companyName: nameMap[cid] || "Company", title: "Direct Message" }));
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
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_IMAGE_TYPES.has(ext)) throw new Error(`File type .${ext} is not allowed. Please upload a JPG, PNG, WebP or GIF.`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Photo is too large. Maximum size is 5 MB.");
  const path = `${userId}/avatar.${ext}`;
  const { error } = await withTimeout(
    supabase.storage.from("avatars").upload(path, file, { upsert: true }),
    10000, "Photo upload timed out — profile saved without new photo."
  );
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
}
