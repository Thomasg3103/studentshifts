/**
 * StudentShiftsWeb.jsx — the ROOT component of the entire app.
 *
 * Everything else in the app (every page, every dashboard) is rendered
 * somewhere inside this component's tree. This file is responsible for
 * three big jobs, all tangled together because they depend on each other:
 *
 * 1. ROUTING — defines every URL path the app responds to (<Routes>/<Route>
 *    near the bottom of the file) using React Router. Pages are lazy-loaded
 *    (see the `lazy(() => import(...))` list below) so the browser only
 *    downloads the JS for a page when the user actually navigates to it,
 *    instead of one giant bundle up front.
 *
 * 2. AUTH STATE — Supabase Auth is the source of truth for "is anyone logged
 *    in, and as whom". This component subscribes to Supabase's
 *    `onAuthStateChange` listener (see the big useEffect below) which fires
 *    events like SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED etc. Whenever one of
 *    those fires, this file reacts: loading the user's profile, redirecting
 *    them to the right starting page, or clearing state on logout.
 *
 * 3. PROFILE LOADING + ROLE-BASED ROUTING — Supabase Auth only knows about
 *    the login (email/password + session token). It doesn't know if this
 *    person is a student, a company, or an admin, or whether a student has
 *    been ID-verified yet. That extra info lives in our own `profiles` /
 *    `students` / `companies` tables. After an auth event fires, this file
 *    fetches that profile row (via `getProfile`), reshapes it into the
 *    format the rest of the app expects (`normaliseProfile`), and stores it
 *    in `currentUser` state. `currentUser` is then handed to every page via
 *    React Context (see AppContext.Provider near the bottom) so any
 *    component in the tree can read "who is logged in" without prop-drilling.
 *
 * Why routing and auth are combined in one file: which route a user is
 * ALLOWED to see depends on `currentUser.role` (student/company/admin) and,
 * for students, `currentUser.verificationStatus` (they must complete ID
 * verification before they can apply to jobs or message companies). So the
 * <Route> definitions below are guarded with checks like
 * `currentUser?.role === "student"` — see the route guard comments further
 * down for why each one exists.
 */
import { useState, useEffect, useRef, useCallback, useContext, useMemo, lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { useNavigate, useLocation, Routes, Route, Navigate, useParams } from "react-router-dom";
import Header from "./components/Header";
import ErrorBoundary from "./components/ErrorBoundary";
import AppFooter from "./components/AppFooter";
import CookieBanner from "./components/CookieBanner";
import BetaFeedback from "./components/BetaFeedback"; // BETA ONLY — remove before full launch
import { PageSkeleton } from "./components/Skeleton";

// Every page component is lazy-loaded: React.lazy() + dynamic import() means
// Vite splits each page into its own JS chunk, downloaded only when a user
// actually navigates there (see <Suspense fallback={<PageSkeleton />}> below,
// which shows a loading skeleton while a chunk is being fetched).
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
const LeaderboardPage   = lazy(() => import("./pages/LeaderboardPage"));
const ForumPage         = lazy(() => import("./pages/ForumPage"));
const CompanyProfilePage= lazy(() => import("./pages/CompanyProfilePage"));

import { supabase } from "./lib/supabase";
import { getProfile, fetchLikedJobIds, fetchAppliedJobIds, fetchApplicationStatuses, saveCompanyCroNumber, saveCompanyIndustries, fetchJobBySlug, toJobSlug, fetchJobsByIds, fetchMessageCount } from "./lib/auth";
import { AppContext } from "./context/AppContext";

// Map page-name strings to URL paths (for backwards-compat with setPage calls)
// This app originally navigated by swapping which "page" was rendered in
// state, before React Router was introduced. Lots of components still call
// setPage("someName") instead of using React Router's navigate() directly.
// This lookup table + the setPage() function below translate those old-style
// calls into real URL navigations, so we didn't have to rewrite every caller.
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
  leaderboard:       "/leaderboard",
  forum:             "/forum",
};

