import { supabase, withTimeout, ensureValidSession } from "./supabase";

export async function fetchAllVerifiedStudents() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_all_verified_students"),
    10000
  );
  if (error) throw error;
  return data || [];
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

export async function approveCompany(companyId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("approve_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
}

export async function rejectCompany(companyId) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("reject_company", { company_id: companyId }),
    10000
  );
  if (error) throw error;
}
