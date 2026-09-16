// Backs AdminPage.jsx — the verification queue and platform-wide admin actions.
// Almost everything here goes through SECURITY DEFINER RPC functions (defined in
// Postgres, listed in CLAUDE.md) rather than plain table selects/updates. That's
// because an admin needs to read/modify data across every user's rows, which normal
// RLS policies deliberately forbid (a student can only see their own data, etc.) —
// the RPCs run with elevated privileges to safely punch through that for admin-only
// actions, instead of loosening RLS itself.
import { supabase, withTimeout, ensureValidSession } from "./supabase"; // ensureValidSession used by approve/reject helpers

// Loads every verified student for the admin's "Browse Students" view, in pages of
// 200 at a time. Paging avoids asking Postgres/PostgREST for a potentially huge
// result set in one response as the platform grows; the loop just keeps requesting
// the next page until a short page (or an empty one) signals there's no more data.
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

// The RPC returns one flat row per (day, slot) combination — this reshapes that into
// a nested { day: { slot: count } } map, which is the structure the heatmap grid
// component can index into directly by day/slot instead of scanning an array each render.
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

// Students awaiting ID verification review — the core of the admin queue.
export async function fetchPendingStudents() {
  const { data, error } = await withTimeout(
    supabase.rpc("get_pending_students"),
    7000
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
    7000
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

// ensureValidSession() runs first on every mutating admin action below because these
// calls are gated by admin-only RLS/RPC checks — better to catch an expired session
// client-side with a clear error than have the RPC silently fail a permission check.
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
  // This calls a separate Edge Function (not an RPC) because revoking another user's
  // auth session requires the service-role key, which only server-side code can hold.
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

// Signup counts/trends for the admin dashboard's stats view.
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

// Toggles whether a company shows up in a "featured companies" section on the site.
export async function setCompanyFeatured(companyId, featured) {
  await ensureValidSession();
  const { error } = await withTimeout(
    supabase.rpc("set_company_featured", { p_company_id: companyId, p_featured: featured }),
    10000
  );
  if (error) throw error;
}

// Triggers a one-off bulk email send (e.g. a launch announcement) to all users via
// an Edge Function — bulk sending to every user has to happen server-side since it
// needs the full user list and a transactional email provider (Brevo), not something
// the browser should be doing directly. `test: true` sends just one email to confirm
// the template looks right before blasting the full list.
export async function sendLaunchEmails({ test = false } = {}) {
  const { data, error } = await supabase.functions.invoke("send-launch-emails", {
    body: { test },
  });
  if (error) throw error;
  return data; // { sent, skipped, total, errors } or { test: true, sent: 1 }
}