// Normalise Supabase profile shape to match what the app expects.
//
// Why this is needed: a raw Supabase query joins the shared `profiles` table
// (id/name/email/role) with either the `students` or `companies` table
// (whichever matches the user's role), depending on how the query was
// written elsewhere in lib/auth.js. That join comes back as nested objects
// (profile.students = {...} or profile.companies = {...}) with snake_case
// column names straight from Postgres. The rest of the app (components,
// forms) expects one FLAT object with camelCase keys, regardless of whether
// the user is a student or a company. This function does that reshaping in
// one place so every page can just read `currentUser.bio`, `currentUser.cvName`,
// etc. without caring which underlying table the field came from.
function normaliseProfile(profile) {
  // Only one of profile.students / profile.companies will exist depending on
  // the user's role — admins have neither, so `extra` falls back to {}.
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
    website:              extra.website             || "",
    industries:           extra.industries           || [],
    jobPreferences:     extra.job_preferences  || [],
    availability:       extra.availability || {},
    allowCompanyDm:     extra.allow_company_dm !== false,
    savedLocation:      extra.location_lat ? {
      lat:         extra.location_lat,
      lng:         extra.location_lng,
      displayName: extra.location_display,
    } : null,
    transport:          extra.transport        || [],
    canStart:           extra.can_start        || "",
    workExperience:        extra.work_experience         || "",
    workExperienceEntries: extra.work_experience_entries || [],
    rightToWork:           extra.right_to_work           || false,
    driverLicence:      extra.driver_licence   || false,
  };
}

