import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import "../StudentShiftWeb.css";
import { jobCategories, getCategoryForTitle } from "../data/jobCategories";
import { haversineDistance, formatDistance, coordsForLocation, geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";
import { likeJob, unlikeJob } from "../lib/auth";
import { useApp } from "../context/AppContext";
import { supabaseImg } from "../utils/img";
import StudentOnboarding from "../components/StudentOnboarding";
import { JobCardsSkeleton } from "../components/Skeleton";

const DESC = {
  "Bar Staff":           "Join our bar team serving drinks and looking after customers. Some experience preferred — full training provided.",
  "Retail Assistant":    "Help customers on the shop floor, manage stock, and operate tills. Flexible student-friendly shifts.",
  "Library Assistant":   "Assist students in locating resources, manage book returns, and maintain a quiet study environment.",
  "Waiter":              "Serve food and drinks with a friendly, professional attitude. Teamwork is essential in our busy restaurant.",
  "Cleaner":             "Keep the premises clean and safe throughout the day. Reliable, detail-oriented applicants wanted.",
  "Barista":             "Craft specialty coffees and serve customers in a fast-paced café. Latte art training provided!",
  "Receptionist":        "Welcome guests, manage bookings, and handle front-desk enquiries. Great communication skills required.",
  "Stockroom Assistant": "Receive deliveries, manage inventory, and keep shelves well-stocked. Attention to detail a must.",
  "Food Prep":           "Assist the kitchen team with preparation and mise en place. No experience needed — full training given.",
  "Security Guard":      "Ensure the safety of customers and staff on site. Must be reliable and professionally presented.",
  "Dishwasher":          "Keep the kitchen running smoothly by maintaining clean dishes and high hygiene standards.",
  "Promoter":            "Engage shoppers and promote our latest products in store with enthusiasm and energy.",
  "Host":                "Greet and seat guests, manage reservations, and create an excellent first impression.",
  "Catering Assistant":  "Support our team at events and in-house service. Flexible hours to fit around your college schedule.",
  "Cashier":             "Operate tills, process payments, and provide excellent customer service at all times.",
  "Kitchen Staff":       "Support our chefs with food prep and maintaining kitchen hygiene. Great for culinary students.",
  "Delivery Assistant":  "Help with local deliveries, packing orders, and warehouse duties. Driving licence advantageous.",
  "Stock Clerk":         "Manage stock levels, process deliveries, and maintain accurate inventory records.",
  "Food Runner":         "Deliver food promptly from kitchen to tables and support the floor team during busy service.",
  "Event Staff":         "Set up and assist at hotel events — great for students who thrive in a lively social environment.",
};

function deadlineLabel(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-IE", { month: "short", day: "numeric" });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr) - new Date()) / 86400000);
}

const GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
let _geocodeCache = {};
try {
  const raw = JSON.parse(localStorage.getItem("ss_geocode_cache") || "{}");
  const now = Date.now();
  // Drop entries older than 30 days
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && v.ts && (now - v.ts) < GEOCODE_TTL_MS) _geocodeCache[k] = v;
  }
} catch { _geocodeCache = {}; }

const weekdays  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const workweek  = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

function FilterPanel({
  clearAll, hasActiveFilters, sortBy, setSortBy, openSections, toggleSection,
  warning, selectedDays, toggleDay, dayTimes, updateTime,
  setSelectedDays, setDayTimes, setSelectedLocations, setSelectedJobTypes,
  setWeekendOnly, setAllWeekOnly, setNoWeekends,
  distanceKm, setDistanceKm, studentLocation, allLocations,
  selectedLocations, toggleLocation, selectedJobTypes, toggleJobType,
  weekendOnly, allWeekOnly, noWeekends,
  payMin, setPayMin, payMax, setPayMax,
  matchSchedule, setMatchSchedule, hasStudentAvailability,
  onApply,
}) {
  const sortOptions = [
    { value: "",             label: "Best Match" },
    { value: "payHigh",      label: "Pay: High → Low" },
    { value: "payLow",       label: "Pay: Low → High" },
    { value: "dateNewest",   label: "Date: Newest" },
    { value: "dateOldest",   label: "Date: Oldest" },
    ...(studentLocation ? [
      { value: "distanceNear", label: "Distance: Closest" },
      { value: "distanceFar",  label: "Distance: Furthest" },
    ] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary, #1e293b)" }}>Filter &amp; Sort</h3>
        {(hasActiveFilters || sortBy !== "") && (
          <button onClick={clearAll} style={{ fontSize: "0.75rem", color: "#e11d48", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit" }}>
            Clear All
          </button>
        )}
      </div>

      {/* Sort */}
      <FilterSection title={<>Sort by {sortBy && <Pip n="✓" />}</>} open={openSections.sort} onToggle={() => toggleSection("sort")} onClear={sortBy ? () => setSortBy("") : null}>
        {sortOptions.map(({ value, label }) => (
          <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: sortBy === value ? 700 : 500, color: sortBy === value ? "var(--color-brand)" : "var(--color-text-body, #374151)" }}>
            <input type="radio" name="sortByPanel" checked={sortBy === value} onChange={() => setSortBy(value)} style={{ cursor: "pointer", accentColor: "var(--color-brand)" }} />
            {label}
          </label>
        ))}
      </FilterSection>


      {/* Days & Times */}
      <FilterSection title={<>Days &amp; Times {selectedDays.length > 0 && <Pip n={selectedDays.length} />}</>} open={openSections.days} onToggle={() => toggleSection("days")} onClear={selectedDays.length > 0 ? () => { setSelectedDays([]); setDayTimes({}); } : null}>
        {warning && <p style={{ color: "#ef4444", fontSize: "0.76rem", marginBottom: "0.4rem" }}>{warning}</p>}
        {weekdays.map(day => (
          <div key={day} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <input type="checkbox" id={`sd-${day}`} checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} style={{ cursor: "pointer", width: "14px", height: "14px", accentColor: "var(--color-brand)" }} />
            <label htmlFor={`sd-${day}`} style={{ fontWeight: 500, minWidth: "85px", cursor: "pointer", fontSize: "0.83rem" }}>{day}</label>
            <select
              aria-label={`${day} preferred time`}
              value={dayTimes[day] || ""} onChange={e => updateTime(day, e.target.value)}
              disabled={!selectedDays.includes(day)}
              style={{ padding: "0.15rem 0.3rem", borderRadius: "0.4rem", border: "1px solid var(--color-border-light, #d1d5db)", fontSize: "0.75rem", color: selectedDays.includes(day) ? "var(--color-text-primary, #111827)" : "var(--color-text-secondary, #64748b)", cursor: selectedDays.includes(day) ? "pointer" : "not-allowed", backgroundColor: selectedDays.includes(day) ? "var(--color-bg-elevated, white)" : "var(--color-bg-surface, #f9fafb)", flex: 1 }}
            >
              <option value="">Any time</option>
              {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
        {/* Distance slider — shown below days/times */}
        <div style={{ marginTop: "0.6rem", paddingTop: "0.6rem", borderTop: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
            <span style={{ fontSize: "0.81rem", color: "var(--color-text-body, #374151)", fontWeight: 600 }}>Distance</span>
            <span style={{ fontSize: "0.81rem", color: "var(--color-text-body, #374151)", fontWeight: 500 }}>{distanceKm === 0 ? "Any" : `Within ${distanceKm} km`}</span>
          </div>
          {studentLocation ? (
            <>
              <SmoothSlider value={distanceKm} onChange={setDistanceKm} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.68rem", color: "var(--color-text-secondary, #64748b)" }}>
                <span>0 km</span><span>25 km</span><span>50 km</span>
              </div>
              {distanceKm > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.3rem" }}>
                  <button onClick={() => setDistanceKm(0)} style={{ fontSize: "0.72rem", color: "var(--color-brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit" }}>Reset</button>
                </div>
              )}
            </>
          ) : (
            <p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", fontStyle: "italic", margin: 0 }}>Save your location in Account to filter by distance.</p>
          )}
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection title={<>Location {selectedLocations.length > 0 && <Pip n={selectedLocations.length} />}</>} open={openSections.location} onToggle={() => toggleSection("location")} onClear={selectedLocations.length > 0 ? () => setSelectedLocations([]) : null}>
        {allLocations.map(loc => (
          <label key={loc} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500 }}>
            <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLocation(loc)} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--color-brand)" }} />
            {loc}
          </label>
        ))}
      </FilterSection>

      {/* Job Type */}
      <FilterSection title={<>Job Type {selectedJobTypes.length > 0 && <Pip n={selectedJobTypes.length} />}</>} open={openSections.jobType} onToggle={() => toggleSection("jobType")} onClear={selectedJobTypes.length > 0 ? () => setSelectedJobTypes([]) : null}>
        {Object.keys(jobCategories).map(type => (
          <label key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500 }}>
            <input type="checkbox" checked={selectedJobTypes.includes(type)} onChange={() => toggleJobType(type)} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--color-brand)" }} />
            {type}
          </label>
        ))}
      </FilterSection>

      {/* Pay Range */}
      <FilterSection title={<>Pay Rate {(payMin || payMax) && <Pip n="✓" />}</>} open={openSections.pay} onToggle={() => toggleSection("pay")} onClear={(payMin || payMax) ? () => { setPayMin(""); setPayMax(""); } : null}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", pointerEvents: "none" }}>€</span>
            <input type="number" min="0" max="999" step="0.5" value={payMin} onChange={e => setPayMin(e.target.value)} placeholder="Min" aria-label="Minimum pay per hour"
              style={{ width: "100%", padding: "0.35rem 0.4rem 0.35rem 1.4rem", borderRadius: "0.4rem", border: "1px solid #d1d5db", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", flexShrink: 0 }}>to</span>
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", pointerEvents: "none" }}>€</span>
            <input type="number" min="0" max="999" step="0.5" value={payMax} onChange={e => setPayMax(e.target.value)} placeholder="Max" aria-label="Maximum pay per hour"
              style={{ width: "100%", padding: "0.35rem 0.4rem 0.35rem 1.4rem", borderRadius: "0.4rem", border: "1px solid #d1d5db", fontSize: "0.82rem", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </div>
        <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>per hour</p>
      </FilterSection>

      {/* Schedule */}
      <FilterSection title={<>Schedule {(weekendOnly || allWeekOnly || noWeekends || matchSchedule) && <Pip n="✓" />}</>} open={openSections.schedule} onToggle={() => toggleSection("schedule")} onClear={(weekendOnly || allWeekOnly || noWeekends || matchSchedule) ? () => { setWeekendOnly(false); setAllWeekOnly(false); setNoWeekends(false); setMatchSchedule(false); } : null}>
        {hasStudentAvailability && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: matchSchedule ? 700 : 500, color: matchSchedule ? "var(--color-brand)" : "var(--color-text-body, #374151)", paddingBottom: "0.45rem", borderBottom: "1px solid var(--color-border-light, #f3f4f6)" }}>
            <input type="checkbox" checked={matchSchedule} onChange={() => setMatchSchedule(p => !p)} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--color-brand)" }} />
            Matches my schedule
          </label>
        )}
        {[
          { label: "Weekend Work", active: weekendOnly, toggle: () => setWeekendOnly(p => !p) },
          { label: "All Week",     active: allWeekOnly, toggle: () => setAllWeekOnly(p => !p) },
          { label: "No Weekends",  active: noWeekends,  toggle: () => setNoWeekends(p => !p) },
        ].map(({ label, active, toggle }) => (
          <label key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: active ? 700 : 500, color: active ? "var(--color-brand)" : "var(--color-text-body, #374151)" }}>
            <input type="checkbox" checked={active} onChange={toggle} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "var(--color-brand)" }} />
            {label}
          </label>
        ))}
      </FilterSection>

      {/* Mobile: Apply & close button */}
      {onApply && (
        <button
          onClick={onApply}
          style={{ width: "100%", padding: "0.65rem", borderRadius: "2rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit", marginTop: "0.5rem" }}
        >
          Apply Filters
        </button>
      )}

    </div>
  );
}

