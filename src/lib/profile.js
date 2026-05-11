import { supabase, withTimeout, ensureValidSession } from "./supabase";

/** Fetches a user's full profile (profiles + students/companies join). Retries once on timeout. */
export async function getProfile(userId) {
  const run = () => withTimeout(
    supabase.from("profiles").select("*, students(*), companies(*)").eq("id", userId).single(),
    20000, "Failed to load profile — please refresh."
  );
  try {
    const { data, error } = await run();
    if (error) throw error;
    return data;
  } catch {
    // One auto-retry on timeout — Supabase cold starts can exceed 10 s
    const { data, error } = await run();
    if (error) throw error;
    return data;
  }
}

export async function updateStudentProfile(userId, updates) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("students").update(updates).eq("id", userId),
    10000, "Save timed out — please try again."
  );
  if (error) throw error;
}

export async function updateCompanyProfile(userId, updates) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("companies").update(updates).eq("id", userId),
    10000, "Save timed out — please try again."
  );
  if (error) throw error;
}

export async function saveCompanyCroNumber(userId, croNumber) {
  if (!croNumber) return;
  await ensureValidSession();
  const { error } = await supabase
    .from("companies")
    .update({ cro_number: croNumber })
    .eq("id", userId)
    .is("cro_number", null);
  if (error) console.warn("CRO save failed:", error.message);
}

export async function saveCompanyIndustries(userId, industries) {
  if (!industries?.length) return;
  await ensureValidSession();
  const { error } = await supabase
    .from("companies")
    .update({ industries })
    .eq("id", userId);
  if (error) console.warn("Industries save failed:", error.message);
}

/** Exports all personal data for a student as a JSON-serialisable object (GDPR Art. 20). */
export async function exportMyData(userId) {
  const [profileRes, studentRes, applicationsRes, likedRes, messagesRes] = await Promise.all([
    supabase.from("profiles").select("id, name, role, created_at").eq("id", userId).single(),
    supabase.from("students").select("bio, skills, linkedin, location_display, cv_url, cover_letter_url, status").eq("id", userId).single(),
    supabase.from("applications").select("job_id, status, created_at, jobs(title)").eq("student_id", userId),
    supabase.from("liked_jobs").select("job_id, jobs(title)").eq("student_id", userId),
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