export default function StudentShiftsWeb() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const locationRef   = useRef(location.pathname);

  const dashboardScrollY = useRef(0);
  const [restoreScrollY, setRestoreScrollY] = useState(0);

  // Track selectedJob via ref so setPage("jobDetails") can navigate synchronously.
  // Why both a ref AND state: setPage() is a plain callback (not a React event
  // handler mid-render), so it needs the CURRENT job value immediately when
  // called — reading from `selectedJob` state inside a useCallback would give
  // a stale closure. The ref always has the latest value; the state copy is
  // what actually triggers re-renders for anything that displays the job.
  const [selectedJob, setSelectedJob] = useState(null);
  const selectedJobRef = useRef(null);

  const setSelectedJobBoth = useCallback((job) => {
    selectedJobRef.current = job;
    setSelectedJob(job);
  }, []);

  // setPage — maps old page-name strings to navigate() calls (see PAGE_PATH above).
  // Special-cased for "jobDetails" because job detail URLs are built from the
  // job's title/company (slugified) rather than being a fixed path — e.g.
  // /jobs/barista/costa-coffee — and the job data itself is passed along via
  // router state so JobDetailsRoute doesn't have to re-fetch it from Supabase.
  const setPage = useCallback((newPage) => {
    if (newPage === "jobDetails") {
      const job = selectedJobRef.current;
      if (job) navigate(`/jobs/${toJobSlug(job.title)}/${toJobSlug(job.company)}`, { state: { job } });
      return;
    }
    const path = PAGE_PATH[newPage];
    if (path !== undefined) navigate(path);
  }, [navigate]);

  // Scroll handling: save dashboard position before leaving; restore on return.
  // Without this, clicking a job card, viewing its details, then hitting "back"
  // would dump the student back at the TOP of the job feed instead of where
  // they were scrolled to — annoying if they were 50 jobs down the list.
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

  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem("ss_theme") === "dark"; } catch { return false; }
  });

  const toggleDarkMode = useCallback(() => {
    setDarkMode(d => {
      const next = !d;
      try { localStorage.setItem("ss_theme", next ? "dark" : "light"); } catch { /* ignore */ }
      document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
      return next;
    });
  }, []);
  // authLoading gates the whole app behind a spinner (see the `if (authLoading)`
  // early return further down) until we know for sure whether someone is
  // logged in. Without this, the app would briefly flash the logged-out
  // landing page before Supabase finishes checking for an existing session.
  const [authLoading, setAuthLoading]       = useState(true);
  // Set to true only when Supabase fires PASSWORD_RECOVERY; gates the /reset-password route
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  // Restore session on page load + listen for auth changes.
  //
  // This is the most important effect in the app. supabase.auth.onAuthStateChange
  // is a single subscription that fires an "event" any time the user's login
  // state changes — including once immediately on mount with whatever session
  // (if any) was restored from localStorage. We branch on `event` below to
  // handle each case differently. See the comments on each `if` block for
  // what triggers it and why it's handled that way.
  useEffect(() => {
    // Failsafe: if Supabase's auth check hangs (flaky network, browser
    // extension interference, etc.) we don't want the user stuck on the
    // loading spinner forever — force the app to render after 6s regardless.
    const failsafe = setTimeout(() => setAuthLoading(false), 6000);

    // Fetches a student's liked/applied job IDs + the actual job rows, in the
    // background, AFTER the dashboard is already visible — so the user isn't
    // stuck waiting on this extra data before they can see anything.
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
      // INITIAL_SESSION fires exactly once, right after this listener is set
      // up, whether or not a session exists. Supabase checks localStorage for
      // a previously-saved session and reports what it found. This is how
      // "stay logged in after refreshing the page" works — there's no
      // separate login step needed, this event IS the restored login.
      if (event === "INITIAL_SESSION") {
        if (session?.user && session.user.email_confirmed_at) {
          try {
            const profile = await getProfile(session.user.id);
            if (!profile) {
              // F1: DB trigger failed at signup — profile row missing. Sign out so the user
              // isn't stuck in a half-created state; the same email can then re-register.
              console.warn("Profile missing (DB trigger failed?) for user", session.user.id);
              await supabase.auth.signOut().catch(() => {});
              toast.error("Your account setup didn't complete. Please sign up again or contact support@studentshifts.ie.");
            } else {
              const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
              setCurrentUser(user);
              // Show the app immediately — don't block on supplementary data
              clearTimeout(failsafe);
              setAuthLoading(false);
              // INITIAL_SESSION: only redirect if the user's current URL is wrong for their role.
              // Preserves deep links (e.g. company refreshing /company/messages stays there).
              const currPath = window.location.pathname;
              if (user.role === "admin" && currPath !== "/admin") {
                navigate("/admin", { replace: true });
              } else if (user.role === "company" && !currPath.startsWith("/company") && currPath !== "/account") {
                navigate("/company", { replace: true });
              }
              // Load liked/applied job data in background — dashboard is already visible
              if (user.role === "student") loadStudentData(user.id);
              return;
            }
          } catch (e) {
            Sentry.captureException(e);
            console.error("Failed to load profile", e);
          }
        }
        clearTimeout(failsafe);
        setAuthLoading(false);
      }
      // SIGNED_IN fires whenever the user actively completes a login (or
      // signup that auto-logs-in, or clicks an email confirmation link).
      // Unlike INITIAL_SESSION, this is a fresh action the user just took, so
      // unlike INITIAL_SESSION (which preserves whatever URL the user was on)
      // this branch ALWAYS redirects them to their role's home page —
      // someone who just typed their password expects to land on their
      // dashboard, not wherever the login form happened to be mounted.
      if (event === "SIGNED_IN" && session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          if (!profile) {
            // F1: same as INITIAL_SESSION — sign out and let user re-register
            console.warn("Profile missing on SIGNED_IN (DB trigger failed?) for user", session.user.id);
            await supabase.auth.signOut().catch(() => {});
            navigate("/?signup_error=1", { replace: true });
            return;
          }
          const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
          // Belt-and-braces check: Supabase Auth normally won't issue a
          // session for an unconfirmed email, but if one slips through
          // (edge cases, race conditions) we sign them straight back out
          // rather than letting an unverified account use the app.
          if (!session.user.email_confirmed_at) {
            await supabase.auth.signOut().catch(() => {});
            navigate("/login?unverified=1", { replace: true });
            return;
          }
          setCurrentUser(user);
          // GA4 User ID
          if (window.gtag && import.meta.env.VITE_GA_MEASUREMENT_ID) {
            window.gtag("config", import.meta.env.VITE_GA_MEASUREMENT_ID, { user_id: user.id });
          }
          if (user.role === "company") {
            // Company signup collects CRO number + industries as Supabase Auth
            // "user_metadata" (attached to the auth user at signup time), not
            // directly in the `companies` table. The first time that company
            // logs in, we copy those values into the real `companies` row if
            // they're not already saved there — a one-time migration on login.
            const metaCro = session.user.user_metadata?.cro_number;
            if (metaCro && !user.croNumber) saveCompanyCroNumber(user.id, metaCro);
            const metaIndustries = session.user.user_metadata?.industries;
            if (metaIndustries?.length && !user.industries?.length) saveCompanyIndustries(user.id, metaIndustries);
          }
          if (user.role === "admin") { navigate("/admin", { replace: true }); }
          else if (user.role === "company") { navigate("/company", { replace: true }); }
          else { navigate("/", { replace: true }); }
          if (user.role === "student") await loadStudentData(user.id);
        } catch (e) {
          Sentry.captureException(e);
          console.error("Failed to load profile", e);
        }
      }
      // TOKEN_REFRESHED fires automatically in the background whenever
      // Supabase silently renews the access token before it expires (this
      // keeps a logged-in session alive for days/weeks without the user
      // having to log in again). We re-fetch the profile here mainly to pick
      // up any changes made elsewhere (e.g. an admin approving verification
      // while the tab was open) — if it fails, we just keep showing the
      // existing `currentUser` rather than disrupting the session over it.
      if (event === "TOKEN_REFRESHED" && session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          if (!profile) return;
          const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
          setCurrentUser(user);
        } catch { /* silently ignore — stale data not critical */ }
      }
      // PASSWORD_RECOVERY fires when a user clicks the "reset your password"
      // link from their email — Supabase logs them into a special temporary
      // session just for setting a new password. passwordRecoveryMode is the
      // flag that unlocks the /reset-password route (see the <Route> guard
      // below) so this page can't be reached any other way, e.g. by someone
      // just typing the URL in without a valid recovery link.
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecoveryMode(true);
        navigate("/reset-password", { replace: true });
        clearTimeout(failsafe);
        setAuthLoading(false);
        return;
      }
      // SIGNED_OUT fires on explicit logout, or when Supabase forces a
      // sign-out itself (e.g. the "profile missing" or "email unconfirmed"
      // cases above). Wipes every piece of per-user state back to empty so
      // nothing from the previous account lingers, and unsubscribes from all
      // Supabase Realtime channels (see the effects below) since those were
      // scoped to the now-logged-out user's id.
      if (event === "SIGNED_OUT") {
        supabase.removeAllChannels();
        setCurrentUser(null);
        setLikedJobs([]);
        setAppliedJobs([]);
        setSavedLikedJobIds([]);
        setSavedAppliedJobIds([]);
        setAppStatuses({});
        setNotifCount(0);
        setMsgCount(0);
        navigate("/", { replace: true });
      }
    });

    return () => { clearTimeout(failsafe); subscription.unsubscribe(); };
  }, []);

  // Real-time: watch students table for verification status changes.
  // When a student is in "pending_review" (they've uploaded their ID docs and
  // are waiting on an admin), this subscribes to live database changes so
  // that the MOMENT an admin approves/rejects them elsewhere, this tab
  // updates and redirects automatically — no page refresh needed. Only runs
  // while status is pending_review, since that's the only state where a
  // change is expected/relevant.
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
              if (window.gtag) window.gtag("event", "verification_complete", { user_role: "student" });
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

  // Sync studentLocation when user logs in/out.
  // studentLocation drives the "distance from you" sorting/display on the
  // job feed. It's kept separate from currentUser so it can also be updated
  // live while browsing (e.g. clicking "use my current location") without
  // mutating the profile object.
  useEffect(() => {
    setStudentLocation(currentUser?.savedLocation ?? null);
  }, [currentUser?.id]);

  // Real-time: watch applications table for status changes.
  // Powers the notification badge (see the effect below) — the moment a
  // company accepts/rejects/moves a student's application through the
  // hiring pipeline, this fires and the student sees it live.
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
          setAppStatuses(prev => ({ ...prev, [row.job_id]: {
            status: row.status,
            pipeline_stage: row.pipeline_stage || "applied",
            preferred_shift: row.preferred_shift || null,
          } }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  // Recompute notification badge whenever statuses or applied jobs change.
  // "Pending" applications don't count — the badge is meant to draw
  // attention to applications that have MOVED (accepted/rejected/shortlisted
  // etc.), i.e. things the student hasn't seen yet, not just every application.
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") { setNotifCount(0); return; }
    const count = appliedJobs.reduce((acc, job) => {
      const status = appStatuses[job.id]?.status || "Pending";
      return acc + (status !== "Pending" ? 1 : 0);
    }, 0);
    setNotifCount(count);
  }, [appStatuses, appliedJobs, currentUser?.id]);

  // Message count badge — count distinct conversation threads with received messages.
  // Subscribes to new chat_messages INSERTs so the unread badge updates live
  // while the app is open, but only re-fetches the count when the message
  // was sent BY SOMEONE ELSE (payload.new.sender_id !== currentUser.id) —
  // otherwise sending your own message would bump your own unread count.
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

  // Logged-out visitors at "/" see the marketing LandingPage instead of the
  // Header/Footer chrome used everywhere else in the app (see the JSX below,
  // where Header/AppFooter are conditionally skipped when isLanding is true).
  const isLanding = !currentUser && location.pathname === "/";

  // Bundles every piece of shared state into one object and hands it down via
  // AppContext.Provider (below) so any page/component can call useApp() to
  // read currentUser, call setPage(), etc. without prop-drilling through every
  // layer of the component tree. Wrapped in useMemo so this object only
  // changes (and only triggers re-renders in consuming components) when one
  // of the listed dependencies actually changes.
  const appContextValue = useMemo(() => ({
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
    passwordRecoveryMode, setPasswordRecoveryMode,
    darkMode, toggleDarkMode,
  }), [
    currentUser, setPage, setSelectedJobBoth,
    likedJobs, appliedJobs,
    savedLikedJobIds, savedAppliedJobIds,
    studentLocation, appStatuses, notifCount, msgCount,
    passwordRecoveryMode, darkMode, toggleDarkMode,
  ]);

  // Block the entire app behind a loading screen until the INITIAL_SESSION
  // check (or the failsafe timeout) finishes — prevents a flash of the
  // logged-out landing page for users who are actually already logged in.
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--color-bg-subtle)" }}>
        <div style={{ textAlign: "center", color: "var(--color-text-secondary, #64748b)" }}>
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
      <main id="main-content" style={{ minHeight: "100vh" }}>
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            {/*
              ROUTE GUARDS — why routes check currentUser?.role / verificationStatus:

              Since currentUser and its verificationStatus live in this component's
              state (not in a server-side check), every protected route below
              re-derives "is this person allowed here right now" on every render
              by reading currentUser directly, rather than trusting the URL. This
              means: (a) a student who isn't verified yet gets bounced to /verify
              instead of seeing pages that require verification (applying,
              messaging), (b) a company can't land on student-only pages and
              vice versa, and (c) if a user's role/status changes while the app
              is open (e.g. the real-time verification effect above fires),
              routes react immediately since they're just reading state, not
              doing a one-time check on page load. Unauthorized visits fall
              back with <Navigate replace> to a sensible page rather than
              erroring, so someone can't get stuck on a blank screen.
            */}
            <Routes>
              {/* Home / Student Dashboard / Landing.
                  Logged out -> marketing landing page.
                  Logged-in student who hasn't finished verification (no status,
                  or still "pending") -> forced to /verify before they can browse.
                  Everyone else (verified student, company, admin) -> job feed. */}
              <Route path="/" element={
                !currentUser
                  ? <LandingPage />
                  : currentUser.role === "student" && (!currentUser.verificationStatus || currentUser.verificationStatus === "pending")
                    ? <Navigate to="/verify" replace />
                    : <StudentDashboard restoreScrollY={restoreScrollY} />
              } />

              {/* Job Details */}
              <Route path="/jobs/:titleSlug/:companySlug" element={
                <JobDetailsRoute selectedJob={selectedJob} />
              } />

              {/* Auth */}
              <Route path="/login"   element={<LoginPage />} />
              <Route path="/signup"  element={<SignupPage />} />
              <Route path="/reset-password" element={passwordRecoveryMode ? <ResetPasswordPage /> : <Navigate to="/login" replace />} />
              <Route path="/email-verified" element={<EmailVerifiedPage />} />

              {/* Student pages.
                  /applied and /messages additionally require verificationStatus
                  === "verified" — applying to jobs and messaging companies are
                  the two actions gated behind ID verification, so an unverified
                  student is sent to /verify instead of an empty page. */}
              <Route path="/account" element={currentUser?.role === "student" || currentUser?.role === "company" ? <AccountPage /> : <Navigate to="/login" replace />} />
              <Route path="/liked"   element={currentUser?.role === "student" ? <LikedJobs /> : <Navigate to="/" replace />} />
              <Route path="/applied" element={currentUser?.role === "student" && currentUser?.verificationStatus === "verified" ? <AppliedJobs /> : currentUser?.role === "student" ? <Navigate to="/verify" replace /> : <Navigate to="/" replace />} />
              <Route path="/messages" element={currentUser?.role === "student" && currentUser?.verificationStatus === "verified" ? <Messages /> : currentUser?.role === "student" ? <Navigate to="/verify" replace /> : <Navigate to="/" replace />} />
              <Route path="/verify"  element={currentUser?.role === "student" ? <VerifyDocsPage /> : <Navigate to="/" replace />} />

              {/* Company pages. Companies aren't gated behind a verificationStatus
                  check the way students are — /companies/:companyId (a public
                  profile page) is intentionally open to anyone, verified or not. */}
              <Route path="/company" element={currentUser?.role === "company" ? <CompanyDashboard /> : <Navigate to="/" replace />} />
              <Route path="/company/messages" element={currentUser?.role === "company" ? <CompanyMessages /> : <Navigate to="/" replace />} />
              <Route path="/companies/:companyId" element={<CompanyProfilePage />} />

              {/* Admin — verification queue only; admins have no job/application access */}
              <Route path="/admin" element={currentUser?.role === "admin" ? <AdminPage /> : <Navigate to="/" replace />} />

              {/* Info pages */}
              <Route path="/about"   element={<AboutPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms"   element={<TermsOfServicePage />} />
              <Route path="/help"    element={<HelpPage />} />
              <Route path="/contact" element={<ContactPage />} />

              {/* Community.
                  /forum is readable by anyone EXCEPT an unverified student —
                  logged-out visitors, companies, and admins all get <ForumPage />
                  directly, but a student mid-verification is redirected to
                  /verify first (same "finish verification before participating"
                  rule as /applied and /messages above). */}
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/forum" element={currentUser?.role === "student" && currentUser?.verificationStatus === "verified" ? <ForumPage /> : currentUser?.role === "student" ? <Navigate to="/verify" replace /> : <ForumPage />} />

              {/* 404 */}
              <Route path="/404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isLanding && <AppFooter />}
      <BetaFeedback /> {/* BETA ONLY — remove before full launch */}
      <CookieBanner />
      <Toaster position="bottom-center" containerProps={{ "aria-live": "polite", "aria-atomic": "true" }} toastOptions={{ duration: 4000, style: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: "0.875rem", borderRadius: "0.75rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" } }} />
    </AppContext.Provider>
  );
}

