import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase, withTimeout } from "../lib/supabase";
import PageWrapper from "../components/PageWrapper";
import { useApp } from "../context/AppContext";
import { updateCompanyProfile } from "../lib/profile";
import { uploadAvatar } from "../lib/auth";
import { jobCategories } from "../data/jobCategories";
import toast from "react-hot-toast";

const ALL_INDUSTRIES = Object.keys(jobCategories);

export default function CompanyProfilePage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { setSelectedJob, currentUser } = useApp();
  const isOwner = currentUser?.id === companyId && currentUser?.role === "company";

  const [company, setCompany] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hireStats, setHireStats] = useState(null);
  const [responseRate, setResponseRate] = useState(null);

  // Edit state (owner only)
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      withTimeout(
        supabase.from("profiles").select("id, name").eq("id", companyId).eq("role", "company").single(),
        8000
      ),
      withTimeout(
        supabase.from("companies").select("bio, website, industries, status, is_featured, profile_photo_url").eq("id", companyId).single(),
        8000
      ),
      withTimeout(
        supabase.from("jobs").select("id, title, category, location, pay, days, deadline, is_urgent, photos").eq("company_id", companyId).eq("status", "Active").order("created_at", { ascending: false }),
        8000
      ),
    ]).then(([profileRes, companyRes, jobsRes]) => {
      if (!profileRes.data || companyRes.data?.status !== "verified") {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const merged = { ...profileRes.data, ...companyRes.data };
      setCompany(merged);
      setBio(merged.bio || "");
      setWebsite(merged.website || "");
      setSelectedIndustries(merged.industries || []);
      setJobs(jobsRes.data || []);
      setLoading(false);
      supabase.rpc("get_company_hire_stats", { p_company_id: companyId })
        .then(({ data }) => { if (data) setHireStats(data); })
        .catch(() => {});
      supabase.rpc("get_company_response_rate", { p_company_id: companyId })
        .then(({ data }) => { if (data) setResponseRate(data); })
        .catch(() => {});
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [companyId]);

  const saveField = async (fields) => {
    setSaving(true);
    try {
      await updateCompanyProfile(companyId, fields);
      setCompany(prev => ({ ...prev, ...fields }));
    } catch (e) {
      toast.error("Save failed — " + (e.message || "please try again"));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadAvatar(companyId, file);
      await updateCompanyProfile(companyId, { profile_photo_url: url });
      setCompany(prev => ({ ...prev, profile_photo_url: url }));
      toast.success("Photo updated");
    } catch (e) {
      toast.error("Photo upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveIndustries = async () => {
    await saveField({ industries: selectedIndustries });
    toast.success("Industries saved");
  };

  if (loading) {
    return (
      <PageWrapper>
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Loading…</p>
        </div>
      </PageWrapper>
    );
  }

  if (notFound) {
    return (
      <PageWrapper>
        <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
          <div style={{ fontSize: "3rem" }}>🏢</div>
          <p style={{ fontWeight: "700", fontSize: "1.1rem", color: "var(--color-text-primary, #1e293b)", margin: 0 }}>Company not found</p>
          <p style={{ color: "var(--color-text-secondary, #64748b)", margin: 0, fontSize: "0.9rem" }}>This company profile doesn't exist or isn't verified yet.</p>
          <button onClick={() => navigate(-1)} style={{ marginTop: "0.5rem", padding: "0.5rem 1.25rem", borderRadius: "2rem", border: "none", backgroundColor: "var(--color-brand)", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.875rem" }}>Go back</button>
        </div>
      </PageWrapper>
    );
  }

  const displayIndustries = isOwner ? selectedIndustries : (company.industries || []);
  const cleanWebsite = (company.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <PageWrapper>
      <Helmet>
        <title>{company.name} — StudentShifts</title>
        <meta name="description" content={`${company.name} is hiring students on StudentShifts. ${company.bio ? company.bio.slice(0, 120) : ""}`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content={`${company.name} — StudentShifts`} />
        <meta property="og:description" content={`${company.name} is hiring students on StudentShifts. ${company.bio ? company.bio.slice(0, 120) : ""}`} />
        <meta property="og:url" content={`https://studentshifts.ie/companies/${company.id}`} />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${company.name} — StudentShifts`} />
        <meta name="twitter:description" content={`${company.name} is hiring students on StudentShifts.`} />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
      </Helmet>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1rem" }}>

        {/* "You're editing your public profile" banner — owner only */}
        {isOwner && (
          <div style={{ backgroundColor: "#fce7f3", border: "1.5px solid #fca5c5", borderRadius: "0.75rem", padding: "0.65rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem" }}>✏️</span>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: "600", color: "var(--color-brand)" }}>
              This is your public profile — changes you make here are visible to students immediately.
            </p>
            {saving && <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>Saving…</span>}
          </div>
        )}

        {/* Profile header */}
        <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", marginBottom: "1.5rem" }}>
          {/* Cover banner */}
          <div style={{ height: "140px", background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 55%, #1e293b 100%)", borderRadius: "1rem 1rem 0 0", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "1rem 1rem 0 0", backgroundImage: "radial-gradient(circle at 15% 60%, rgba(255,255,255,0.10) 0%, transparent 55%), radial-gradient(circle at 75% 25%, rgba(255,255,255,0.07) 0%, transparent 45%)" }} />
          </div>

          {/* Logo — negative margin overlaps banner */}
          <div style={{ padding: "0 1.75rem" }}>
            <div style={{ position: "relative", display: "inline-block", marginTop: "-44px" }}>
              <div style={{ width: "88px", height: "88px", borderRadius: "1rem", border: "3px solid white", backgroundColor: "var(--color-bg-surface, #f1f5f9)", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>
                {photoUploading
                  ? <div style={{ width: "28px", height: "28px", border: "3px solid rgba(0,0,0,0.15)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  : company.profile_photo_url
                    ? <img src={company.profile_photo_url} alt={company.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "🏢"}
              </div>
              {/* Camera button — owner only */}
              {isOwner && (
                <label style={{ position: "absolute", bottom: "-4px", right: "-4px", width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: photoUploading ? "not-allowed" : "pointer", fontSize: "0.65rem", zIndex: 1 }}>
                  📷
                  <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handlePhotoChange} disabled={photoUploading} />
                </label>
              )}
            </div>
          </div>

          {/* Info / edit block */}
          <div style={{ padding: "0.85rem 1.75rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)", letterSpacing: "-0.02em" }}>{company.name}</h1>
              {company.is_featured && (
                <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#854d0e", backgroundColor: "#fef9c3", borderRadius: "999px", padding: "0.2rem 0.6rem", border: "1.5px solid #fde68a" }}>⭐ Featured Employer</span>
              )}
            </div>

            {/* Industries — toggle pills if owner, display pills if visitor */}
            {isOwner ? (
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Industries</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.6rem" }}>
                  {ALL_INDUSTRIES.map(ind => {
                    const active = selectedIndustries.includes(ind);
                    return (
                      <button key={ind} type="button"
                        onClick={() => setSelectedIndustries(prev => active ? prev.filter(i => i !== ind) : [...prev, ind])}
                        style={{ padding: "0.25rem 0.65rem", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: active ? "#fce7f3" : "white", color: active ? "var(--color-brand)" : "#64748b" }}>
                        {active ? "✓ " : ""}{ind}
                      </button>
                    );
                  })}
                </div>
                <button onClick={handleSaveIndustries} style={{ fontSize: "0.78rem", fontWeight: "700", padding: "0.3rem 0.85rem", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                  Save industries
                </button>
              </div>
            ) : (
              displayIndustries.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
                  {displayIndustries.map(ind => (
                    <span key={ind} style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-brand)", backgroundColor: "#fce7f3", borderRadius: "999px", padding: "0.2rem 0.65rem", border: "1.5px solid #fca5c5" }}>{ind}</span>
                  ))}
                </div>
              )
            )}

            {/* Website */}
            {isOwner ? (
              <div style={{ marginBottom: "0.85rem" }}>
                <p style={{ margin: "0 0 0.3rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Website</p>
                <input
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  onBlur={() => saveField({ website })}
                  placeholder="https://yourcompany.ie"
                  style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.88rem", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-subtle, #fafafa)", boxSizing: "border-box" }}
                />
              </div>
            ) : (
              company.website && (
                <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem", color: "var(--color-brand)", fontWeight: "600", textDecoration: "none", marginBottom: "0.6rem" }}>
                  🔗 {cleanWebsite}
                </a>
              )
            )}

            {/* Bio */}
            {isOwner ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bio</p>
                  <span style={{ fontSize: "0.72rem", color: bio.length > 450 ? "#ef4444" : "#94a3b8" }}>{bio.length}/500</span>
                </div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  onBlur={() => saveField({ bio })}
                  maxLength={500}
                  rows={3}
                  placeholder="Tell students about your company, culture, and the kinds of roles you hire for…"
                  style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.88rem", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-subtle, #fafafa)", boxSizing: "border-box" }}
                />
              </div>
            ) : (
              company.bio && (
                <p style={{ margin: "0.1rem 0 0", fontSize: "0.9rem", color: "var(--color-text-body, #374151)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{company.bio}</p>
              )
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>{jobs.length}</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Active Jobs</p>
          </div>
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>
              {hireStats ? hireStats.total_hired : "—"}
            </p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Total Hired</p>
            {hireStats?.hired_this_month > 0 && (
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.65rem", color: "#16a34a", fontWeight: "700" }}>+{hireStats.hired_this_month} this month</p>
            )}
          </div>
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
            {responseRate && responseRate.total_received > 0 ? (
              <>
                <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>{responseRate.response_rate_pct}%</p>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Response Rate</p>
                {responseRate.avg_hours !== null && (
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.65rem", color: "var(--color-text-secondary, #64748b)" }}>
                    avg {responseRate.avg_hours < 1
                      ? `${Math.round(responseRate.avg_hours * 60)}m`
                      : `${responseRate.avg_hours}h`}
                  </p>
                )}
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: "1.3rem" }}>⏱️</p>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Avg. Response</p>
                <p style={{ margin: "0.1rem 0 0", fontSize: "0.65rem", color: "#94a3b8" }}>No data yet</p>
              </>
            )}
          </div>
          <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px dashed #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "1.3rem" }}>⭐</p>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#94a3b8", fontWeight: "600" }}>Company Rating</p>
            <span style={{ fontSize: "0.6rem", fontWeight: "700", color: "#a855f7", backgroundColor: "#f5f3ff", borderRadius: "999px", padding: "0.1rem 0.45rem" }}>Coming Soon</span>
          </div>
        </div>

        {/* Active jobs */}
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.05rem", fontWeight: "700", color: "var(--color-text-primary, #0f172a)" }}>Open Positions ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "0.85rem", border: "1.5px solid #e2e8f0", color: "var(--color-text-secondary, #64748b)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
            <p style={{ margin: 0, fontWeight: "600" }}>No open positions right now</p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>Check back soon — new shifts are posted regularly.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {jobs.map(job => {
              const thumb = job.photos?.[0];
              return (
                <button
                  key={job.id}
                  onClick={() => { if (currentUser?.role === "student") { setSelectedJob({ id: job.id, title: job.title, company: company.name }); } }}
                  style={{ width: "100%", textAlign: "left", background: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.25rem", cursor: currentUser?.role === "student" ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "1rem" }}
                >
                  {thumb && <img src={thumb} alt="" style={{ width: "52px", height: "52px", borderRadius: "0.5rem", objectFit: "cover", flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #0f172a)" }}>{job.title}</p>
                      {job.is_urgent && <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#dc2626", backgroundColor: "#fee2e2", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>Urgent</span>}
                    </div>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>
                      📍 {job.location} &nbsp;·&nbsp; 💰 {job.pay} &nbsp;·&nbsp; {job.category}
                    </p>
                    {job.days?.length > 0 && (
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>{job.days.join(", ")}</p>
                    )}
                  </div>
                  {currentUser?.role === "student" && (
                    <span style={{ flexShrink: 0, fontSize: "0.8rem", color: "var(--color-brand)", fontWeight: "700" }}>View →</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Reviews placeholder */}
        <div style={{ marginTop: "2rem", backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary, #0f172a)" }}>Student Reviews</h3>
            <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#a855f7", backgroundColor: "#f5f3ff", borderRadius: "999px", padding: "0.2rem 0.6rem" }}>Coming Soon</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>Students who've worked here will be able to leave reviews once this feature launches.</p>
        </div>

      </div>
    </PageWrapper>
  );
}
