import { supabase, withTimeout, ensureValidSession } from "./supabase";

/** Fetches a user's full profile (profiles + students/companies join). Retries once on timeout.
 *  Returns null if no profile row exists yet (e.g. DB trigger failed at signup). */
export async function getProfile(userId) {
  const run = () => withTimeout(
    supabase.from("profiles").select("*, students(*), companies(*)").eq("id", userId).single(),
    20000, "Failed to load profile — please refresh."
  );
  const attempt = async () => {
    const { data, error } = await run();
    // PGRST116 = "no rows returned" — profile row not created yet (trigger failed at signup)
    if (error?.code === "PGRST116") return null;
    if (error) throw error;
    return data;
  };
  try {
    return await attempt();
  } catch {
    // One auto-retry on timeout — Supabase cold starts can exceed 10 s
    return await attempt();
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
  const { error } = await withTimeout(
    supabase.from("companies").update({ cro_number: croNumber }).eq("id", userId).is("cro_number", null),
    10000
  );
  if (error) console.warn("CRO save failed:", error.message);
}

export async function saveCompanyIndustries(userId, industries) {
  if (!industries?.length) return;
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("companies").update({ industries }).eq("id", userId),
    10000
  );
  if (error) console.warn("Industries save failed:", error.message);
}

/** Exports all personal data as a JSON-serialisable object (GDPR Art. 20). */
export async function exportMyData(userId, role = "student") {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("export_log")
    .select("id")
    .eq("user_id", userId)
    .gte("exported_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    throw new Error("You can only export your data once every 24 hours.");
  }

  await supabase.from("export_log").insert({ user_id: userId });

  if (role === "company") {
    const [profileRes, companyRes, jobsRes, messagesRes] = await Promise.all([
      supabase.from("profiles").select("id, name, role, created_at").eq("id", userId).single(),
      supabase.from("companies").select("bio, website, cro_number, status").eq("id", userId).single(),
      supabase.from("jobs").select("id, title, category, pay, location, days, status, deadline, created_at").eq("company_id", userId).order("created_at"),
      supabase.from("chat_messages").select("text, created_at, sender_id, student_id").eq("company_id", userId).order("created_at"),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      profile:    profileRes.data  || {},
      company:    companyRes.data  || {},
      jobs:       jobsRes.data     || [],
      messages:   messagesRes.data || [],
    };
  }

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
  // GDPR Art. 17 — erase storage files before deleting the auth user
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id;
  if (uid) {
    const [avatarRes, docRes, verifyRes, photoRes] = await Promise.allSettled([
      supabase.storage.from("avatars").list(uid),
      supabase.storage.from("documents").list(uid),
      supabase.storage.from("verification-docs").list(uid),
      supabase.storage.from("job-photos").list(uid),
    ]);
    const deletes = [];
    if (avatarRes.status === "fulfilled" && avatarRes.value.data?.length) {
      deletes.push(supabase.storage.from("avatars").remove(avatarRes.value.data.map(f => `${uid}/${f.name}`)));
    }
    if (docRes.status === "fulfilled" && docRes.value.data?.length) {
      deletes.push(supabase.storage.from("documents").remove(docRes.value.data.map(f => `${uid}/${f.name}`)));
    }
    if (verifyRes.status === "fulfilled" && verifyRes.value.data?.length) {
      deletes.push(supabase.storage.from("verification-docs").remove(verifyRes.value.data.map(f => `${uid}/${f.name}`)));
    }
    if (photoRes.status === "fulfilled" && photoRes.value.data?.length) {
      deletes.push(supabase.storage.from("job-photos").remove(photoRes.value.data.map(f => `${uid}/${f.name}`)));
    }
    await Promise.allSettled(deletes);
  }

  const { error } = await withTimeout(
    supabase.rpc("delete_account"),
    15000, "Account deletion timed out — please try again."
  );
  if (error) throw error;
}
