// Covers both halves of the "matching" system: students saving/applying to jobs
// (`liked_jobs`, `applications`) and companies saving students they're interested in
// (`company_liked_students`). It also owns the hiring-pipeline functions the Company
// Dashboard uses to move an applicant through applied -> shortlisted -> interview ->
// trial -> decision (see CLAUDE.md for the full pipeline description).
import { supabase, withTimeout, ensureValidSession } from "./supabase";

// "Liked" jobs are a student's save-for-later list (heart icon), separate from
// actually applying — fetch/like/unlike below are basically a bookmarks feature.
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
  // 23505 = Postgres unique-constraint violation — the job's already liked (e.g. a
  // double-click or a stale UI state re-sending the like). Treated as success rather
  // than an error since the end state (job is liked) is the same either way.
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

// Submits an application. `preferredShift` matters for jobs with multiple shifts
// (see CLAUDE.md — hiring a student for one shift keeps the job open for the rest),
// and `screeningAnswers` are the applicant's answers to a job's custom screening
// questions, if it has any. Returns true on success, false if this exact
// student+job application already exists (rather than throwing, since a duplicate
// isn't really an error from the UI's point of view — just a no-op).
export async function createApplication(userId, jobId, preferredShift = null, screeningAnswers = null) {
  await ensureValidSession();
  const payload = { student_id: userId, job_id: jobId };
  if (preferredShift) payload.preferred_shift = preferredShift;
  if (screeningAnswers?.length) payload.screening_answers = screeningAnswers;
  const { error } = await withTimeout(supabase.from("applications").insert(payload), 10000);
  if (!error) return true;
  // 42703 = "column does not exist" — a defensive fallback in case this runs against
  // a DB that hasn't had the preferred_shift migration applied yet. Retries without
  // that field so the application still goes through instead of hard-failing.
  if (error.code === "42703" && preferredShift) {
    const { error: e2 } = await withTimeout(supabase.from("applications").insert({ student_id: userId, job_id: jobId }), 10000);
    if (!e2) return true;
    if (e2.code === "23505") return false;
    throw e2;
  }
  // 23505 = unique constraint violation — already applied to this job.
  if (error.code === "23505") return false;
  // 42501 = insufficient privilege — the RLS policy enforcing a per-hour application
  // rate limit rejected the insert. Turned into a friendly, specific message here
  // rather than surfacing the raw Postgres error code to the user.
  if (error.code === "42501") throw new Error("You've applied to too many jobs this hour. Please try again later.");
  throw error;
}

// Returns a { job_id: {...} } lookup map rather than an array, so the student job
// feed can cheaply check "have I applied to this job, and what stage is it at?" for
// each job card by key instead of scanning the whole applications list every render.
export async function fetchApplicationStatuses(userId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").select("id, job_id, status, pipeline_stage, preferred_shift").eq("student_id", userId),
    10000
  );
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.job_id, {
    status: r.status,
    pipeline_stage: r.pipeline_stage || "applied",
    preferred_shift: r.preferred_shift || null,
    application_id: r.id,
  }]));
}

// Interview slots let a company propose several time options for one application;
// the student then picks one via selectInterviewSlot below.
export async function fetchInterviewSlots(applicationId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    () => supabase.from("interview_slots").select("id, slot_time, selected").eq("application_id", applicationId).order("slot_time"),
    10000,
    "Slot fetch timed out"
  );
  if (error) throw error;
  return data || [];
}

// Goes through an RPC (rather than a plain update) because confirming one slot needs
// to atomically un-select any other slots for the same application in the same
// transaction — doing that as two separate client calls could race with another
// browser tab/device and leave two slots marked selected.
export async function selectInterviewSlot(slotId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    () => supabase.rpc("confirm_interview_slot", { p_slot_id: slotId }),
    10000,
    "Slot confirmation timed out"
  );
  if (error) throw error;
}

// Lets a student withdraw an application. The delete is gated by an RLS policy that
// (per the thrown error below) blocks deleting applications that have already moved
// to Accepted — so a company can't have a hire yanked out from under them after the
// fact. `data?.length` being empty after the delete is how we detect that block,
// since RLS silently filters rows rather than raising a distinct error.
export async function removeApplication(userId, jobId, withdrawReason = null) {
  await ensureValidSession();
  if (withdrawReason) {
    await withTimeout(
      supabase.from("applications").update({ withdraw_reason: withdrawReason }).eq("student_id", userId).eq("job_id", jobId),
      10000
    );
  }
  const { data, error } = await withTimeout(
    supabase.from("applications").delete().eq("student_id", userId).eq("job_id", jobId).select("id"),
    10000
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Application cannot be withdrawn — it may already be accepted.");
}

// The functions from here down are used by the Company Dashboard's hiring pipeline
// (applied -> shortlisted -> interview -> trial -> decision). All of them check
// `data?.length` after an update+select to catch RLS silently blocking a row (e.g.
// a company trying to touch an application on a job it doesn't own) and turn that
// into an explicit error instead of a silent no-op.
export async function updateApplicationStage(applicationId, stage) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.from("applications").update({ pipeline_stage: stage }).eq("id", applicationId).select("id"),
    10000
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Stage update failed — row not found or permission denied");
}

// Private notes a company keeps on an applicant, visible only to that company (with
// the one GDPR-driven exception surfaced via RPC in profile.js's exportMyData).
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

// Mirror of the student-side liked_jobs feature: lets a company bookmark students
// (from Browse Students) they're interested in before formally messaging/hiring them.
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
