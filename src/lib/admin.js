import { supabase, withTimeout, ensureValidSession } from "./supabase"; // ensureValidSession used by approve/reject helpers

export async function fetchAllVerifiedStudents() {
  const PAGE = 200;
  let offset = 0;
  const all = [];
  while (true) {
    const { data, error } = await withTimeout(
      supabase.rpc("get_all_verified_students", { p_limit: PAGE, p_offset: offset }),
      10000
    );
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function fetchAvailabilityHeatmap() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_availability_heatmap"),
    10000, "Timed out loading availability."
  );
  if (error) throw error;
  const map = {};
  for (const { day, slot, student_count } of data || []) {
    if (!map[day]) map[day] = {};
    map[day][slot] = Number(student_count);
  }
  return map;
}

export async function fetchPendingStudents() {
  const { data, error } = await withTimeout(
    () => supabase.rpc("get_pending_students"),
    12000
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
    () => supabase.rpc("get_pending_companies"),
    12000
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

export async function approveStudent(studentId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.rpc("approve_student", { student_id: studentId }),
    10000
  );
  if (error) throw error;
  return data; // true = new approval, false = already approved (another admin got there first)
}

export async function rejectStudent(studentId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("reject_student", { student_id: studentId }),
    10000
  );
  if (error) throw error;
  // Revoke active sessions so the rejected user is force-signed-out immediately.
  // Fire-and-forget: rejection is DB-committed even if revoke fails.
  supabase.functions.invoke("admin-actions", {
    body: { action: "revoke_session", userId: studentId },
  }).catch(() => {});
}

export async function approveCompany(companyId) {
  await ensureValidSession();
  const { data, error } = await withTimeout(
    supabase.rpc("approve_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
  return data; // true = new approval, false = already approved
}

export async function rejectCompany(companyId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("reject_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
  supabase.functions.invoke("admin-actions", {
    body: { action: "revoke_session", userId: companyId },
  }).catch(() => {});
}

export async function getSignups() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_signups"),
    10000
  );
  if (error) throw error;
  return data || [];
}

export async function fetchVerifiedCompanies() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_verified_companies"),
    10000
  );
  if (error) throw error;
  return (data || []).map(c => ({ id: c.id, name: c.name, isFeatured: c.is_featured }));
}

export async function setCompanyFeatured(companyId, featured) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("set_company_featured", { p_company_id: companyId, p_featured: featured }),
    10000
  );
  if (error) throw error;
}

export async function sendLaunchEmails({ test = false } = {}) {
  const { data, error } = await supabase.functions.invoke("send-launch-emails", {
    body: { test },
  });
  if (error) throw error;
  return data; // { sent, skipped, total, errors } or { test: true, sent: 1 }
}
