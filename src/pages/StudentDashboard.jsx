import { useState, useRef, useEffect, useCallback } from "react";
import "../StudentShiftWeb.css";
import { jobCategories, getCategoryForTitle } from "../data/jobCategories";
import { haversineDistance, formatDistance, mockLocationCoords, geocodeAddress } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";
import { likeJob, unlikeJob } from "../lib/auth";

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
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

const _geocodeCache = {};

export default function StudentDashboard({
  setPage, setSelectedJob, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs,
  currentUser, studentLocation, savedLikedJobIds, savedAppliedJobIds, restoreScrollY,
}) {
  const [jobs,         setJobs]         = useState([]);
  const [jobsLoading,  setJobsLoading]  = useState(true);
  const [jobsError,    setJobsError]    = useState(false);
  const [extraCoords,  setExtraCoords]  = useState(_geocodeCache);
  const [windowWidth,  setWindowWidth]  = useState(window.innerWidth);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const searchInputRef = useRef(null);
  const sortDropdownRef = useRef(null);
  // Saved searches: [{ name, filters }]
  const ssKey = "ss_saved_searches_" + (currentUser?.id || "guest");
  const [savedSearches,    setSavedSearches]    = useState(() => { try { return JSON.parse(localStorage.getItem(ssKey) || "[]"); } catch { return []; } });
  const [justSaved,        setJustSaved]        = useState(false);
  const [gridCols,         setGridCols]         = useState(1);

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handler = e => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) setSortDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isMobile = windowWidth < 768;

  useEffect(() => {
    withTimeout(
      supabase.from("jobs").select("*").eq("status", "Active").order("created_at", { ascending: false }),
      10000, "Loading jobs timed out."
    ).then(async ({ data, error }) => {
      if (error) { setJobsError(true); setJobsLoading(false); return; }
      if (!data || data.length === 0) { setJobsLoading(false); return; }
      const today = new Date().toISOString().split("T")[0];
      const liveJobs = data.filter(j => !j.deadline || j.deadline >= today);
      if (liveJobs.length === 0) { setJobsLoading(false); return; }
      const companyIds = [...new Set(liveJobs.map(j => j.company_id))];
      let nameMap = {};
      try {
        const { data: profiles } = await withTimeout(supabase.from("profiles").select("id, name").in("id", companyIds), 8000);
        if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });
      } catch (_) {}
      setJobs(liveJobs.map(j => ({
        id:              j.id,
        title:           j.title,
        company:         nameMap[j.company_id] || "Unknown Company",
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
        photos:          j.photos || [],
        photoCrops:      j.photo_crops || [],
        status:          j.status,
      })));
      setJobsLoading(false);
    }).catch(e => { console.error("[StudentDashboard] jobs error:", e); setJobsError(true); setJobsLoading(false); });
  }, []);

  useEffect(() => {
    if (!jobs.length || !currentUser) return;
    if (savedLikedJobIds?.length)   setLikedJobs(jobs.filter(j => savedLikedJobIds.includes(j.id)));
    if (savedAppliedJobIds?.length) setAppliedJobs(jobs.filter(j => savedAppliedJobIds.includes(j.id)));
  }, [jobs, currentUser?.id]);

  useEffect(() => {
    if (restoreScrollY > 0) requestAnimationFrame(() => window.scrollTo(0, restoreScrollY));
  }, []);

  // Geocode missing locations
  useEffect(() => {
    if (!jobs.length) return;
    const unknown = [...new Set(
      jobs.filter(j => !j.lat || !j.lng).map(j => j.location)
        .filter(loc => loc && !mockLocationCoords[loc] && !_geocodeCache[loc])
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
            _geocodeCache[loc] = { lat: result.lat, lng: result.lng };
            setExtraCoords(prev => ({ ...prev, [loc]: { lat: result.lat, lng: result.lng } }));
          }
        } catch (_) {}
        if (!cancelled) await new Promise(r => setTimeout(r, 1200));
      }
    })();
    return () => { cancelled = true; };
  }, [jobs]);

  const getJobCoords = (job) => {
    if (job.lat && job.lng) return { lat: job.lat, lng: job.lng };
    return mockLocationCoords[job.location] || extraCoords[job.location] || null;
  };

  const jobDistance = useCallback((job) => {
    if (!studentLocation) return null;
    const coords = getJobCoords(job);
    if (!coords) return null;
    return haversineDistance(studentLocation.lat, studentLocation.lng, coords.lat, coords.lng);
  }, [studentLocation, extraCoords]);

  // Filter state
  const weekdays  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const workweek  = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const timeSlots = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
  const allLocations = [...new Set(jobs.map(j => j.location))].sort();

  const [prefOnly,          setPrefOnly]          = useState(false);
  const [selectedDays,      setSelectedDays]      = useState([]);
  const [dayTimes,          setDayTimes]          = useState({});
  const [warning,           setWarning]           = useState("");
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedJobTypes,  setSelectedJobTypes]  = useState([]);
  const [weekendOnly,       setWeekendOnly]       = useState(false);
  const [allWeekOnly,       setAllWeekOnly]       = useState(false);
  const [noWeekends,        setNoWeekends]        = useState(false);
  const [distanceKm,        setDistanceKm]        = useState(0);
  const [searchQuery,       setSearchQuery]       = useState("");
  const [sortBy,            setSortBy]            = useState("");

  // Sidebar section collapse state (all open by default)
  const [openSections, setOpenSections] = useState({ sort: true, days: true, location: false, jobType: false, schedule: true, distance: true });
  const toggleSection = (k) => setOpenSections(p => ({ ...p, [k]: !p[k] }));

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
    setWeekendOnly(false); setAllWeekOnly(false); setNoWeekends(false);
    setDistanceKm(0); setSearchQuery(""); setSortBy(""); setWarning("");
  };

  const currentFilters = () => ({
    selectedDays, dayTimes, selectedLocations, selectedJobTypes,
    weekendOnly, allWeekOnly, noWeekends, distanceKm, sortBy, prefOnly,
    searchQuery,
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
  };

  const saveSearch = () => {
    const name = searchQuery.trim() || `Search ${savedSearches.length + 1}`;
    if (savedSearches.some(s => s.name === name)) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
      return;
    }
    const updated = [...savedSearches, { name, filters: currentFilters() }];
    setSavedSearches(updated);
    localStorage.setItem(ssKey, JSON.stringify(updated));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const deleteSearch = (i) => {
    const updated = savedSearches.filter((_, idx) => idx !== i);
    setSavedSearches(updated);
    localStorage.setItem(ssKey, JSON.stringify(updated));
  };

  const hasActiveFilters = selectedDays.length > 0 || selectedLocations.length > 0 || selectedJobTypes.length > 0 || weekendOnly || allWeekOnly || noWeekends || distanceKm > 0 || searchQuery.trim() !== "";
  const activeFilterCount = (selectedDays.length > 0 ? 1 : 0) + (selectedLocations.length > 0 ? 1 : 0) + (selectedJobTypes.length > 0 ? 1 : 0) + (weekendOnly ? 1 : 0) + (allWeekOnly ? 1 : 0) + (noWeekends ? 1 : 0) + (distanceKm > 0 ? 1 : 0);

  const userPrefs = currentUser?.jobPreferences || [];

  // Filter logic (time filter uses >= not exact match)
  const filteredJobs = jobs.filter(job => {
    if (prefOnly && userPrefs.length > 0) {
      const cat = getCategoryForTitle(job.title);
      if (!cat || !userPrefs.includes(cat)) return false;
    }
    if (selectedDays.length > 0) {
      const daysMatch = selectedDays.every(day => {
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!job.title.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const payNum = (p) => parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
  const displayJobs = sortBy === "" ? filteredJobs : [...filteredJobs].sort((a, b) => {
    if (sortBy === "payHigh")     return payNum(b.pay) - payNum(a.pay);
    if (sortBy === "payLow")      return payNum(a.pay) - payNum(b.pay);
    if (sortBy === "dateNewest")  return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === "dateOldest")  return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === "distanceNear") { const da = jobDistance(a) ?? Infinity;  const db = jobDistance(b) ?? Infinity;  return da - db; }
    if (sortBy === "distanceFar")  { const da = jobDistance(a) ?? -Infinity; const db = jobDistance(b) ?? -Infinity; return db - da; }
    return 0;
  });

  const toggleLike = (job) => {
    if (!currentUser) { setPage("login"); return; }
    if (appliedJobs.some(j => j.id === job.id)) return;
    const isLiked = likedJobs.some(j => j.id === job.id);
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
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

  // Sidebar / filter panel content
  const FilterPanel = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

      {/* Days & Times */}
      <FilterSection title={<>Days &amp; Times {selectedDays.length > 0 && <Pip n={selectedDays.length} />}</>} open={openSections.days} onToggle={() => toggleSection("days")}>
        {warning && <p style={{ color: "#ef4444", fontSize: "0.76rem", marginBottom: "0.4rem" }}>{warning}</p>}
        {weekdays.map(day => (
          <div key={day} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <input type="checkbox" id={`sd-${day}`} checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} style={{ cursor: "pointer", width: "14px", height: "14px", accentColor: "#6366f1" }} />
            <label htmlFor={`sd-${day}`} style={{ fontWeight: 500, minWidth: "85px", cursor: "pointer", fontSize: "0.83rem" }}>{day}</label>
            <select
              value={dayTimes[day] || ""} onChange={e => updateTime(day, e.target.value)}
              disabled={!selectedDays.includes(day)}
              style={{ padding: "0.15rem 0.3rem", borderRadius: "0.4rem", border: "1px solid #d1d5db", fontSize: "0.75rem", color: selectedDays.includes(day) ? "#111827" : "#9ca3af", cursor: selectedDays.includes(day) ? "pointer" : "not-allowed", backgroundColor: selectedDays.includes(day) ? "white" : "#f9fafb", flex: 1 }}
            >
              <option value="">Any time</option>
              {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        ))}
      </FilterSection>

      {/* Location */}
      <FilterSection title={<>Location {selectedLocations.length > 0 && <Pip n={selectedLocations.length} />}</>} open={openSections.location} onToggle={() => toggleSection("location")}>
        {allLocations.map(loc => (
          <label key={loc} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500 }}>
            <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLocation(loc)} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "#6366f1" }} />
            {loc}
          </label>
        ))}
      </FilterSection>

      {/* Job Type */}
      <FilterSection title={<>Job Type {selectedJobTypes.length > 0 && <Pip n={selectedJobTypes.length} />}</>} open={openSections.jobType} onToggle={() => toggleSection("jobType")}>
        {Object.keys(jobCategories).map(type => (
          <label key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: 500 }}>
            <input type="checkbox" checked={selectedJobTypes.includes(type)} onChange={() => toggleJobType(type)} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "#6366f1" }} />
            {type}
          </label>
        ))}
      </FilterSection>

      {/* Schedule */}
      <FilterSection title="Schedule" open={openSections.schedule} onToggle={() => toggleSection("schedule")}>
        {[
          { label: "Weekend Work", active: weekendOnly, toggle: () => setWeekendOnly(p => !p) },
          { label: "All Week",     active: allWeekOnly, toggle: () => setAllWeekOnly(p => !p) },
          { label: "No Weekends",  active: noWeekends,  toggle: () => setNoWeekends(p => !p) },
        ].map(({ label, active, toggle }) => (
          <label key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer", fontSize: "0.83rem", fontWeight: active ? 700 : 500, color: active ? "#4f46e5" : "#374151" }}>
            <input type="checkbox" checked={active} onChange={toggle} style={{ width: "14px", height: "14px", cursor: "pointer", accentColor: "#6366f1" }} />
            {label}
          </label>
        ))}
      </FilterSection>

      {/* Distance */}
      <FilterSection title="Distance" open={openSections.distance} onToggle={() => toggleSection("distance")}>
        {studentLocation ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.81rem", color: "#374151", fontWeight: 500 }}>{distanceKm === 0 ? "Any distance" : `Within ${distanceKm} km`}</span>
              {distanceKm > 0 && <button onClick={() => setDistanceKm(0)} style={{ fontSize: "0.72rem", color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0, fontFamily: "inherit" }}>Reset</button>}
            </div>
            <SmoothSlider value={distanceKm} onChange={setDistanceKm} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#9ca3af" }}>
              <span>0 km</span><span>25 km</span><span>50 km</span>
            </div>
          </>
        ) : (
          <p style={{ fontSize: "0.78rem", color: "#9ca3af", fontStyle: "italic", margin: 0 }}>Save your location in Account to filter by distance.</p>
        )}
      </FilterSection>

      {/* Clear */}
      {(hasActiveFilters || sortBy !== "") && (
        <button onClick={clearAll} style={{ padding: "0.55rem", borderRadius: "0.6rem", border: "1.5px solid #fda4af", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: 700, fontSize: "0.83rem", cursor: "pointer", fontFamily: "inherit", width: "100%" }}>
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", fontFamily: "'Poppins', sans-serif" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "1.5rem 1.25rem" }}>

        {/* Page heading */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: "1.85rem", color: "#1e293b" }}>Find Your Shift</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Browse student-friendly jobs across Galway</p>
        </div>

        {/* Location nudge */}
        {currentUser?.role === "student" && !studentLocation && (
          <div onClick={() => setPage("account")} style={{ display: "flex", alignItems: "center", gap: "0.6rem", backgroundColor: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: "0.75rem", padding: "0.6rem 1rem", marginBottom: "1rem", cursor: "pointer" }}>
            <span style={{ fontSize: "1.1rem" }}>📍</span>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#1d4ed8", fontWeight: 600, lineHeight: 1.4 }}>
              Set your location in Account to see how far each job is from you.
            </p>
          </div>
        )}

        {/* Preference tabs */}
        {currentUser?.role === "student" && userPrefs.length > 0 && (
          <div style={{ display: "flex", backgroundColor: "#e8edf5", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1rem", gap: "0.25rem" }}>
            {[{ val: false, label: "All Jobs" }, { val: true, label: "My Preferences" }].map(({ val, label }) => (
              <button key={String(val)} onClick={() => setPrefOnly(val)} style={{ flex: 1, padding: "0.55rem", borderRadius: "0.6rem", border: "none", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit", backgroundColor: prefOnly === val ? "white" : "transparent", color: prefOnly === val ? "#6366f1" : "#64748b", boxShadow: prefOnly === val ? "0 1px 6px rgba(0,0,0,0.1)" : "none" }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Main layout: sidebar + jobs */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>

          {/* Sidebar — desktop only */}
          {!isMobile && (
            <aside style={{ width: "260px", flexShrink: 0, position: "sticky", top: "88px" }}>
              <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1rem", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <FilterPanel />
              </div>
            </aside>
          )}

          {/* Job list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Search bar */}
            <div style={{ marginBottom: "0.9rem" }}>
              <input
                ref={searchInputRef}
                placeholder="Search by job title or company…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b", backgroundColor: "white", outline: "none" }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
            </div>

            {/* Saved search chips */}
            {savedSearches.length > 0 && (
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                {savedSearches.map((s, i) => (
                  <button key={i} onClick={() => applyFilters(s.filters)} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.5rem 0.25rem 0.7rem", borderRadius: "999px", border: "1.5px solid #c7d2fe", backgroundColor: "#eef2ff", color: "#4f46e5", fontSize: "0.77rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ⭐ {s.name}
                    <span role="button" onClick={e => { e.stopPropagation(); deleteSearch(i); }} style={{ marginLeft: "0.1rem", color: "#a5b4fc", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1, cursor: "pointer", padding: "0 0.1rem" }}>×</span>
                  </button>
                ))}
              </div>
            )}

            {/* Job count + grid toggle + Sort By */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#4f46e5", backgroundColor: "#eef2ff", padding: "0.25rem 0.7rem", borderRadius: "999px" }}>
                  {displayJobs.length} job{displayJobs.length !== 1 ? "s" : ""}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", backgroundColor: "#f1f5f9", borderRadius: "0.6rem", padding: "0.2rem" }}>
                  <button onClick={() => setGridCols(1)} title="Single column" style={{ padding: "0.28rem 0.5rem", border: "none", borderRadius: "0.4rem", cursor: "pointer", backgroundColor: gridCols === 1 ? "white" : "transparent", color: gridCols === 1 ? "#6366f1" : "#94a3b8", fontWeight: 700, fontSize: "1rem", boxShadow: gridCols === 1 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▤</button>
                  <button onClick={() => setGridCols(2)} title="Two columns" style={{ padding: "0.28rem 0.5rem", border: "none", borderRadius: "0.4rem", cursor: "pointer", backgroundColor: gridCols === 2 ? "white" : "transparent", color: gridCols === 2 ? "#6366f1" : "#94a3b8", fontWeight: 700, fontSize: "1rem", boxShadow: gridCols === 2 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▦</button>
                </div>
                {/* Save search button — auto-saves using search bar text as name */}
                <button
                  onClick={saveSearch}
                  title="Save current search"
                  style={{ padding: "0.28rem 0.55rem", border: `1.5px solid ${justSaved ? "#6366f1" : "#e2e8f0"}`, borderRadius: "0.4rem", cursor: "pointer", backgroundColor: justSaved ? "#eef2ff" : "white", color: justSaved ? "#6366f1" : "#94a3b8", fontWeight: 700, fontSize: "0.95rem", lineHeight: 1, fontFamily: "inherit" }}
                >⭐</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {isMobile && (
                <button
                  onClick={() => setMobileFiltersOpen(o => !o)}
                  style={{ padding: "0.42rem 1rem", borderRadius: "2rem", border: `1.5px solid ${activeFilterCount > 0 ? "#6366f1" : "#e2e8f0"}`, backgroundColor: activeFilterCount > 0 ? "#eef2ff" : "white", color: activeFilterCount > 0 ? "#4f46e5" : "#64748b", fontWeight: activeFilterCount > 0 ? 700 : 500, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap" }}
                >
                  Filters {activeFilterCount > 0 && <Pip n={activeFilterCount} />} {mobileFiltersOpen ? "▲" : "▼"}
                </button>
              )}
              <div style={{ position: "relative" }} ref={sortDropdownRef}>
                <button
                  onClick={() => setSortDropdownOpen(o => !o)}
                  style={{ padding: "0.42rem 1rem", borderRadius: "2rem", border: `1.5px solid ${sortBy ? "#6366f1" : "#e2e8f0"}`, backgroundColor: sortBy ? "#eef2ff" : "white", color: sortBy ? "#4f46e5" : "#64748b", fontWeight: sortBy ? 700 : 500, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                >
                  {sortLabel[sortBy] || "Sort by"} ▾
                </button>
                {sortDropdownOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 0.4rem)", right: 0, zIndex: 50, backgroundColor: "white", border: "1.5px solid #e5e7eb", borderRadius: "0.75rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "0.5rem 0.75rem", minWidth: "210px" }}>
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
                      <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", cursor: "pointer", fontSize: "0.85rem", fontWeight: sortBy === value ? 700 : 500, color: sortBy === value ? "#4f46e5" : "#374151" }}>
                        <input type="radio" name="sortByAbove" checked={sortBy === value} onChange={() => { setSortBy(value); setSortDropdownOpen(false); }} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
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
              <div style={{ backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1rem", marginBottom: "0.75rem", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                <FilterPanel />
              </div>
            )}

            {/* States */}
            {jobsError && !jobsLoading && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280", background: "white", borderRadius: "1rem" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "#ef4444" }}>Couldn't load jobs</p>
                <p style={{ fontSize: "0.875rem" }}>Check your connection and refresh the page.</p>
              </div>
            )}
            {jobsLoading && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280", background: "white", borderRadius: "1rem" }}>
                <div style={{ width: "36px", height: "36px", border: "4px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
                <p style={{ fontWeight: 600 }}>Loading jobs…</p>
              </div>
            )}
            {!jobsLoading && !jobsError && displayJobs.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280", background: "white", borderRadius: "1rem" }}>
                <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.4rem" }}>No jobs match your filters</p>
                <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>
                  {searchQuery.trim() ? `No results for "${searchQuery}"` : "Try removing some filters."}
                </p>
                <button onClick={clearAll} style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Clear All Filters
                </button>
              </div>
            )}

            {/* Job cards */}
            <div className="job-list-grid" style={{ display: "grid", gridTemplateColumns: gridCols === 2 ? "1fr 1fr" : "1fr", gap: "0.85rem" }}>
              {displayJobs.map(job => {
                const isLiked   = likedJobs.some(j => j.id === job.id);
                const isApplied = appliedJobs.some(j => j.id === job.id);
                const dist      = jobDistance(job);
                const dl        = job.deadline;
                const dlDays    = daysUntil(dl);
                const dlSoon    = dlDays !== null && dlDays <= 7 && dlDays >= 0;
                const photo     = job.photos?.[0] || null;
                const crop      = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };

                return (
                  <div key={job.id} className="job-card" style={{ display: "flex", alignItems: "stretch", padding: 0, overflow: "hidden", marginBottom: 0, cursor: "default" }}>

                    {/* Square photo */}
                    <div style={{ width: "120px", height: "120px", flexShrink: 0, alignSelf: "flex-start", position: "relative", overflow: "hidden", borderRadius: "1rem 0 0 0" }}>
                      {photo ? (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `translate(${crop.offsetX}%, ${crop.offsetY}%) scale(${crop.zoom})`, transformOrigin: "center" }}>
                          <img src={photo} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ) : (
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" }}>
                          <span style={{ fontSize: "2rem", opacity: 0.5 }}>🏢</span>
                        </div>
                      )}
                    </div>

                    {/* Middle info */}
                    <div style={{ flex: 1, padding: "0.85rem 1rem", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <h2 style={{ fontWeight: 800, fontSize: "1rem", margin: "0 0 0.15rem", color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</h2>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.83rem", color: "#6b7280" }}>{job.company} · {job.location}</p>
                      </div>

                      {/* Days / Times / Distance */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
                        {job.days.map(day => (
                          <span key={day} style={{ fontSize: "0.7rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 600 }}>
                            {day.slice(0, 3)} · {job.times[day]?.join(", ")}
                          </span>
                        ))}
                        {dist !== null && (
                          <span style={{ fontSize: "0.7rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 600 }}>
                            📍 {formatDistance(dist)}
                          </span>
                        )}
                      </div>

                      {/* Pay + deadline */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#111827", fontSize: "0.92rem" }}>{job.pay}</span>
                        {dl && (
                          <span style={{ fontSize: "0.68rem", padding: "0.1rem 0.45rem", borderRadius: "999px", fontWeight: 600, backgroundColor: dlSoon ? "#fef3c7" : "#f3f4f6", color: dlSoon ? "#d97706" : "#6b7280", border: `1px solid ${dlSoon ? "#fde68a" : "#e5e7eb"}` }}>
                            Closes {deadlineLabel(dl)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: action buttons */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.5rem", padding: "0.85rem 1rem 0.85rem 0", flexShrink: 0 }}>
                      <button
                        onClick={() => { setSelectedJob(job); setPage("jobDetails"); }}
                        style={{ padding: "0.45rem 1rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => toggleLike(job)}
                        disabled={isApplied}
                        style={{ padding: "0.4rem 1rem", borderRadius: "2rem", fontWeight: 700, fontSize: "0.78rem", cursor: isApplied ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap", border: isApplied ? "none" : (isLiked ? "none" : "2px solid #f43f5e"), backgroundColor: isApplied ? "#10b981" : (isLiked ? "#10b981" : "white"), color: isApplied ? "white" : (isLiked ? "white" : "#f43f5e") }}
                      >
                        {isApplied ? "✅" : (isLiked ? "✅" : "❤️")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", padding: "0.35rem 0", cursor: "pointer", fontWeight: 700, fontSize: "0.82rem", color: "#1e293b", fontFamily: "inherit", textAlign: "left", marginBottom: open ? "0.5rem" : 0 }}
      >
        <span>{title}</span>
        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div>{children}</div>}
      <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "0.6rem 0 0" }} />
    </div>
  );
}

function Pip({ n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#6366f1", color: "white", borderRadius: "999px", fontSize: "0.62rem", fontWeight: 700, minWidth: "16px", height: "16px", padding: "0 0.25rem", marginLeft: "0.3rem" }}>
      {n}
    </span>
  );
}

function SmoothSlider({ value, onChange, max = 50 }) {
  const trackRef = useRef(null);

  const calc = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(max, (clientX - r.left) / r.width * max)));
  };

  const pct = (value / max) * 100;

  return (
    <div
      ref={trackRef}
      onPointerDown={e => {
        e.preventDefault();
        trackRef.current.setPointerCapture(e.pointerId);
        onChange(calc(e.clientX));
      }}
      onPointerMove={e => {
        if (!trackRef.current.hasPointerCapture(e.pointerId)) return;
        onChange(calc(e.clientX));
      }}
      style={{ position: "relative", height: "24px", display: "flex", alignItems: "center", cursor: "pointer", userSelect: "none", touchAction: "none" }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, height: "5px", borderRadius: "3px", backgroundColor: "#e2e8f0" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#6366f1", borderRadius: "3px" }} />
      </div>
      <div style={{ position: "absolute", left: `${pct}%`, transform: "translateX(-50%)", width: "20px", height: "20px", borderRadius: "50%", backgroundColor: "white", border: "2.5px solid #6366f1", boxShadow: "0 1px 6px rgba(99,102,241,0.4)", pointerEvents: "none" }} />
    </div>
  );
}
