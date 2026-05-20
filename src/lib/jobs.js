import { supabase, withTimeout } from "./supabase";

export function toJobSlug(str) {
  if (!str) return '';
  // Decompose accented chars (e.g. é → e + combining accent) then strip combining marks
  // so Irish names like "Óstán" slugify to "ostan" instead of being fully stripped.
  const ascii = str.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = ascii
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug;
}

export function fromJobSlug(slug) {
  return slug.replace(/-/g, ' ');
}

function escapeIlike(str) {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function normaliseJobRow(job, companyName) {
  return {
    id:              job.id,
    title:           job.title,
    company:         companyName || "Unknown Company",
    category:        job.category || "",
    location:        job.location,
    lat:             job.lat,
    lng:             job.lng,
    pay:             job.pay,
    description:     job.description || "",
    deadline:        job.deadline || null,
    days:            job.days || [],
    times:           Object.fromEntries(Object.entries(job.times || {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
    weekendRequired: job.weekend_required || false,
    sickPay:         job.sick_pay || false,
    holidays:        job.holidays || "",
    photos:          job.photos || [],
    photoCrops:      job.photo_crops || [],
    filledShifts:    job.filled_shifts || [],
    status:          job.status,
    updatedAt:       job.updated_at || null,
    createdAt:       job.created_at || null,
  };
}

export async function fetchJobBySlug(titleSlug, companySlug) {
  const title   = fromJobSlug(titleSlug);
  const company = fromJobSlug(companySlug);

  // F16: allow Closed/Expired so deep links to filled/expired jobs resolve instead of 404
  const { data: jobs, error } = await withTimeout(
    supabase.from("jobs").select("*").ilike("title", escapeIlike(title)),
    10000
  );
  if (error) throw error;
  if (!jobs?.length) throw new Error("Job not found");

  const companyIds = [...new Set(jobs.map(j => j.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds),
    8000
  ).catch(() => ({ data: [] }));
  const nameMap = {};
  if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });

  const match = jobs.find(j => (nameMap[j.company_id] || "").toLowerCase() === company.toLowerCase())
    ?? jobs[0];

  return normaliseJobRow(match, nameMap[match.company_id]);
}

export async function fetchJobsByIds(ids) {
  if (!ids.length) return [];
  const { data: jobs, error } = await withTimeout(
    supabase.from("jobs").select("*").in("id", ids),
    10000
  );
  if (error || !jobs?.length) return [];
  const companyIds = [...new Set(jobs.map(j => j.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds),
    8000
  ).catch(() => ({ data: [] }));
  const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
  return jobs.map(j => normaliseJobRow(j, nameMap[j.company_id]));
}
