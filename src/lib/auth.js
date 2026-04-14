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
  if (error) throw error;
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
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl + "?t=" + Date.now();
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
