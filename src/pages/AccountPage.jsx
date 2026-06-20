import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Cropper from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Helmet } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import toast from "react-hot-toast";
import BackButton from "../components/BackButton";
import { geocodeAddress, getCurrentPosition } from "../utils/geo";
import { updateStudentProfile, updateCompanyProfile, uploadAvatar, uploadDocument, signOut, deleteAccount, exportMyData, sendPasswordReset } from "../lib/auth";
import { uploadCoverPhoto } from "../lib/uploads";
import { supabase } from "../lib/supabase";
import { getOrCreateReferralCode, fetchMyReferrals } from "../lib/referrals";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { jobCategories } from "../data/jobCategories";
import { useApp } from "../context/AppContext";
import { supabaseImg } from "../utils/img";
import TimetableGrid from "../components/TimetableGrid";

const PART_TIME_SKILLS = [
  "Customer Service", "Cash Handling", "Till Operation", "Retail Sales", "Stock Management",
  "Merchandising", "Visual Merchandising", "Product Knowledge",
  "Food Service", "Food Preparation", "Kitchen Porter", "Barista", "Bartending",
  "Waitressing", "Hosting", "Catering", "Hospitality",
  "Cleaning & Housekeeping", "Laundry & Linen",
  "Warehouse Work", "Packing & Picking", "Forklift Operation", "Goods Receiving",
  "Delivery Driving", "Courier Work", "Bike Delivery",
  "Data Entry", "Administration", "Reception & Front Desk", "Filing & Record Keeping",
  "Microsoft Office", "Word Processing", "Spreadsheets",
  "Social Media Management", "Content Creation", "Graphic Design", "Photography",
  "Childcare", "Babysitting", "After-School Care",
  "Tutoring", "Teaching Assistant",
  "Event Staff", "Event Setup & Breakdown", "Ushering", "Crowd Management",
  "Security", "Door Work",
  "Call Centre", "Telesales", "Customer Support",
  "Teamwork", "Communication", "Time Management", "Attention to Detail",
  "Problem Solving", "Multitasking", "Cash Register", "POS Systems",
  "Manual Handling", "Health & Safety", "First Aid",
  "Promotions & Leafleting", "Brand Ambassador",
  "Gardening & Landscaping", "Car Washing", "Parking Attendant",
];

async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const size = Math.min(pixelCrop.width, pixelCrop.height, 600);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size);
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

