import { useState, useEffect, useRef, useCallback, useContext, lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "react-hot-toast";
import { useNavigate, useLocation, Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieBanner from "./components/CookieBanner";
import AppFooter from "./components/AppFooter";

const StudentDashboard  = lazy(() => import("./pages/StudentDashboard"));
const CompanyDashboard  = lazy(() => import("./pages/CompanyDashboard"));
const LoginPage         = lazy(() => import("./pages/LoginPage"));
const SignupPage        = lazy(() => import("./pages/SignupPage"));
const AccountPage       = lazy(() => import("./pages/AccountPage"));
const JobDetails        = lazy(() => import("./pages/JobDetails"));
const LikedJobs         = lazy(() => import("./pages/LikedJobs"));
const AppliedJobs       = lazy(() => import("./pages/AppliedJobs"));
const AboutPage         = lazy(() => import("./pages/AboutPage"));
const Messages          = lazy(() => import("./pages/Messages"));
const CompanyMessages   = lazy(() => import("./pages/CompanyMessages"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const VerifyDocsPage    = lazy(() => import("./pages/VerifyDocsPage"));
const AdminPage         = lazy(() => import("./pages/AdminPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage= lazy(() => import("./pages/TermsOfServicePage"));
const LandingPage       = lazy(() => import("./pages/LandingPage"));
const HelpPage          = lazy(() => import("./pages/HelpPage"));
const ContactPage       = lazy(() => import("./pages/ContactPage"));

function PageSpinner() {
  return (
    <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", border: "4px solid #e5e7eb", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    </div>
  );
}
import { supabase } from "./lib/supabase";
import { getProfile, fetchLikedJobIds, fetchAppliedJobIds, fetchApplicationStatuses, saveCompanyCroNumber, saveCompanyIndustries, fetchJobBySlug, toJobSlug, fetchJobsByIds, fetchMessageCount } from "./lib/auth";
import { AppContext } from "./context/AppContext";

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
  help:              "/help",
  contact:           "/contact",
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
    allowCompanyDm:     extra.allow_company_dm !== false,
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

    // GA4 page_view (SPA — GA doesn't auto-track route changes)
    if (window.gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
      window.gtag("event", "page_view", { page_path: curr, page_title: document.title });
    }
  }, [location.pathname]);

  const [currentUser, setCurrentUser]       = useState(null);
  const [likedJobs, setLikedJobs]           = useState([]);
  const [appliedJobs, setAppliedJobs]       = useState([]);
  const [savedLikedJobIds, setSavedLikedJobIds]     = useState([]);
  const [savedAppliedJobIds, setSavedAppliedJobIds] = useState([]);
  const [studentLocation, setStudentLocation] = useState(null);
  const [appStatuses, setAppStatuses]       = useState({});
  const [notifCount, setNotifCount]         = useState(0);
  const [msgCount, setMsgCount]             = useState(0);
  const [authLoading, setAuthLoading]       = useState(true);

  // Restore session on page load + listen for auth changes
  useEffect(() => {
    const failsafe = setTimeout(() => setAuthLoading(false), 6000);

    async function loadStudentData(userId) {
      const [likedIds, appliedIds] = await Promise.all([
        fetchLikedJobIds(userId).catch(() => []),
        fetchAppliedJobIds(userId).catch(() => []),
      ]);
      setSavedLikedJobIds(likedIds);
      setSavedAppliedJobIds(appliedIds);
      const allIds = [...new Set([...likedIds, ...appliedIds])];
      if (allIds.length) {
        try {
          const fetchedJobs = await fetchJobsByIds(allIds);
          const jobMap = Object.fromEntries(fetchedJobs.map(j => [j.id, j]));
          setLikedJobs(likedIds.map(id => jobMap[id]).filter(Boolean));
          setAppliedJobs(appliedIds.map(id => jobMap[id]).filter(Boolean));
        } catch (e) { console.warn("Failed to fetch liked/applied jobs:", e); }
      }
    }

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
            if (user.role === "student") await loadStudentData(user.id);
          } catch (e) {
            Sentry.captureException(e);
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
          // GA4 User ID
          if (window.gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
            window.gtag("config", import.meta.env.VITE_GA_MEASUREMENT_ID, { user_id: user.id });
          }
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
          if (user.role === "student") await loadStudentData(user.id);
        } catch (e) {
          Sentry.captureException(e);
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
    const count = appliedJobs.reduce((acc, job) => {
      const status = appStatuses[job.id] || "Pending";
      return acc + (status !== "Pending" ? 1 : 0);
    }, 0);
    setNotifCount(count);
  }, [appStatuses, appliedJobs, currentUser?.id]);

  // Message count badge — count distinct conversation threads with received messages
  useEffect(() => {
    if (!currentUser || currentUser.role === "admin") { setMsgCount(0); return; }
    fetchMessageCount(currentUser.id, currentUser.role).then(setMsgCount).catch(() => {});

    const filter = currentUser.role === "student"
      ? `student_id=eq.${currentUser.id}`
      : `company_id=eq.${currentUser.id}`;

    const channel = supabase
      .channel(`msg_count_${currentUser.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter },
        payload => {
          if (payload.new.sender_id !== currentUser.id) {
            fetchMessageCount(currentUser.id, currentUser.role).then(setMsgCount).catch(() => {});
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  const isLanding = !currentUser && location.pathname === "/";

  const appContextValue = {
    currentUser, setCurrentUser,
    setPage,
    setSelectedJob: setSelectedJobBoth,
    likedJobs, setLikedJobs,
    appliedJobs, setAppliedJobs,
    savedLikedJobIds, setSavedLikedJobIds,
    savedAppliedJobIds, setSavedAppliedJobIds,
    studentLocation, setStudentLocation,
    appStatuses,
    notifCount,
    msgCount, setMsgCount,
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <img loading="lazy" src="/favicon.svg" alt="StudentShifts" style={{ width: "48px", height: "54px", marginBottom: "0.5rem" }} />
          <p style={{ fontWeight: "600", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Loading StudentShifts…</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={appContextValue}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {!isLanding && <Header />}
      <main id="main-content">
        <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              {/* Home / Student Dashboard / Landing */}
              <Route path="/" element={
                !currentUser
                  ? <LandingPage />
                  : currentUser?.role === "student" && !currentUser?.studentIdPath
                  ? <VerifyDocsPage />
                  : <StudentDashboard restoreScrollY={restoreScrollY} />
              } />

              {/* Job Details */}
              <Route path="/jobs/:titleSlug/:companySlug" element={
                <JobDetailsRoute selectedJob={selectedJob} />
              } />

              {/* Auth */}
              <Route path="/login"   element={<LoginPage />} />
              <Route path="/signup"  element={<SignupPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/email-verified" element={<EmailVerifiedPage />} />

              {/* Student pages */}
              <Route path="/account" element={currentUser ? <AccountPage /> : <Navigate to="/login" replace />} />
              <Route path="/liked"   element={currentUser ? <LikedJobs /> : <Navigate to="/login" replace />} />
              <Route path="/applied" element={currentUser?.role === "student" ? <AppliedJobs /> : <Navigate to="/" replace />} />
              <Route path="/messages" element={currentUser?.role === "student" ? <Messages /> : <Navigate to="/" replace />} />
              <Route path="/verify"  element={currentUser ? <VerifyDocsPage /> : <Navigate to="/" replace />} />

              {/* Company pages */}
              <Route path="/company" element={currentUser?.role === "company" ? <CompanyDashboard /> : <Navigate to="/" replace />} />
              <Route path="/company/messages" element={currentUser?.role === "company" ? <CompanyMessages /> : <Navigate to="/" replace />} />

              {/* Admin */}
              <Route path="/admin" element={currentUser?.role === "admin" ? <AdminPage /> : <Navigate to="/" replace />} />

              {/* Info pages */}
              <Route path="/about"   element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms"   element={<TermsOfServicePage />} />
              <Route path="/help"    element={<HelpPage />} />
              <Route path="/contact" element={<ContactPage />} />

              {/* 404 */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isLanding && <AppFooter />}
      <CookieBanner />
      <Toaster position="bottom-center" toastOptions={{ duration: 4000, style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: "0.875rem", borderRadius: "0.75rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" } }} />
    </AppContext.Provider>
  );
}

// Job details route — handles in-app nav (job in state/memory) and direct URL access (fetches from DB)
function JobDetailsRoute({ selectedJob }) {
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
          <div style={{ width: "40px", height: "40px", border: "4px solid #e5e7eb", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: "600" }}>Loading job…</p>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return <JobDetails job={job} />;
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        <div style={{ fontSize: "5rem", fontWeight: "900", color: "var(--color-brand)", lineHeight: 1, marginBottom: "0.5rem" }}>404</div>
        <h1 style={{ margin: "0 0 0.75rem", fontWeight: "800", fontSize: "1.6rem", color: "#1e293b" }}>Page not found</h1>
        <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          className="btn btn-primary"
          style={{ padding: "0.75rem 2rem", fontSize: "0.95rem" }}
          onClick={() => navigate("/", { replace: true })}
        >
          Go home
        </button>
      </div>
    </div>
  );
}

function EmailVerifiedPage() {
  const { currentUser } = useContext(AppContext);
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
        <div style={{ width: "48px", height: "48px", border: "4px solid #e5e7eb", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      </div>
    </div>
  );
}
