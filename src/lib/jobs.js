// Job-related helpers that don't fit neatly under "just a Supabase call": building
// SEO-friendly URL slugs for job listings (e.g. /jobs/barista/some-cafe), converting
// slugs back into search terms to resolve a deep link, and reshaping raw `jobs` table
// rows (snake_case, DB-shaped) into the camelCase object shape the UI components expect.
import { supabase, withTimeout } from "./supabase";

// Turns a job title into a URL-safe slug for shareable links, e.g. "Café Barista" -> "cafe-barista".
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

// Reverses toJobSlug's dash-for-space swap so a URL slug can be turned back into a
// search string. This is lossy (punctuation/accents were stripped when the slug was
// made) which is exactly why fetchJobBySlug below does a fuzzy `ilike` match rather
// than an exact lookup — slugs aren't stored in the DB, they're derived on the fly.
export function fromJobSlug(slug) {
  return slug.replace(/-/g, ' ');
}

// Escapes Postgres ILIKE wildcard characters (% and _) in user/URL-derived text before
// it's used in an `ilike` filter, so a title like "50% Off Shop" or "Under_25s Cafe"
// is matched literally instead of `%`/`_` being treated as pattern wildcards.
function escapeIlike(str) {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Converts a raw `jobs` table row (snake_case columns, nullable DB fields) into the
// flat camelCase shape every UI component expects, filling in safe defaults (empty
// arrays/strings) so components don't need null-checks everywhere they read a job.
export function normaliseJobRow(job, companyName) {
  return {
    id:              job.id,
    title:           job.title,
    company:         companyName || "Unknown Company",
    companyId:       job.company_id,
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
    tutorSubject:    job.tutor_subject || "",
    holidays:        job.holidays || "",
    photos:          job.photos || [],
    photoCrops:      job.photo_crops || [],
    filledShifts:    job.filled_shifts || [],
    isUrgent:           job.is_urgent || false,
    screeningQuestions: job.screening_questions || [],
    status:             job.status,
    updatedAt:          job.updated_at || null,
    createdAt:          job.created_at || null,
  };
}

// Resolves a job's shareable URL (/jobs/:titleSlug/:companySlug) back to a single row.
// Since slugs aren't stored — they're derived from the title — this has to search by
// a fuzzy title match and then disambiguate using the company slug, because multiple
// companies could plausibly post jobs with the same title (e.g. two "Barista" jobs).
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

  // Job rows only store company_id, not the company's display name, so a second query
  // against `profiles` is needed to get names to match/display against.
  const companyIds = [...new Set(jobs.map(j => j.company_id))];
  const { data: profiles } = await withTimeout(
    supabase.from("profiles").select("id, name").in("id", companyIds),
    8000
  ).catch(() => ({ data: [] }));
  const nameMap = {};
  if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });

  // Prefer the job whose company name matches the URL's company slug; if nothing
  // matches exactly (e.g. company renamed since the link was shared), fall back to
  // the first title match rather than 404ing on an otherwise-valid link.
  const match = jobs.find(j => (nameMap[j.company_id] || "").toLowerCase() === company.toLowerCase())
    ?? jobs[0];

  return normaliseJobRow(match, nameMap[match.company_id]);
}

// Batch-fetches jobs by id (e.g. for a student's liked-jobs list) in one round trip,
// then joins in company names the same way fetchJobBySlug does. Swallows errors by
// returning [] rather than throwing, since callers use this to hydrate a list where a
// few missing/deleted jobs shouldn't break the whole page.
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
