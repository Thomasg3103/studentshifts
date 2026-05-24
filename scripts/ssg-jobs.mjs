#!/usr/bin/env node
// Post-build SSG: generates pre-rendered HTML shells for every active job.
// Reads dist/index.html, injects per-job <title>, meta, canonical, and JSON-LD,
// writes to dist/jobs/{title-slug}/{company-slug}/index.html.
// Also appends job URLs to dist/sitemap.xml.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Load .env for local dev (Render sets env vars directly in the dashboard)
try {
  const raw = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*?)\s*$/);
    if (m && !Object.prototype.hasOwnProperty.call(process.env, m[1])) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* no .env file — use process.env directly */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Service role key required: profiles table is auth-only (RLS), anon key can't read company names.
// Add SUPABASE_SERVICE_ROLE_KEY to .env locally and to Render dashboard env vars.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = 'https://studentshifts.ie';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[ssg-jobs] SUPABASE_SERVICE_ROLE_KEY not set — skipping SSG. Add it to .env and Render env vars.');
  process.exit(0);
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.warn('[ssg-jobs] dist/index.html not found — run `npm run build` first.');
  process.exit(1);
}

function toJobSlug(str) {
  if (!str) return '';
  const ascii = str.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ascii.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: jobs, error: jobsError } = await supabase
  .from('jobs')
  .select('id, title, category, location, pay, description, deadline, days, times, created_at, company_id, photos')
  .eq('status', 'Active');

if (jobsError) {
  console.error('[ssg-jobs] Failed to fetch jobs:', jobsError.message);
  process.exit(1);
}

if (!jobs?.length) {
  console.log('[ssg-jobs] No active jobs — nothing to pre-render.');
  process.exit(0);
}

const companyIds = [...new Set(jobs.map(j => j.company_id))];
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, name')
  .in('id', companyIds);

const nameMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));

const shell = readFileSync(join(DIST, 'index.html'), 'utf8');
const today = new Date().toISOString().split('T')[0];
const jobUrls = [];
let count = 0;

for (const job of jobs) {
  const company   = nameMap[job.company_id] || 'StudentShifts';
  const titleSlug = toJobSlug(job.title);
  const compSlug  = toJobSlug(company);
  if (!titleSlug || !compSlug) continue;

  const canonical = `${SITE}/jobs/${titleSlug}/${compSlug}`;
  const pageTitle = `${job.title} at ${company} — StudentShifts`;
  const metaDesc  = `${job.title} in ${job.location}. Pay: ${job.pay}. Apply now on StudentShifts.`;
  const ogImage   = job.photos?.[0] || `${SITE}/og-image.png`;
  const datePosted = (job.created_at || new Date().toISOString()).split('T')[0];

  const payNums = (job.pay || '').match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const baseSalary = payNums.length > 0 ? {
    '@type': 'MonetaryAmount', currency: 'EUR',
    value: {
      '@type': 'QuantitativeValue', unitText: 'HOUR',
      ...(payNums.length >= 2
        ? { minValue: payNums[0], maxValue: payNums[payNums.length - 1] }
        : { value: payNums[0] }),
    },
  } : undefined;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || `${job.title} at ${company} in ${job.location}.`,
    identifier: { '@type': 'PropertyValue', name: 'StudentShifts', value: String(job.id) },
    directApply: true,
    hiringOrganization: { '@type': 'Organization', name: company },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'IE' } },
    employmentType: 'PART_TIME',
    datePosted,
    ...(job.deadline ? { validThrough: job.deadline } : {}),
    ...(baseSalary ? { baseSalary } : {}),
  });

  const breadcrumbLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Jobs', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: `${job.title} at ${company}`, item: canonical },
    ],
  });

  const injectedHead = `
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(metaDesc)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(pageTitle)}" />
    <meta property="og:description" content="${esc(metaDesc)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(pageTitle)}" />
    <meta name="twitter:description" content="${esc(metaDesc)}" />
    <meta name="twitter:image" content="${esc(ogImage)}" />
    <script type="application/ld+json">${jsonLd}</script>
    <script type="application/ld+json">${breadcrumbLd}</script>`;

  const html = shell
    // Replace the generic site <title> with the job-specific one
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(pageTitle)}</title>`)
    // Inject all other meta/LD tags just before </head>
    .replace('</head>', `${injectedHead}\n  </head>`);

  const dir = join(DIST, 'jobs', titleSlug, compSlug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);

  jobUrls.push(canonical);
  count++;
}

// Append job URLs to dist/sitemap.xml
const sitemapPath = join(DIST, 'sitemap.xml');
if (jobUrls.length && existsSync(sitemapPath)) {
  const entries = jobUrls
    .map(url => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>`)
    .join('\n');
  const sitemap = readFileSync(sitemapPath, 'utf8').replace('</urlset>', `${entries}\n</urlset>`);
  writeFileSync(sitemapPath, sitemap);
  console.log(`[ssg-jobs] Added ${jobUrls.length} job URLs to sitemap.xml`);
}

console.log(`[ssg-jobs] Pre-rendered ${count} job page${count !== 1 ? 's' : ''}.`);
