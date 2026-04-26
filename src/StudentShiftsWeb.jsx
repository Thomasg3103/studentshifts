import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import StudentDashboard from "./pages/StudentDashboard";
import CompanyDashboard from "./pages/CompanyDashboard";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AccountPage from "./pages/AccountPage";
import JobDetails from "./pages/JobDetails";
import LikedJobs from "./pages/LikedJobs";
import AppliedJobs from "./pages/AppliedJobs";
import AboutPage from "./pages/AboutPage";
import Messages from "./pages/Messages";
import CompanyMessages from "./pages/CompanyMessages";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyDocsPage from "./pages/VerifyDocsPage";
import AdminPage from "./pages/AdminPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import CookieBanner from "./components/CookieBanner";
import { supabase } from "./lib/supabase";
import { getProfile, fetchLikedJobIds, fetchAppliedJobIds, fetchApplicationStatuses, saveCompanyCroNumber, saveCompanyIndustries, fetchJobBySlug, toJobSlug } from "./lib/auth";

// Map page-name strings to URL paths (for backwards-compat with setPage calls)
const PAGE_PATH = {
  studentDashboard:  "/",
  companyDashboard:  "/company",
  login:             "/login",
  signup:            "/signup",
  account:           "/account",
  likedJobs:         "/liked",
  appliedJobs:       "/applied",
  messages:          "/messages",
  companyMessages:   "/company/messages",
  admin:             "/admin",
  verifyDocs:        "/verify",
  emailVerified:     "/email-verified",
  resetPassword:     "/reset-password",
  about:             "/about",
  privacy:           "/privacy",
  terms:             "/terms",
};

// Normalise Supabase profile shape to match what the app expects
function normaliseProfile(profile) {
  const extra = profile.students || profile.companies || {};
  return {
    id:                 profile.id,
    name:               profile.name,
    email:              profile.email,
    role:               profile.role,
    cvName:             extra.cv_url             || null,
    coverLetterName:    extra.cover_letter_url   || null,
    linkedIn:           extra.linkedin           || "",
    bio:                extra.bio                || "",
    skills:             extra.skills             || [],
    profilePhoto:       extra.profile_photo_url  || "",
    studentIdCardName:    extra.student_id_url     || null,
    governmentIdName:     extra.gov_id_url         || null,
    studentIdPath:        extra.student_id_url     || null,
    verificationStatus:   extra.status             || null,
    croNumber:            extra.cro_number          || null,
    industries:           extra.industries           || [],
    jobPreferences:     extra.job_preferences  || [],
    availability:       extra.availability || {},
    savedLocation:      extra.location_lat ? {
      lat:         extra.location_lat,
      lng:         extra.location_lng,
      displayName: extra.location_display,
    } : null,
  };
}