async function getCroppedBlobRect(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const maxW = 1800;
  const scale = Math.min(1, maxW / pixelCrop.width);
  canvas.width  = Math.round(pixelCrop.width  * scale);
  canvas.height = Math.round(pixelCrop.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

const _acctCache = {
  notifPrefs: null, notifPrefsFetchedAt: 0,
  workHistory: null, workHistoryFetchedAt: 0,
  referralCode: null, referralCount: null, referralFetchedAt: 0,
  userId: null,
};
const ACCT_TTL = 5 * 60 * 1000;

export default function AccountPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, setPage, setLikedJobs, setAppliedJobs, setStudentLocation, darkMode, toggleDarkMode } = useApp();
  const { supported: pushSupported, permission: pushPermission, subscribed: pushSubscribed, loading: pushLoading, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications(currentUser?.id);
  const [availability, setAvailability]         = useState(currentUser.availability || {});
  const [jobPreferences, setJobPreferences]     = useState(currentUser.jobPreferences || []);
  const [industries, setIndustries]             = useState(currentUser.industries || []);
  const [industrySaved, setIndustrySaved]       = useState(false);
  const [industrySaving, setIndustrySaving]     = useState(false);
  const [linkedIn, setLinkedIn]                 = useState(currentUser.linkedIn || "");
  const [bio, setBio]                           = useState(currentUser.bio || "");
  const [website, setWebsite]                   = useState(currentUser.website || "");
  const [skills, setSkills]                     = useState(currentUser.skills || []);
  const [skillInput, setSkillInput]             = useState("");
  const [showSkillSuggestions, setShowSkillSuggestions] = useState(false);
  const skillWrapRef = useRef(null);
  const [saving, setSaving]                     = useState(false);
  const [saved, setSaved]                       = useState(false);
  const [saveError, setSaveError]               = useState("");
  const [showLogoutModal, setShowLogoutModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const deleteModalRef = useRef(null);
  const logoutModalRef = useRef(null);
  useFocusTrap(deleteModalRef, () => setShowDeleteModal(false), showDeleteModal);
  useFocusTrap(logoutModalRef, () => setShowLogoutModal(false), showLogoutModal);
  const [deleteConfirm, setDeleteConfirm]       = useState("");
  const [_deletePassword, setDeletePassword]   = useState("");
  const [deleting, setDeleting]                 = useState(false);
  const [deleteError, setDeleteError]           = useState("");
  const [exporting, setExporting]               = useState(false);
  const [changingPw, setChangingPw]             = useState(false);
  const [allowDm, setAllowDm]                   = useState(currentUser.allowCompanyDm !== false);
  const [profilePhoto, setProfilePhoto]         = useState(currentUser.profilePhoto || "");
  const [photoUploading, setPhotoUploading]     = useState(false);
  const [cropSrc, setCropSrc]                   = useState(null);
  const [crop, setCrop]                         = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom]                 = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const photoInputRef                           = useRef(null);
  const availDebounceRef    = useRef(null);
  const bioDebounceRef     = useRef(null);
  const websiteDebounceRef = useRef(null);
  const [showBackToTop, setShowBackToTop]        = useState(false);
  // Track whether bio / linkedin / website have been edited but not yet saved (dirty state)
  const [dirtyFields, setDirtyFields]           = useState(false);
  const [referralCode, setReferralCode]         = useState(null);
  const [referralCopied, setReferralCopied]     = useState(false);
  const [referralCount, setReferralCount]       = useState(0);
  const [transport, setTransport]               = useState(currentUser.transport || []);
  const [canStart, setCanStart]                 = useState(currentUser.canStart || "");
  const [_workExperience, _setWorkExperience]     = useState(currentUser.workExperience || "");
  const [workExperienceEntries, setWorkExperienceEntries] = useState(currentUser.workExperienceEntries || []);
  const [showAddExp, setShowAddExp]             = useState(false);
  const [newExpSector, setNewExpSector]         = useState("");
  const [newExpRole, setNewExpRole]             = useState("");
  const [newExpDuration, setNewExpDuration]     = useState("");
  const [rightToWork, setRightToWork]           = useState(currentUser.rightToWork || false);
  const [driverLicence, setDriverLicence]       = useState(currentUser.driverLicence || false);
  const [showProfilePreview, setShowProfilePreview] = useState(false);
  const [workHistory, setWorkHistory]               = useState([]);
  const [jobAlerts, setJobAlerts]                   = useState(() => localStorage.getItem("ss_job_alerts") === "1");
  const [notifPrefs, setNotifPrefs]                 = useState({});

  useEffect(() => {
    return () => { if (availDebounceRef.current) clearTimeout(availDebounceRef.current); };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Load notification preferences
  useEffect(() => {
    if (!currentUser?.id) return;
    if (_acctCache.userId === currentUser.id && Date.now() - _acctCache.notifPrefsFetchedAt < ACCT_TTL && _acctCache.notifPrefs) {
      setNotifPrefs(_acctCache.notifPrefs);
      return;
    }
    supabase
      .from("notification_preferences")
      .select("event_type, push_enabled, email_enabled")
      .eq("user_id", currentUser.id)
      .then(({ data }) => {
        if (data?.length) {
          const prefs = {};
          data.forEach(r => { prefs[r.event_type] = { push: r.push_enabled, email: r.email_enabled }; });
          _acctCache.notifPrefs = prefs;
          _acctCache.notifPrefsFetchedAt = Date.now();
          _acctCache.userId = currentUser.id;
          setNotifPrefs(prefs);
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser.role !== "student") return;
    if (_acctCache.userId === currentUser.id && Date.now() - _acctCache.workHistoryFetchedAt < ACCT_TTL && _acctCache.workHistory) {
      setWorkHistory(_acctCache.workHistory);
      return;
    }
    supabase
      .from("applications")
      .select("id, created_at, jobs(title, location, pay)")
      .eq("student_id", currentUser.id)
      .eq("status", "Accepted")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          _acctCache.workHistory = data;
          _acctCache.workHistoryFetchedAt = Date.now();
          _acctCache.userId = currentUser.id;
          setWorkHistory(data);
        }
      });
  }, [currentUser.role, currentUser.id]);

  // Load referral code for students
  useEffect(() => {
    if (currentUser.role !== "student") return;
    if (_acctCache.userId === currentUser.id && Date.now() - _acctCache.referralFetchedAt < ACCT_TTL && _acctCache.referralCode !== null) {
      setReferralCode(_acctCache.referralCode);
      setReferralCount(_acctCache.referralCount ?? 0);
      return;
    }
    getOrCreateReferralCode().then(code => {
      _acctCache.referralCode = code;
      _acctCache.referralFetchedAt = Date.now();
      _acctCache.userId = currentUser.id;
      setReferralCode(code);
    }).catch(() => {});
    fetchMyReferrals().then(rows => {
      _acctCache.referralCount = rows.length;
      setReferralCount(rows.length);
    }).catch(() => {});
  }, [currentUser.role]);

  // Autosave text fields 1.5s after the user stops typing
  const autoSaveRef = useRef(null);
  const triggerAutoSave = (fields, userUpdate) => {
    setDirtyFields(true);
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(async () => {
      if (currentUser.role === "student") await saveField(fields, userUpdate).catch(() => {});
      else await saveCompanyField(fields).catch(() => {});
      setDirtyFields(false);
    }, 300);
  };
  useEffect(() => () => clearTimeout(autoSaveRef.current), []);

  // Warn if navigating away before autosave completes
  useEffect(() => {
    if (!dirtyFields) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyFields]);

  const isStudent = currentUser.role === "student";
  const isCompany = currentUser.role === "company";

  // ── Company profile data (jobs + stats + cover photo) ─────────────────
  const [companyJobs, setCompanyJobs] = useState([]);
  const [hireStats, setHireStats] = useState(null);
  const [responseRate, setResponseRate] = useState(null);
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef(null);
  const [coverCropSrc, setCoverCropSrc] = useState(null);
  const [coverCrop, setCoverCrop] = useState({ x: 0, y: 0 });
  const [coverCropZoom, setCoverCropZoom] = useState(1);
  const [coverCroppedAreaPixels, setCoverCroppedAreaPixels] = useState(null);

  useEffect(() => {
    if (!isCompany) return;
    supabase.from("jobs").select("id, title, category, location, pay, days, photos, is_urgent").eq("company_id", currentUser.id).eq("status", "Active").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setCompanyJobs(data); });
    supabase.from("companies").select("cover_photo_url").eq("id", currentUser.id).single()
      .then(({ data }) => { if (data?.cover_photo_url) setCoverPhotoUrl(data.cover_photo_url); });
    supabase.rpc("get_company_hire_stats", { p_company_id: currentUser.id }).then(({ data }) => { if (data) setHireStats(data); }).catch(() => {});
    supabase.rpc("get_company_response_rate", { p_company_id: currentUser.id }).then(({ data }) => { if (data) setResponseRate(data); }).catch(() => {});
  }, [isCompany, currentUser.id]);

  const handleCoverPhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = ev => {
      setCoverCropSrc(ev.target.result);
      setCoverCrop({ x: 0, y: 0 });
      setCoverCropZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onCoverCropComplete = useCallback((_, pixels) => setCoverCroppedAreaPixels(pixels), []);

  const handleCoverCropConfirm = async () => {
    if (!coverCropSrc || !coverCroppedAreaPixels) return;
    setCoverUploading(true);
    setCoverCropSrc(null);
    try {
      const blob = await getCroppedBlobRect(coverCropSrc, coverCroppedAreaPixels);
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      const url = await uploadCoverPhoto(currentUser.id, file);
      await updateCompanyProfile(currentUser.id, { cover_photo_url: url });
      setCoverPhotoUrl(url);
      toast.success("Cover photo updated");
    } catch (err) {
      toast.error(err.message || "Cover photo upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  // ── Auto-save helper (students only) ───────────────────────────────────
  // Pass an optional `userUpdate` object to also sync currentUser state (camelCase keys).
  const saveField = async (fields, userUpdate) => {
    setDirtyFields(false);
    setSaving(true);
    setSaveError("");
    try {
      await updateStudentProfile(currentUser.id, fields);
      if (userUpdate) setCurrentUser(prev => ({ ...prev, ...userUpdate }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-save helper (companies only) ──────────────────────────────────
  const saveCompanyField = async (fields) => {
    setDirtyFields(false);
    setSaving(true);
    setSaveError("");
    try {
      await updateCompanyProfile(currentUser.id, fields);
      setCurrentUser(prev => ({ ...prev, ...fields }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      setSaveError("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Skills ──────────────────────────────────────────────────────────────
  const skillSuggestions = skillInput.trim().length > 0
    ? PART_TIME_SKILLS.filter(s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s))
    : [];

  const addSkillFromSuggestion = (s) => {
    if (skills.includes(s)) return;
    if (skills.length >= 50) { toast.error("You can add up to 50 skills."); return; }
    const next = [...skills, s];
    setSkills(next);
    setSkillInput("");
    setShowSkillSuggestions(false);
    saveField({ skills: next }, { skills: next });
  };

  const removeSkill = (s) => {
    const next = skills.filter(x => x !== s);
    setSkills(next);
    saveField({ skills: next }, { skills: next });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (skillWrapRef.current && !skillWrapRef.current.contains(e.target)) {
        setShowSkillSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Availability (debounced) ─────────────────────────────────────────────
  const handleAvailabilityChange = (newAvail) => {
    setAvailability(newAvail);
    if (availDebounceRef.current) clearTimeout(availDebounceRef.current);
    availDebounceRef.current = setTimeout(() => saveField({ availability: newAvail }, { availability: newAvail }), 800);
  };

  // ── Job Preferences ──────────────────────────────────────────────────────
  const handlePrefToggle = (cat) => {
    const active = jobPreferences.includes(cat);
    const next   = active ? jobPreferences.filter(c => c !== cat) : [...jobPreferences, cat];
    setJobPreferences(next);
    saveField({ job_preferences: next }, { jobPreferences: next });
  };

  // ── Profile Photo auto-upload ────────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so the same file can be re-selected if user cancels and tries again
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = ev => {
      setCropSrc(ev.target.result);
      setCrop({ x: 0, y: 0 });
      setCropZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setPhotoUploading(true);
    setSaving(true);
    setCropSrc(null);
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      setProfilePhoto(URL.createObjectURL(blob));
      const url = await uploadAvatar(currentUser.id, file);
      if (isCompany) {
        await updateCompanyProfile(currentUser.id, { profile_photo_url: url });
      } else {
        await updateStudentProfile(currentUser.id, { profile_photo_url: url });
      }
      setCurrentUser(prev => ({ ...prev, profilePhoto: url }));
      setProfilePhoto(url);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Sentry.captureException(err);
      setProfilePhoto(currentUser.profilePhoto || "");
      toast.error(err.message || "Photo upload failed.");
    } finally {
      setPhotoUploading(false);
      setSaving(false);
    }
  };

  // ── CV auto-upload ───────────────────────────────────────────────────────
  const handleCvUpload = async (file) => {
    if (!file) return;
    setSaving(true);
    try {
      const path = await uploadDocument(currentUser.id, file, "documents", "cv");
      await updateStudentProfile(currentUser.id, { cv_url: path });
      setCurrentUser(prev => ({ ...prev, cvName: file.name }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "CV upload failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Cover Letter auto-upload ─────────────────────────────────────────────
  const handleCoverLetterUpload = async (file) => {
    if (!file) return;
    setSaving(true);
    try {
      const path = await uploadDocument(currentUser.id, file, "documents", "cover-letter");
      await updateStudentProfile(currentUser.id, { cover_letter_url: path });
      setCurrentUser(prev => ({ ...prev, coverLetterName: file.name }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Cover letter upload failed.");
    } finally {
      setSaving(false);
    }
  };

  // ── Location ─────────────────────────────────────────────────────────────
  const saved_loc = currentUser.savedLocation || null;
  const [locationDone, setLocationDone]     = useState(!!saved_loc);

  // ── Industries (company) ─────────────────────────────────────────────────
  const handleSaveIndustries = async () => {
    setIndustrySaving(true);
    try {
      await updateCompanyProfile(currentUser.id, { industries });
      setCurrentUser(prev => ({ ...prev, industries }));
      setIndustrySaved(true);
      setTimeout(() => setIndustrySaved(false), 2500);
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Failed to save. Please try again.");
    } finally {
      setIndustrySaving(false);
    }
  };

  // ── Availability ICS export ──────────────────────────────────────────────
  const exportAvailabilityIcs = () => {
    const dayNumbers = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0 };
    const byDayMap   = { 0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA" };
    const nextWeekday = (targetDay) => {
      const today = new Date();
      const diff  = (targetDay - today.getDay() + 7) % 7 || 7;
      const d     = new Date(today);
      d.setDate(today.getDate() + diff);
      return d;
    };
    const fmt = (date, h, m) => {
      const y  = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, "0");
      const d  = String(date.getDate()).padStart(2, "0");
      return `${y}${mo}${d}T${String(h).padStart(2,"0")}${String(m||0).padStart(2,"0")}00`;
    };
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//StudentShifts//EN","X-WR-CALNAME:My Availability","X-WR-TIMEZONE:Europe/Dublin"];
    Object.entries(availability).forEach(([day, slots]) => {
      if (!slots?.length) return;
      const dayNum  = dayNumbers[day];
      const refDate = nextWeekday(dayNum);
      slots.forEach(slot => {
        const [hour, min] = slot.split(":").map(Number);
        lines.push(
          "BEGIN:VEVENT",
          `DTSTART;TZID=Europe/Dublin:${fmt(refDate, hour, min)}`,
          `DTEND;TZID=Europe/Dublin:${fmt(refDate, hour + 1, min)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byDayMap[dayNum]}`,
          `SUMMARY:Available — ${day} ${slot}`,
          `UID:${day}-${slot}-studentshifts`,
          "END:VEVENT"
        );
      });
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "my-availability.ics"; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Notification preferences ─────────────────────────────────────────────
  const toggleNotifPref = async (eventType, channel) => {
    const current = notifPrefs[eventType] || { push: true, email: true };
    const next    = { ...current, [channel]: !current[channel] };
    setNotifPrefs(prev => ({ ...prev, [eventType]: next }));
    const { error } = await supabase.from("notification_preferences").upsert(
      { user_id: currentUser.id, event_type: eventType, push_enabled: next.push, email_enabled: next.email },
      { onConflict: "user_id,event_type" }
    );
    if (error) {
      setNotifPrefs(prev => ({ ...prev, [eventType]: current }));
      toast.error("Failed to save notification preference.");
    }
  };

  // ── Export ───────────────────────────────────────────────────────────────
  const EXPORT_COOLDOWN_MS = 86_400_000; // 24 hours — mirrors DB rate limit
  const handleExport = async () => {
    const lastKey = `export_last_${currentUser.id}`;
    const last = parseInt(localStorage.getItem(lastKey) || "0", 10);
    const remainingMs = last + EXPORT_COOLDOWN_MS - Date.now();
    if (remainingMs > 0) {
      const hours = Math.floor(remainingMs / 3_600_000);
      const label = hours > 0 ? `${hours}h` : `${Math.ceil(remainingMs / 60_000)}m`;
      toast.error(`You've already exported today. Try again in ${label}.`);
      return;
    }
    setExporting(true);
    try {
      const data = await exportMyData(currentUser.id, currentUser.role);
      localStorage.setItem(lastKey, String(Date.now()));
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `studentshifts-data-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (e?.message?.includes("once every 24 hours")) {
        toast.error(e.message);
      } else {
        Sentry.captureException(e);
        toast.error("Export failed. Please try again.");
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Delete / Logout ──────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount();
      try { await signOut(); } catch (e) { console.warn("Sign-out after delete failed:", e); }
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('ss_notif_seen_')) localStorage.removeItem(key);
      }
      setCurrentUser(null);
      setLikedJobs([]);
      setAppliedJobs([]);
      setPage("studentDashboard");
    } catch (e) {
      Sentry.captureException(e);
      setDeleteError(e.message || "Failed to delete account.");
      setDeleting(false);
    }
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    setCurrentUser(null);
    setLikedJobs([]);
    setAppliedJobs([]);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ss_notif_seen_')) localStorage.removeItem(key);
    }
    signOut().catch(e => console.warn("Sign-out failed:", e));
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const docsStored = !!(currentUser.studentIdCardName && currentUser.governmentIdName)
    || currentUser.verificationStatus === "verified";

  const profileFields = isStudent ? [
    { label: "CV",       done: !!currentUser.cvName },
    { label: "Location", done: locationDone },
    { label: "Bio",      done: !!bio.trim() },
    { label: "Skills",   done: skills.length > 0 },
    { label: "LinkedIn", done: !!linkedIn.trim() },
  ] : [];
  const donePct = profileFields.length ? Math.round(profileFields.filter(f => f.done).length / profileFields.length * 100) : 0;
  const pcColor = donePct >= 80 ? "#16a34a" : donePct >= 40 ? "#d97706" : "#ef4444";

  // ── Sidebar cards (students) ──────────────────────────────────────────────
  const SidebarAvailability = () => (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", padding: "0.85rem 0.9rem", marginBottom: "0.75rem", borderTop: "3px solid var(--color-brand)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-brand)" }}>My Availability</p>
      </div>
      <p style={{ fontSize: "0.73rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.65rem", lineHeight: 1.4 }}>Mark when you're free — companies match shifts to your timetable.</p>
      <TimetableGrid value={availability} onChange={handleAvailabilityChange} />
    </div>
  );

  const SidebarPrefs = () => (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", padding: "0.85rem 0.9rem" }}>
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)" }}>Job Preferences</p>
      <p style={{ fontSize: "0.73rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.65rem", lineHeight: 1.4 }}>Industries you're interested in.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {Object.keys(jobCategories).map(cat => {
          const active = jobPreferences.includes(cat);
          return (
            <button key={cat} type="button" onClick={() => handlePrefToggle(cat)} style={{
              padding: "0.25rem 0.6rem", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600",
              cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`,
              backgroundColor: active ? "#fce7f3" : "#f8fafc",
              color: active ? "var(--color-brand)" : "#64748b",
            }}>
              {active ? "✓ " : ""}{cat}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Right column content (shared pieces) ─────────────────────────────────

  const handleChangePassword = async () => {
    setChangingPw(true);
    try {
      await sendPasswordReset(currentUser.email);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Failed to send reset email. Please try again.");
    } finally {
      setChangingPw(false);
    }
  };

  const BottomActions = () => (
    <>
      <div style={{ borderTop: "1.5px solid #e2e8f0", marginBottom: "1rem", marginTop: "0.25rem" }} />
      <button
        onClick={() => navigate("/")}
        style={{ ...btnBase, width: "100%", marginBottom: "0.75rem", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", boxShadow: "0 4px 14px rgba(162,29,84,0.3)" }}
      >
        ← Back to Home
      </button>
      {/* Appearance */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", padding: "0.65rem 0.85rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", borderRadius: "0.65rem", border: "1.5px solid var(--color-border-light, #e2e8f0)" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.875rem", color: "var(--color-text-primary, #1e293b)" }}>Appearance</p>
          <p style={{ margin: "0.1rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>{darkMode ? "Dark mode on" : "Light mode on"}</p>
        </div>
        <button
          onClick={toggleDarkMode}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          style={{ padding: "0.45rem 1rem", borderRadius: "2rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-primary, #1e293b)", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <button onClick={() => setShowLogoutModal(true)} style={{ ...btnBase, flex: 1, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 4px 14px rgba(244,63,94,0.3)" }}>Logout</button>
        <button onClick={() => { setDeleteConfirm(""); setDeletePassword(""); setDeleteError(""); setShowDeleteModal(true); }} style={{ ...btnBase, flex: 1, backgroundColor: "transparent", border: "1.5px solid #fca5a5", color: "#dc2626", boxShadow: "none" }}>Delete Account</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: "1.25rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
        <button onClick={handleChangePassword} disabled={changingPw} style={{ background: "none", border: "none", color: "var(--color-text-secondary, #64748b)", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
          {changingPw ? "Sending…" : "Change Password"}
        </button>
        <button onClick={handleExport} disabled={exporting} style={{ background: "none", border: "none", color: "var(--color-text-secondary, #64748b)", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
          {exporting ? "Exporting…" : "Download My Data"}
        </button>
        {pushSupported && pushPermission !== "denied" && (
          <button
            onClick={pushSubscribed ? unsubscribePush : subscribePush}
            disabled={pushLoading}
            style={{ background: "none", border: "none", color: pushSubscribed ? "var(--color-brand)" : "#64748b", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}
          >
            {pushLoading ? "…" : pushSubscribed ? "🔔 Notifications on" : "🔕 Enable Notifications"}
          </button>
        )}
      </div>
    </>
  );

  const firstName = currentUser.name || "";

  return (
    <>
      <Helmet>
        <title>My Account — StudentShifts</title>
        <meta name="description" content="Manage your StudentShifts profile, CV, availability, and account settings." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://studentshifts.ie/account" />
      </Helmet>
      <BackButton />
      <div style={{ backgroundColor: "var(--color-bg-subtle)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "1.5rem 1.25rem", boxSizing: "border-box", width: "100%", overflowX: "hidden" }}>
        <div style={{ maxWidth: isStudent ? "1100px" : "900px", margin: "0 auto" }}>

          {/* Waiting for approval banner — shown at top for pending_review students */}
          {isStudent && currentUser.verificationStatus === "pending_review" && (
            <div style={{ backgroundColor: "#fefce8", border: "1.5px solid #fde047", borderRadius: "0.85rem", padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <span style={{ fontSize: "1.2rem" }}>⏳</span>
              <div>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "0.9rem", color: "#854d0e" }}>Waiting for Approval</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400e", lineHeight: 1.5 }}>Your documents have been submitted. Our team usually reviews within 24 hours (Mon–Fri).</p>
              </div>
            </div>
          )}

          {/* Profile photo + name header — students only */}
          {isStudent && <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              {/* Avatar circle with loading overlay */}
              <div style={{ position: "relative", width: "88px", height: "88px", margin: "0 auto" }}>
                <div style={{ width: "88px", height: "88px", borderRadius: "50%", overflow: "hidden", border: "3px solid #fce7f3", backgroundColor: "var(--color-bg-subtle, #fafafa)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px var(--color-brand)22" }}>
                  {profilePhoto
                    ? <img loading="lazy" src={supabaseImg(profilePhoto, 176)} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <PersonIcon />}
                </div>
                {/* Uploading spinner overlay */}
                {photoUploading && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "22px", height: "22px", border: "3px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  </div>
                )}
              </div>
              <label style={{ position: "absolute", bottom: "2px", right: "2px", width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: photoUploading ? "not-allowed" : "pointer", fontSize: "0.7rem", opacity: photoUploading ? 0.6 : 1 }}>
                📷
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handlePhotoChange} disabled={photoUploading} />
              </label>
            </div>
            <p style={{ margin: "0.6rem 0 0", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "500" }}>Welcome back,</p>
            <p style={{ margin: "0.1rem 0 0.1rem", fontWeight: "800", fontSize: "1.15rem", color: "var(--color-text-primary, #1e293b)" }}>👋 {firstName}</p>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}>{currentUser.email}</p>
          </div>}

          {isStudent ? (
            /* ── Student single-column layout ── */
            <div>

              {/* Verification docs — hide for verified students; admin clears URLs on approval */}
              {currentUser.verificationStatus === "verified" ? (
                <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.85rem", padding: "0.75rem 1rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1rem" }}>✅</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "0.85rem", color: "#15803d" }}>Identity Verified</p>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#166634" }}>Your Student ID and Government ID have been reviewed and approved.</p>
                  </div>
                </div>
              ) : docsStored ? null : (
                <Collapsible title="Verification Documents" defaultOpen>
                  <DocRow label="Student ID Card" filename={currentUser.studentIdCardName} />
                  <DocRow label="Government ID"   filename={currentUser.governmentIdName} />
                </Collapsible>
              )}

              <LocationSection
                savedLoc={saved_loc}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                setStudentLocation={setStudentLocation}
                onSaved={() => setLocationDone(true)}
              />

              {/* My Availability — collapsible, below location */}
              <Collapsible title="My Availability">
                <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.75rem", lineHeight: 1.4 }}>Drag or tap to mark when you're free. Companies match shifts to your timetable.</p>
                <TimetableGrid value={availability} onChange={handleAvailabilityChange} />
                {Object.values(availability).some(s => s?.length > 0) && (
                  <button
                    type="button"
                    onClick={exportAvailabilityIcs}
                    style={{ marginTop: "0.85rem", padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    📅 Export to Calendar (.ics)
                  </button>
                )}
              </Collapsible>

              {/* Job Preferences */}
                <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.5rem" }}>Job Preferences</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.65rem" }}>Industries you're interested in.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {Object.keys(jobCategories).map(cat => {
                      const active = jobPreferences.includes(cat);
                      return (
                        <button key={cat} type="button" onClick={() => handlePrefToggle(cat)} style={{
                          padding: "0.45rem 0.8rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600",
                          cursor: "pointer", fontFamily: "inherit",
                          minHeight: "44px", display: "inline-flex", alignItems: "center",
                          border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`,
                          backgroundColor: active ? "#fce7f3" : "#f8fafc",
                          color: active ? "var(--color-brand)" : "#64748b",
                        }}>
                          {active ? "✓ " : ""}{cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Work Profile — structured fields for company filtering */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.15rem" }}>Work Profile</p>
                <p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.85rem" }}>Helps companies filter applicants — takes 30 seconds.</p>

                {/* Right to work + Driver's licence */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.85rem" }}>
                  {[
                    { key: "rightToWork", label: "I have the right to work in Ireland", value: rightToWork, set: v => { setRightToWork(v); saveField({ right_to_work: v }, { rightToWork: v }); } },
                    { key: "driverLicence", label: "I have a full driver's licence", value: driverLicence, set: v => { setDriverLicence(v); saveField({ driver_licence: v }, { driverLicence: v }); } },
                  ].map(({ key, label, value, set }) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.65rem", cursor: "pointer", padding: "0.55rem 0.75rem", backgroundColor: value ? "#f0fdf4" : "#f8fafc", borderRadius: "0.6rem", border: `1.5px solid ${value ? "#86efac" : "#e2e8f0"}` }}>
                      <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} style={{ width: "16px", height: "16px", accentColor: "#16a34a", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.85rem", fontWeight: "600", color: value ? "#15803d" : "#374151" }}>{label}</span>
                    </label>
                  ))}
                </div>

                {/* Transport */}
                <p style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)", margin: "0 0 0.4rem" }}>How do you get to work?</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.85rem" }}>
                  {["Own car", "Public transport", "Cycling / walking"].map(opt => {
                    const active = transport.includes(opt);
                    const next = active ? transport.filter(t => t !== opt) : [...transport, opt];
                    return (
                      <button key={opt} type="button" onClick={() => { setTransport(next); saveField({ transport: next }, { transport: next }); }}
                        style={{ padding: "0.4rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: active ? "#fce7f3" : "#f8fafc", color: active ? "var(--color-brand)" : "#64748b" }}>
                        {active ? "✓ " : ""}{opt}
                      </button>
                    );
                  })}
                </div>

                {/* Experience entries */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)" }}>Work Experience</label>
                    {!showAddExp && (
                      <button type="button" onClick={() => { setNewExpSector(""); setNewExpRole(""); setNewExpDuration(""); setShowAddExp(true); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-brand)", fontFamily: "inherit", padding: 0 }}>
                        + Add
                      </button>
                    )}
                  </div>

                  {workExperienceEntries.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
                      {workExperienceEntries.map((entry, idx) => {
                        const durLabel = { under1: "Under 1 yr", "1to3": "1–3 yrs", "3plus": "3+ yrs" }[entry.duration] || entry.duration;
                        return (
                          <div key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", backgroundColor: "#fce7f3", border: "1.5px solid var(--color-brand)", borderRadius: "999px", padding: "0.2rem 0.6rem", fontSize: "0.75rem", fontWeight: "600", color: "var(--color-brand)" }}>
                            <span>{entry.sector} · {entry.role} · {durLabel}</span>
                            <button type="button" onClick={() => {
                              const next = workExperienceEntries.filter((_, i) => i !== idx);
                              setWorkExperienceEntries(next);
                              saveField({ work_experience_entries: next }, { workExperienceEntries: next });
                            }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: "0.85rem", color: "var(--color-brand)", fontFamily: "inherit" }}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {workExperienceEntries.length === 0 && !showAddExp && (
                    <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "0 0 0.5rem", fontStyle: "italic" }}>No experience added yet</p>
                  )}

                  {showAddExp && (
                    <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid #e2e8f0", borderRadius: "0.65rem", padding: "0.75rem", marginBottom: "0.5rem" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <div>
                          <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-body, #374151)", display: "block", marginBottom: "0.2rem" }}>Sector</label>
                          <select value={newExpSector} onChange={e => { setNewExpSector(e.target.value); setNewExpRole(""); }}
                            style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.45rem", border: "1.5px solid #e2e8f0", fontSize: "0.78rem", fontFamily: "inherit", backgroundColor: "var(--color-bg-elevated, white)", color: newExpSector ? "#1e293b" : "#94a3b8" }}>
                            <option value="">Sector…</option>
                            {Object.keys(jobCategories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-body, #374151)", display: "block", marginBottom: "0.2rem" }}>Duration</label>
                          <select value={newExpDuration} onChange={e => setNewExpDuration(e.target.value)}
                            style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.45rem", border: "1.5px solid #e2e8f0", fontSize: "0.78rem", fontFamily: "inherit", backgroundColor: "var(--color-bg-elevated, white)", color: newExpDuration ? "#1e293b" : "#94a3b8" }}>
                            <option value="">Duration…</option>
                            <option value="under1">Under 1 year</option>
                            <option value="1to3">1–3 years</option>
                            <option value="3plus">3+ years</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <label style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-body, #374151)", display: "block", marginBottom: "0.2rem" }}>Role / Job Title</label>
                        {newExpSector && (jobCategories[newExpSector] || []).length > 0 ? (
                          <select value={newExpRole} onChange={e => setNewExpRole(e.target.value)}
                            style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.45rem", border: "1.5px solid #e2e8f0", fontSize: "0.78rem", fontFamily: "inherit", backgroundColor: "var(--color-bg-elevated, white)", color: newExpRole ? "#1e293b" : "#94a3b8" }}>
                            <option value="">Select role…</option>
                            {(jobCategories[newExpSector] || []).map(r => <option key={r} value={r}>{r}</option>)}
                            <option value="__other__">Other…</option>
                          </select>
                        ) : (
                          <input value={newExpRole} onChange={e => setNewExpRole(e.target.value)} placeholder="e.g. Bar Staff"
                            style={{ width: "100%", padding: "0.4rem 0.5rem", borderRadius: "0.45rem", border: "1.5px solid #e2e8f0", fontSize: "0.78rem", fontFamily: "inherit", boxSizing: "border-box" }} />
                        )}
                        {newExpRole === "__other__" && (
                          <input autoFocus value={""} onChange={e => setNewExpRole(e.target.value)} placeholder="Type role…"
                            style={{ width: "100%", marginTop: "0.35rem", padding: "0.4rem 0.5rem", borderRadius: "0.45rem", border: "1.5px solid #e2e8f0", fontSize: "0.78rem", fontFamily: "inherit", boxSizing: "border-box" }} />
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button type="button"
                          disabled={!newExpSector || !newExpRole || newExpRole === "__other__" || !newExpDuration}
                          onClick={() => {
                            const entry = { sector: newExpSector, role: newExpRole, duration: newExpDuration };
                            const next = [...workExperienceEntries, entry];
                            setWorkExperienceEntries(next);
                            saveField({ work_experience_entries: next }, { workExperienceEntries: next });
                            setShowAddExp(false);
                            setNewExpSector(""); setNewExpRole(""); setNewExpDuration("");
                          }}
                          style={{ flex: 1, padding: "0.45rem 0.6rem", borderRadius: "0.5rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: (!newExpSector || !newExpRole || newExpRole === "__other__" || !newExpDuration) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (!newExpSector || !newExpRole || newExpRole === "__other__" || !newExpDuration) ? 0.5 : 1 }}>
                          Add Entry
                        </button>
                        <button type="button" onClick={() => setShowAddExp(false)}
                          style={{ padding: "0.45rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", background: "none", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Can start */}
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)", display: "block", marginBottom: "0.3rem" }}>Can start</label>
                    <select value={canStart} onChange={e => { setCanStart(e.target.value); saveField({ can_start: e.target.value }, { canStart: e.target.value }); }}
                      style={{ width: "100%", padding: "0.45rem 0.6rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", fontSize: "0.8rem", fontFamily: "inherit", color: canStart ? "#1e293b" : "#64748b", backgroundColor: "var(--color-bg-elevated, white)" }}>
                      <option value="">Select…</option>
                      <option value="immediately">Immediately</option>
                      <option value="1week">Within 1 week</option>
                      <option value="2weeks">Within 2 weeks</option>
                      <option value="1month">Within 1 month</option>
                    </select>
                </div>
              </div>

              {/* My Profile */}
                <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1.25rem", marginBottom: "1rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 1rem" }}>My Profile</p>

                  {/* Completeness bar */}
                  {(() => {
                    const done = profileFields.filter(f => f.done).length;
                    return (
                      <div style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--color-text-body, #374151)" }}>Profile Completeness</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: pcColor }}>{done}/{profileFields.length}</span>
                        </div>
                        <div style={{ height: "8px", backgroundColor: "#e5e7eb", borderRadius: "999px", overflow: "hidden", marginBottom: "0.45rem" }}>
                          <div style={{ height: "100%", width: donePct + "%", backgroundColor: pcColor, borderRadius: "999px", transition: "width 0.3s" }} />
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {profileFields.map(f => (
                            <span key={f.label} style={{ fontSize: "0.7rem", fontWeight: "600", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: f.done ? "#dcfce7" : "#f3f4f6", color: f.done ? "#16a34a" : "#64748b" }}>
                              {f.done ? "✓" : "○"} {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <FileUpload label="CV" hint=".pdf or .docx — required to apply" accept=".pdf,.doc,.docx" onUpload={handleCvUpload} existingName={currentUser.cvName} required />
                  <FileUpload label="Cover Letter" hint=".pdf or .docx — optional" accept=".pdf,.doc,.docx" onUpload={handleCoverLetterUpload} existingName={currentUser.coverLetterName} />

                  <label htmlFor="linkedin-url" style={labelStyle}>LinkedIn URL <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)" }}>(optional)</span></label>
                  <input
                    id="linkedin-url"
                    placeholder="https://linkedin.com/in/yourname"
                    value={linkedIn}
                    onChange={e => { setLinkedIn(e.target.value); triggerAutoSave({ linkedin: e.target.value }, { linkedIn: e.target.value }); }}
                    onBlur={() => {
                      setDirtyFields(false);
                      if (linkedIn && !/^https:\/\/([a-zA-Z0-9-]+\.)?linkedin\.com\//.test(linkedIn)) {
                        toast.error("Please enter a valid LinkedIn URL (e.g. https://linkedin.com/in/yourname)");
                        return;
                      }
                      saveField({ linkedin: linkedIn }, { linkedIn });
                    }}
                    style={inputStyle}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <label htmlFor="short-bio" style={labelStyle}>Short Bio <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)" }}>(optional)</span></label>
                    <span style={{ fontSize: "0.73rem", color: bio.length > 450 ? "#ef4444" : "#64748b" }}>{bio.length}/500</span>
                  </div>
                  <textarea
                    id="short-bio"
                    placeholder="Tell employers a bit about yourself…"
                    value={bio}
                    maxLength={500}
                    onChange={e => { setBio(e.target.value); triggerAutoSave({ bio: e.target.value }, { bio: e.target.value }); }}
                    onBlur={() => { setDirtyFields(false); saveField({ bio }, { bio }); }}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
                  />

                  <label htmlFor="skills-input" style={labelStyle}>Skills <span style={{ fontWeight: "400", color: "var(--color-text-secondary, #64748b)" }}>(type to search, click to add)</span></label>
                  <div ref={skillWrapRef} style={{ position: "relative", marginBottom: "0.5rem" }}>
                    <input
                      id="skills-input"
                      placeholder="e.g. Customer Service"
                      value={skillInput}
                      onChange={e => { setSkillInput(e.target.value); setShowSkillSuggestions(true); }}
                      onFocus={() => setShowSkillSuggestions(true)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                    />
                    {showSkillSuggestions && skillSuggestions.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto", marginTop: "0.25rem" }}>
                        {skillSuggestions.map(s => (
                          <button
                            key={s}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addSkillFromSuggestion(s); }}
                            style={{ display: "block", width: "100%", textAlign: "left", padding: "0.55rem 0.85rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "var(--color-text-primary, #1e293b)", fontFamily: "inherit" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                          >{s}</button>
                        ))}
                      </div>
                    )}
                    {showSkillSuggestions && skillInput.trim().length > 0 && skillSuggestions.length === 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.6rem", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", padding: "0.6rem 0.85rem", marginTop: "0.25rem" }}>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)" }}>No matching skills found</p>
                      </div>
                    )}
                  </div>
                  {skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {skills.map(s => (
                        <span key={s} style={{ fontSize: "0.8rem", backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1.5px solid #bfdbfe", borderRadius: "999px", padding: "0.2rem 0.6rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          {s}
                          <button aria-label={`Remove skill: ${s}`} onClick={() => removeSkill(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-secondary, #6b7280)", fontSize: "0.8rem", padding: "0.25rem", lineHeight: 1, minWidth: "28px", minHeight: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}

                {/* Preview Profile button */}
                <button
                  onClick={() => setShowProfilePreview(true)}
                  style={{ width: "100%", marginTop: "0.85rem", padding: "0.55rem", borderRadius: "0.6rem", border: "1.5px solid var(--color-brand)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-brand)", fontWeight: "700", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
                >
                  👁 Preview — How companies see your profile
                </button>
                </div>

              {/* Work History */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: 0 }}>Work History</p>
                  {workHistory.length > 0 && <span style={{ fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>{workHistory.length} shift{workHistory.length !== 1 ? "s" : ""}</span>}
                </div>
                {workHistory.length === 0 ? (
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>Shifts you complete through StudentShifts will appear here.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {workHistory.map(app => (
                      <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0.75rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "700", color: "var(--color-text-primary, #0f172a)" }}>{app.jobs?.title || "Job"}</p>
                          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>{app.jobs?.location}{app.jobs?.pay ? ` · ${app.jobs.pay}` : ""}</p>
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: "700", backgroundColor: "#dcfce7", borderRadius: "999px", padding: "0.15rem 0.5rem", flexShrink: 0 }}>Hired</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills Endorsements — placeholder */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                  <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: 0 }}>Skills Endorsements</p>
                  <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#7c3aed", backgroundColor: "#ede9fe", borderRadius: "999px", padding: "0.1rem 0.45rem" }}>Coming Soon</span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: 0 }}>Companies you've worked with will be able to endorse your skills, making your profile stand out to future employers.</p>
              </div>

              {/* Job Alerts */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.5rem" }}>Job Alerts</p>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={jobAlerts}
                    onChange={e => {
                      const next = e.target.checked;
                      setJobAlerts(next);
                      if (next) localStorage.setItem("ss_job_alerts", "1");
                      else localStorage.removeItem("ss_job_alerts");
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--color-brand)" }}
                  />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text-body, #374151)" }}>
                    Notify me when new jobs match my preferences
                  </span>
                </label>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.77rem", color: "var(--color-text-secondary, #64748b)", paddingLeft: "1.75rem" }}>
                  Alerts are sent when jobs matching your preferred categories are posted.
                </p>
              </div>

              {/* Notification Preferences */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.6rem" }}>Notification Preferences</p>
                <p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.85rem", lineHeight: 1.4 }}>Choose what you're notified about and how.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    { key: "new_message",      label: "New message from a company" },
                    { key: "application_update", label: "Application status changes" },
                    { key: "job_alert",        label: "New jobs matching my preferences" },
                    { key: "trial_reminder",   label: "Reminder before a trial shift" },
                  ].map(({ key, label }) => {
                    const pref = notifPrefs[key] || { push: true, email: true };
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0.75rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--color-text-body, #374151)", flex: 1 }}>{label}</span>
                        <div style={{ display: "flex", gap: "0.65rem", flexShrink: 0 }}>
                          {pushSupported && (
                            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>
                              <input type="checkbox" checked={pref.push} onChange={() => toggleNotifPref(key, "push")} style={{ accentColor: "var(--color-brand)", width: "14px", height: "14px" }} />
                              Push
                            </label>
                          )}
                          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", cursor: "pointer", fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>
                            <input type="checkbox" checked={pref.email} onChange={() => toggleNotifPref(key, "email")} style={{ accentColor: "var(--color-brand)", width: "14px", height: "14px" }} />
                            Email
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DM Consent */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
                <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.5rem" }}>Messaging</p>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={allowDm}
                    onChange={async e => {
                      const next = e.target.checked;
                      setAllowDm(next);
                      try {
                        const { error } = await supabase
                          .from("students")
                          .update({ allow_company_dm: next })
                          .eq("id", currentUser.id)
                          .select("id");
                        if (error) throw error;
                        setCurrentUser(prev => ({ ...prev, allowCompanyDm: next }));
                        toast.success(next ? "DMs enabled" : "DMs disabled");
                      } catch (err) {
                        setAllowDm(!next);
                        Sentry.captureException(err);
                        toast.error("Failed to save — please try again.");
                      }
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--color-brand)" }}
                  />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-text-body, #374151)" }}>
                    Allow verified companies to send me messages before I apply
                  </span>
                </label>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.77rem", color: "var(--color-text-secondary, #64748b)", paddingLeft: "1.75rem" }}>
                  Companies can only contact you if they have been verified by StudentShifts.
                </p>
              </div>

              {/* ── Refer a Friend ── */}
              {referralCode && (
                <div style={{ backgroundColor: "#fdf4ff", border: "1.5px solid #e9d5ff", borderRadius: "1rem", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span style={{ fontSize: "1.1rem" }}>🎁</span>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#6b21a8" }}>Refer a Friend</span>
                    {referralCount > 0 && (
                      <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#7e22ce", fontWeight: 600, backgroundColor: "#ede9fe", borderRadius: "999px", padding: "0.1rem 0.55rem" }}>
                        {referralCount} referred
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 0.65rem", fontSize: "0.8rem", color: "#7c3aed", lineHeight: 1.45 }}>
                    Share your link — friends who sign up via your link are tracked here.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      readOnly
                      value={`${window.location.origin}/signup?ref=${referralCode}`}
                      style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: "0.6rem", border: "1.5px solid #c4b5fd", fontSize: "0.78rem", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-elevated, white)", fontFamily: "monospace", outline: "none" }}
                      onClick={e => e.target.select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/signup?ref=${referralCode}`).catch(() => {});
                        setReferralCopied(true);
                        setTimeout(() => setReferralCopied(false), 2000);
                      }}
                      style={{ padding: "0.5rem 0.9rem", borderRadius: "0.6rem", border: "none", backgroundColor: "#7c3aed", color: "white", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {referralCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              )}

              {/* Save status — above logout/delete */}
              {(saving || saved || saveError) && (
                <div style={{ textAlign: "center", padding: "0.6rem 1rem", marginBottom: "0.75rem", borderRadius: "0.6rem", backgroundColor: saveError ? "#fff1f2" : saved ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${saveError ? "#fca5a5" : saved ? "#86efac" : "#e2e8f0"}` }}>
                  {saving && <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", fontWeight: 600 }}>Saving…</p>}
                  {saved  && <p style={{ margin: 0, fontSize: "0.8rem", color: "#16a34a", fontWeight: 700 }}>✓ Saved</p>}
                  {saveError && <p style={{ margin: 0, fontSize: "0.8rem", color: "#ef4444", fontWeight: 600 }}>{saveError}</p>}
                </div>
              )}

              <BottomActions />
            </div>
          ) : (
            /* ── Company layout — public profile + editing ── */
            <div>
              {/* Banner + logo (editable photo) */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", marginBottom: "1.25rem" }}>
                <div style={{ height: "140px", borderRadius: "1rem 1rem 0 0", position: "relative", background: coverPhotoUrl ? `url(${coverPhotoUrl}) center/cover no-repeat` : "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 55%, #1e293b 100%)" }}>
                  {!coverPhotoUrl && <div style={{ position: "absolute", inset: 0, borderRadius: "1rem 1rem 0 0", backgroundImage: "radial-gradient(circle at 15% 60%, rgba(255,255,255,0.10) 0%, transparent 55%), radial-gradient(circle at 75% 25%, rgba(255,255,255,0.07) 0%, transparent 45%)" }} />}
                  <label style={{ position: "absolute", top: "10px", right: "10px", display: "inline-flex", alignItems: "center", gap: "0.3rem", padding: "0.35rem 0.75rem", borderRadius: "999px", backgroundColor: "rgba(0,0,0,0.45)", color: "white", fontSize: "0.75rem", fontWeight: "700", cursor: coverUploading ? "not-allowed" : "pointer", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.2)" }}>
                    {coverUploading ? "Uploading…" : "📷 Change cover"}
                    <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handleCoverPhotoChange} disabled={coverUploading} />
                  </label>
                </div>
                <div style={{ padding: "0 1.75rem" }}>
                  <div style={{ position: "relative", display: "inline-block", marginTop: "-44px" }}>
                    <div style={{ width: "88px", height: "88px", borderRadius: "1rem", border: "3px solid white", backgroundColor: "var(--color-bg-surface, #f1f5f9)", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>
                      {photoUploading
                        ? <div style={{ width: "24px", height: "24px", border: "3px solid rgba(0,0,0,0.15)", borderTopColor: "var(--color-brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        : profilePhoto
                          ? <img src={supabaseImg(profilePhoto, 176)} alt={currentUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : "🏢"}
                    </div>
                    <label style={{ position: "absolute", bottom: "-4px", right: "-4px", width: "26px", height: "26px", borderRadius: "50%", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center", cursor: photoUploading ? "not-allowed" : "pointer", fontSize: "0.65rem", zIndex: 1 }}>
                      📷
                      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handlePhotoChange} disabled={photoUploading} />
                    </label>
                  </div>
                </div>
                <div style={{ padding: "0.85rem 1.75rem 1.5rem" }}>
                  <h2 style={{ margin: "0 0 1rem", fontWeight: "800", fontSize: "1.4rem", color: "var(--color-text-primary, #1e293b)" }}>{currentUser.name}</h2>

                  {/* Industries */}
                  <p style={{ margin: "0 0 0.4rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Industries</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
                    {Object.keys(jobCategories).map(cat => {
                      const active = industries.includes(cat);
                      return (
                        <button key={cat} type="button"
                          onClick={() => setIndustries(prev => active ? prev.filter(c => c !== cat) : [...prev, cat])}
                          style={{ padding: "0.3rem 0.75rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${active ? "var(--color-brand)" : "#e2e8f0"}`, backgroundColor: active ? "#fce7f3" : "white", color: active ? "var(--color-brand)" : "#64748b" }}>
                          {active ? "✓ " : ""}{cat}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={handleSaveIndustries} disabled={industrySaving} style={{ marginBottom: "1rem", padding: "0.3rem 0.9rem", borderRadius: "999px", fontSize: "0.78rem", fontWeight: "700", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", cursor: industrySaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {industrySaved ? "✓ Saved!" : industrySaving ? "Saving…" : "Save Industries"}
                  </button>

                  {/* Website */}
                  <p style={{ margin: "0 0 0.3rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Website</p>
                  <input
                    placeholder="https://yourcompany.ie"
                    value={website}
                    onChange={e => {
                      setWebsite(e.target.value);
                      if (websiteDebounceRef.current) clearTimeout(websiteDebounceRef.current);
                      websiteDebounceRef.current = setTimeout(() => saveCompanyField({ website: e.target.value }), 800);
                    }}
                    onBlur={() => { if (websiteDebounceRef.current) { clearTimeout(websiteDebounceRef.current); websiteDebounceRef.current = null; } saveCompanyField({ website }); }}
                    style={{ ...inputStyle, marginBottom: "1rem" }}
                  />

                  {/* Bio */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Bio</p>
                    <span style={{ fontSize: "0.73rem", color: bio.length > 450 ? "#ef4444" : "#64748b" }}>{bio.length}/500</span>
                  </div>
                  <textarea
                    placeholder="Tell students about your company, culture, and the kinds of roles you hire for…"
                    value={bio}
                    maxLength={500}
                    onChange={e => {
                      setBio(e.target.value);
                      if (bioDebounceRef.current) clearTimeout(bioDebounceRef.current);
                      bioDebounceRef.current = setTimeout(() => saveCompanyField({ bio: e.target.value }), 800);
                    }}
                    onBlur={() => { if (bioDebounceRef.current) { clearTimeout(bioDebounceRef.current); bioDebounceRef.current = null; } saveCompanyField({ bio }); }}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: "1.5" }}
                  />
                  {(saving || saved || saveError) && (
                    <div style={{ padding: "0.4rem 0.75rem", borderRadius: "0.5rem", backgroundColor: saveError ? "#fff1f2" : saved ? "#f0fdf4" : "#f8fafc", border: `1.5px solid ${saveError ? "#fca5a5" : saved ? "#86efac" : "#e2e8f0"}` }}>
                      {saving && <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>Saving…</p>}
                      {saved  && <p style={{ margin: 0, fontSize: "0.8rem", color: "#16a34a", fontWeight: 700 }}>✓ Saved</p>}
                      {saveError && <p style={{ margin: 0, fontSize: "0.8rem", color: "#ef4444", fontWeight: 600 }}>{saveError}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
                <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>{companyJobs.length}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Active Jobs</p>
                </div>
                <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>{hireStats ? hireStats.total_hired : "—"}</p>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Total Hired</p>
                </div>
                <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", padding: "1rem 1.25rem", textAlign: "center" }}>
                  {responseRate?.total_received > 0 ? (
                    <>
                      <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: "800", color: "var(--color-text-primary, #0f172a)" }}>{responseRate.response_rate_pct}%</p>
                      <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", fontWeight: "600" }}>Response Rate</p>
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

              {/* Open Positions */}
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary, #0f172a)" }}>Open Positions ({companyJobs.length})</h2>
              {companyJobs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2rem 1rem", backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "0.85rem", border: "1.5px solid #e2e8f0", color: "var(--color-text-secondary, #64748b)", marginBottom: "1.25rem" }}>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "0.9rem" }}>No active jobs right now</p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem" }}>Jobs you post will appear here once active.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.25rem" }}>
                  {companyJobs.map(job => (
                    <div key={job.id} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "0.85rem", padding: "0.9rem 1.1rem", display: "flex", alignItems: "center", gap: "0.85rem" }}>
                      {job.photos?.[0] && <img src={job.photos[0]} alt="" style={{ width: "48px", height: "48px", borderRadius: "0.5rem", objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                          <p style={{ margin: 0, fontWeight: "700", fontSize: "0.92rem", color: "var(--color-text-primary, #0f172a)" }}>{job.title}</p>
                          {job.is_urgent && <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#dc2626", backgroundColor: "#fee2e2", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>Urgent</span>}
                        </div>
                        <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)" }}>📍 {job.location} &nbsp;·&nbsp; 💰 {job.pay} &nbsp;·&nbsp; {job.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Student Reviews */}
              <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: "700", color: "var(--color-text-primary, #0f172a)" }}>Student Reviews</h3>
                  <span style={{ fontSize: "0.65rem", fontWeight: "700", color: "#a855f7", backgroundColor: "#f5f3ff", borderRadius: "999px", padding: "0.2rem 0.6rem" }}>Coming Soon</span>
                </div>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#94a3b8" }}>Students who've worked here will be able to leave reviews once this feature launches.</p>
              </div>

              {/* Account Details */}
              <Collapsible title="Account Details">
                <InfoRow label="Name"  value={currentUser.name} />
                <InfoRow label="Email" value={currentUser.email} />
                <InfoRow label="Role"  value="Company" />
                {currentUser.croNumber && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                    <span style={{ color: "var(--color-text-secondary, #6b7280)" }}>CRO Number</span>
                    <span style={{ fontWeight: "600", color: "var(--color-text-primary, #111827)", fontFamily: "monospace", fontSize: "0.92rem", letterSpacing: "0.05em" }}>{currentUser.croNumber}</span>
                  </div>
                )}
              </Collapsible>

              <BottomActions />
            </div>
          )}
        </div>

        {/* ── Delete modal ── */}
        {showDeleteModal && (
          <div onClick={() => setShowDeleteModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)" }}>
            <div ref={deleteModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff1f2", border: "2px solid #fecdd3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>⚠️</div>
              <h3 id="delete-modal-title" style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.35rem", color: "var(--color-text-primary, #1e293b)" }}>Delete your account?</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", margin: "0 0 1.25rem" }}>This is permanent. Your profile, CV, and all data will be deleted.</p>
              <p style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--color-text-body, #374151)", margin: "0 0 0.4rem", textAlign: "left" }}>Type <strong>DELETE</strong> to confirm</p>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={{ ...inputStyle, marginBottom: "0.75rem", borderColor: deleteConfirm === "DELETE" ? "#ef4444" : "#e2e8f0" }} />
              {deleteError && <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 0.75rem" }}>{deleteError}</p>}
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Cancel</button>
                <button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE" || deleting} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: deleteConfirm === "DELETE" ? "#dc2626" : "#fca5a5", color: "white", fontWeight: "700", cursor: deleteConfirm === "DELETE" && !deleting ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "0.9rem" }}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Profile preview modal ── */}
        {showProfilePreview && (
          <div onClick={() => setShowProfilePreview(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200, padding: "1rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)" }}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Profile preview" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "1.5rem", maxWidth: "400px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>How companies see your profile</h3>
                <button onClick={() => setShowProfilePreview(false)} style={{ width: "30px", height: "30px", borderRadius: "0.4rem", border: "1px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", cursor: "pointer", color: "var(--color-text-secondary, #64748b)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>✕</button>
              </div>

              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.25rem", padding: "0.85rem", backgroundColor: "var(--color-bg-surface, #f8fafc)", borderRadius: "0.75rem" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {currentUser.profilePhoto
                    ? <img src={currentUser.profilePhoto} alt={currentUser.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #0f172a)" }}>{currentUser.name}</p>
                  {currentUser.verificationStatus === "verified" && (
                    <span style={{ fontSize: "0.72rem", fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>✓ Verified Student</span>
                  )}
                </div>
              </div>

              {/* Checklist */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <PreviewRow ok={!!currentUser.cvName} label="CV" detail={currentUser.cvName ? "Uploaded" : "Not uploaded — required to apply"} />
                <PreviewRow ok={!!currentUser.coverLetterName} warn label="Cover Letter" detail={currentUser.coverLetterName ? "Uploaded" : "Not uploaded (optional)"} />
                <PreviewRow ok={!!currentUser.bio} label="Bio" detail={bio || "Not written yet"} truncate />
                <PreviewRow ok={(skills || []).length > 0} label="Skills" detail={(skills || []).length > 0 ? skills.join(", ") : "None listed"} truncate />
                <PreviewRow ok={!!linkedIn} warn label="LinkedIn" detail={linkedIn || "Not provided"} truncate />

                {/* Work profile */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", fontWeight: "700", color: "var(--color-text-secondary, #64748b)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Work Profile</p>
                  <PreviewRow ok={rightToWork} label="Right to work in Ireland" />
                  <PreviewRow ok={driverLicence} warn label="Driver's licence" />
                  {transport.length > 0 && <PreviewRow ok label="Transport" detail={transport.join(", ")} />}
                  {workExperienceEntries.length > 0 && workExperienceEntries.map((e, i) => {
                    const dur = { under1: "Under 1 yr", "1to3": "1–3 yrs", "3plus": "3+ yrs" }[e.duration] || e.duration;
                    return <PreviewRow key={i} ok label="Experience" detail={`${e.sector} · ${e.role} · ${dur}`} />;
                  })}
                  {canStart && <PreviewRow ok label="Can start" detail={{ immediately: "Immediately", "1week": "Within 1 wk", "2weeks": "Within 2 wks", "1month": "Within 1 mo" }[canStart] || canStart} />}
                </div>
              </div>

              <button onClick={() => setShowProfilePreview(false)} style={{ width: "100%", marginTop: "1.25rem", padding: "0.65rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}>
                Close Preview
              </button>
            </div>
          </div>
        )}

        {/* ── Photo crop modal ── */}
        {cropSrc && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem", WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)" }}>
            <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", width: "100%", maxWidth: "380px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
              <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: "1px solid var(--color-border-light, #e2e8f0)" }}>
                <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>Crop your photo</h3>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>Drag to reposition · Pinch or scroll to zoom</p>
              </div>
              {/* Cropper area */}
              <div style={{ position: "relative", width: "100%", height: "300px", background: "#0f172a" }}>
                <Cropper
                  image={cropSrc}
                  crop={crop}
                  zoom={cropZoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setCropZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              {/* Zoom slider */}
              <div style={{ padding: "0.75rem 1.5rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", flexShrink: 0 }}>Zoom</span>
                <input
                  type="range" min={1} max={3} step={0.05} value={cropZoom}
                  onChange={e => setCropZoom(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--color-brand, #a21d54)" }}
                />
              </div>
              {/* Actions */}
              <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem 1.25rem" }}>
                <button
                  onClick={() => { setCropSrc(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                  style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
                >Cancel</button>
                <button
                  onClick={handleCropConfirm}
                  style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
                >Save photo</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Cover photo crop modal ── */}
        {coverCropSrc && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem", WebkitBackdropFilter: "blur(4px)", backdropFilter: "blur(4px)" }}>
            <div style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", width: "100%", maxWidth: "560px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
              <div style={{ padding: "1.25rem 1.5rem 0.75rem", borderBottom: "1px solid var(--color-border-light, #e2e8f0)" }}>
                <h3 style={{ margin: 0, fontWeight: "800", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>Crop your cover photo</h3>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>Drag to reposition · Pinch or scroll to zoom</p>
              </div>
              <div style={{ position: "relative", width: "100%", height: "260px", background: "#0f172a" }}>
                <Cropper
                  image={coverCropSrc}
                  crop={coverCrop}
                  zoom={coverCropZoom}
                  aspect={3}
                  cropShape="rect"
                  showGrid={false}
                  onCropChange={setCoverCrop}
                  onZoomChange={setCoverCropZoom}
                  onCropComplete={onCoverCropComplete}
                />
              </div>
              <div style={{ padding: "0.75rem 1.5rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)", flexShrink: 0 }}>Zoom</span>
                <input
                  type="range" min={1} max={3} step={0.05} value={coverCropZoom}
                  onChange={e => setCoverCropZoom(Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--color-brand, #a21d54)" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem", padding: "1rem 1.5rem 1.25rem" }}>
                <button
                  onClick={() => { setCoverCropSrc(null); if (coverInputRef.current) coverInputRef.current.value = ""; }}
                  style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
                >Cancel</button>
                <button
                  onClick={handleCoverCropConfirm}
                  style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}
                >Save cover</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Logout modal ── */}
        {showLogoutModal && (
          <div onClick={() => setShowLogoutModal(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", WebkitBackdropFilter: "blur(2px)", backdropFilter: "blur(2px)" }}>
            <div ref={logoutModalRef} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1.25rem", padding: "2rem 1.75rem", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "1rem", backgroundColor: "#fff1f2", border: "2px solid #fecdd3", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem" }}>👋</div>
              <h3 id="logout-modal-title" style={{ fontWeight: "800", fontSize: "1.1rem", marginBottom: "0.35rem", color: "var(--color-text-primary, #1e293b)" }}>Log out?</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", marginBottom: "1.5rem" }}>You'll need to sign back in to access your account.</p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Stay</button>
                <button onClick={confirmLogout} style={{ flex: 1, padding: "0.7rem", borderRadius: "0.75rem", border: "none", backgroundColor: "#f43f5e", color: "white", fontWeight: "700", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem" }}>Log Out</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          style={{ position: "fixed", bottom: "5rem", right: "1.25rem", zIndex: 900, width: "44px", height: "44px", borderRadius: "50%", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontSize: "1.1rem", cursor: "pointer", boxShadow: "0 4px 16px rgba(162,29,84,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}
        >
          ↑
        </button>
      )}

      {/* Spinner keyframe — injected as a style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PreviewRow({ ok, warn, label, detail, truncate }) {
  const color = ok ? "#16a34a" : warn ? "#d97706" : "#dc2626";
  const icon  = ok ? "✓" : warn ? "–" : "✗";
  return (
    <div style={{ display: "flex", gap: "0.55rem", alignItems: "flex-start", marginBottom: "0.35rem" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0, marginTop: "1px", backgroundColor: ok ? "#dcfce7" : warn ? "#fef3c7" : "#fee2e2", color, fontSize: "0.65rem", fontWeight: "900" }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--color-text-body, #374151)" }}>{label}</span>
        {detail && <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary, #6b7280)", marginLeft: "0.35rem", ...(truncate ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "200px", verticalAlign: "bottom" } : {}) }}>{detail}</span>}
      </div>
    </div>
  );
}

const IE_BBOX = "-10.56,51.39,-5.43,55.43";
const suggestCache = new Map();

function LocationSection({ savedLoc, currentUser, setCurrentUser, setStudentLocation, onSaved }) {
  const [locationAddress, setLocationAddress] = useState(savedLoc?.displayName || "");
  const [locationCoords, setLocationCoords]   = useState(savedLoc ? { lat: savedLoc.lat, lng: savedLoc.lng, displayName: savedLoc.displayName } : null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError]     = useState("");
  const [showManual, setShowManual]           = useState(false);
  const [manualLine1, setManualLine1]         = useState("");
  const [manualLine2, setManualLine2]         = useState("");
  const [manualCity, setManualCity]           = useState("");
  const [manualCounty, setManualCounty]       = useState("");
  const [suggestions, setSuggestions]         = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer                          = useRef(null);
  const wrapperRef                            = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = async (q) => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    if (suggestCache.has(q)) {
      const cached = suggestCache.get(q);
      setSuggestions(cached);
      setShowSuggestions(cached.length > 0);
      return;
    }
    try {
      const qs = new URLSearchParams({ q: `${q}, Ireland`, limit: "6", lang: "en", bbox: IE_BBOX });
      const res = await fetch(`https://photon.komoot.io/api/?${qs}`);
      const data = await res.json();
      const results = (data.features || []).map(f => {
        const p = f.properties;
        const locality = p.city || p.town || p.village || p.name || "";
        const county   = p.county || p.state || "";
        return {
          label:       [p.name, locality !== p.name ? locality : null, county].filter(Boolean).join(", "),
          displayName: [locality, county].filter(Boolean).join(", ") || "Ireland",
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
        };
      });
      suggestCache.set(q, results);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch { setSuggestions([]); setShowSuggestions(false); }
  };

  const applyGeoResult = async (result) => {
    setLocationCoords(result);
    setLocationAddress(result.displayName);
    setLocationError("");
    setShowManual(false);
    setSuggestions([]);
    setShowSuggestions(false);
    const savedLocation = { lat: result.lat, lng: result.lng, displayName: result.displayName };
    try {
      await updateStudentProfile(currentUser.id, { location_lat: result.lat, location_lng: result.lng, location_display: result.displayName });
      setCurrentUser(prev => ({ ...prev, savedLocation }));
      if (setStudentLocation) setStudentLocation(savedLocation);
      onSaved();
      toast.success("Location saved!");
    } catch (e) {
      import("@sentry/react").then(({ captureException }) => captureException(e));
      toast.error("Failed to save location.");
    }
  };

  const handleGeocode = async () => {
    if (!locationAddress.trim()) { setLocationError("Enter an Eircode or address first."); return; }
    setShowSuggestions(false);
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(locationAddress + ", Ireland");
    setLocationLoading(false);
    if (result) await applyGeoResult(result);
    else { setLocationError("Not found. Try the manual fields below."); setShowManual(true); }
  };

  const handleManualGeocode = async () => {
    if (!manualLine1.trim() && !manualCity.trim()) { setLocationError("Enter at least the address and city."); return; }
    const fullAddress = [manualLine1, manualLine2, manualCity, manualCounty, "Ireland"].filter(Boolean).join(", ");
    setLocationLoading(true);
    setLocationError("");
    const result = await geocodeAddress(fullAddress);
    setLocationLoading(false);
    if (result) await applyGeoResult(result);
    else setLocationError("Could not find that address. Try adjusting the details.");
  };

  const handleGPS = async () => {
    setLocationLoading(true);
    setLocationError("");
    const pos = await getCurrentPosition();
    setLocationLoading(false);
    if (pos) {
      await applyGeoResult({ lat: pos.lat, lng: pos.lng, displayName: "Your current GPS location" });
      setLocationAddress("Your current GPS location");
    } else {
      setLocationError("Could not get GPS location. Check browser permissions.");
    }
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
      <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)", margin: "0 0 0.5rem" }}>My Location</p>
      <p style={{ fontSize: "0.8rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.75rem", lineHeight: 1.4 }}>
        Set your address so we can show job distances. Never shared publicly.
      </p>

      {/* Search row with autocomplete */}
      <div ref={wrapperRef} style={{ position: "relative", marginBottom: "0.4rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            aria-label="Enter Eircode or address"
            placeholder="Start typing your address or Eircode…"
            value={locationAddress}
            onChange={e => {
              const val = e.target.value;
              setLocationAddress(val);
              setLocationCoords(null);
              setShowManual(false);
              clearTimeout(suggestTimer.current);
              suggestTimer.current = setTimeout(() => fetchSuggestions(val), 80);
            }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleGeocode(); } if (e.key === "Escape") setShowSuggestions(false); }}
            onFocus={() => { if (suggestions.length) setShowSuggestions(true); }}
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          />
          <button type="button" onClick={handleGPS} disabled={locationLoading} title="Use current GPS location" style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid #d1d5db", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontSize: "1rem", cursor: locationLoading ? "not-allowed" : "pointer", lineHeight: 1 }}>
            📡
          </button>
          <button type="button" onClick={handleGeocode} disabled={locationLoading} style={{ padding: "0.6rem 0.9rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.85rem", cursor: locationLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
            {locationLoading ? "…" : "Find"}
          </button>
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.65rem", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50, overflow: "hidden" }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={e => { e.preventDefault(); applyGeoResult(s); }}
                style={{ width: "100%", textAlign: "left", padding: "0.65rem 0.9rem", background: "none", border: "none", borderBottom: i < suggestions.length - 1 ? "1px solid var(--color-border-light, #f1f5f9)" : "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", color: "var(--color-text-body, #374151)", lineHeight: 1.4 }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--color-bg-subtle, #f8fafc)"}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
              >
                📍 {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {locationCoords && !showManual && (
        <div style={{ backgroundColor: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "0.5rem", padding: "0.45rem 0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#16a34a", fontWeight: "700" }}>✓ Location set</span>
          <p style={{ color: "var(--color-text-body, #374151)", margin: "0.15rem 0 0", fontSize: "0.7rem" }}>{locationCoords.displayName}</p>
        </div>
      )}
      {locationError && <p style={{ fontSize: "0.8rem", color: "#ef4444", margin: "0 0 0.4rem" }}>{locationError}</p>}
      {!showManual && !locationCoords && (
        <button type="button" onClick={() => setShowManual(true)} style={{ background: "none", border: "none", padding: 0, color: "var(--color-text-secondary, #6b7280)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", marginBottom: "0.5rem", fontFamily: "inherit" }}>
          Enter address manually
        </button>
      )}
      {showManual && (
        <div style={{ backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid var(--color-border-light, #e5e7eb)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "0.5rem", marginTop: "0.4rem" }}>
          <input value={manualLine1} onChange={e => setManualLine1(e.target.value)} placeholder="Address Line 1" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualLine2} onChange={e => setManualLine2(e.target.value)} placeholder="Address Line 2 (optional)" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualCity} onChange={e => setManualCity(e.target.value)} placeholder="Town / City" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
          <input value={manualCounty} onChange={e => setManualCounty(e.target.value)} onKeyDown={e => e.key === "Enter" && handleManualGeocode()} placeholder="County" style={{ ...inputStyle, marginBottom: "0.6rem" }} />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={handleManualGeocode} disabled={locationLoading} style={{ flex: 1, padding: "0.5rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#3b82f6", color: "white", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>
              {locationLoading ? "Finding…" : "Find Address"}
            </button>
            <button type="button" onClick={() => setShowManual(false)} style={{ padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "1.5px solid var(--color-border-light, #d1d5db)", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #6b7280)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", marginBottom: "0.75rem", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.1rem", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
        <span style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)" }}>{title}</span>
        <span style={{ color: "var(--color-text-secondary, #64748b)", fontSize: "0.85rem", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && <div style={{ padding: "0 1.1rem 1rem" }}>{children}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "0.85rem", padding: "1rem 1.1rem", marginBottom: "0.75rem" }}>
      <p style={{ fontWeight: "700", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary, #64748b)", marginBottom: "0.75rem" }}>{title}</p>
      {children}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
      <span style={{ color: "var(--color-text-secondary, #6b7280)" }}>{label}</span>
      <span style={{ fontWeight: "600", color: "var(--color-text-primary, #111827)" }}>{value}</span>
    </div>
  );
}

function DocRow({ label, filename }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", fontSize: "0.875rem" }}>
      <span style={{ color: "var(--color-text-secondary, #6b7280)" }}>{label}</span>
      {filename
        ? <span style={{ color: "#16a34a", fontWeight: "600" }}>✓ Uploaded</span>
        : <span style={{ color: "#ef4444", fontWeight: "600" }}>Not uploaded</span>}
    </div>
  );
}

function FileUpload({ label, hint, accept, onUpload, existingName, required }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);
  const [localName, setLocalName] = useState("");
  const [uploadError, setUploadError] = useState("");

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      await onUpload(file);
      setLocalName(file.name);
      setUploaded(true);
      setTimeout(() => setUploaded(false), 2500);
    } catch (err) {
      // onUpload (handleCvUpload/handleCoverLetterUpload) shows a toast for lib errors,
      // but also surface inline here for clarity
      setUploadError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected after an error
      e.target.value = "";
    }
  };

  // Derive a user-friendly display name from the existingName (which may be a storage path)
  const displayName = localName || (existingName ? existingName.split("/").pop() : "");

  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label style={{ display: "block", fontWeight: "600", fontSize: "0.875rem", marginBottom: "0.25rem", color: "var(--color-text-body, #374151)" }}>
        {label} {required && !existingName && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary, #6b7280)", marginBottom: "0.35rem" }}>{hint}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", border: `1.5px dashed ${uploadError ? "#fca5a5" : existingName || uploaded ? "#22c55e" : "var(--color-border-light, #d1d5db)"}`, borderRadius: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: uploadError ? "#fff1f2" : existingName || uploaded ? "#f0fdf4" : "var(--color-bg-elevated, white)", overflow: "hidden" }}>
        <label style={{ cursor: uploading ? "not-allowed" : "pointer", fontSize: "0.8rem", fontWeight: "600", color: uploading ? "#64748b" : "#3b82f6", whiteSpace: "nowrap", flexShrink: 0 }}>
          {uploading ? "Uploading…" : existingName ? "Change" : "Choose file"}
          <input type="file" accept={accept} style={{ display: "none" }} onChange={handleChange} disabled={uploading} />
        </label>
        <span style={{ fontSize: "0.8rem", color: uploadError ? "#dc2626" : existingName || uploaded ? "#16a34a" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {uploadError ? uploadError : uploaded ? `✓ ${displayName}` : existingName ? `✓ ${displayName || "Uploaded"}` : "No file chosen"}
        </span>
      </div>
    </div>
  );
}

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00"];

function AvailabilityPicker({ value, onChange }) {
  const toggle = (day, slot) => {
    const current = value[day] || [];
    const updated = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
    onChange({ ...value, [day]: updated });
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {DAYS.map(day => {
        const selected  = value[day] || [];
        const isWeekend = day === "Saturday" || day === "Sunday";
        return (
          <div key={day}>
            <p style={{ fontSize: "0.72rem", fontWeight: "700", color: isWeekend ? "#d97706" : "#374151", marginBottom: "0.25rem" }}>{day}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
              {SLOTS.map(slot => {
                const active = selected.includes(slot);
                return (
                  <button key={slot} type="button" onClick={() => toggle(day, slot)} style={{
                    padding: "0.4rem 0.55rem", borderRadius: "0.3rem", fontSize: "0.72rem", fontWeight: "600", cursor: "pointer",
                    minHeight: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1.5px solid ${active ? (isWeekend ? "#f59e0b" : "var(--color-brand)") : "#e2e8f0"}`,
                    backgroundColor: active ? (isWeekend ? "#fef3c7" : "#fce7f3") : "white",
                    color: active ? (isWeekend ? "#d97706" : "var(--color-brand)") : "#64748b",
                    fontFamily: "inherit",
                  }}>
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const labelStyle = { display: "block", fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-body, #374151)", marginBottom: "0.3rem" };
const inputStyle = { width: "100%", padding: "0.6rem 0.75rem", marginBottom: "1rem", borderRadius: "0.65rem", border: "1.5px solid var(--color-border-light, #e2e8f0)", fontSize: "1rem", boxSizing: "border-box", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", backgroundColor: "var(--color-bg-elevated, white)" };
const btnBase    = { width: "100%", padding: "0.8rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", cursor: "pointer", fontSize: "0.95rem", fontFamily: "inherit" };
