import { supabase, withTimeout, ensureValidSession } from "./supabase";

export async function fetchLikedJobIds(userId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("liked_jobs").select("job_id").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return (data || []).map(r => r.job_id);
}

export async function likeJob(userId, jobId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("liked_jobs").insert({ student_id: userId, job_id: jobId }),
    10000
  );
  if (error && error.code !== "23505") throw error;
}

export async function unlikeJob(userId, jobId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("liked_jobs").delete().eq("student_id", userId).eq("job_id", jobId),
    10000
  );
  if (error) throw error;
}

export async function fetchAppliedJobIds(userId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").select("job_id").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return (data || []).map(r => r.job_id);
}

export async function createApplication(userId, jobId, preferredShift = null) {
  await ensureValidSession();
  const payload = { student_id: userId, job_id: jobId };
  if (preferredShift) payload.preferred_shift = preferredShift;
  const { error } = await withTimeout(supabase.from("applications").insert(payload), 10000);
  if (!error) return true;
  if (error.code === "42703" && preferredShift) {
    const { error: e2 } = await withTimeout(supabase.from("applications").insert({ student_id: userId, job_id: jobId }), 10000);
    if (!e2) return true;
    if (e2.code === "23505") return false;
    throw e2;
  }
  if (error.code === "23505") return false;
  if (error.code === "42501") throw new Error("You've applied to too many jobs this hour. Please try again later.");
  throw error;
}

export async function fetchApplicationStatuses(userId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").select("job_id, status, pipeline_stage, preferred_shift").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.job_id, {
    status: r.status,
    pipeline_stage: r.pipeline_stage || "applied",
    preferred_shift: r.preferred_shift || null,
  }]));
}

export async function removeApplication(userId, jobId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("applications").delete().eq("student_id", userId).eq("job_id", jobId),
    10000
  );
  if (error) throw error;
}

export async function updateApplicationStage(applicationId, stage) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").update({ pipeline_stage: stage }).eq("id", applicationId).select("id"),
    10000
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Stage update failed — row not found or permission denied");
}

export async function saveApplicationNotes(applicationId, notes) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("applications").update({ company_notes: notes }).eq("id", applicationId),
    10000
  );
  if (error) throw error;
}

export async function incrementInterviewRound(applicationId, currentRound) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").update({ interview_round: currentRound + 1 }).eq("id", applicationId).select("id"),
    10000
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Round update failed — row not found or permission denied");
}

export async function saveTrialSchedule(applicationId, trialDate, trialTime) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("applications").update({ trial_date: trialDate || null, trial_time: trialTime || null }).eq("id", applicationId),
    10000
  );
  if (error) throw error;
}

export async function saveInterviewSchedule(applicationId, date, time) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("applications").update({ interview_date: date || null, interview_time: time || null }).eq("id", applicationId),
    10000
  );
  if (error) throw error;
}

export async function saveInterviewRoundsData(applicationId, rounds) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("applications").update({ interview_rounds_data: rounds }).eq("id", applicationId),
    10000
  );
  if (error) throw error;
}

export async function moveToInterviewRound(applicationId, round) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").update({ pipeline_stage: "interview", interview_round: round }).eq("id", applicationId).select("id"),
    10000
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Move failed — row not found or permission denied");
}

export async function fetchLikedStudentIds(companyId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("company_liked_students").select("student_id").eq("company_id", companyId),
    10000
  );
  if (error) throw error;
  return (data || []).map(r => r.student_id);
}

export async function likeStudent(companyId, studentId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("company_liked_students").insert({ company_id: companyId, student_id: studentId }),
    10000
  );
  if (error && error.code !== "23505") throw error;
}

export async function unlikeStudent(companyId, studentId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.from("company_liked_students").delete().eq("company_id", companyId).eq("student_id", studentId),
    10000
  );
  if (error) throw error;
}
