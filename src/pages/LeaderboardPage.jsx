import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase, withTimeout } from "../lib/supabase";
import BackButton from "../components/BackButton";

// LeaderboardPage — a PUBLIC page (no login required) that ranks companies by
// how many shifts they've filled. It's mostly a marketing/trust-signal page:
// it shows students which employers are actively hiring, and gives companies
// a small incentive to post more jobs and fill them (social proof / gamification).
// There's no "leaderboard" table in the database — this page computes the
// ranking on the fly from the jobs table every time it loads.
export default function LeaderboardPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Step 1: pull every currently Active job, joined with the posting
        // company's name (via the profiles table FK). withTimeout wraps the
        // Supabase call so a slow/hanging network request fails fast instead
        // of leaving the page stuck on the loading skeleton forever.
        const { data, error: err } = await withTimeout(
          () => supabase
            .from("jobs")
            .select("company_id, company:profiles!jobs_company_id_fkey(name), title, status, filled_shifts, created_at")
            .eq("status", "Active"),
          10000
        );
        if (err) throw err;

        // Aggregate by company — build a map keyed by company_id so we can
        // tally each company's active job count and filled-shift count in
        // one pass, rather than querying per-company.
        const map = {};
        for (const job of (data || [])) {
          const id = job.company_id;
          const name = job.company?.name || "Unknown";
          if (!map[id]) map[id] = { id, name, activeJobs: 0, filledShifts: 0, totalShifts: 0 };
          map[id].activeJobs++;
          map[id].filledShifts += (job.filled_shifts || []).length;
        }

        // Also count all-time filled via a second query
        // Closed jobs (fully filled and taken down) still count toward a
        // company's "shifts filled" total — otherwise a company that finishes
        // hiring and closes its listings would unfairly drop in the ranking.
        const { data: closed } = await withTimeout(
          () => supabase
            .from("jobs")
            .select("company_id, filled_shifts")
            .eq("status", "Closed"),
          8000
        );
        for (const job of (closed || [])) {
          const id = job.company_id;
          // Only add to companies we already saw among Active jobs — a company
          // with ONLY closed jobs (nothing currently active) is intentionally
          // left off the board, since this leaderboard is meant to highlight
          // companies who are actively hiring right now.
          if (map[id]) map[id].filledShifts += (job.filled_shifts || []).length;
        }

        // Rank by total filled shifts first, active job count as tiebreaker,
        // and cap at the top 20 so the page stays a quick, skimmable list.
        const ranked = Object.values(map)
          .sort((a, b) => b.filledShifts - a.filledShifts || b.activeJobs - a.activeJobs)
          .slice(0, 20);
        setCompanies(ranked);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Top 3 ranks get a medal emoji instead of a plain "#4" style number.
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Helmet>
        <title>Top Employers — StudentShifts</title>
        <meta name="description" content="The most active and highest-hiring companies on StudentShifts Ireland." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content="Top Employers — StudentShifts" />
        <meta property="og:description" content="The most active and highest-hiring companies on StudentShifts Ireland." />
        <meta property="og:url" content="https://studentshifts.ie/leaderboard" />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="StudentShifts — Part-Time Jobs for Irish Students" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Top Employers — StudentShifts" />
        <meta name="twitter:description" content="The most active and highest-hiring companies on StudentShifts Ireland." />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
      </Helmet>

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "2rem 1.25rem" }}>
        <BackButton />

        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🏆</div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: "1.85rem", color: "var(--color-text-primary, #1e293b)" }}>Top Employers</h1>
          <p style={{ margin: "0.4rem 0 0", color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem" }}>
            Companies ranked by student hires and active listings
          </p>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "0.85rem" }} />
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary, #64748b)" }}>
            <p style={{ fontWeight: 600 }}>Could not load leaderboard. Please try again.</p>
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary, #64748b)" }}>
            <p style={{ fontWeight: 600 }}>No companies yet. Check back soon!</p>
          </div>
        )}

        {!loading && !error && companies.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {companies.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex", alignItems: "center", gap: "1rem",
                  backgroundColor: i < 3 ? "var(--color-bg-elevated, white)" : "var(--color-bg-surface, #f8fafc)",
                  border: `1.5px solid ${i === 0 ? "#fde68a" : i === 1 ? "#e2e8f0" : i === 2 ? "#fed7aa" : "var(--color-border-light, #e2e8f0)"}`,
                  borderRadius: "0.85rem",
                  padding: "1rem 1.25rem",
                  boxShadow: i < 3 ? "0 2px 10px rgba(0,0,0,0.07)" : "none",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, minWidth: "2.5rem" }}>
                  {i === 0 && (
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "2px" }}>
                      <path d="M6 9H3.5a2.5 2.5 0 0 1 0-5H6"/>
                      <path d="M18 9h2.5a2.5 2.5 0 0 0 0-5H18"/>
                      <path d="M4 22h16"/>
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
                    </svg>
                  )}
                  <span style={{ fontSize: i < 3 ? "1.6rem" : "1rem", fontWeight: 800, color: i < 3 ? undefined : "#94a3b8", textAlign: "center" }}>
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary, #1e293b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>
                    {c.activeJobs} active job{c.activeJobs !== 1 ? "s" : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: "1.15rem", color: c.filledShifts > 0 ? "#16a34a" : "var(--color-text-muted, #64748b)" }}>
                    {c.filledShifts}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>
                    shift{c.filledShifts !== 1 ? "s" : ""} filled
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--color-text-muted, #64748b)", marginTop: "2rem" }}>
          Rankings update in real time · Only verified companies are listed
        </p>
      </div>
    </div>
  );
}