export default function StudentShiftsWeb() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const locationRef   = useRef(location.pathname);

  const dashboardScrollY = useRef(0);
  const [restoreScrollY, setRestoreScrollY] = useState(0);

  // Track selectedJob via ref so setPage("jobDetails") can navigate synchronously
  const [selectedJob, setSelectedJob] = useState(null);
  const selectedJobRef = useRef(null);

  const setSelectedJobBoth = useCallback((job) => {
    selectedJobRef.current = job;
    setSelectedJob(job);
  }, []);

  // setPage — maps old page-name strings to navigate() calls
  const setPage = useCallback((newPage) => {
    if (newPage === "jobDetails") {
      const job = selectedJobRef.current;
      if (job) navigate(`/jobs/${toJobSlug(job.title)}/${toJobSlug(job.company)}`, { state: { job } });
      return;
    }
    const path = PAGE_PATH[newPage];
    if (path !== undefined) navigate(path);
  }, [navigate]);

  // Scroll handling: save dashboard position before leaving; restore on return
  useEffect(() => {
    const prev = locationRef.current;
    const curr = location.pathname;

    if (curr === "/" && prev !== null && prev.startsWith("/jobs/")) {
      // Returning from job details → restore dashboard scroll
      setRestoreScrollY(dashboardScrollY.current);
    } else {
      setRestoreScrollY(0);
      window.scrollTo(0, 0);
    }

    // Save dashboard scroll before navigating away
    if (prev === "/") dashboardScrollY.current = window.scrollY;
    locationRef.current = curr;
  }, [location.pathname]);

  const [currentUser, setCurrentUser]       = useState(null);
  const [likedJobs, setLikedJobs]           = useState([]);
  const [appliedJobs, setAppliedJobs]       = useState([]);
  const [savedLikedJobIds, setSavedLikedJobIds]     = useState([]);
  const [savedAppliedJobIds, setSavedAppliedJobIds] = useState([]);
  const [studentLocation, setStudentLocation] = useState(null);
  const [appStatuses, setAppStatuses]       = useState({});
  const [notifCount, setNotifCount]         = useState(0);
  const [authLoading, setAuthLoading]       = useState(true);

  // Restore session on page load + listen for auth changes
  useEffect(() => {
    const failsafe = setTimeout(() => setAuthLoading(false), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session?.user) {
          try {
            const profile = await getProfile(session.user.id);
            const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
            setCurrentUser(user);
            if (user.role === "admin")   { navigate("/admin", { replace: true }); }
            else if (user.role === "company") { navigate("/company", { replace: true }); }
            else if (user.role === "student" && (!user.studentIdPath || user.verificationStatus === "rejected")) { navigate("/verify", { replace: true }); }
            if (user.role === "student") {
              const [likedIds, appliedIds] = await Promise.all([
                fetchLikedJobIds(user.id).catch(() => []),
                fetchAppliedJobIds(user.id).catch(() => []),
              ]);
              setSavedLikedJobIds(likedIds);
              setSavedAppliedJobIds(appliedIds);
            }
          } catch (e) {
            console.error("Failed to load profile", e);
          }
        }
        clearTimeout(failsafe);
        setAuthLoading(false);
      }
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
          setCurrentUser(user);
          if (user.role === "company") {
            const metaCro = session.user.user_metadata?.cro_number;
            if (metaCro && !user.croNumber) saveCompanyCroNumber(user.id, metaCro);
            const metaIndustries = session.user.user_metadata?.industries;
            if (metaIndustries?.length && !user.industries?.length) saveCompanyIndustries(user.id, metaIndustries);
          }
          const justVerified = window.location.hash.includes("type=signup") || window.location.hash.includes("type=email");
          if (justVerified) { navigate("/email-verified", { replace: true }); return; }
          if (user.role === "admin")   { navigate("/admin", { replace: true }); }
          else if (user.role === "company") { navigate("/company", { replace: true }); }
          else if (user.role === "student" && (!user.studentIdPath || user.verificationStatus === "rejected")) { navigate("/verify", { replace: true }); }
          else { navigate("/", { replace: true }); }
          if (user.role === "student") {
            const [likedIds, appliedIds] = await Promise.all([
              fetchLikedJobIds(user.id).catch(() => []),
              fetchAppliedJobIds(user.id).catch(() => []),
            ]);
            setSavedLikedJobIds(likedIds);
            setSavedAppliedJobIds(appliedIds);
          }
        } catch (e) {
          console.error("Failed to load profile", e);
        }
      }
      if (event === "PASSWORD_RECOVERY") {
        navigate("/reset-password", { replace: true });
        clearTimeout(failsafe);
        setAuthLoading(false);
        return;
      }
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setLikedJobs([]);
        setAppliedJobs([]);
        setSavedLikedJobIds([]);
        setSavedAppliedJobIds([]);
        navigate("/", { replace: true });
      }
    });

    return () => { clearTimeout(failsafe); subscription.unsubscribe(); };
  }, []);

  // Real-time: watch students table for verification status changes
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student" || currentUser.verificationStatus !== "pending_review") return;
    const channel = supabase
      .channel(`verify_${currentUser.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "students", filter: `id=eq.${currentUser.id}` },
        async () => {
          try {
            const profile = await getProfile(currentUser.id);
            const updated = normaliseProfile({ ...profile, email: profile.email || currentUser.email });
            if (updated.verificationStatus === "verified") {
              setCurrentUser(updated);
              navigate("/", { replace: true });
            } else if (updated.verificationStatus === "rejected") {
              setCurrentUser(updated);
              navigate("/verify", { replace: true });
            }
          } catch { /* silently ignore */ }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id, currentUser?.verificationStatus]);

  // Sync studentLocation when user logs in/out
  useEffect(() => {
    setStudentLocation(currentUser?.savedLocation ?? null);
  }, [currentUser?.id]);

  // Real-time: watch applications table for status changes
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") { setAppStatuses({}); return; }
    // Initial fetch
    fetchApplicationStatuses(currentUser.id).then(setAppStatuses).catch(() => {});
    // Live updates
    const channel = supabase
      .channel(`app_statuses_${currentUser.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "applications", filter: `student_id=eq.${currentUser.id}` },
        ({ new: row }) => {
          setAppStatuses(prev => ({ ...prev, [row.job_id]: row.status }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Recompute notification badge whenever statuses or applied jobs change
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") { setNotifCount(0); return; }
    const seen = JSON.parse(localStorage.getItem("ss_notif_seen_" + currentUser.id) || "{}");
    const count = appliedJobs.reduce((acc, job) => {
      const cur  = appStatuses[job.id] || "Pending";
      const prev = seen[job.id]        || "Pending";
      return acc + (cur !== "Pending" && cur !== prev ? 1 : 0);
    }, 0);
    setNotifCount(count);
  }, [appStatuses, appliedJobs, currentUser?.id]);

  // Mark notifications as seen when student opens Applied Jobs
  useEffect(() => {
    if (location.pathname !== "/applied" || !currentUser) return;
    const seen = {};
    appliedJobs.forEach(job => { seen[job.id] = appStatuses[job.id] || "Pending"; });
    localStorage.setItem("ss_notif_seen_" + currentUser.id, JSON.stringify(seen));
    setNotifCount(0);
  }, [location.pathname]);

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <img src="/favicon.svg" alt="StudentShifts" style={{ width: "48px", height: "54px", marginBottom: "0.5rem" }} />
          <p style={{ fontWeight: "600", fontFamily: "'Poppins', sans-serif" }}>Loading StudentShifts…</p>
        </div>
      </div>
    );
  }

  const sharedStudentProps = {
    likedJobs, setLikedJobs, appliedJobs, setAppliedJobs, currentUser,
  };

  return (
    <>
      <Header
        currentUser={currentUser}
        setPage={setPage}
        likedJobs={likedJobs}
        appliedJobs={appliedJobs}
        notifCount={notifCount}
      />
      <Routes>
        {/* Home / Student Dashboard */}
        <Route path="/" element={
          currentUser?.role === "student" && !currentUser?.studentIdPath
            ? <VerifyDocsPage currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} />
            : <StudentDashboard
                setPage={setPage}
                setSelectedJob={setSelectedJobBoth}
                {...sharedStudentProps}
                studentLocation={studentLocation}
                savedLikedJobIds={savedLikedJobIds}
                savedAppliedJobIds={savedAppliedJobIds}
                restoreScrollY={restoreScrollY}
              />
        } />

        {/* Job Details */}
        <Route path="/jobs/:titleSlug/:companySlug" element={
          <JobDetailsRoute
            selectedJob={selectedJob}
            setPage={setPage}
            {...sharedStudentProps}
          />
        } />

        {/* Auth */}
        <Route path="/login"   element={<LoginPage setPage={setPage} setCurrentUser={setCurrentUser} />} />
        <Route path="/signup"  element={<SignupPage setPage={setPage} />} />
        <Route path="/reset-password" element={<ResetPasswordPage setPage={setPage} />} />
        <Route path="/email-verified" element={<EmailVerifiedPage setPage={setPage} currentUser={currentUser} />} />

        {/* Student pages */}
        <Route path="/account" element={currentUser
          ? <AccountPage currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} setLikedJobs={setLikedJobs} setAppliedJobs={setAppliedJobs} setStudentLocation={setStudentLocation} />
          : <Navigate to="/login" replace />
        } />
        <Route path="/liked" element={currentUser
          ? <LikedJobs likedJobs={likedJobs} setLikedJobs={setLikedJobs} setSavedLikedJobIds={setSavedLikedJobIds} setSelectedJob={setSelectedJobBoth} setPage={setPage} currentUser={currentUser} />
          : <Navigate to="/login" replace />
        } />
        <Route path="/applied" element={currentUser?.role === "student"
          ? <AppliedJobs appliedJobs={appliedJobs} setAppliedJobs={setAppliedJobs} setSavedAppliedJobIds={setSavedAppliedJobIds} setSelectedJob={setSelectedJobBoth} setPage={setPage} currentUser={currentUser} statuses={appStatuses} />
          : <Navigate to="/" replace />
        } />
        <Route path="/messages" element={currentUser?.role === "student"
          ? <Messages currentUser={currentUser} setPage={setPage} />
          : <Navigate to="/" replace />
        } />
        <Route path="/verify" element={currentUser
          ? <VerifyDocsPage currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} />
          : <Navigate to="/" replace />
        } />

        {/* Company pages */}
        <Route path="/company" element={currentUser?.role === "company"
          ? <CompanyDashboard setPage={setPage} currentUser={currentUser} />
          : <Navigate to="/" replace />
        } />
        <Route path="/company/messages" element={currentUser?.role === "company"
          ? <CompanyMessages currentUser={currentUser} setPage={setPage} />
          : <Navigate to="/" replace />
        } />

        {/* Admin */}
        <Route path="/admin" element={currentUser?.role === "admin"
          ? <AdminPage currentUser={currentUser} setPage={setPage} />
          : <Navigate to="/" replace />
        } />

        {/* Info pages */}
        <Route path="/about"   element={<AboutPage setPage={setPage} />} />
        <Route path="/privacy" element={<PrivacyPolicyPage setPage={setPage} />} />
        <Route path="/terms"   element={<TermsOfServicePage setPage={setPage} />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer style={{ backgroundColor: "#0f172a", color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "1.25rem 1rem", fontSize: "0.78rem", fontFamily: "'Poppins', sans-serif" }}>
        <span>© {new Date().getFullYear()} StudentShifts · Ireland</span>
        <span style={{ margin: "0 0.6rem" }}>·</span>
        <span onClick={() => setPage("privacy")} style={{ cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>Privacy Policy</span>
        <span style={{ margin: "0 0.6rem" }}>·</span>
        <span onClick={() => setPage("terms")} style={{ cursor: "pointer", color: "rgba(255,255,255,0.6)" }}>Terms of Service</span>
      </footer>
      <CookieBanner setPage={setPage} />
    </>
  );
}

// Job details route — handles in-app nav (job in state/memory) and direct URL access (fetches from DB)
function JobDetailsRoute({ selectedJob, setPage, currentUser, likedJobs, setLikedJobs, appliedJobs, setAppliedJobs }) {
  const { titleSlug, companySlug } = useParams();
  const location = useLocation();
  const navigate  = useNavigate();

  const stateJob = location.state?.job;
  const slugMatches = stateJob
    ? (toJobSlug(stateJob.title) === titleSlug && toJobSlug(stateJob.company) === companySlug)
    : false;
  const memoryMatch = selectedJob
    ? (toJobSlug(selectedJob.title) === titleSlug && toJobSlug(selectedJob.company) === companySlug)
    : false;
  const [job, setJob] = useState((slugMatches ? stateJob : null) || (memoryMatch ? selectedJob : null) || null);
  const [loading, setLoading] = useState(!job);

  useEffect(() => {
    if (job && toJobSlug(job.title) === titleSlug && toJobSlug(job.company) === companySlug) return;
    setLoading(true);
    fetchJobBySlug(titleSlug, companySlug)
      .then(j => { setJob(j); setLoading(false); })
      .catch(() => navigate("/", { replace: true }));
  }, [titleSlug, companySlug]);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
          <p style={{ fontFamily: "'Poppins', sans-serif", fontWeight: "600" }}>Loading job…</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <JobDetails
      job={job}
      setPage={setPage}
      currentUser={currentUser}
      likedJobs={likedJobs}
      setLikedJobs={setLikedJobs}
      appliedJobs={appliedJobs}
      setAppliedJobs={setAppliedJobs}
    />
  );
}

function EmailVerifiedPage({ setPage, currentUser }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      if (currentUser.role === "admin") navigate("/admin", { replace: true });
      else if (currentUser.role === "company") navigate("/company", { replace: true });
      else if (currentUser.role === "student" && (!currentUser.studentIdPath || currentUser.verificationStatus === "rejected")) navigate("/verify", { replace: true });
      else navigate("/", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
        <h2 style={{ margin: "0 0 0.5rem", fontWeight: "800", fontSize: "1.8rem", color: "#1e293b" }}>Email verified!</h2>
        <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Your account is now active. Taking you to StudentShifts…
        </p>
        <div style={{ width: "48px", height: "48px", border: "4px solid #e5e7eb", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      </div>
    </div>
  );
}
