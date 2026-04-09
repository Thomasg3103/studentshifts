import React, { useState, useRef, useEffect } from "react";
import PageWrapper from "../components/PageWrapper";
import "../StudentShiftWeb.css";
import { jobCategories, getCategoryForTitle } from "../data/jobCategories";
import { haversineDistance, formatDistance, mockLocationCoords } from "../utils/geo";
import { supabase, withTimeout } from "../lib/supabase";

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


const COMPANY_PHOTOS = {
  "Galway Pub":     "https://picsum.photos/seed/galwaypub/800/140",
  "SuperMart":      "https://picsum.photos/seed/supermart/800/140",
  "Campus Library": "https://picsum.photos/seed/campuslibrary/800/140",
  "Galway Bistro":  "https://picsum.photos/seed/galwaybistro/800/140",
  "City Mall":      "https://picsum.photos/seed/citymall/800/140",
  "Coffee Hub":     "https://picsum.photos/seed/coffeehub/800/140",
  "City Hotel":     "https://picsum.photos/seed/cityhotel/800/140",
  "Tech Store":     "https://picsum.photos/seed/techstore/800/140",
  "City Bistro":    "https://picsum.photos/seed/citybistro/800/140",
};

function deadlineLabel(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-IE", { month: "short", day: "numeric" });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export default function StudentDashboard({
  setPage, setSelectedJob, likedJobs, setLikedJobs, appliedJobs, currentUser, studentLocation,
}) {

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    withTimeout(
      supabase
        .from("jobs")
        .select("*")
        .eq("status", "Active")
        .order("created_at", { ascending: false }),
      10000, "Loading jobs timed out."
    ).then(async ({ data, error }) => {
      if (error || !data || data.length === 0) { setJobsLoading(false); return; }

      // Fetch company names from profiles using the unique company_ids
      const companyIds = [...new Set(data.map(j => j.company_id))];
      let nameMap = {};
      try {
        const { data: profiles } = await withTimeout(
          supabase.from("profiles").select("id, name").in("id", companyIds),
          8000
        );
        if (profiles) profiles.forEach(p => { nameMap[p.id] = p.name; });
      } catch (_) {}

      setJobs(data.map(j => ({
        id:              j.id,
        title:           j.title,
        company:         nameMap[j.company_id] || "Unknown Company",
        location:        j.location,
        lat:             j.lat,
        lng:             j.lng,
        pay:             j.pay,
        description:     j.description || DESC[j.title] || "",
        deadline:        j.deadline || null,
        days:            j.days || [],
        times:           Object.fromEntries(Object.entries(j.times || {}).map(([k, v]) => [k, Array.isArray(v) ? v : [v]])),
        weekendRequired: j.weekend_required || false,
        photos:          j.photos || [],
        photoCrops:      j.photo_crops || [],
        status:          j.status,
      })));
      setJobsLoading(false);
    }).catch(e => { console.error("[StudentDashboard] jobs error:", e); setJobsLoading(false); });
  }, []);

  const weekdays    = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  const workweek    = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
  const timeSlots   = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
  const allLocations = [...new Set(jobs.map(j => j.location))].sort();

  const [selectedDays,    setSelectedDays]    = useState([]);
  const [dayTimes,        setDayTimes]        = useState({});
  const [warning,         setWarning]         = useState("");
  const [openDropdown,    setOpenDropdown]    = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedJobTypes,  setSelectedJobTypes]  = useState([]);
  const [weekendOnly,     setWeekendOnly]     = useState(false);
  const [allWeekOnly,     setAllWeekOnly]     = useState(false);
  const [noWeekends,      setNoWeekends]      = useState(false);
  const [distanceKm,      setDistanceKm]      = useState(0);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [sortBy,          setSortBy]          = useState("");
  const [gridCols,        setGridCols]        = useState(1);
  const [photoIndexes,    setPhotoIndexes]    = useState({});
  const [openSubSection,  setOpenSubSection]  = useState(null);
  const filterBarRef = useRef(null);

  const getJobCoords = (job) => {
    if (job.lat && job.lng) return { lat: job.lat, lng: job.lng };
    return mockLocationCoords[job.location] || null;
  };

  const jobDistance = (job) => {
    if (!studentLocation) return null;
    const coords = getJobCoords(job);
    if (!coords) return null;
    return haversineDistance(studentLocation.lat, studentLocation.lng, coords.lat, coords.lng);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    setSelectedDays([]);
    setDayTimes({});
    setSelectedLocations([]);
    setSelectedJobTypes([]);
    setWeekendOnly(false);
    setAllWeekOnly(false);
    setNoWeekends(false);
    setDistanceKm(0);
    setSearchQuery("");
    setSortBy("");
    setWarning("");
  };

  const hasActiveFilters = selectedDays.length > 0 || selectedLocations.length > 0 || selectedJobTypes.length > 0 || weekendOnly || allWeekOnly || noWeekends || distanceKm > 0 || searchQuery.trim() !== "";
  const activeFilterCount = (selectedDays.length > 0 ? 1 : 0) + (selectedLocations.length > 0 ? 1 : 0) + (selectedJobTypes.length > 0 ? 1 : 0) + (weekendOnly ? 1 : 0) + (allWeekOnly ? 1 : 0) + (noWeekends ? 1 : 0) + (distanceKm > 0 ? 1 : 0);

  const filteredJobs = jobs.filter(job => {
    if (selectedDays.length > 0) {
      const daysMatch = selectedDays.every(day => {
        if (!job.days.includes(day)) return false;
        if (dayTimes[day]) return job.times[day]?.includes(dayTimes[day]);
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

  const locationOrder = { "5 min walk": 0, "10 min walk": 1, "On-Campus": 2, "Near Campus": 3, "City Centre": 4, "Downtown": 5 };
  const locRank = (job) => locationOrder[job.location] ?? 99;

  const payNum = (p) => parseInt(p.replace(/[^0-9]/g, "")) || 0;
  const displayJobs = sortBy === "" ? filteredJobs : [...filteredJobs].sort((a, b) => {
    if (sortBy === "payHigh")      return payNum(b.pay) - payNum(a.pay);
    if (sortBy === "payLow")       return payNum(a.pay) - payNum(b.pay);
    if (sortBy === "distanceNear") return locRank(a) - locRank(b);
    if (sortBy === "distanceFar")  return locRank(b) - locRank(a);
    return 0;
  });

  const toggleLike = (job) => {
    if (!currentUser) { setPage("login"); return; }
    if (appliedJobs.some(j => j.id === job.id)) return;
    const isLiked = likedJobs.some(j => j.id === job.id);
    setLikedJobs(isLiked ? likedJobs.filter(j => j.id !== job.id) : [...likedJobs, job]);
  };


  const dropdownBtnStyle = (isActive) => ({
    padding: "0.45rem 1rem", borderRadius: "2rem",
    border: `1.5px solid ${isActive ? "#6366f1" : "#e2e8f0"}`,
    backgroundColor: isActive ? "#eef2ff" : "white",
    color: isActive ? "#4f46e5" : "#64748b",
    fontWeight: isActive ? "700" : "500",
    fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
  });

  return (
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>Find Your Shift</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Browse student-friendly jobs across Galway</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          placeholder="Search by job title or company…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "0.7rem 1rem", borderRadius: "0.75rem", border: "1.5px solid #e2e8f0", fontSize: "0.9rem", boxSizing: "border-box", fontFamily: "inherit", color: "#1e293b" }}
        />
      </div>

      {/* Filter Bar */}
      <div ref={filterBarRef} style={{ marginBottom: "1.5rem", position: "relative" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>

          {/* Relevance dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setOpenDropdown(openDropdown === "relevance" ? null : "relevance")} style={dropdownBtnStyle(sortBy !== "")}>
              {sortBy === "" ? "Relevance" : sortBy === "payHigh" ? "Pay: High → Low" : sortBy === "payLow" ? "Pay: Low → High" : sortBy === "distanceNear" ? "Closest First" : "Furthest First"} ▾
            </button>
            {openDropdown === "relevance" && (
              <div style={dropdownPanel}>
                {[
                  { value: "",             label: "Default" },
                  { value: "payHigh",      label: "Pay: High → Low" },
                  { value: "payLow",       label: "Pay: Low → High" },
                  { value: "distanceNear", label: "Distance: Closest → Furthest" },
                  { value: "distanceFar",  label: "Distance: Furthest → Closest" },
                ].map(({ value, label }) => (
                  <label key={value} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer", fontWeight: sortBy === value ? "700" : "500", color: sortBy === value ? "#4f46e5" : "#374151", fontSize: "0.85rem" }}>
                    <input type="radio" name="sortBy" checked={sortBy === value} onChange={() => { setSortBy(value); setOpenDropdown(null); }} style={{ cursor: "pointer" }} />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Filters dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setOpenDropdown(openDropdown === "filters" ? null : "filters")} style={dropdownBtnStyle(activeFilterCount > 0)}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} ▾
            </button>
            {openDropdown === "filters" && (
              <div style={{ ...dropdownPanel, minWidth: "300px", maxHeight: "520px", overflowY: "auto" }}>

                {/* Days & Times — collapsible */}
                <button onClick={() => setOpenSubSection(openSubSection === "days" ? null : "days")} style={subSectionBtn}>
                  <span>Days &amp; Times {selectedDays.length > 0 && <span style={activePip}>{selectedDays.length}</span>}</span>
                  <span>{openSubSection === "days" ? "▴" : "▾"}</span>
                </button>
                {openSubSection === "days" && (
                  <div style={{ paddingTop: "0.4rem", paddingBottom: "0.2rem" }}>
                    {warning && <p style={{ color: "#ef4444", fontSize: "0.78rem", marginBottom: "0.4rem" }}>{warning}</p>}
                    {weekdays.map(day => (
                      <div key={day} style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.45rem" }}>
                        <input type="checkbox" id={`day-${day}`} checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} style={{ cursor: "pointer", width: "15px", height: "15px" }} />
                        <label htmlFor={`day-${day}`} style={{ fontWeight: "500", minWidth: "90px", cursor: "pointer", fontSize: "0.85rem" }}>{day}</label>
                        <select value={dayTimes[day] || ""} onChange={e => updateTime(day, e.target.value)} disabled={!selectedDays.includes(day)}
                          style={{ padding: "0.2rem 0.4rem", borderRadius: "0.4rem", border: "1px solid #d1d5db", fontSize: "0.78rem", color: selectedDays.includes(day) ? "#111827" : "#9ca3af", cursor: selectedDays.includes(day) ? "pointer" : "not-allowed", backgroundColor: selectedDays.includes(day) ? "white" : "#f9fafb" }}>
                          <option value="">Any time</option>
                          {timeSlots.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0.4rem 0" }} />

                {/* Location — collapsible */}
                <button onClick={() => setOpenSubSection(openSubSection === "location" ? null : "location")} style={subSectionBtn}>
                  <span>Location {selectedLocations.length > 0 && <span style={activePip}>{selectedLocations.length}</span>}</span>
                  <span>{openSubSection === "location" ? "▴" : "▾"}</span>
                </button>
                {openSubSection === "location" && (
                  <div style={{ paddingTop: "0.4rem", paddingBottom: "0.2rem" }}>
                    {allLocations.map(loc => (
                      <label key={loc} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer", fontWeight: "500", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={selectedLocations.includes(loc)} onChange={() => toggleLocation(loc)} style={{ width: "15px", height: "15px", cursor: "pointer" }} />
                        {loc}
                      </label>
                    ))}
                  </div>
                )}

                <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0.4rem 0" }} />

                {/* Job Type — collapsible */}
                <button onClick={() => setOpenSubSection(openSubSection === "jobType" ? null : "jobType")} style={subSectionBtn}>
                  <span>Job Type {selectedJobTypes.length > 0 && <span style={activePip}>{selectedJobTypes.length}</span>}</span>
                  <span>{openSubSection === "jobType" ? "▴" : "▾"}</span>
                </button>
                {openSubSection === "jobType" && (
                  <div style={{ paddingTop: "0.4rem", paddingBottom: "0.2rem" }}>
                    {Object.keys(jobCategories).map(type => (
                      <label key={type} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer", fontWeight: "500", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={selectedJobTypes.includes(type)} onChange={() => toggleJobType(type)} style={{ width: "15px", height: "15px", cursor: "pointer" }} />
                        {type}
                      </label>
                    ))}
                  </div>
                )}

                <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "0.4rem 0" }} />

                {/* Schedule toggles — always visible */}
                <p style={{ ...filterSectionLabel, marginTop: "0.4rem" }}>Schedule</p>
                {[
                  { label: "Weekend Work", active: weekendOnly, toggle: () => setWeekendOnly(p => !p) },
                  { label: "All Week",     active: allWeekOnly, toggle: () => setAllWeekOnly(p => !p) },
                  { label: "No Weekends",  active: noWeekends,  toggle: () => setNoWeekends(p => !p) },
                ].map(({ label, active, toggle }) => (
                  <label key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", cursor: "pointer", fontWeight: active ? "700" : "500", color: active ? "#4f46e5" : "#374151", fontSize: "0.85rem" }}>
                    <input type="checkbox" checked={active} onChange={toggle} style={{ width: "15px", height: "15px", cursor: "pointer" }} />
                    {label}
                  </label>
                ))}

              </div>
            )}
          </div>

          {(hasActiveFilters || sortBy !== "") && (
            <button onClick={clearAll} style={{ padding: "0.45rem 0.9rem", borderRadius: "2rem", border: "1.5px solid #fda4af", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
          )}

          {/* Grid toggle */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.3rem", backgroundColor: "#f1f5f9", borderRadius: "0.6rem", padding: "0.2rem" }}>
            <button onClick={() => setGridCols(1)} title="Single column" style={{ padding: "0.3rem 0.5rem", border: "none", borderRadius: "0.45rem", cursor: "pointer", backgroundColor: gridCols === 1 ? "white" : "transparent", color: gridCols === 1 ? "#6366f1" : "#94a3b8", fontWeight: "700", fontSize: "1rem", boxShadow: gridCols === 1 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▤</button>
            <button onClick={() => setGridCols(2)} title="Two columns" style={{ padding: "0.3rem 0.5rem", border: "none", borderRadius: "0.45rem", cursor: "pointer", backgroundColor: gridCols === 2 ? "white" : "transparent", color: gridCols === 2 ? "#6366f1" : "#94a3b8", fontWeight: "700", fontSize: "1rem", boxShadow: gridCols === 2 ? "0 1px 4px rgba(0,0,0,0.1)" : "none", lineHeight: 1, fontFamily: "inherit" }}>▦</button>
          </div>

          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "#4f46e5", backgroundColor: "#eef2ff", padding: "0.25rem 0.7rem", borderRadius: "999px" }}>
            {displayJobs.length} job{displayJobs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {jobsLoading && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1rem", fontWeight: "600" }}>Loading jobs…</p>
        </div>
      )}
      {!jobsLoading && displayJobs.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No jobs match your search</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.25rem" }}>
            {searchQuery.trim() ? `No results for "${searchQuery}" — try a different keyword.` : "Try removing some filters to see more results."}
          </p>
          <button onClick={clearAll} style={{ padding: "0.6rem 1.5rem", borderRadius: "2rem", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" }}>
            Clear All Filters
          </button>
        </div>
      )}

      {/* Job List */}
      <div className="job-list-grid" style={{ display: "grid", gridTemplateColumns: gridCols === 2 ? "1fr 1fr" : "1fr", gap: "1rem" }}>
        {displayJobs.map((job) => {
          const isLiked   = likedJobs.some(j => j.id === job.id);
          const isApplied = appliedJobs.some(j => j.id === job.id);
          const dist      = jobDistance(job);
          const dl        = job.deadline;
          const dlDays    = daysUntil(dl);
          const dlSoon    = dlDays !== null && dlDays <= 7 && dlDays >= 0;

          return (
            <div key={job.id} className="job-card" style={{ flexDirection: "column", alignItems: "stretch", padding: 0, overflow: "hidden", marginBottom: 0 }}>
              {/* Company banner photo carousel */}
              {(() => {
                const photos = job.photos?.length > 0 ? job.photos : [COMPANY_PHOTOS[job.company] || "https://picsum.photos/seed/default/800/140"];
                const idx = photoIndexes[job.id] || 0;
                const crop = job.photoCrops?.[idx] || { zoom: 1, offsetX: 0, offsetY: 0 };
                const prev = (e) => { e.stopPropagation(); setPhotoIndexes(p => ({ ...p, [job.id]: (idx - 1 + photos.length) % photos.length })); };
                const next = (e) => { e.stopPropagation(); setPhotoIndexes(p => ({ ...p, [job.id]: (idx + 1) % photos.length })); };
                return (
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/7", backgroundColor: "#0f172a", overflow: "hidden" }}>
                    {crop.zoom === 1 && crop.offsetX === 0 && crop.offsetY === 0 ? (
                      <img src={photos[idx]} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                    ) : (
                      <img src={photos[idx]} alt={job.company} style={{
                        position: "absolute",
                        top: `calc(50% + ${crop.offsetY}%)`,
                        left: `calc(50% + ${crop.offsetX}%)`,
                        transform: `translate(-50%, -50%) scale(${crop.zoom})`,
                        transformOrigin: "center",
                        minWidth: "100%", minHeight: "100%", width: "auto", height: "auto", maxWidth: "none",
                        display: "block",
                      }} />
                    )}
                    {photos.length > 1 && (
                      <>
                        <button onClick={prev} style={arrowBtn("left")}>‹</button>
                        <button onClick={next} style={arrowBtn("right")}>›</button>
                        <div style={{ position: "absolute", bottom: "6px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "4px" }}>
                          {photos.map((_, i) => (
                            <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: i === idx ? "white" : "rgba(255,255,255,0.4)" }} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* Content */}
              <div style={{ padding: "0.85rem 1rem" }}>
                {/* Title + buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.2rem" }}>
                  <h2 style={{ fontWeight: "bold", fontSize: "1.05rem", margin: 0 }}>{job.title}</h2>
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                    <button onClick={() => { setSelectedJob(job); setPage("jobDetails"); }} style={btnBlue}>View</button>
                    <button
                      onClick={() => toggleLike(job)}
                      disabled={isApplied}
                      style={{
                        ...btnBase,
                        backgroundColor: isApplied ? "#10b981" : (isLiked ? "#10b981" : "white"),
                        color: isApplied ? "white" : (isLiked ? "white" : "#f43f5e"),
                        border: isApplied ? "none" : (isLiked ? "none" : "2px solid #f43f5e"),
                        boxShadow: "none",
                      }}
                    >
                      {isApplied ? "✅" : (isLiked ? "✅" : "❤️")}
                    </button>
                  </div>
                </div>

                {/* Company · location · distance */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.15rem" }}>
                  <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>{job.company} · {job.location}</span>
                  {dist !== null && (
                    <span style={{ fontSize: "0.7rem", backgroundColor: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", padding: "0.1rem 0.4rem", borderRadius: "999px", fontWeight: "600" }}>
                      {formatDistance(dist)}
                    </span>
                  )}
                </div>

                {/* Pay + deadline */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: "700", color: "#111827", fontSize: "0.9rem" }}>{job.pay}</span>
                  {dl && (
                    <span style={{ fontSize: "0.7rem", padding: "0.1rem 0.45rem", borderRadius: "999px", fontWeight: "600", backgroundColor: dlSoon ? "#fef3c7" : "#f3f4f6", color: dlSoon ? "#d97706" : "#6b7280", border: `1px solid ${dlSoon ? "#fde68a" : "#e5e7eb"}` }}>
                      {`Closes ${deadlineLabel(dl)}`}
                    </span>
                  )}
                </div>

                {/* Description (2-line clamp) */}
                {job.description && (
                  <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0 0 0.35rem", lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {job.description}
                  </p>
                )}

                {/* Day tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {job.days.map(day => (
                    <span key={day} style={{ fontSize: "0.7rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: "600" }}>
                      {day.slice(0, 3)} · {job.times[day]?.join(", ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}

const dropdownPanel = {
  position: "absolute", top: "calc(100% + 0.4rem)", left: 0, zIndex: 100,
  backgroundColor: "white", border: "1.5px solid #e5e7eb", borderRadius: "0.6rem",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "0.75rem 1rem", minWidth: "220px",
};

const btnBase = { padding: "0.38rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.8rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" };

const arrowBtn = (side) => ({
  position: "absolute", top: "50%", [side]: "8px",
  transform: "translateY(-50%)",
  background: "rgba(0,0,0,0.45)", border: "none", color: "white",
  borderRadius: "50%", width: "28px", height: "28px",
  fontSize: "1.2rem", lineHeight: "1", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 2,
});
const filterSectionLabel = { fontSize: "0.72rem", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.4rem" };
const subSectionBtn = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", padding: "0.35rem 0", cursor: "pointer", fontWeight: "600", fontSize: "0.88rem", color: "#1e293b", fontFamily: "inherit", textAlign: "left" };
const activePip = { display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "#6366f1", color: "white", borderRadius: "999px", fontSize: "0.65rem", fontWeight: "700", minWidth: "16px", height: "16px", padding: "0 0.3rem", marginLeft: "0.3rem" };