// Job details route — handles in-app nav (job in state/memory) and direct URL access (fetches from DB).
//
// A job details URL like /jobs/barista/costa-coffee can be reached two ways:
// 1. In-app: user clicked a job card, setPage("jobDetails") ran, and the job
//    object was passed along via router state (fast — no DB round-trip) or is
//    still sitting in the selectedJob ref/state from StudentShiftsWeb.
// 2. Direct URL: someone pastes/shares the link, or refreshes the page. There's
//    no router state or in-memory job in that case, so we fetch it from
//    Supabase by slug instead (fetchJobBySlug).
// This component tries options 1 first (instant, no loading state) and only
// falls back to fetching from the DB when neither is available or the slugs
// don't match what's currently loaded.
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
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-secondary, #64748b)" }}>
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
        <h1 style={{ margin: "0 0 0.75rem", fontWeight: "800", fontSize: "1.6rem", color: "var(--color-text-primary, #1e293b)" }}>Page not found</h1>
        <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.75rem" }}>
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

// Shown after a user clicks the email confirmation link from Supabase — that
// link logs them in (triggering SIGNED_IN above) and redirects here. This
// page just displays a short "success" message, then auto-redirects to the
// right home page for their role after a couple of seconds so the confirmation
// feels like a deliberate step rather than an instant silent redirect.
function EmailVerifiedPage() {
  const { currentUser } = useContext(AppContext);
  const navigate = useNavigate();
  useEffect(() => {
    if (!currentUser) return;
    const timer = setTimeout(() => {
      if (currentUser.role === "admin") navigate("/admin", { replace: true });
      else if (currentUser.role === "company" && currentUser.verificationStatus === "verified") navigate("/company", { replace: true });
      else if (currentUser.role === "company") navigate("/", { replace: true });
      else navigate("/", { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentUser]);

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", maxWidth: "420px" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>✅</div>
        <h2 style={{ margin: "0 0 0.5rem", fontWeight: "800", fontSize: "1.8rem", color: "var(--color-text-primary, #1e293b)" }}>Email verified!</h2>
        <p style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Your account is now active. Taking you to StudentShifts…
        </p>
        <div style={{ width: "48px", height: "48px", border: "4px solid #e5e7eb", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
      </div>
    </div>
  );
}
