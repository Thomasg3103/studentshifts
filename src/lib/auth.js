import { supabase, withTimeout } from "./supabase";

export async function signUp({ email, password, name, role }) {
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password, options: { data: { name, role } } }),
    15000, "Sign up timed out — please try again."
  );
  if (error) throw error;
  return data.user;
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
    supabase
      .from("students")
      .select("id, student_id_url, gov_id_url, status, profiles(name)")
      .eq("status", "pending_review"),
    10000
  );
  if (error) throw error;
  return (data || []).map(s => ({
    id:           s.id,
    name:         s.profiles?.name || "Unknown",
    studentIdUrl: s.student_id_url,
    govIdUrl:     s.gov_id_url,
    status:       s.status,
  }));
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