export default function StudentDashboard({ restoreScrollY }) {
  const { setPage, setSelectedJob, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs,
    currentUser, studentLocation, savedLikedJobIds, savedAppliedJobIds,
    setSavedLikedJobIds } = useApp();
  const navigate = useNavigate();
  const [jobs,           setJobs]           = useState([]);
  const [jobsLoading,    setJobsLoading]    = useState(true);
  const [jobsError,      setJobsError]      = useState(false);
  const [applicantCounts, setApplicantCounts] = useState({});
  const [featuredCompanyIds,   setFeaturedCompanyIds]   = useState(new Set());
  const [companyResponseRates, setCompanyResponseRates] = useState({});
  const [fetchedPage,  setFetchedPage]  = useState(0);
  const [hasMore,      setHasMore]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [extraCoords,  setExtraCoords]  = useState(_geocodeCache);
  const [windowWidth,  setWindowWidth]  = useState(window.innerWidth);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortDropsUp,      setSortDropsUp]      = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const searchInputRef = useRef(null);
  const sortDropdownRef = useRef(null);
  // Saved searches: [{ name, filters }]
  const ssKey = "ss_saved_searches_" + (currentUser?.id || "guest");
  const [savedSearches,    setSavedSearches]    = useState(() => { try { return JSON.parse(localStorage.getItem(ssKey) || "[]"); } catch { return []; } });
  const [justSaved,        setJustSaved]        = useState(false);
  const [gridCols,         setGridCols]         = useState(1);
  const isPhone = windowWidth < 768;

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const handler = e => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setSortDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isMobile = windowWidth < 1024;

  function mapJobRow(j, nameMap) {
    return {
      id:              j.id,
      title:           j.title,
      company:         nameMap[j.company_id] || "Unknown Company",
      companyId:       j.company_id,
      category:        j.category || "",
      location:        j.location,
      lat:             j.lat,
      lng:             j.lng,
      pay:             j.pay,
      description:     j.description || DESC[j.title] || "",
      deadline:        j.deadline || null,
      createdAt:       j.created_at,
      days:            j.days || [],
      times:           Object.fromEntries(Object.entries(j.times || {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
      weekendRequired: j.weekend_required || false,
      sickPay:         j.sick_pay || false,
      holidays:        j.holidays || "",
      isUrgent:        j.is_urgent || false,
      photos:          j.photos || [],
      photoCrops:      j.photo_crops || [],
      filledShifts:        j.filled_shifts || [],
      screeningQuestions:  j.screening_questions || [],
      status:              j.status,
    };
  }

  async function fetchJobPage(pageNum, append = false) {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await withTimeout(
      supabase.from("jobs").select("*").eq("status", "Active")
        .or(`deadline.is.null,deadline.gte.${today}`)
        .order("created_at", { ascending: false })
        .range(pageNum * 20, pageNum * 20 + 19),
      10000, "Loading jobs timed out."
    );
    if (error) throw error;
    const rows = data || [];
    setHasMore(rows.length === 20);
    if (!rows.length) return;
    const companyIds = [...new Set(rows.map(j => j.company_id))];
    let nameMap = {};
    try {
      const { data: profiles } = await withTimeout(supabase.from("profiles").select("id, name").in("id", companyIds), 8000);
      if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });
    } catch (e) { console.warn("[StudentDashboard] profile name lookup failed:", e); }
    const mapped = rows.map(j => mapJobRow(j, nameMap));
    if (append) setJobs(prev => [...prev, ...mapped]);
    else setJobs(mapped);
    const jobIds = mapped.map(j => j.id);
    supabase.rpc("get_job_applicant_counts", { job_ids: jobIds })
      .then(({ data }) => {
        if (!data) return;
        setApplicantCounts(prev => ({ ...prev, ...Object.fromEntries(data.map(r => [r.job_id, Number(r.applicant_count)])) }));
      })
      .catch(() => {});
    // Batch-load response rates for newly seen companies (fire-and-forget)
    const pageCompanyIds = [...new Set(rows.map(r => r.company_id))];
    if (pageCompanyIds.length) {
      supabase.rpc("get_companies_response_rates", { p_company_ids: pageCompanyIds })
        .then(({ data }) => {
          if (!data?.length) return;
          setCompanyResponseRates(prev => ({ ...prev, ...Object.fromEntries(data.map(r => [r.company_id, Number(r.avg_hours)])) }));
        })
        .catch(() => {});
    }
  }

  useEffect(() => {
    fetchJobPage(0).catch(e => { console.error("[StudentDashboard] jobs error:", e); setJobsError(true); })
      .finally(() => setJobsLoading(false));
    // Load featured company IDs once on mount (fire-and-forget)
    supabase.rpc("get_featured_company_ids")
      .then(({ data }) => { if (data?.length) setFeaturedCompanyIds(new Set(data.map(r => r.id))); })
      .catch(() => {});
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = fetchedPage + 1;
      await fetchJobPage(nextPage, true);
      setFetchedPage(nextPage);
    } catch (e) {
      console.error("[StudentDashboard] load more error:", e);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchedPage]);

  useEffect(() => {
    if (!jobs.length || !currentUser) return;
    const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));
    if (savedLikedJobIds?.length) {
      setLikedJobs(prev => {
        const prevMap = Object.fromEntries(prev.map(j => [j.id, j]));
        return savedLikedJobIds.map(id => jobMap[id] || prevMap[id]).filter(Boolean);
      });
    }
    if (savedAppliedJobIds?.length) {
      setAppliedJobs(prev => {
        const prevMap = Object.fromEntries(prev.map(j => [j.id, j]));
        return savedAppliedJobIds.map(id => jobMap[id] || prevMap[id]).filter(Boolean);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, currentUser?.id, savedLikedJobIds, savedAppliedJobIds]);

  useEffect(() => {
    if (restoreScrollY > 0) requestAnimationFrame(() => window.scrollTo(0, restoreScrollY));
  }, []);

  // Geocode missing locations — cache keyed lowercase for case-insensitive hits
  useEffect(() => {
    if (!jobs.length) return;
    const unknown = [...new Set(
      jobs.filter(j => !j.lat || !j.lng).map(j => j.location?.trim().toLowerCase())
        .filter(loc => loc && !coordsForLocation(loc) && !_geocodeCache[loc])
    )];
    if (!unknown.length) return;
    let cancelled = false;
    (async () => {
      for (const loc of unknown) {
        if (cancelled) break;
        try {
          const query = /galway|ireland/i.test(loc) ? loc : `${loc}, Galway, Ireland`;
          const result = await geocodeAddress(query);
          if (result && !cancelled) {
            _geocodeCache[loc] = { lat: result.lat, lng: result.lng, ts: Date.now() };
            try { localStorage.setItem("ss_geocode_cache", JSON.stringify(_geocodeCache)); } catch { /* ignore quota errors */ }
            setExtraCoords(prev => ({ ...prev, [loc]: { lat: result.lat, lng: result.lng } }));
          }
        } catch (e) { console.warn("[StudentDashboard] geocode failed:", e); }
        if (!cancelled) await new Promise(r => setTimeout(r, 1100));
      }
    })();
    return () => { cancelled = true; };
  }, [jobs]);

  const getJobCoords = (job) => {
    if (job.lat && job.lng) return { lat: job.lat, lng: job.lng };
    return coordsForLocation(job.location, extraCoords);
  };

  const jobDistance = useCallback((job) => {
    if (!studentLocation) return null;
    const coords = getJobCoords(job);
    if (!coords) return null;
    return haversineDistance(studentLocation.lat, studentLocation.lng, coords.lat, coords.lng);
  }, [studentLocation, extraCoords]);

  // Filter state
  // Memoised so the location list doesn't recreate on every render
  const allLocations = useMemo(() => [...new Set(jobs.map(j => j.location))].sort(), [jobs]);

  const [prefOnly,          setPrefOnly]          = useState(false);
  const [profileNudgeDismissed, setProfileNudgeDismissed] = useState(() => {
    try { return localStorage.getItem("ss_profile_nudge_dismissed") === "1"; } catch { return false; }
  });
  const [selectedDays,      setSelectedDays]      = useState([]);
  const [dayTimes,          setDayTimes]          = useState({});
  const [warning,           setWarning]           = useState("");
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedJobTypes,  setSelectedJobTypes]  = useState([]);
  const [weekendOnly,       setWeekendOnly]       = useState(false);
  const [allWeekOnly,       setAllWeekOnly]       = useState(false);
  const [noWeekends,        setNoWeekends]        = useState(false);
  const [distanceKm,        setDistanceKm]        = useState(0);
  const [payMin,            setPayMin]            = useState("");
  const [payMax,            setPayMax]            = useState("");
  const [matchSchedule,     setMatchSchedule]     = useState(false);
  const [jobAlerts,         setJobAlerts]         = useState(() => { try { return localStorage.getItem("ss_job_alerts") === "1"; } catch { return false; } });
  const [searchQuery,       setSearchQuery]       = useState("");
  // Debounced version — filter/sort only recomputes 200 ms after the user stops typing
  const [debouncedSearch,   setDebouncedSearch]   = useState("");
  const [sortBy,            setSortBy]            = useState("");

  // Sidebar section collapse state — Sort and Days & Times open by default
  const [openSections, setOpenSections] = useState({ sort: true, days: true, location: false, jobType: false, pay: false, schedule: false, distance: false });
  const toggleSection = (k) => setOpenSections(p => ({ ...p, [k]: !p[k] }));

  // Debounce search input so filtering doesn't fire on every keystroke
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const toggleDay = (day) => {
    let updated = [...selectedDays];
    if (updated.includes(day)) {
      updated = updated.filter(d => d !== day);
      const newTimes = { ...dayTimes };
      delete newTimes[day];
      setDayTimes(newTimes);
    } else {
      if (updated.length >= 5) setWarning("Are you a student selecting all 5 weekdays?");
      updated.push(day);
    }
    setSelectedDays(updated);
  };
  const updateTime      = (day, time) => setDayTimes({ ...dayTimes, [day]: time });
  const toggleLocation  = (loc)  => setSelectedLocations(prev => prev.includes(loc)  ? prev.filter(l => l !== loc)  : [...prev, loc]);
  const toggleJobType   = (type) => setSelectedJobTypes(prev  => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);

  const clearAll = () => {
    setSelectedDays([]); setDayTimes({}); setSelectedLocations([]); setSelectedJobTypes([]);
    setPayMin(""); setPayMax(""); setMatchSchedule(false);
    setWeekendOnly(false); setAllWeekOnly(false); setNoWeekends(false);
    setDistanceKm(0); setSearchQuery(""); setSortBy(""); setWarning("");
  };

  const currentFilters = () => ({
    selectedDays, dayTimes, selectedLocations, selectedJobTypes,
    weekendOnly, allWeekOnly, noWeekends, distanceKm, sortBy, prefOnly,
    searchQuery, payMin, payMax, matchSchedule,
  });

  const applyFilters = (f) => {
    setSelectedDays(f.selectedDays || []);
    setDayTimes(f.dayTimes || {});
    setSelectedLocations(f.selectedLocations || []);
    setSelectedJobTypes(f.selectedJobTypes || []);
    setWeekendOnly(f.weekendOnly || false);
    setAllWeekOnly(f.allWeekOnly || false);
    setNoWeekends(f.noWeekends || false);
    setDistanceKm(f.distanceKm || 0);
    setSortBy(f.sortBy || "");
    setPrefOnly(f.prefOnly || false);
    setSearchQuery(f.searchQuery || "");
    setPayMin(f.payMin || "");
    setPayMax(f.payMax || "");
    setMatchSchedule(f.matchSchedule || false);
  };

  const generateSearchName = () => {
    if (searchQuery.trim()) return searchQuery.trim();
    const parts = [];
    if (selectedDays.length > 0) parts.push(selectedDays.slice(0, 2).map(d => d.slice(0, 3)).join("/"));
    if (selectedLocations.length > 0) parts.push(selectedLocations[0]);
    if (selectedJobTypes.length > 0) parts.push(selectedJobTypes[0]);
    if (weekendOnly) parts.push("Weekends");
    if (allWeekOnly) parts.push("Weekdays");
    if (distanceKm > 0) parts.push(`${distanceKm}km`);
    return parts.length > 0 ? parts.join(" · ") : `Search ${savedSearches.length + 1}`;
  };

  const saveSearch = () => {
    const name = generateSearchName();
    if (savedSearches.some(s => s.name === name)) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      return;
    }
    const updated = [...savedSearches, { name, filters: currentFilters() }];
    setSavedSearches(updated);
    try { localStorage.setItem(ssKey, JSON.stringify(updated)); } catch (e) { console.warn("Could not persist saved search:", e); }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const deleteSearch = (i) => {
    const updated = savedSearches.filter((_, idx) => idx !== i);
    setSavedSearches(updated);
    try { localStorage.setItem(ssKey, JSON.stringify(updated)); } catch (e) { console.warn("Could not persist saved search deletion:", e); }
  };

  const hasActiveFilters = selectedDays.length > 0 || selectedLocations.length > 0 || selectedJobTypes.length > 0 || weekendOnly || allWeekOnly || noWeekends || distanceKm > 0 || debouncedSearch.trim() !== "" || !!payMin || !!payMax || matchSchedule;
  const activeFilterCount = (selectedDays.length > 0 ? 1 : 0) + (selectedLocations.length > 0 ? 1 : 0) + (selectedJobTypes.length > 0 ? 1 : 0) + (weekendOnly ? 1 : 0) + (allWeekOnly ? 1 : 0) + (noWeekends ? 1 : 0) + (distanceKm > 0 ? 1 : 0) + ((payMin || payMax) ? 1 : 0) + (matchSchedule ? 1 : 0);

  const userPrefs = currentUser?.jobPreferences || [];

  // Memoised — only recomputes when filter state or jobs actually change
  const firstBlockingFilter = useMemo(() => {
    if (!hasActiveFilters || jobs.length === 0) return null;
    let pool = [...jobs];
    const step = (filtered, label) => { if (filtered.length === 0 && pool.length > 0) return label; pool = filtered; return null; };
    let hit;
    if (prefOnly && userPrefs.length > 0) {
      hit = step(pool.filter(j => { const c = getCategoryForTitle(j.title); return c && userPrefs.includes(c); }), "your job preferences"); if (hit) return hit;
    }
    if (selectedDays.length > 0) {
      hit = step(pool.filter(j => selectedDays.some(d => { if (!j.days.includes(d)) return false; if (dayTimes[d]) return j.times[d]?.some(t => t >= dayTimes[d]); return true; })), selectedDays.length === 1 ? `${selectedDays[0]}` : `${selectedDays.slice(0,2).map(d=>d.slice(0,3)).join("/")} days`); if (hit) return hit;
    }
    if (selectedLocations.length > 0) {
      hit = step(pool.filter(j => selectedLocations.includes(j.location)), selectedLocations.length === 1 ? selectedLocations[0] : "location filter"); if (hit) return hit;
    }
    if (selectedJobTypes.length > 0) {
      hit = step(pool.filter(j => { const c = getCategoryForTitle(j.title); return c && selectedJobTypes.includes(c); }), "job type filter"); if (hit) return hit;
    }
    if (weekendOnly) { hit = step(pool.filter(j => j.days.includes("Saturday") || j.days.includes("Sunday")), "weekends-only filter"); if (hit) return hit; }
    if (allWeekOnly) { hit = step(pool.filter(j => workweek.every(d => j.days.includes(d))), "full-week filter"); if (hit) return hit; }
    if (noWeekends)  { hit = step(pool.filter(j => !j.days.includes("Saturday") && !j.days.includes("Sunday")), "no-weekends filter"); if (hit) return hit; }
    if (distanceKm > 0 && studentLocation) {
      hit = step(pool.filter(j => { const d = jobDistance(j); return d !== null && d <= distanceKm; }), `${distanceKm}km distance limit`); if (hit) return hit;
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      hit = step(pool.filter(j => j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || (j.description || "").toLowerCase().includes(q)), `"${debouncedSearch}"`); if (hit) return hit;
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, hasActiveFilters, prefOnly, userPrefs, selectedDays, dayTimes, selectedLocations, selectedJobTypes, weekendOnly, allWeekOnly, noWeekends, distanceKm, studentLocation, debouncedSearch, jobDistance]);

  // Filter logic (time filter uses >= not exact match) — memoised
  const filteredJobs = useMemo(() => jobs.filter(job => {
    if (prefOnly && userPrefs.length > 0) {
      const cat = getCategoryForTitle(job.title);
      if (!cat || !userPrefs.includes(cat)) return false;
    }
    if (selectedDays.length > 0) {
      const daysMatch = selectedDays.some(day => {
        if (!job.days.includes(day)) return false;
        if (dayTimes[day]) return job.times[day]?.some(t => t >= dayTimes[day]);
        return true;
      });
      if (!daysMatch) return false;
    }
    if (selectedLocations.length > 0 && !selectedLocations.includes(job.location)) return false;
    if (selectedJobTypes.length > 0) {
      const category = getCategoryForTitle(job.title);
      if (!category || !selectedJobTypes.includes(category)) return false;
    }
    if (weekendOnly && !job.weekendRequired && !job.days.includes("Saturday") && !job.days.includes("Sunday")) return false;
    if (allWeekOnly && !workweek.every(d => job.days.includes(d))) return false;
    if (noWeekends && (job.weekendRequired || job.days.includes("Saturday") || job.days.includes("Sunday"))) return false;
    if (distanceKm > 0 && studentLocation) {
      const dist = jobDistance(job);
      if (dist === null || dist > distanceKm) return false;
    }
    if (payMin && payNum(job.pay) < parseFloat(payMin)) return false;
    if (payMax && payNum(job.pay) > parseFloat(payMax)) return false;
    if (matchSchedule) {
      const avail = currentUser?.availability || {};
      const hasOverlap = (job.days || []).some(day => Array.isArray(avail[day]) && avail[day].length > 0);
      if (!hasOverlap) return false;
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q) && !(job.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [jobs, prefOnly, userPrefs, selectedDays, dayTimes, selectedLocations, selectedJobTypes, weekendOnly, allWeekOnly, noWeekends, distanceKm, studentLocation, debouncedSearch, jobDistance, payMin, payMax, matchSchedule, currentUser?.availability]);

  const payNum = (p) => parseFloat((p || "").replace(/[^0-9.]/g, "")) || 0;

  // Match score per job — skills + preferences + availability overlap (must be before sortedJobs)
  const jobMatchScore = useCallback((job) => {
    if (!currentUser) return 0;
    let score = 0;
    const prefs = currentUser.jobPreferences || [];
    const skills = currentUser.skills || [];
    const avail  = currentUser.availability || {};
    const cat    = job.category || getCategoryForTitle(job.title);
    if (cat && prefs.includes(cat)) score += 40;
    const jobText = (job.title + " " + (job.description || "")).toLowerCase();
    const skillMatches = skills.filter(s => jobText.includes(s.toLowerCase())).length;
    score += Math.min(30, skillMatches * 10);
    const days = job.days || [];
    const matchingDays = days.filter(d => Array.isArray(avail[d]) && avail[d].length > 0).length;
    score += days.length > 0 ? Math.round((matchingDays / days.length) * 30) : 0;
    return score;
  }, [currentUser]);

  // Top-matched jobs for "For You" strip
  const forYouJobs = useMemo(() => {
    if (!currentUser || currentUser.role !== "student") return [];
    const prefs  = currentUser.jobPreferences || [];
    const skills = currentUser.skills || [];
    const avail  = currentUser.availability || {};
    if (!prefs.length && !skills.length && !Object.keys(avail).length) return [];
    return [...jobs]
      .map(j => ({ ...j, _score: jobMatchScore(j) }))
      .filter(j => j._score > 0 && !appliedJobs.some(a => a.id === j.id))
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, currentUser, jobMatchScore, appliedJobs]);

  // Sorted jobs — urgent floats first only on default (no explicit sort selected)
  const sortedJobs = useMemo(() => {
    const sorted = [...filteredJobs].sort((a, b) => {
      if (sortBy === "payHigh")     return payNum(b.pay) - payNum(a.pay);
      if (sortBy === "payLow")      return payNum(a.pay) - payNum(b.pay);
      if (sortBy === "dateNewest")  return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "dateOldest")  return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "distanceNear") { const da = jobDistance(a) ?? Infinity;  const db = jobDistance(b) ?? Infinity;  return da - db; }
      if (sortBy === "distanceFar")  { const da = jobDistance(a) ?? -Infinity; const db = jobDistance(b) ?? -Infinity; return db - da; }
      return jobMatchScore(b) - jobMatchScore(a);
    });
    if (sortBy) return sorted;
    return [...sorted.filter(j => j.isUrgent), ...sorted.filter(j => !j.isUrgent)];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredJobs, sortBy, jobDistance, jobMatchScore]);

  // Market average pay per category, computed from ALL loaded jobs (not filtered subset)
  const categoryAvgPay = useMemo(() => {
    const sums = {};
    const counts = {};
    for (const j of jobs) {
      const cat = j.category;
      const n = payNum(j.pay);
      if (!cat || n <= 0) continue;
      sums[cat] = (sums[cat] || 0) + n;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const result = {};
    for (const cat of Object.keys(sums)) {
      if (counts[cat] >= 2) result[cat] = Math.round((sums[cat] / counts[cat]) * 10) / 10;
    }
    return result;
  }, [jobs]);

  const toggleLike = (job) => {
    if (!currentUser) { setPage("login"); return; }
    if (appliedJobs.some(j => j.id === job.id)) return;
    const isLiked = likedJobs.some(j => j.id === job.id);
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
    setSavedLikedJobIds?.(prev => isLiked ? prev.filter(id => id !== job.id) : [...new Set([...prev, job.id])]);
    if (isLiked) unlikeJob(currentUser.id, job.id).catch(console.error);
    else likeJob(currentUser.id, job.id).catch(console.error);
  };

  const sortLabel = {
    "":             "Best Match",
    "payHigh":      "Pay: High → Low",
    "payLow":       "Pay: Low → High",
    "dateNewest":   "Date: Newest",
    "dateOldest":   "Date: Oldest",
    "distanceNear": "Distance: Closest",
    "distanceFar":  "Distance: Furthest",
  };

  const hasStudentAvailability = !!(currentUser?.availability && Object.values(currentUser.availability || {}).some(v => Array.isArray(v) && v.length > 0));

  const filterPanelProps = {
    clearAll, hasActiveFilters, sortBy, setSortBy, openSections, toggleSection,
    warning, selectedDays, toggleDay, dayTimes, updateTime,
    setSelectedDays, setDayTimes, setSelectedLocations, setSelectedJobTypes,
    distanceKm, setDistanceKm, studentLocation, allLocations,
    selectedLocations, toggleLocation, selectedJobTypes, toggleJobType,
    weekendOnly, setWeekendOnly, allWeekOnly, setAllWeekOnly, noWeekends, setNoWeekends,
    payMin, setPayMin, payMax, setPayMax,
    matchSchedule, setMatchSchedule, hasStudentAvailability,
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-subtle)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Helmet>
        <title>Find Your Shift — StudentShifts</title>
        <meta name="description" content="Browse student-friendly part-time jobs across Ireland. Filter by day, time, location and more." />
        <link rel="canonical" href="https://studentshifts.ie/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Find Your Shift — StudentShifts" />
        <meta property="og:description" content="Browse student-friendly part-time jobs across Ireland. Filter by day, time, location and more." />
        <meta property="og:url" content="https://studentshifts.ie/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Find Your Shift — StudentShifts" />
        <meta name="twitter:description" content="Browse student-friendly part-time jobs across Ireland. Filter by day, time, location and more." />
      </Helmet>
      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Page heading */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: "1.85rem", color: "var(--color-text-primary, #1e293b)" }}>Find Your Shift</h1>
          <p style={{ margin: "0.35rem 0 0", color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem" }}>Browse student-friendly jobs across Galway</p>
        </div>

        {/* Location nudge */}
        {currentUser?.role === "student" && !studentLocation && (
          <button onClick={() => setPage("account")} style={{ display: "flex", alignItems: "center", gap: "0.6rem", backgroundColor: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: "0.75rem", padding: "0.6rem 1rem", marginBottom: "1rem", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}>
            <span style={{ fontSize: "1.1rem" }}>📍</span>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#1d4ed8", fontWeight: 600, lineHeight: 1.4 }}>
              Set your location in Account to see how far each job is from you.
            </p>
          </button>
        )}

        {/* Preference tabs */}
        {currentUser?.role === "student" && userPrefs.length > 0 && (
          <div style={{ display: "flex", backgroundColor: "var(--color-bg-surface, #e8edf5)", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1rem", gap: "0.25rem" }}>
            {[{ val: false, label: "All Jobs" }, { val: true, label: "My Preferences" }].map(({ val, label }) => (
              <button key={String(val)} onClick={() => setPrefOnly(val)} style={{ flex: 1, padding: "0.55rem", borderRadius: "0.6rem", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", backgroundColor: prefOnly === val ? "var(--color-bg-elevated, white)" : "transparent", color: prefOnly === val ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", boxShadow: prefOnly === val ? "0 1px 6px rgba(0,0,0,0.1)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Profile completeness nudge — verified students missing CV or bio */}
        {currentUser?.role === "student" && currentUser?.verificationStatus === "verified" && !profileNudgeDismissed && (!currentUser.cvName || !currentUser.bio) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", backgroundColor: "#fef9c3", border: "1.5px solid #fde047", borderRadius: "0.75rem", padding: "0.65rem 1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#78350f", fontWeight: 600, lineHeight: 1.4 }}>
                {!currentUser.cvName
                  ? "Upload a CV to start applying. Companies won't see your application without one."
                  : "Add a bio to your profile — companies shortlist applicants with complete profiles 3× more often."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <button onClick={() => setPage("account")} style={{ padding: "0.4rem 0.9rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, #d97706, #b45309)", color: "white", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Complete Profile →
              </button>
              <button onClick={() => { setProfileNudgeDismissed(true); try { localStorage.setItem("ss_profile_nudge_dismissed", "1"); } catch { /* ignore */ } }} aria-label="Dismiss" style={{ padding: "0.4rem 0.6rem", borderRadius: "2rem", border: "1.5px solid #fde047", background: "var(--color-bg-elevated, white)", color: "#92400e", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            </div>
          </div>
        )}

        {/* Main layout: sidebar + jobs */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

          {/* Sidebar — desktop only */}
          {!isMobile && (
            <aside style={{ width: "260px", flexShrink: 0, position: "sticky", top: "88px" }}>
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "var(--border-muted)", borderRadius: "1rem", padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <FilterPanel {...filterPanelProps} />
              </div>
            </aside>
          )}

          {/* Job list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Search bar */}
            <div style={{ marginBottom: "0.9rem", position: "relative" }}>
              <input
                ref={searchInputRef}
                placeholder="Search by job title or company…"
                aria-label="Search by job title or company"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 2.5rem 0.7rem 1rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", fontSize: "1rem", boxSizing: "border-box", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-elevated, white)", outline: "none" }}
                onFocus={e => e.target.style.borderColor = "var(--color-brand)"}
                onBlur={e => e.target.style.borderColor = "var(--color-border-light, #e2e8f0)"}
              />
              {searchQuery && (
                <button
                  aria-label="Clear search"
                  onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                  style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary, #64748b)", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontSize: "1.1rem", lineHeight: 1, borderRadius: "50%" }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Saved search chips */}
            {savedSearches.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                {savedSearches.map((s, i) => (
                  <div key={i} style={{ display: "inline-flex", alignItems: "center", borderRadius: "999px", border: "1.5px solid #fce7f3", backgroundColor: "#fce7f3", overflow: "hidden" }}>
                    <button onClick={() => applyFilters(s.filters)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.3rem 0.25rem 0.7rem", background: "none", border: "none", color: "var(--color-brand)", fontSize: "0.77rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      ⭐ {s.name}
                    </button>
                    <button onClick={() => deleteSearch(i)} aria-label={`Remove saved search: ${s.name}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.25rem 0.5rem 0.25rem 0.1rem", background: "none", border: "none", color: "#f48fb1", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1, cursor: "pointer" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* For You recommendations strip */}
            {forYouJobs.length > 0 && !hasActiveFilters && (
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.55rem" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "var(--color-brand)", textTransform: "uppercase", letterSpacing: "0.07em" }}>✨ For You</p>
                  <p style={{ margin: 0, fontSize: "0.68rem", color: "#94a3b8" }}>Based on your profile</p>
                </div>
                <div style={{ display: "flex", gap: "0.65rem", overflowX: "auto", paddingBottom: "0.35rem" }}>
                  {forYouJobs.map(job => {
                    const score = job._score || 0;
                    const pct   = Math.min(100, Math.round((score / 100) * 100));
                    const isApplied = appliedJobs.some(j => j.id === job.id);
                    return (
                      <button key={job.id} onClick={() => { setSelectedJob(job); setPage("jobDetails"); }}
                        style={{ flexShrink: 0, width: "175px", padding: "0.75rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-brand)", background: "var(--color-bg-elevated, white)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(162,29,84,0.1)" }}>
                        <p style={{ margin: "0 0 0.2rem", fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary, #0f172a)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</p>
                        <p style={{ margin: "0 0 0.35rem", fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <button onClick={e => { e.stopPropagation(); navigate(`/companies/${job.companyId}`); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "2px" }}>{job.company}</button>
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary, #111827)" }}>{job.pay}</span>
                          {isApplied
                            ? <span className="badge badge-green badge-sm">Applied</span>
                            : <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--color-brand)", backgroundColor: "#fce7f3", borderRadius: "999px", padding: "0.1rem 0.45rem" }}>{pct}% match</span>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Job count + grid toggle + Sort By */}
            {/* #10 — active filter chips */}
            {hasActiveFilters && (() => {
              const chips = [
                ...selectedDays.map(d => ({ label: d, onRemove: () => setSelectedDays(p => p.filter(x => x !== d)) })),
                ...selectedLocations.map(l => ({ label: l, onRemove: () => setSelectedLocations(p => p.filter(x => x !== l)) })),
                ...selectedJobTypes.map(t => ({ label: t, onRemove: () => setSelectedJobTypes(p => p.filter(x => x !== t)) })),
                ...(weekendOnly ? [{ label: "Weekend", onRemove: () => setWeekendOnly(false) }] : []),
                ...(allWeekOnly ? [{ label: "All-Week", onRemove: () => setAllWeekOnly(false) }] : []),
                ...(noWeekends ? [{ label: "No Weekends", onRemove: () => setNoWeekends(false) }] : []),
                ...(matchSchedule ? [{ label: "Matches Schedule", onRemove: () => setMatchSchedule(false) }] : []),
                ...((payMin || payMax) ? [{ label: `Pay ${payMin ? `€${payMin}` : ""}${payMin && payMax ? "–" : ""}${payMax ? `€${payMax}` : ""}`, onRemove: () => { setPayMin(""); setPayMax(""); } }] : []),
                ...(distanceKm > 0 ? [{ label: `≤${distanceKm}km`, onRemove: () => setDistanceKm(0) }] : []),
                ...(debouncedSearch.trim() ? [{ label: `"${debouncedSearch.trim()}"`, onRemove: () => setSearchQuery("") }] : []),
              ];
              return (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.6rem" }}>
                  {chips.map(c => (
                    <span key={c.label} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.5rem 0.25rem 0.65rem", borderRadius: "999px", backgroundColor: "#fce7f3", border: "1.5px solid #f9a8d4", color: "var(--color-brand)", fontSize: "0.75rem", fontWeight: 700 }}>
                      {c.label}
                      <button onClick={c.onRemove} aria-label={`Remove ${c.label} filter`} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-brand)", lineHeight: 1, fontSize: "0.8rem", display: "flex", alignItems: "center" }}>×</button>
                    </span>
                  ))}
                </div>
              );
            })()}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span className="badge badge-brand" style={{ fontSize: "0.8rem" }}>
                  {sortedJobs.length} job{sortedJobs.length !== 1 ? "s" : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", backgroundColor: "var(--color-bg-surface, #fafafa)", borderRadius: "0.6rem", padding: "0.2rem" }}>
                  <button onClick={() => setGridCols(1)} aria-label="Single column layout" aria-pressed={gridCols === 1} title="Single column" style={{ padding: "0.28rem 0.5rem", border: "none", borderRadius: "0.4rem", cursor: "pointer", backgroundColor: gridCols === 1 ? "var(--color-bg-elevated, white)" : "transparent", color: gridCols === 1 ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: 700, fontSize: "1rem", boxShadow: gridCols === 1 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▤</button>
                  <button onClick={() => setGridCols(2)} aria-label="Two column layout" aria-pressed={gridCols === 2} title="Two columns" style={{ padding: "0.28rem 0.5rem", border: "none", borderRadius: "0.4rem", cursor: "pointer", backgroundColor: gridCols === 2 ? "var(--color-bg-elevated, white)" : "transparent", color: gridCols === 2 ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: 700, fontSize: "1rem", boxShadow: gridCols === 2 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▦</button>
                </div>
                {/* Save search button — auto-saves using search bar text as name */}
                <button
                  onClick={saveSearch}
                  aria-label={justSaved ? "Search saved" : "Save current search"}
                  title="Save current search"
                  style={{ padding: "0.28rem 0.55rem", border: `1.5px solid ${justSaved ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, borderRadius: "0.4rem", cursor: "pointer", backgroundColor: justSaved ? "#fce7f3" : "var(--color-bg-elevated, white)", color: justSaved ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1, fontFamily: "inherit" }}
                >⭐</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {isMobile && (
                <button
                  onClick={() => setMobileFiltersOpen(o => !o)}
                  style={{ padding: "0.42rem 1rem", borderRadius: "2rem", border: `1.5px solid ${activeFilterCount > 0 ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: activeFilterCount > 0 ? "#fce7f3" : "var(--color-bg-elevated, white)", color: activeFilterCount > 0 ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: activeFilterCount > 0 ? 700 : 500, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap" }}
                >
                  Filters {activeFilterCount > 0 && <Pip n={activeFilterCount} />} {mobileFiltersOpen ? "▲" : "▼"}
                </button>
              )}
              <div style={{ position: "relative" }} ref={sortDropdownRef}>
                <button
                  onClick={() => {
                    const rect = sortDropdownRef.current?.getBoundingClientRect();
                    setSortDropsUp(!!rect && window.innerHeight - rect.bottom < 280);
                    setSortDropdownOpen(o => !o);
                  }}
                  style={{ padding: "0.42rem 1rem", borderRadius: "2rem", border: `1.5px solid ${sortBy ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: sortBy ? "#fce7f3" : "var(--color-bg-elevated, white)", color: sortBy ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: sortBy ? 700 : 500, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  {sortLabel[sortBy] || "Sort by"} ▾
                </button>
                {sortDropdownOpen && (
                  <div style={{ position: "absolute", ...(sortDropsUp ? { bottom: "calc(100% + 0.4rem)" } : { top: "calc(100% + 0.4rem)" }), ...(isPhone ? { left: 0 } : { right: 0 }), zIndex: 50, backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e5e7eb)", borderRadius: "0.75rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "0.5rem 0.75rem", minWidth: "210px" }}>
                    {[
                      { value: "",             label: "Best Match" },
                      { value: "payHigh",      label: "Pay: High → Low" },
                      { value: "payLow",       label: "Pay: Low → High" },
                      { value: "dateNewest",   label: "Date Posted: Newest" },
                      { value: "dateOldest",   label: "Date Posted: Oldest" },
                      ...(studentLocation ? [
                        { value: "distanceNear", label: "Distance: Closest → Furthest" },
                        { value: "distanceFar",  label: "Distance: Furthest → Closest" },
                      ] : []),
                    ].map(({ value, label }) => (
                      <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", cursor: "pointer", fontSize: "0.85rem", fontWeight: sortBy === value ? 700 : 500, color: sortBy === value ? "var(--color-brand)" : "var(--color-text-body, #374151)" }}>
                        <input type="radio" name="sortByAbove" checked={sortBy === value} onChange={() => { setSortBy(value); setSortDropdownOpen(false); }} style={{ cursor: "pointer", accentColor: "var(--color-brand)" }} />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Mobile filter panel */}
            {isMobile && mobileFiltersOpen && (
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "1rem", marginBottom: "0.75rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                <FilterPanel {...filterPanelProps} onApply={() => setMobileFiltersOpen(false)} />
              </div>
            )}

            {/* States */}
            {jobsError && !jobsLoading && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #6b7280)", background: "var(--color-bg-elevated, white)", borderRadius: "1rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#ef4444", marginBottom: "0.4rem" }}>Couldn't load jobs</p>
                <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>Check your connection and try again.</p>
                <button
                  onClick={() => {
                    setJobsError(false);
                    setJobsLoading(true);
                    fetchJobPage(0)
                      .catch(e => { console.error("[StudentDashboard] jobs error:", e); setJobsError(true); })
                      .finally(() => setJobsLoading(false));
                  }}
                  style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Retry
                </button>
              </div>
            )}
            {jobsLoading && <JobCardsSkeleton />}
            {!jobsLoading && !jobsError && sortedJobs.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #6b7280)", background: "var(--color-bg-elevated, white)", borderRadius: "1rem" }}>
                {hasActiveFilters ? (
                  <>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.4rem" }}>No jobs match your filters</p>
                    <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem", color: "var(--color-text-secondary, #6b7280)" }}>
                      {firstBlockingFilter
                        ? <><strong style={{ color: "var(--color-text-body, #374151)" }}>{firstBlockingFilter}</strong> has no matches — try widening it.</>
                        : "Try removing some filters."}
                    </p>
                    <button onClick={clearAll} style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dark))", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Clear All Filters
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📋</div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.4rem" }}>No jobs available right now</p>
                    <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #6b7280)" }}>Check back soon — new shifts are posted regularly.</p>
                  </>
                )}
              </div>
            )}

            {/* Job cards */}
            <div role="list" className="job-list-grid" style={{ display: "grid", gridTemplateColumns: gridCols === 2 ? "1fr 1fr" : "1fr", gap: "0.85rem" }}>
              {sortedJobs.map(job => {
                const isLiked   = likedJobs.some(j => j.id === job.id);
                const isApplied = appliedJobs.some(j => j.id === job.id);
                const isNew     = job.createdAt && (Date.now() - new Date(job.createdAt)) < 48 * 60 * 60 * 1000;
                const dist      = jobDistance(job);
                const dl        = job.deadline;
                const dlDays    = daysUntil(dl);
                const dlSoon    = dlDays !== null && dlDays <= 7 && dlDays >= 0;
                const rawPhoto  = job.photos?.[0] || null;
                const photo     = supabaseImg(rawPhoto, 400);
                const crop      = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

                const openJob = () => {
                  setSelectedJob(job);
                  setPage("jobDetails");
                  if (window.gtag) window.gtag("event", "view_item", { item_id: job.id, item_name: job.title, item_category: job.category });
                };
                return (
                  <div key={job.id} role="listitem" className="job-card" onClick={openJob} style={{ display: "flex", flexDirection: "row", alignItems: "stretch", padding: 0, overflow: "hidden", marginBottom: 0, cursor: "pointer" }}>

                    {/* Square photo */}
                    <div style={{ width: isPhone ? "100px" : "180px", flexShrink: 0, alignSelf: "stretch", position: "relative", overflow: "hidden", borderRadius: "1rem 0 0 0" }}>
                      {photo ? (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
                          <img loading="lazy" src={photo} alt={`${job.title} at ${job.company}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ) : (
                        /* #7 — brand-tint gradient placeholder with initials */
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #fce7f3 0%, #f5d0e3 100%)" }}>
                          <span style={{ fontSize: isPhone ? "1.5rem" : "2.2rem", fontWeight: 800, color: "var(--color-brand)", opacity: 0.7, letterSpacing: "-0.03em", userSelect: "none" }}>
                            {(job.company || "?").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* #9 — NEW ribbon in top-right corner of photo */}
                      {isNew && !job.isUrgent && (
                        <div style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "var(--color-brand)", color: "white", fontSize: "0.6rem", fontWeight: 800, padding: "0.15rem 0.45rem", borderRadius: "0.3rem", letterSpacing: "0.06em", lineHeight: 1.4, boxShadow: "0 2px 6px rgba(162,29,84,0.45)" }}>
                          NEW
                        </div>
                      )}
                    </div>

                    {/* Middle info */}
                    <div style={{ flex: 1, padding: isPhone ? "0.65rem 0.7rem" : "1.1rem 1.4rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      {/* Top: title + company + pills */}
                      <div>
                        <h2 style={{ fontWeight: 800, fontSize: isPhone ? "1.0rem" : "1.5rem", margin: "0 0 0.15rem", color: "var(--color-text-primary, #1e293b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</h2>
                        <p style={{ margin: isPhone ? "0 0 0.35rem" : "0 0 0.6rem", fontSize: isPhone ? "0.78rem" : "1.1rem", color: "var(--color-text-secondary, #6b7280)" }}>
                          <button onClick={e => { e.stopPropagation(); navigate(`/companies/${job.companyId}`); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontSize: "inherit", fontFamily: "inherit", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "2px" }}>{job.company}</button>
                          {" · "}{job.location}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {job.days.map(day => {
                            const isFilled = (job.filledShifts || []).includes(day);
                            return (
                              <span key={day} className={`badge ${isFilled ? "badge-gray" : "badge-brand"} ${isPhone ? "badge-sm" : "badge-lg"}`} style={{ textDecoration: isFilled ? "line-through" : "none" }} title={isFilled ? "This shift has been filled" : undefined}>
                                {day.slice(0, 3)} · {job.times[day]?.join(", ")}{isFilled ? " ✓" : ""}
                              </span>
                            );
                          })}
                        </div>
                        {(job.filledShifts || []).length > 0 && (
                          <p style={{ margin: "0.25rem 0 0", fontSize: isPhone ? "0.68rem" : "0.75rem", color: "var(--color-text-secondary, #6b7280)", fontWeight: 500 }}>
                            {job.filledShifts.length} of {job.days.length} shift{job.days.length !== 1 ? "s" : ""} filled
                          </p>
                        )}
                        {dist !== null && (
                          <div style={{ marginTop: "0.3rem" }}>
                            <span className={`badge badge-green ${isPhone ? "badge-sm" : ""}`}>
                              📍 {formatDistance(dist)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Bottom: pay + deadline + updated */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                        {/* #8 — pay as primary visual attribute */}
                        <span style={{ fontWeight: 800, color: "var(--color-brand)", fontSize: isPhone ? "0.95rem" : "1.35rem", letterSpacing: "-0.01em" }}>
                          <span style={{ opacity: 0.6, fontWeight: 700 }}>€</span>{job.pay.replace(/€/g, "")}
                        </span>
                        {isNew && !job.isUrgent && (
                          <span className={`badge badge-green ${isPhone ? "badge-sm" : ""}`} title="Posted in the last 48 hours">
                            NEW
                          </span>
                        )}
                        {job.isUrgent && (
                          <span className={`badge badge-red ${isPhone ? "badge-sm" : ""}`} title="Urgent — shift needs filling today">
                            URGENT
                          </span>
                        )}
                        {(() => {
                          const avg = categoryAvgPay[job.category];
                          const mine = payNum(job.pay);
                          if (!avg || !mine || isPhone) return null;
                          const aboveAvg = mine > avg;
                          return (
                            <span
                              className={`badge ${aboveAvg ? "badge-green" : "badge-gray"} badge-sm`}
                              title={`Market average for ${job.category}: €${avg}/hr`}
                            >
                              {aboveAvg ? "↑" : "≈"} Avg €{avg}/hr
                            </span>
                          );
                        })()}
                        {dl && (() => {
                          if (dlDays !== null && dlDays <= 3 && dlDays >= 0) {
                            return <span className={`badge badge-red ${isPhone ? "badge-sm" : ""}`}>🔴 Closes in {dlDays === 0 ? "today" : `${dlDays} day${dlDays !== 1 ? "s" : ""}`}</span>;
                          }
                          return <span className={`badge ${dlSoon ? "badge-yellow" : "badge-gray"} ${isPhone ? "badge-sm" : ""}`}>Closes {deadlineLabel(dl)}</span>;
                        })()}
                        {job.updatedAt && (
                          <span style={{ fontSize: isPhone ? "0.65rem" : "0.72rem", color: "var(--color-text-secondary, #64748b)", marginLeft: "auto" }}>
                            Updated {new Date(job.updatedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                      {/* Social proof + match score + job alerts */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.2rem", flexWrap: "wrap" }}>
                        {(applicantCounts[job.id] ?? 0) > 0 && (
                          <span style={{ fontSize: isPhone ? "0.65rem" : "0.72rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 500 }}>
                            👥 {applicantCounts[job.id]} applicant{applicantCounts[job.id] !== 1 ? "s" : ""}
                          </span>
                        )}
                        {(() => {
                          const score = jobMatchScore(job);
                          if (!score || !currentUser || currentUser.role !== "student") return null;
                          const pct = Math.min(100, Math.round((score / 100) * 100));
                          if (pct < 20) return null;
                          return <span style={{ fontSize: isPhone ? "0.62rem" : "0.68rem", fontWeight: 700, color: "var(--color-brand)", backgroundColor: "#fce7f3", borderRadius: "999px", padding: "0.1rem 0.4rem", flexShrink: 0 }}>{pct}% match</span>;
                        })()}
                        {featuredCompanyIds.has(job.companyId) && (
                          <span style={{ fontSize: isPhone ? "0.62rem" : "0.68rem", fontWeight: "700", color: "#854d0e", backgroundColor: "#fef9c3", borderRadius: "999px", padding: "0.1rem 0.4rem", flexShrink: 0 }}>⭐ Featured</span>
                        )}
                        {(() => {
                          const hrs = companyResponseRates[job.companyId];
                          if (!hrs) return null;
                          const label = hrs < 1 ? `${Math.round(hrs * 60)}m reply` : hrs <= 24 ? `${hrs}h reply` : null;
                          if (!label) return null;
                          return <span style={{ fontSize: isPhone ? "0.62rem" : "0.68rem", color: "#16a34a", fontWeight: "600", flexShrink: 0 }}>⚡ {label}</span>;
                        })()}
                        <button
                          onClick={e => { e.stopPropagation(); const next = !jobAlerts; setJobAlerts(next); try { localStorage.setItem("ss_job_alerts", next ? "1" : "0"); } catch { /* ignore */ } }}
                          title={jobAlerts ? "Job alerts on — you'll be notified of new matching jobs" : "Get notified when similar jobs are posted (coming soon)"}
                          aria-label={jobAlerts ? "Disable job alerts" : "Enable job alerts"}
                          style={{ marginLeft: "auto", padding: "0.1rem 0.4rem", borderRadius: "999px", border: `1px solid ${jobAlerts ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, background: jobAlerts ? "#fce7f3" : "var(--color-bg-elevated, white)", color: jobAlerts ? "var(--color-brand)" : "var(--color-text-secondary, #94a3b8)", fontSize: "0.62rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, whiteSpace: "nowrap" }}
                        >{jobAlerts ? "🔔 Alerts on" : "🔔 Alert me"}</button>
                      </div>
                    </div>

                    {/* Right: heart / applied icon */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleLike(job); }}
                      disabled={isApplied}
                      title={isApplied ? "You’ve already applied" : isLiked ? "Remove from liked" : "Save job"}
                      aria-label={isApplied ? "Already applied" : isLiked ? "Remove from liked jobs" : "Save job"}
                      style={{ width: isPhone ? "54px" : "90px", flexShrink: 0, alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderLeft: "1.5px solid #f1f5f9", cursor: isApplied ? "default" : "pointer", padding: 0, margin: 0, borderRadius: "0 1rem 1rem 0" }}
                    >
                      {isApplied ? (
                        <svg width={isPhone ? "26" : "40"} height={isPhone ? "26" : "40"} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : isLiked ? (
                        <svg width={isPhone ? "26" : "40"} height={isPhone ? "26" : "40"} viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      ) : (
                        <svg width={isPhone ? "26" : "40"} height={isPhone ? "26" : "40"} viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ textAlign: "center", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{ padding: "0.65rem 2rem", borderRadius: "2rem", border: "1.5px solid var(--color-brand)", background: "var(--color-bg-elevated, white)", color: "var(--color-brand)", fontWeight: 700, fontSize: "0.9rem", fontFamily: "inherit", cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.7 : 1 }}
                >
                  {loadingMore ? "Loading…" : "Load more jobs"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          style={{
            position: "fixed", bottom: isMobile ? "80px" : "2rem", right: "1.25rem",
            width: "44px", height: "44px", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
            border: "none", color: "white", fontSize: "1.2rem",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(162,29,84,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 150,
          }}
        >
          ↑
        </button>
      )}

      <StudentOnboarding />
    </div>
  );
}

function FilterSection({ title, open, onToggle, onClear, children }) {
  const [everOpened, setEverOpened] = useState(open);
  useEffect(() => { if (open) setEverOpened(true); }, [open]);
  return (
    <div className="filter-section-header" style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.65rem", padding: "0.5rem 0.75rem", marginBottom: "0.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? "0.5rem" : 0 }}>
        <button
          onClick={onToggle}
          aria-expanded={open}
          style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none", padding: "0.2rem 0", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary, #1e293b)", fontFamily: "inherit", textAlign: "left", flex: 1 }}
        >
          <span>{title}</span>
          <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary, #64748b)", marginLeft: "0.2rem" }}>{open ? "▲" : "▼"}</span>
        </button>
        {onClear && (
          <button onClick={e => { e.stopPropagation(); onClear(); }} style={{ fontSize: "0.7rem", color: "#e11d48", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: "0.1rem 0.25rem", fontFamily: "inherit" }}>
            Clear
          </button>
        )}
      </div>
      {everOpened && <div style={{ display: open ? "block" : "none" }}>{children}</div>}
    </div>
  );
}

function Pip({ n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-brand)", color: "white", borderRadius: "999px", fontSize: "0.62rem", fontWeight: 700, minWidth: "16px", height: "16px", padding: "0 0.25rem", marginLeft: "0.3rem" }}>
      {n}
    </span>
  );
}

function SmoothSlider({ value, onChange, max = 50 }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);
  const onChangeRef = useRef(onChange);
  const maxRef = useRef(max);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { maxRef.current = max; }, [max]);

  const valueFromClientX = (clientX) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChangeRef.current(Math.round(ratio * maxRef.current));
  };

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) valueFromClientX(e.clientX); };
    const onUp   = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, []);

  const pct = (value / max) * 100;

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => { e.preventDefault(); dragging.current = true; valueFromClientX(e.clientX); }}
      style={{ position: "relative", height: "6px", borderRadius: "999px", background: `linear-gradient(to right, var(--color-brand) ${pct}%, #e2e8f0 ${pct}%)`, cursor: "pointer", margin: "0.75rem 0", userSelect: "none", touchAction: "none" }}
    >
      <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%, -50%)", width: "18px", height: "18px", borderRadius: "50%", backgroundColor: "var(--color-brand)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", pointerEvents: "none" }} />
    </div>
  );
}
