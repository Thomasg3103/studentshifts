import { useState, useEffect } from "react";
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
import { supabase } from "./lib/supabase";
import { getProfile, fetchLikedJobIds, fetchAppliedJobIds } from "./lib/auth";

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
    studentIdCardName:  extra.student_id_url     || null,
    governmentIdName:   extra.gov_id_url         || null,
    savedLocation:      extra.location_lat ? {
      lat:         extra.location_lat,
      lng:         extra.location_lng,
      displayName: extra.location_display,
    } : null,
  };
}

export default function StudentShiftsWeb() {
  const [page, setPage]               = useState("studentDashboard");
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [likedJobs, setLikedJobs]         = useState([]);
  const [appliedJobs, setAppliedJobs]     = useState([]);
  const [savedLikedJobIds, setSavedLikedJobIds]   = useState([]);
  const [savedAppliedJobIds, setSavedAppliedJobIds] = useState([]);
  const [studentLocation, setStudentLocation] = useState(null);
  const [notifCount, setNotifCount]   = useState(0);
  const [authLoading, setAuthLoading] = useState(true);

  // Restore session on page load + listen for auth changes
  useEffect(() => {
    // Failsafe for browsers (e.g. Edge) that block Supabase localStorage access
    const failsafe = setTimeout(() => setAuthLoading(false), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION") {
        if (session?.user) {
          try {
            const profile = await getProfile(session.user.id);
            const user = normaliseProfile({ ...profile, email: profile.email || session.user.email });
            setCurrentUser(user);
            if (user.role === "company") setPage("companyDashboard");
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
          setPage(user.role === "company" ? "companyDashboard" : "studentDashboard");
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
      if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setLikedJobs([]);
        setAppliedJobs([]);
        setSavedLikedJobIds([]);
        setSavedAppliedJobIds([]);
        setPage("studentDashboard");
      }
    });

    return () => { clearTimeout(failsafe); subscription.unsubscribe(); };
  }, []);

  // Sync studentLocation when user logs in/out
  useEffect(() => {
    setStudentLocation(currentUser?.savedLocation ?? null);
  }, [currentUser?.id]);

  // Recompute notification badge for student
  useEffect(() => {
    if (!currentUser || currentUser.role !== "student") { setNotifCount(0); return; }
    const seen = JSON.parse(localStorage.getItem("ss_notif_seen_" + currentUser.id) || "{}");
    const count = appliedJobs.reduce((acc, job) => {
      const cur  = localStorage.getItem("ss_appstatus_" + currentUser.id + "_" + job.id) || "Pending";
      const prev = seen[job.id] || "Pending";
      return acc + (cur !== prev && cur !== "Pending" ? 1 : 0);
    }, 0);
    setNotifCount(count);
  }, [page, appliedJobs, currentUser?.id]);

  // Mark notifications as seen when student opens Applied Jobs
  useEffect(() => {
    if (page !== "appliedJobs" || !currentUser) return;
    const seen = {};
    appliedJobs.forEach(job => {
      seen[job.id] = localStorage.getItem("ss_appstatus_" + currentUser.id + "_" + job.id) || "Pending";
    });
    localStorage.setItem("ss_notif_seen_" + currentUser.id, JSON.stringify(seen));
    setNotifCount(0);
  }, [page]);

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

  const renderPage = () => {
    switch (page) {
      case "login":
        return <LoginPage setPage={setPage} setCurrentUser={setCurrentUser} />;
      case "signup":
        return <SignupPage setPage={setPage} />;
      case "studentDashboard":
        return (
          <StudentDashboard
            setPage={setPage}
            setSelectedJob={setSelectedJob}
            likedJobs={likedJobs}
            setLikedJobs={setLikedJobs}
            appliedJobs={appliedJobs}
            setAppliedJobs={setAppliedJobs}
            currentUser={currentUser}
            studentLocation={studentLocation}
            savedLikedJobIds={savedLikedJobIds}
            savedAppliedJobIds={savedAppliedJobIds}
          />
        );
      case "companyDashboard":
        return <CompanyDashboard setPage={setPage} currentUser={currentUser} />;
      case "account":
        return currentUser ? (
          <AccountPage currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} setLikedJobs={setLikedJobs} setAppliedJobs={setAppliedJobs} setStudentLocation={setStudentLocation} />
        ) : null;
      case "jobDetails":
        return selectedJob && (
          <JobDetails
            job={selectedJob}
            setPage={setPage}
            currentUser={currentUser}
            likedJobs={likedJobs}
            setLikedJobs={setLikedJobs}
            appliedJobs={appliedJobs}
            setAppliedJobs={setAppliedJobs}
          />
        );
      case "likedJobs":
        return currentUser && (
          <LikedJobs
            likedJobs={likedJobs}
            setLikedJobs={setLikedJobs}
            setSavedLikedJobIds={setSavedLikedJobIds}
            setSelectedJob={setSelectedJob}
            setPage={setPage}
            currentUser={currentUser}
          />
        );
      case "appliedJobs":
        return currentUser && (
          <AppliedJobs
            appliedJobs={appliedJobs}
            setAppliedJobs={setAppliedJobs}
            setSavedAppliedJobIds={setSavedAppliedJobIds}
            setSelectedJob={setSelectedJob}
            setPage={setPage}
            currentUser={currentUser}
          />
        );
      case "messages":
        return currentUser && <Messages currentUser={currentUser} setPage={setPage} />;
      case "companyMessages":
        return currentUser && <CompanyMessages currentUser={currentUser} setPage={setPage} />;
      case "about":
        return <AboutPage setPage={setPage} />;
      default:
        return (
          <StudentDashboard
            setPage={setPage}
            setSelectedJob={setSelectedJob}
            likedJobs={likedJobs}
            setLikedJobs={setLikedJobs}
            appliedJobs={appliedJobs}
            setAppliedJobs={setAppliedJobs}
            currentUser={currentUser}
            studentLocation={studentLocation}
            savedLikedJobIds={savedLikedJobIds}
            savedAppliedJobIds={savedAppliedJobIds}
          />
        );
    }
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
      {renderPage()}
    </>
  );
}
