import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * sitemap — Edge Function
 * GET /functions/v1/sitemap
 * Returns an XML sitemap of all active job pages + static pages.
 * No auth required — public endpoint.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FRONTEND_URL
 */

// MUST be set in Render environment variables to "https://studentshifts.ie" before launch.
// Defaults to the Render preview URL in the meantime.
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://studentshifts.onrender.com";

function toSlug(str: string): string {
  return str
    .trim()
    .toLowerCase()
    // Expand common special characters before stripping so they don't merge adjacent words
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Escape a string for safe inclusion in an XML text node or attribute value */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("title, company_id, updated_at")
      .eq("status", "Active");
    if (jobsError) throw jobsError;

    const companyIds = [...new Set((jobs || []).map((j: { company_id: string }) => j.company_id))];
    const { data: profiles, error: profilesError } = companyIds.length
      ? await supabase.from("profiles").select("id, name").in("id", companyIds)
      : { data: [], error: null };
    if (profilesError) throw profilesError;

    const nameMap: Record<string, string> = Object.fromEntries(
      (profiles || []).map((p: { id: string; name: string }) => [p.id, p.name])
    );

    const staticPages = [
      { loc: FRONTEND_URL,                    changefreq: "daily",   priority: "1.0" },
      { loc: `${FRONTEND_URL}/login`,         changefreq: "monthly", priority: "0.5" },
      { loc: `${FRONTEND_URL}/signup`,        changefreq: "monthly", priority: "0.7" },
      { loc: `${FRONTEND_URL}/privacy`,       changefreq: "yearly",  priority: "0.3" },
      { loc: `${FRONTEND_URL}/terms`,         changefreq: "yearly",  priority: "0.3" },
    ];

    const jobPages = (jobs || []).map((job: { title: string; company_id: string; updated_at: string }) => ({
      // URLs use slugified (safe) path segments — no escaping needed for <loc>
      loc: `${FRONTEND_URL}/jobs/${toSlug(job.title)}/${toSlug(nameMap[job.company_id] || "")}`,
      // lastmod is a YYYY-MM-DD date string from Postgres — no special characters possible
      lastmod: job.updated_at ? job.updated_at.slice(0, 10) : undefined,
      changefreq: "weekly",
      priority: "0.8",
    }));

    const urls = [...staticPages, ...jobPages];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(({ loc, lastmod, changefreq, priority }) => `  <url>
    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}
    <changefreq>${escapeXml(changefreq)}</changefreq>
    <priority>${escapeXml(priority)}</priority>
  </url>`).join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    console.error("sitemap error:", e instanceof Error ? e.message : String(e));
    return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", {
      status: 500,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
