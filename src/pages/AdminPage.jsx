import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { Helmet } from "react-helmet-async";
import PageWrapper from "../components/PageWrapper";
import {
  fetchPendingStudents, approveStudent, rejectStudent, getSignedDocumentUrl,
  fetchPendingCompanies, approveCompany, rejectCompany,
  sendEmail, emailStudentApproved, emailCompanyApproved,
  getSignups, sendLaunchEmails,
  fetchVerifiedCompanies, setCompanyFeatured,
} from "../lib/auth";
import { emailStudentRejected, emailCompanyRejected } from "../lib/emails";
import { useFocusTrap } from "../hooks/useFocusTrap";

export default function AdminPage() {
  const [tab, setTab]           = useState("students");
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState(null); // { type: "student"|"company", item }
  const rejectModalRef = useRef(null);
  useFocusTrap(rejectModalRef, () => setRejectConfirm(null), !!rejectConfirm);
  const inFlight = useRef(new Set()); // F-C6: prevent double-approval across renders
  const [signups, setSignups]             = useState(null); // null = not yet fetched
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [launchSending, setLaunchSending] = useState(false);
  const [testSending, setTestSending]     = useState(false);
  const [verifiedCompanies, setVerifiedCompanies] = useState(null); // null = not yet fetched
  const [verifiedLoading, setVerifiedLoading]     = useState(false);
  const [featuredToggling, setFeaturedToggling]   = useState(null); // company id being toggled
  const [forumPosts,       setForumPosts]         = useState(null); // null = not yet fetched
  const [forumLoading,     setForumLoading]       = useState(false);
  const [forumExpandedId,  setForumExpandedId]    = useState(null);
  const [forumComments,    setForumComments]      = useState({});
  const [deletingForumPost,  setDeletingForumPost]  = useState(null);
  const [deletingCommentId,  setDeletingCommentId]  = useState(null);
  // BETA ONLY — remove before full launch
  const [suggestions,        setSuggestions]        = useState(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  // Admin delete
  const [deleteUserConfirm,  setDeleteUserConfirm]  = useState(null); // { id, name, role }
  const [deletingUserId,     setDeletingUserId]     = useState(null);
  const [allPosts,           setAllPosts]           = useState(null);
  const [postsLoading,       setPostsLoading]       = useState(false);
  const [deletingPostId,     setDeletingPostId]     = useState(null);
  const deleteUserModalRef = useRef(null);
  useFocusTrap(deleteUserModalRef, () => setDeleteUserConfirm(null), !!deleteUserConfirm);
  // All-users view (filter toggle inside Students / Companies tabs)
  const [studentsFilter,    setStudentsFilter]    = useState("pending"); // "pending" | "all"
  const [companiesFilter,   setCompaniesFilter]   = useState("pending");
  const [allStudents,       setAllStudents]       = useState(null);
  const [allStudentsLoading,setAllStudentsLoading]= useState(false);
  const [allCompanies,      setAllCompanies]      = useState(null);
  const [allCompaniesLoading,setAllCompaniesLoading]= useState(false);
  // Reports, search, expanded details
  const [pendingReports,    setPendingReports]    = useState({}); // id -> reports[] for pending tab
  const [studentSearch,    setStudentSearch]    = useState("");
  const [companySearch,    setCompanySearch]    = useState("");
  const [postSearch,       setPostSearch]       = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  const [expandedPostId,    setExpandedPostId]    = useState(null);
  const [expandedDetails,  setExpandedDetails]  = useState({});
  const [loadingDetails,   setLoadingDetails]   = useState(new Set());
  const [resolveReportId,  setResolveReportId]  = useState(null);

  // F-M10: extracted so the Refresh button can re-call it
  const loadData = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchPendingStudents().catch(e => { Sentry.captureException(e); setError("Failed to load. Please refresh."); return []; }),
      fetchPendingCompanies().catch(e => { Sentry.captureException(e); setError("Failed to load. Please refresh."); return []; }),
    ]).then(([s, c]) => {
      setStudents(s);
      setCompanies(c);
      const ids = [...s.map(x => x.id), ...c.map(x => x.id)];
      if (ids.length) {
        supabase.from("reports").select("id, target_id, reason, created_at").in("target_id", ids).is("resolved_at", null)
          .then(({ data: reps }) => {
            const map = {};
            for (const r of reps || []) { (map[r.target_id] = map[r.target_id] || []).push(r); }
            setPendingReports(map);
          }).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadAllStudents = useCallback(async () => {
    setAllStudentsLoading(true);
    try {
      const { data: profs, error: e1 } = await supabase
        .from("profiles").select("id, name, created_at").eq("role", "student")
        .order("created_at", { ascending: false }).limit(300);
      if (e1) throw e1;
      const ids = (profs || []).map(p => p.id);
      const [{ data: statuses, error: e2 }, { data: reps, error: e3 }, { data: emails }] = await Promise.all([
        ids.length ? supabase.from("students").select("id, status").in("id", ids) : Promise.resolve({ data: [] }),
        supabase.from("reports").select("id, target_id, reason, created_at").eq("target_type", "student").is("resolved_at", null),
        ids.length ? supabase.rpc("admin_get_emails", { p_ids: ids }) : Promise.resolve({ data: [] }),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      const statusMap = Object.fromEntries((statuses || []).map(s => [s.id, s.status]));
      const emailMap  = Object.fromEntries((emails  || []).map(e => [e.id, e.email]));
      const reportMap = {};
      for (const r of reps || []) { (reportMap[r.target_id] = reportMap[r.target_id] || []).push(r); }
      setAllStudents((profs || []).map(p => ({ id: p.id, name: p.name || "Unknown", email: emailMap[p.id] || null, status: statusMap[p.id] || "pending", created_at: p.created_at, reports: reportMap[p.id] || [] })));
    } catch { toast.error("Failed to load students."); setAllStudents([]); }
    finally { setAllStudentsLoading(false); }
  }, []);

  const loadAllCompanies = useCallback(async () => {
    setAllCompaniesLoading(true);
    try {
      const { data: profs, error: e1 } = await supabase
        .from("profiles").select("id, name, created_at").eq("role", "company")
        .order("created_at", { ascending: false }).limit(300);
      if (e1) throw e1;
      const ids = (profs || []).map(p => p.id);
      const [{ data: cos, error: e2 }, { data: reps, error: e3 }, { data: emails }] = await Promise.all([
        ids.length ? supabase.from("companies").select("id, status, cro_number").in("id", ids) : Promise.resolve({ data: [] }),
        supabase.from("reports").select("id, target_id, reason, created_at").eq("target_type", "company").is("resolved_at", null),
        ids.length ? supabase.rpc("admin_get_emails", { p_ids: ids }) : Promise.resolve({ data: [] }),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      const coMap     = Object.fromEntries((cos    || []).map(c => [c.id, c]));
      const emailMap  = Object.fromEntries((emails || []).map(e => [e.id, e.email]));
      const reportMap = {};
      for (const r of reps || []) { (reportMap[r.target_id] = reportMap[r.target_id] || []).push(r); }
      setAllCompanies((profs || []).map(p => ({ id: p.id, name: p.name || "Unknown", email: emailMap[p.id] || null, status: coMap[p.id]?.status || "pending", croNumber: coMap[p.id]?.cro_number || null, created_at: p.created_at, reports: reportMap[p.id] || [] })));
    } catch { toast.error("Failed to load companies."); setAllCompanies([]); }
    finally { setAllCompaniesLoading(false); }
  }, []);

  useEffect(() => { if (studentsFilter === "all" && allStudents === null) loadAllStudents(); }, [studentsFilter, allStudents, loadAllStudents]);
  useEffect(() => { if (companiesFilter === "all" && allCompanies === null) loadAllCompanies(); }, [companiesFilter, allCompanies, loadAllCompanies]);

  const loadSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const data = await getSignups();
      setSignups(data);
    } catch {
      toast.error("Failed to load signups.");
    } finally {
      setSignupsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "signups" && signups === null) loadSignups();
  }, [tab, signups, loadSignups]);

  useEffect(() => {
    if (tab === "featured" && verifiedCompanies === null) {
      setVerifiedLoading(true);
      fetchVerifiedCompanies()
        .then(setVerifiedCompanies)
        .catch(() => toast.error("Failed to load companies."))
        .finally(() => setVerifiedLoading(false));
    }
  }, [tab, verifiedCompanies]);

  const loadForumPosts = useCallback(async () => {
    setForumLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("forum_posts")
        .select("id, author_name, category, title, body, upvotes, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      setForumPosts(data || []);
    } catch {
      toast.error("Failed to load forum posts.");
      setForumPosts([]);
    } finally {
      setForumLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "forum" && forumPosts === null) loadForumPosts();
  }, [tab, forumPosts, loadForumPosts]);

  // BETA ONLY — remove before full launch
  const loadSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("beta_suggestions")
        .select("id, name, role, message, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      setSuggestions(data || []);
    } catch {
      toast.error("Failed to load suggestions.");
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "feedback" && suggestions === null) loadSuggestions();
  }, [tab, suggestions, loadSuggestions]);

  const loadForumComments = async (postId) => {
    setForumComments(prev => ({ ...prev, [postId]: { loading: true, data: [] } }));
    try {
      const { data, error: err } = await supabase
        .from("forum_comments")
        .select("id, author_name, body, created_at")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (err) throw err;
      setForumComments(prev => ({ ...prev, [postId]: { loading: false, data: data || [] } }));
    } catch {
      setForumComments(prev => ({ ...prev, [postId]: { loading: false, data: [], error: true } }));
    }
  };

  const handleDeleteForumPost = async (postId) => {
    setDeletingForumPost(postId);
    try {
      const { error: err } = await supabase.from("forum_posts").delete().eq("id", postId);
      if (err) throw err;
      setForumPosts(prev => prev.filter(p => p.id !== postId));
      if (forumExpandedId === postId) setForumExpandedId(null);
      toast.success("Post deleted.");
    } catch {
      toast.error("Failed to delete post.");
    } finally {
      setDeletingForumPost(null);
    }
  };

  const handleDeleteForumComment = async (postId, commentId) => {
    setDeletingCommentId(commentId);
    try {
      const { error: err } = await supabase.from("forum_comments").delete().eq("id", commentId);
      if (err) throw err;
      setForumComments(prev => ({
        ...prev,
        [postId]: { ...prev[postId], data: prev[postId].data.filter(c => c.id !== commentId) },
      }));
      toast.success("Comment deleted.");
    } catch {
      toast.error("Failed to delete comment.");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleAdminDeleteUser = async () => {
    if (!deleteUserConfirm) return;
    const { id, name } = deleteUserConfirm;
    setDeletingUserId(id);
    try {
      const { error: err } = await supabase.rpc("admin_delete_user", { target_id: id });
      if (err) throw err;
      setStudents(prev => prev.filter(s => s.id !== id));
      setCompanies(prev => prev.filter(c => c.id !== id));
      if (allStudents) setAllStudents(prev => prev.filter(s => s.id !== id));
      if (allCompanies) setAllCompanies(prev => prev.filter(c => c.id !== id));
      if (verifiedCompanies) setVerifiedCompanies(prev => prev.filter(c => c.id !== id));
      setDeleteUserConfirm(null);
      toast.success(`${name} deleted.`);
    } catch (e) {
      toast.error(e.message || "Failed to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const loadAllPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const { data: rows, error: e1 } = await supabase
        .from("jobs").select("id, title, status, created_at, company_id, description, location, pay, category, days").order("created_at", { ascending: false }).limit(300);
      if (e1) throw e1;
      const companyIds = [...new Set((rows || []).map(j => j.company_id).filter(Boolean))];
      const [{ data: profs, error: e2 }, { data: reps, error: e3 }] = await Promise.all([
        companyIds.length ? supabase.from("profiles").select("id, name").in("id", companyIds) : Promise.resolve({ data: [] }),
        supabase.from("reports").select("id, target_id, reason, created_at").eq("target_type", "post").is("resolved_at", null),
      ]);
      if (e2) throw e2;
      if (e3) throw e3;
      const nameMap = Object.fromEntries((profs || []).map(p => [p.id, p.name]));
      const reportMap = {};
      for (const r of reps || []) { (reportMap[r.target_id] = reportMap[r.target_id] || []).push(r); }
      setAllPosts((rows || []).map(j => ({ ...j, companyName: nameMap[j.company_id] || "Unknown company", reports: reportMap[j.id] || [] })));
    } catch {
      toast.error("Failed to load posts.");
      setAllPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "posts" && allPosts === null) loadAllPosts();
  }, [tab, allPosts, loadAllPosts]);

  const loadExpandedDetails = useCallback(async (id, type) => {
    if (expandedDetails[id] !== undefined) return;
    setLoadingDetails(s => new Set([...s, id]));
    try {
      if (type === "student") {
        const { data } = await supabase
          .from("students")
          .select("bio, skills, linkedin, cv_url, cover_letter_url, student_id_url, gov_id_url, location_display, job_preferences")
          .eq("id", id).single();
        setExpandedDetails(d => ({ ...d, [id]: data || {} }));
      } else if (type === "company") {
        const [{ data: co }, { data: jobs }] = await Promise.all([
          supabase.from("companies").select("bio, website, cro_number, industries").eq("id", id).single(),
          supabase.from("jobs").select("id, title, status, created_at, location, pay, category, days, description, deadline").eq("company_id", id).order("created_at", { ascending: false }).limit(500),
        ]);
        setExpandedDetails(d => ({ ...d, [id]: { ...(co || {}), jobs: jobs || [] } }));
      }
    } catch { setExpandedDetails(d => ({ ...d, [id]: {} })); }
    finally { setLoadingDetails(s => { const n = new Set(s); n.delete(id); return n; }); }
  }, [expandedDetails]);

  const handleResolveReport = useCallback(async (reportId, targetType) => {
    setResolveReportId(reportId);
    try {
      const { error } = await supabase.from("reports").update({ resolved_at: new Date().toISOString() }).eq("id", reportId);
      if (error) throw error;
      if (targetType === "student") { setAllStudents(null); loadAllStudents(); }
      else if (targetType === "company") { setAllCompanies(null); loadAllCompanies(); }
      else { setAllPosts(null); loadAllPosts(); }
      toast.success("Report dismissed.");
    } catch { toast.error("Failed to dismiss report."); }
    finally { setResolveReportId(null); }
  }, [loadAllStudents, loadAllCompanies, loadAllPosts]);

  const handleAdminDeletePost = async (jobId, title) => {
    setDeletingPostId(jobId);
    try {
      const { error: err } = await supabase.from("jobs").delete().eq("id", jobId);
      if (err) throw err;
      setAllPosts(prev => prev.filter(j => j.id !== jobId));
      toast.success(`"${title}" deleted.`);
    } catch {
      toast.error("Failed to delete post.");
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleToggleFeatured = async (company) => {
    if (featuredToggling) return;
    setFeaturedToggling(company.id);
    const next = !company.isFeatured;
    setVerifiedCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isFeatured: next } : c));
    try {
      await setCompanyFeatured(company.id, next);
      toast.success(`${company.name} ${next ? "marked as featured" : "unfeatured"}.`);
    } catch {
      setVerifiedCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isFeatured: !next } : c));
      toast.error("Failed to update featured status.");
    } finally {
      setFeaturedToggling(null);
    }
  };

  const handleTestLaunchEmail = async () => {
    setTestSending(true);
    try {
      await sendLaunchEmails({ test: true });
      toast.success("Test email sent to your inbox!");
    } catch (e) {
      toast.error(e.message || "Failed to send test email.");
    } finally {
      setTestSending(false);
    }
  };

  const handleSendLaunchEmails = async () => {
    const unsent = (signups || []).filter(s => !s.launch_email_sent_at).length;
    if (unsent === 0) { toast("All signups have already received the launch email."); return; }
    if (!window.confirm(`Send launch emails to ${unsent} signup${unsent === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setLaunchSending(true);
    try {
      const result = await sendLaunchEmails();
      toast.success(`Sent ${result.sent} launch email${result.sent === 1 ? "" : "s"}!`);
      if (result.errors?.length) console.warn("Launch email errors:", result.errors);
      loadSignups(); // refresh sent_at timestamps
    } catch (e) {
      toast.error(e.message || "Failed to send launch emails.");
    } finally {
      setLaunchSending(false);
    }
  };

  const openDoc = async (path) => {
    try {
      const url = await getSignedDocumentUrl("verification-docs", path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      Sentry.captureException(e);
      toast.error("Could not open document. Please try again.");
    }
  };

  const handleApproveStudent = async (student) => {
    if (inFlight.current.has(student.id)) return; // F-C6: double-click guard
    inFlight.current.add(student.id);
    setActionLoading(student.id + "_approve");
    try {
      const isNew = await approveStudent(student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
      if (isNew) {
        toast.success(`${student.name} approved.`);
        // Fire-and-forget: storage cleanup + email don't block the UI
        (async () => {
          // S7: delete verification doc files from storage now that they've been reviewed.
          const { supabase: sb } = await import("../lib/supabase");
          const { data: verifyFiles } = await sb.storage.from("verification-docs").list(student.id).catch(() => ({ data: null }));
          if (verifyFiles?.length) {
            await sb.storage.from("verification-docs")
              .remove(verifyFiles.map(f => `${student.id}/${f.name}`))
              .catch(e => console.warn("Verification doc cleanup failed:", e.message));
          }
          if (student.email) {
            try {
              await sendEmail({
                to: student.email,
                subject: "Your StudentShifts account has been approved!",
                html: emailStudentApproved(student.name),
                magicLinkEmail: student.email,
                redirectTo: window.location.origin,
              });
            } catch (e) {
              console.warn("Approval email failed:", e.message);
            }
          }
        })();
      } else {
        toast("Already approved by another admin.");
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to approve. Please try again.");
    } finally {
      inFlight.current.delete(student.id);
      setActionLoading(null);
    }
  };

  // F-M8: confirmed=false → show inline modal; confirmed=true → proceed
  const handleRejectStudent = async (student, confirmed = false) => {
    if (!confirmed) { setRejectConfirm({ type: "student", item: student }); return; }
    if (inFlight.current.has(student.id)) return; // F-C6
    inFlight.current.add(student.id);
    setActionLoading(student.id + "_reject");
    try {
      await rejectStudent(student.id);
      setStudents(prev => prev.filter(s => s.id !== student.id));
      toast(`${student.name} rejected.`);
      if (student.email) {
        sendEmail({
          to: student.email,
          subject: "StudentShifts verification update",
          html: emailStudentRejected(student.name),
          magicLinkEmail: student.email,
          redirectTo: window.location.origin,
        }).catch(e => console.warn("Rejection email failed:", e.message));
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to reject. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(student.id);
      setActionLoading(null);
    }
  };

  const handleApproveCompany = async (company) => {
    if (inFlight.current.has(company.id)) return; // F-C6
    inFlight.current.add(company.id);
    setActionLoading(company.id + "_approve");
    try {
      const isNew = await approveCompany(company.id);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (isNew) {
        toast.success(`${company.name} approved.`);
        if (company.email) {
          sendEmail({
            to: company.email,
            subject: "Your StudentShifts company account has been verified!",
            html: emailCompanyApproved(company.name, window.location.origin),
          }).catch(e => console.warn("Approval email failed:", e.message));
        }
      } else {
        toast("Already approved by another admin.");
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to approve. Please try again.");
    } finally {
      inFlight.current.delete(company.id);
      setActionLoading(null);
    }
  };

  const handleRejectCompany = async (company, confirmed = false) => {
    if (!confirmed) { setRejectConfirm({ type: "company", item: company }); return; } // F-M8
    if (inFlight.current.has(company.id)) return; // F-C6
    inFlight.current.add(company.id);
    setActionLoading(company.id + "_reject");
    try {
      await rejectCompany(company.id);
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      toast(`${company.name} rejected.`);
      if (company.email) {
        sendEmail({
          to: company.email,
          subject: "StudentShifts company verification update",
          html: emailCompanyRejected(company.name),
        }).catch(e => console.warn("Rejection email failed:", e.message));
      }
    } catch (e) {
      Sentry.captureException(e);
      toast.error(e.message || "Failed to reject. Please try again."); // F-H19
    } finally {
      inFlight.current.delete(company.id);
      setActionLoading(null);
    }
  };

  const pendingStudents  = students.length;
  const pendingCompanies = companies.length;

  return (
    <PageWrapper>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem", gap: "1rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.25rem", fontWeight: "800", fontSize: "1.8rem", color: "var(--color-text-primary, #1e293b)" }}>Admin Dashboard</h1>
            <p style={{ margin: 0, color: "var(--color-text-secondary, #64748b)", fontSize: "0.9rem" }}>Pending verification requests</p>
          </div>
          {/* F-M10: refresh button */}
          <button
            onClick={loadData}
            disabled={loading}
            style={{ padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.82rem", cursor: loading ? "default" : "pointer", fontFamily: "inherit", opacity: loading ? 0.5 : 1, flexShrink: 0 }}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "0.6rem", padding: "0.65rem 1rem", marginBottom: "1rem", color: "#e11d48", fontSize: "0.875rem" }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="tab-scroll-bar" style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0", overflowX: "auto", touchAction: "pan-x", overscrollBehaviorX: "contain" }}>
          {[
            { key: "students",  label: "Students",  count: pendingStudents },
            { key: "companies", label: "Companies", count: pendingCompanies },
            { key: "signups",   label: "Signups",   count: 0 },
            { key: "featured",  label: "Featured",  count: 0 },
            { key: "forum",     label: "Forum",     count: 0 },
            { key: "posts",     label: "Posts",     count: 0 },
            { key: "feedback",  label: "Feedback ✦", count: 0 }, // BETA ONLY — remove before full launch
          ].map(({ key, label, count }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.5rem 0.5rem 0 0",
                  border: "none",
                  background: active ? "white" : "transparent",
                  fontWeight: active ? "700" : "600",
                  fontSize: "0.875rem",
                  color: active ? "var(--color-brand)" : "#64748b",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderBottom: active ? "2px solid var(--color-brand)" : "2px solid transparent",
                  marginBottom: "-2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{ fontSize: "0.7rem", fontWeight: "700", backgroundColor: active ? "var(--color-brand)" : "#64748b", color: "white", borderRadius: "999px", padding: "0.1rem 0.45rem", minWidth: "18px", textAlign: "center" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "featured" ? (
          <div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>
              Featured employers get a ⭐ badge on their job cards and profile. Toggle to feature or unfeature a verified company.
            </p>
            {verifiedLoading ? (
              <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
            ) : !verifiedCompanies?.length ? (
              <EmptyState label="No verified companies yet" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {verifiedCompanies.map(c => (
                  <div key={c.id} style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flex: 1, minWidth: 0 }}>
                      {c.isFeatured && <span style={{ fontSize: "1.1rem" }}>⭐</span>}
                      <p style={{ margin: 0, fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{c.name}</p>
                      {c.isFeatured && (
                        <span style={{ fontSize: "0.65rem", fontWeight: "700", backgroundColor: "#fef9c3", color: "#854d0e", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>Featured</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                      <button
                        onClick={() => handleToggleFeatured(c)}
                        disabled={featuredToggling === c.id}
                        style={{
                          padding: "0.4rem 0.9rem", borderRadius: "0.45rem", border: "1.5px solid",
                          borderColor: c.isFeatured ? "#fca5a5" : "#d1d5db",
                          backgroundColor: c.isFeatured ? "#fff1f2" : "white",
                          color: c.isFeatured ? "#e11d48" : "#374151",
                          fontWeight: "600", fontSize: "0.8rem", cursor: featuredToggling === c.id ? "default" : "pointer",
                          fontFamily: "inherit", opacity: featuredToggling === c.id ? 0.5 : 1,
                        }}
                      >
                        {featuredToggling === c.id ? "…" : c.isFeatured ? "Unfeature" : "⭐ Feature"}
                      </button>
                      <button
                        onClick={() => setDeleteUserConfirm({ id: c.id, name: c.name, role: "company" })}
                        style={{ padding: "0.4rem 0.75rem", borderRadius: "0.45rem", border: "1.5px solid #1e293b", backgroundColor: "#0f172a", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "signups" ? (
          <SignupsPanel
            signups={signups}
            loading={signupsLoading}
            launchSending={launchSending}
            testSending={testSending}
            onRefresh={loadSignups}
            onSendLaunch={handleSendLaunchEmails}
            onTestLaunch={handleTestLaunchEmail}
          />
        ) : tab === "forum" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>
                Review all community posts and comments. Delete anything inappropriate.
              </p>
              <button onClick={loadForumPosts} style={docBtn}>↻ Refresh</button>
            </div>
            {forumLoading ? (
              <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
            ) : !forumPosts?.length ? (
              <EmptyState label="No forum posts yet" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {forumPosts.map(post => {
                  const isExpanded = forumexpandedPostId === post.id;
                  const comments = forumComments[post.id];
                  return (
                    <div key={post.id} style={cardStyle}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#475569", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>{post.category}</span>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{post.author_name}</span>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>·</span>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{new Date(post.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                            <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>· ▲ {post.upvotes}</span>
                          </div>
                          <p style={{ margin: "0 0 0.2rem", fontWeight: "700", fontSize: "0.95rem", color: "var(--color-text-primary, #0f172a)" }}>{post.title}</p>
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #475569)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: isExpanded ? undefined : 2, WebkitBoxOrient: "vertical" }}>{post.body}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteForumPost(post.id)}
                          disabled={deletingForumPost === post.id}
                          style={{ padding: "0.3rem 0.7rem", borderRadius: "0.4rem", border: "1.5px solid #fca5a5", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                        >
                          {deletingForumPost === post.id ? "…" : "Delete Post"}
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (isExpanded) { setForumExpandedId(null); } else {
                            setForumExpandedId(post.id);
                            if (!forumComments[post.id]) loadForumComments(post.id);
                          }
                        }}
                        style={{ marginTop: "0.65rem", background: "none", border: "none", color: "#64748b", fontSize: "0.78rem", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        {isExpanded ? "▲ Hide comments" : "▼ View comments"}
                      </button>
                      {isExpanded && (
                        <div style={{ marginTop: "0.6rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {comments?.loading ? (
                            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>Loading…</p>
                          ) : !comments?.data?.length ? (
                            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>No comments on this post.</p>
                          ) : (
                            comments.data.map(comment => (
                              <div key={comment.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", backgroundColor: "var(--color-bg-elevated, white)", border: "1px solid #e2e8f0", borderRadius: "0.5rem", padding: "0.5rem 0.7rem" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                                    <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--color-text-body, #374151)" }}>{comment.author_name}</span>
                                    <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>{new Date(comment.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #475569)" }}>{comment.body}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteForumComment(post.id, comment.id)}
                                  disabled={deletingCommentId === comment.id}
                                  style={{ padding: "0.2rem 0.55rem", borderRadius: "0.35rem", border: "1.5px solid #fca5a5", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: "700", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                                >
                                  {deletingCommentId === comment.id ? "…" : "Delete"}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === "posts" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>All job posts. Red = reported. Delete anything inappropriate.</p>
              <button onClick={() => { setAllPosts(null); loadAllPosts(); }} style={docBtn}>↻ Refresh</button>
            </div>
            {postsLoading ? (
              <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
            ) : !allPosts?.length ? (
              <EmptyState label="No job posts yet" />
            ) : (() => {
              const q = postSearch.trim().toLowerCase();
              const list = q ? allPosts.filter(p => p.title.toLowerCase().includes(q) || p.companyName.toLowerCase().includes(q)) : allPosts;
              return (
                <div>
                  <input
                    type="search" value={postSearch} onChange={e => setPostSearch(e.target.value)}
                    placeholder="Search by title or company…"
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.55rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", outline: "none", marginBottom: "0.75rem" }}
                  />
                  {!list.length ? <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>No posts match "{postSearch}"</p> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                      {list.map(post => {
                        const isReported = post.reports.length > 0;
                        const isExpanded = expandedPostId === post.id;
                        return (
                          <div key={post.id} style={{ ...cardStyle, border: isReported ? "2px solid #fca5a5" : cardStyle.border, backgroundColor: isReported ? "#fff5f5" : cardStyle.backgroundColor }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }} onClick={() => setExpandedPostId(isExpanded ? null : post.id)}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>{post.title}</span>
                                  <span style={{ fontSize: "0.7rem", fontWeight: "700", borderRadius: "999px", padding: "0.1rem 0.45rem", backgroundColor: post.status === "Active" ? "#dcfce7" : "#f1f5f9", color: post.status === "Active" ? "#16a34a" : "#64748b" }}>{post.status}</span>
                                  {isReported && <span style={{ fontSize: "0.68rem", fontWeight: "700", backgroundColor: "#fee2e2", color: "#b91c1c", padding: "0.15rem 0.45rem", borderRadius: "999px" }}>⚠ {post.reports.length} report{post.reports.length > 1 ? "s" : ""}</span>}
                                </div>
                                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{post.companyName}</span>
                                  <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{new Date(post.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                                </div>
                              </div>
                              <span style={{ color: "#94a3b8", fontSize: "0.85rem", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                            </div>

                            {isReported && (
                              <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                {post.reports.map(r => (
                                  <div key={r.id} style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.45rem 0.7rem", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                                    <div style={{ flex: 1 }}>
                                      <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "#991b1b" }}>🚩 {r.reason}</p>
                                      <p style={{ margin: "0.1rem 0 0", fontSize: "0.7rem", color: "#b91c1c" }}>{new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</p>
                                    </div>
                                    <button onClick={() => handleResolveReport(r.id, "post")} disabled={resolveReportId === r.id} style={{ padding: "0.2rem 0.55rem", fontSize: "0.7rem", fontWeight: "700", borderRadius: "0.3rem", border: "1px solid #fca5a5", background: "white", color: "#991b1b", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{resolveReportId === r.id ? "…" : "✓ Dismiss"}</button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {isExpanded && (
                              <div style={{ marginTop: "0.9rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.9rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                {post.location && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>📍 {post.location}</p>}
                                {post.pay && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>💶 €{post.pay}/hr</p>}
                                {post.category && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>Category: {post.category}</p>}
                                {post.days?.length > 0 && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>Days: {post.days.join(", ")}</p>}
                                {post.description && <div><p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</p><p style={{ margin: 0, fontSize: "0.82rem", color: "#1e293b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{post.description}</p></div>}
                              </div>
                            )}

                            <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                              <button onClick={() => handleAdminDeletePost(post.id, post.title)} disabled={deletingPostId === post.id} style={{ padding: "0.35rem 0.75rem", borderRadius: "0.4rem", border: "1.5px solid #fca5a5", backgroundColor: "#fff1f2", color: "#e11d48", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>{deletingPostId === post.id ? "…" : "🗑 Delete"}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : tab === "feedback" ? (
          // BETA ONLY — remove before full launch
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary, #64748b)" }}>
                Suggestions submitted by beta testers. Remove this tab before full launch.
              </p>
              <button onClick={loadSuggestions} style={docBtn}>↻ Refresh</button>
            </div>
            {suggestionsLoading ? (
              <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
            ) : !suggestions?.length ? (
              <EmptyState label="No suggestions yet" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {suggestions.map(s => (
                  <div key={s.id} style={cardStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--color-text-body, #374151)" }}>{s.name || "Anonymous"}</span>
                      <span style={{ fontSize: "0.7rem", fontWeight: "700", backgroundColor: s.role === "company" ? "#eff6ff" : "#fdf4ff", color: s.role === "company" ? "#1d4ed8" : "#7c3aed", borderRadius: "999px", padding: "0.1rem 0.5rem" }}>{s.role || "user"}</span>
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginLeft: "auto" }}>{new Date(s.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--color-text-primary, #0f172a)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
        ) : tab === "students" ? (
          <div>
            <FilterToggle value={studentsFilter} onChange={f => setStudentsFilter(f)} options={[{ value: "pending", label: `Pending (${students.length})` }, { value: "all", label: "All Students" }]} onRefresh={studentsFilter === "all" ? loadAllStudents : loadData} />
            {studentsFilter === "pending" ? (
              loading ? <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
              : students.length === 0 ? <EmptyState label="No pending student requests" />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {students.map(s => {
                    const reps = pendingReports[s.id] || [];
                    const isReported = reps.length > 0;
                    return (
                    <div key={s.id} style={{ ...cardStyle, border: isReported ? "2px solid #fca5a5" : cardStyle.border, backgroundColor: isReported ? "#fff5f5" : cardStyle.backgroundColor }}>
                      {isReported && (
                        <div style={{ marginBottom: "0.65rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {reps.map(r => (
                            <div key={r.id} style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.45rem", padding: "0.35rem 0.65rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#991b1b", flex: 1 }}>🚩 {r.reason}</span>
                              <span style={{ fontSize: "0.68rem", color: "#b91c1c" }}>{new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginBottom: "0.85rem" }}>
                        <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>{s.name}</p>
                        {s.email && <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)" }}>{s.email}</p>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                        {s.studentIdUrl && <button onClick={() => openDoc(s.studentIdUrl)} style={docBtn}>View Student ID</button>}
                        {s.govIdUrl && <button onClick={() => openDoc(s.govIdUrl)} style={docBtn}>View Government ID</button>}
                      </div>
                      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                        <button aria-label={`Approve ${s.name}`} onClick={() => handleApproveStudent(s)} disabled={actionLoading === s.id + "_approve" || actionLoading === s.id + "_reject" || !s.studentIdUrl || !s.govIdUrl} title={!s.studentIdUrl || !s.govIdUrl ? "Cannot approve: documents not yet uploaded" : undefined} style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: (actionLoading === s.id + "_approve" || !s.studentIdUrl || !s.govIdUrl) ? 0.5 : 1 }}>{actionLoading === s.id + "_approve" ? "Approving…" : "✅ Approve"}</button>
                        <button aria-label={`Reject ${s.name}`} onClick={() => handleRejectStudent(s)} disabled={actionLoading === s.id + "_approve" || actionLoading === s.id + "_reject"} style={{ ...actionBtnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", opacity: actionLoading === s.id + "_reject" ? 0.7 : 1 }}>{actionLoading === s.id + "_reject" ? "Rejecting…" : "❌ Reject"}</button>
                        <button aria-label={`Delete ${s.name}`} onClick={() => setDeleteUserConfirm({ id: s.id, name: s.name, role: "student" })} style={{ ...actionBtnBase, background: "#0f172a", fontSize: "0.8rem" }}>🗑 Delete</button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )
            ) : (
              allStudentsLoading ? <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
              : !allStudents?.length ? <EmptyState label="No students yet" />
              : (() => {
                const q = studentSearch.trim().toLowerCase();
                const list = q ? allStudents.filter(s => s.name.toLowerCase().includes(q)) : allStudents;
                return (
                  <div>
                    <input
                      type="search" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Search students by name…"
                      style={{ width: "100%", boxSizing: "border-box", padding: "0.55rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", outline: "none", marginBottom: "0.75rem" }}
                    />
                    {!list.length ? <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>No students match "{studentSearch}"</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        {list.map(s => {
                          const isReported = s.reports.length > 0;
                          const isExpanded = expandedStudentId === s.id;
                          const det = expandedDetails[s.id];
                          const loadingDet = loadingDetails.has(s.id);
                          return (
                            <div key={s.id} style={{ ...cardStyle, border: isReported ? "2px solid #fca5a5" : cardStyle.border, backgroundColor: isReported ? "#fff5f5" : cardStyle.backgroundColor }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }} onClick={() => { const next = isExpanded ? null : s.id; setExpandedStudentId(next); if (next) loadExpandedDetails(next, "student"); }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>{s.name}</span>
                                    <StatusBadge status={s.status} />
                                    {isReported && <span style={{ fontSize: "0.68rem", fontWeight: "700", backgroundColor: "#fee2e2", color: "#b91c1c", padding: "0.15rem 0.45rem", borderRadius: "999px" }}>⚠ {s.reports.length} report{s.reports.length > 1 ? "s" : ""}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Joined {new Date(s.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    {s.email && <span style={{ fontSize: "0.7rem", color: "#64748b" }}>· {s.email}</span>}
                                  </div>
                                </div>
                                <span style={{ color: "#94a3b8", fontSize: "0.85rem", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                              </div>

                              {isReported && (
                                <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                  {s.reports.map(r => (
                                    <div key={r.id} style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.45rem 0.7rem", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                                      <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "#991b1b" }}>🚩 {r.reason}</p>
                                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.7rem", color: "#b91c1c" }}>{new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</p>
                                      </div>
                                      <button onClick={() => handleResolveReport(r.id, "student")} disabled={resolveReportId === r.id} style={{ padding: "0.2rem 0.55rem", fontSize: "0.7rem", fontWeight: "700", borderRadius: "0.3rem", border: "1px solid #fca5a5", background: "white", color: "#991b1b", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{resolveReportId === r.id ? "…" : "✓ Dismiss"}</button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isExpanded && (
                                <div style={{ marginTop: "0.9rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.9rem" }}>
                                  {loadingDet ? <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>Loading details…</p> : det ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                                      {det.bio && <div><p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bio</p><p style={{ margin: 0, fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.5 }}>{det.bio}</p></div>}
                                      {det.skills?.length > 0 && <div><p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Skills</p><div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>{det.skills.map(sk => <span key={sk} style={{ fontSize: "0.75rem", backgroundColor: "#eff6ff", color: "#1d4ed8", borderRadius: "999px", padding: "0.15rem 0.5rem", fontWeight: "600" }}>{sk}</span>)}</div></div>}
                                      {det.job_preferences?.length > 0 && <div><p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Job Preferences</p><div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>{det.job_preferences.map(j => <span key={j} style={{ fontSize: "0.75rem", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "999px", padding: "0.15rem 0.5rem", fontWeight: "600" }}>{j}</span>)}</div></div>}
                                      {det.location_display && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>📍 {det.location_display}</p>}
                                      {det.linkedin && <p style={{ margin: 0, fontSize: "0.82rem" }}>LinkedIn: <a href={det.linkedin} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>{det.linkedin}</a></p>}
                                      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                                        {det.cv_url && <button onClick={() => openDoc(det.cv_url)} style={docBtn}>CV</button>}
                                        {det.cover_letter_url && <button onClick={() => openDoc(det.cover_letter_url)} style={docBtn}>Cover Letter</button>}
                                        {det.student_id_url && <button onClick={() => openDoc(det.student_id_url)} style={docBtn}>Student ID</button>}
                                        {det.gov_id_url && <button onClick={() => openDoc(det.gov_id_url)} style={docBtn}>Gov ID</button>}
                                      </div>
                                    </div>
                                  ) : <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>No additional details.</p>}
                                </div>
                              )}

                              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                                <button onClick={() => setDeleteUserConfirm({ id: s.id, name: s.name, role: "student" })} style={{ padding: "0.35rem 0.75rem", borderRadius: "0.4rem", border: "1.5px solid #1e293b", backgroundColor: "#0f172a", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>🗑 Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        ) : tab === "companies" ? (
          <div>
            <FilterToggle value={companiesFilter} onChange={f => setCompaniesFilter(f)} options={[{ value: "pending", label: `Pending (${companies.length})` }, { value: "all", label: "All Companies" }]} onRefresh={companiesFilter === "all" ? loadAllCompanies : loadData} />
            {companiesFilter === "pending" ? (
              loading ? <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
              : companies.length === 0 ? <EmptyState label="No pending company requests" />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {companies.map(c => {
                    const reps = pendingReports[c.id] || [];
                    const isReported = reps.length > 0;
                    return (
                    <div key={c.id} style={{ ...cardStyle, border: isReported ? "2px solid #fca5a5" : cardStyle.border, backgroundColor: isReported ? "#fff5f5" : cardStyle.backgroundColor }}>
                      {isReported && (
                        <div style={{ marginBottom: "0.65rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {reps.map(r => (
                            <div key={r.id} style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.45rem", padding: "0.35rem 0.65rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#991b1b", flex: 1 }}>🚩 {r.reason}</span>
                              <span style={{ fontSize: "0.68rem", color: "#b91c1c" }}>{new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginBottom: "0.85rem" }}>
                        <p style={{ margin: 0, fontWeight: "700", fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>{c.name}</p>
                        {c.email && (
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "var(--color-text-secondary, #64748b)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <span style={{ fontSize: "0.7rem", backgroundColor: "#dcfce7", color: "#16a34a", fontWeight: "700", padding: "0.1rem 0.45rem", borderRadius: "999px", textTransform: "uppercase", letterSpacing: "0.04em" }}>✓ Email verified</span>
                            {c.email}
                          </p>
                        )}
                      </div>
                      {c.croNumber ? (
                        <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "0.6rem", padding: "0.65rem 0.85rem", marginBottom: "1rem" }}>
                          <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", fontWeight: "700", color: "#0369a1" }}>CRO Number: <span style={{ fontFamily: "monospace", fontSize: "0.88rem", color: "var(--color-text-primary, #1e293b)", letterSpacing: "0.05em" }}>{c.croNumber}</span></p>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            <a href="https://core.cro.ie/" target="_blank" rel="noreferrer" style={verifyLinkStyle}>🔍 Verify on CRO →</a>
                            <a href={`https://www.solocheck.ie/Irish-Company/search?q=${encodeURIComponent(c.name)}`} target="_blank" rel="noreferrer" style={verifyLinkStyle}>🔍 SoloCheck →</a>
                          </div>
                          <p style={{ margin: "0.45rem 0 0", fontSize: "0.72rem", color: "var(--color-text-secondary, #64748b)" }}>Confirm the company name matches <strong style={{ color: "var(--color-text-primary, #1e293b)" }}>{c.name}</strong>.</p>
                        </div>
                      ) : (
                        <div style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", marginBottom: "1rem" }}>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#c2410c" }}>⚠ No CRO number provided — cannot approve without verification</p>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                        <button aria-label={`Approve ${c.name}`} onClick={() => handleApproveCompany(c)} disabled={actionLoading === c.id + "_approve" || actionLoading === c.id + "_reject" || !c.croNumber} title={!c.croNumber ? "Cannot approve: no CRO number provided" : undefined} style={{ ...actionBtnBase, background: "linear-gradient(135deg, #22c55e, #16a34a)", opacity: (actionLoading === c.id + "_approve" || !c.croNumber) ? 0.5 : 1 }}>{actionLoading === c.id + "_approve" ? "Approving…" : "✅ Approve"}</button>
                        <button aria-label={`Reject ${c.name}`} onClick={() => handleRejectCompany(c)} disabled={actionLoading === c.id + "_approve" || actionLoading === c.id + "_reject"} style={{ ...actionBtnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", opacity: actionLoading === c.id + "_reject" ? 0.7 : 1 }}>{actionLoading === c.id + "_reject" ? "Rejecting…" : "❌ Reject"}</button>
                        <button aria-label={`Delete ${c.name}`} onClick={() => setDeleteUserConfirm({ id: c.id, name: c.name, role: "company" })} style={{ ...actionBtnBase, background: "#0f172a", fontSize: "0.8rem" }}>🗑 Delete</button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )
            ) : (
              allCompaniesLoading ? <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>
              : !allCompanies?.length ? <EmptyState label="No companies yet" />
              : (() => {
                const q = companySearch.trim().toLowerCase();
                const list = q ? allCompanies.filter(c => c.name.toLowerCase().includes(q)) : allCompanies;
                return (
                  <div>
                    <input
                      type="search" value={companySearch} onChange={e => setCompanySearch(e.target.value)}
                      placeholder="Search companies by name…"
                      style={{ width: "100%", boxSizing: "border-box", padding: "0.55rem 0.85rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", outline: "none", marginBottom: "0.75rem" }}
                    />
                    {!list.length ? <p style={{ color: "#94a3b8", fontSize: "0.875rem" }}>No companies match "{companySearch}"</p> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        {list.map(c => {
                          const isReported = c.reports.length > 0;
                          const isExpanded = expandedCompanyId === c.id;
                          const det = expandedDetails[c.id];
                          const loadingDet = loadingDetails.has(c.id);
                          return (
                            <div key={c.id} style={{ ...cardStyle, border: isReported ? "2px solid #fca5a5" : cardStyle.border, backgroundColor: isReported ? "#fff5f5" : cardStyle.backgroundColor }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }} onClick={() => { const next = isExpanded ? null : c.id; setExpandedCompanyId(next); if (next) loadExpandedDetails(next, "company"); }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: "700", fontSize: "0.95rem", color: "#0f172a" }}>{c.name}</span>
                                    <StatusBadge status={c.status} />
                                    {isReported && <span style={{ fontSize: "0.68rem", fontWeight: "700", backgroundColor: "#fee2e2", color: "#b91c1c", padding: "0.15rem 0.45rem", borderRadius: "999px" }}>⚠ {c.reports.length} report{c.reports.length > 1 ? "s" : ""}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.1rem", alignItems: "center" }}>
                                    {c.croNumber && <span style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>CRO: {c.croNumber}</span>}
                                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Joined {new Date(c.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</span>
                                    {c.email && <span style={{ fontSize: "0.7rem", color: "#64748b" }}>· {c.email}</span>}
                                  </div>
                                </div>
                                <span style={{ color: "#94a3b8", fontSize: "0.85rem", flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
                              </div>

                              {isReported && (
                                <div style={{ marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                  {c.reports.map(r => (
                                    <div key={r.id} style={{ backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "0.5rem", padding: "0.45rem 0.7rem", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                                      <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: "700", color: "#991b1b" }}>🚩 {r.reason}</p>
                                        <p style={{ margin: "0.1rem 0 0", fontSize: "0.7rem", color: "#b91c1c" }}>{new Date(r.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</p>
                                      </div>
                                      <button onClick={() => handleResolveReport(r.id, "company")} disabled={resolveReportId === r.id} style={{ padding: "0.2rem 0.55rem", fontSize: "0.7rem", fontWeight: "700", borderRadius: "0.3rem", border: "1px solid #fca5a5", background: "white", color: "#991b1b", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{resolveReportId === r.id ? "…" : "✓ Dismiss"}</button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {isExpanded && (
                                <div style={{ marginTop: "0.9rem", borderTop: "1px solid #e2e8f0", paddingTop: "0.9rem" }}>
                                  {loadingDet ? <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>Loading details…</p> : det ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                      {det.bio && <div><p style={{ margin: "0 0 0.2rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>About</p><p style={{ margin: 0, fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.5 }}>{det.bio}</p></div>}
                                      {det.website && <p style={{ margin: 0, fontSize: "0.82rem" }}>🌐 <a href={det.website} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9" }}>{det.website}</a></p>}
                                      {det.industries?.length > 0 && <div><p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Industries</p><div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>{det.industries.map(i => <span key={i} style={{ fontSize: "0.75rem", backgroundColor: "#f0f9ff", color: "#0369a1", borderRadius: "999px", padding: "0.15rem 0.5rem", fontWeight: "600" }}>{i}</span>)}</div></div>}
                                      {det.cro_number && <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569" }}>CRO: <span style={{ fontFamily: "monospace", fontWeight: "700" }}>{det.cro_number}</span></p>}
                                      {det.jobs?.length > 0 && (
                                        <div>
                                          <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Job Posts ({det.jobs.length})</p>
                                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                            {det.jobs.map(j => (
                                              <div key={j.id} style={{ padding: "0.4rem 0.65rem", backgroundColor: "white", borderRadius: "0.4rem", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: "600", color: "#1e293b" }}>{j.title}</span>
                                                <span style={{ fontSize: "0.68rem", fontWeight: "700", padding: "0.1rem 0.4rem", borderRadius: "999px", backgroundColor: j.status === "Active" ? "#dcfce7" : "#f1f5f9", color: j.status === "Active" ? "#16a34a" : "#64748b" }}>{j.status}</span>
                                                {j.pay && <span style={{ fontSize: "0.7rem", color: "#64748b" }}>€{j.pay}/hr</span>}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>No additional details.</p>}
                                </div>
                              )}

                              <div style={{ marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                                <button onClick={() => setDeleteUserConfirm({ id: c.id, name: c.name, role: "company" })} style={{ padding: "0.35rem 0.75rem", borderRadius: "0.4rem", border: "1.5px solid #1e293b", backgroundColor: "#0f172a", color: "white", fontWeight: "700", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>🗑 Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        ) : null}

      </div>

      {/* F-M8: Reject confirmation modal */}
      {rejectConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div ref={rejectModalRef} role="dialog" aria-modal="true" aria-labelledby="reject-modal-title" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", padding: "1.5rem 1.75rem", maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <p id="reject-modal-title" style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.05rem", color: "var(--color-text-primary, #1e293b)" }}>
              Reject {rejectConfirm.type === "student" ? "Student" : "Company"}?
            </p>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>
              {rejectConfirm.type === "student"
                ? <><strong style={{ color: "var(--color-text-primary, #1e293b)" }}>{rejectConfirm.item.name}</strong> will be notified and can re-submit their documents.</>
                : <><strong style={{ color: "var(--color-text-primary, #1e293b)" }}>{rejectConfirm.item.name}</strong> will need to contact support to re-apply.</>}
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setRejectConfirm(null)}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const item = rejectConfirm.item;
                  const type = rejectConfirm.type;
                  setRejectConfirm(null);
                  if (type === "student") handleRejectStudent(item, true);
                  else handleRejectCompany(item, true);
                }}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#e11d48", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div ref={deleteUserModalRef} role="dialog" aria-modal="true" aria-labelledby="delete-user-modal-title" style={{ backgroundColor: "var(--color-bg-elevated, white)", borderRadius: "1rem", padding: "1.5rem 1.75rem", maxWidth: "380px", width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <p id="delete-user-modal-title" style={{ margin: "0 0 0.35rem", fontWeight: "800", fontSize: "1.05rem", color: "#e11d48" }}>
              Permanently delete {deleteUserConfirm.role}?
            </p>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--color-text-primary, #1e293b)" }}>{deleteUserConfirm.name}</strong> and all their data (jobs, applications, messages) will be permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteUserConfirm(null)}
                disabled={!!deletingUserId}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-body, #374151)", fontWeight: "600", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={handleAdminDeleteUser}
                disabled={!!deletingUserId}
                style={{ padding: "0.5rem 1.1rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#0f172a", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: deletingUserId ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deletingUserId ? 0.6 : 1 }}
              >
                {deletingUserId ? "Deleting…" : "Yes, Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

    </PageWrapper>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-secondary, #64748b)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>✅</div>
      <p style={{ fontWeight: "600", margin: 0 }}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    verified:       { label: "Verified",        bg: "#dcfce7", color: "#16a34a" },
    pending:        { label: "Pending",          bg: "#fef9c3", color: "#854d0e" },
    pending_review: { label: "Pending Review",   bg: "#ffedd5", color: "#c2410c" },
    rejected:       { label: "Rejected",         bg: "#fee2e2", color: "#b91c1c" },
  };
  const s = map[status] || { label: status || "Unknown", bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ fontSize: "0.68rem", fontWeight: "700", padding: "0.15rem 0.5rem", borderRadius: "999px", backgroundColor: s.bg, color: s.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {s.label}
    </span>
  );
}

function FilterToggle({ value, onChange, options, onRefresh }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: "0.3rem", backgroundColor: "#f1f5f9", borderRadius: "2rem", padding: "0.2rem" }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{ padding: "0.35rem 0.9rem", borderRadius: "2rem", border: "none", fontWeight: "700", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", background: value === opt.value ? "#0f172a" : "transparent", color: value === opt.value ? "white" : "#64748b", transition: "all 0.15s" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button onClick={onRefresh} style={{ padding: "0.35rem 0.7rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", fontWeight: "600" }}>↻ Refresh</button>
    </div>
  );
}

function SignupsPanel({ signups, loading, launchSending, testSending, onRefresh, onSendLaunch, onTestLaunch }) {
  const [search, setSearch] = useState("");

  if (loading || signups === null) {
    return <p style={{ color: "var(--color-text-secondary, #64748b)" }}>Loading…</p>;
  }

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week  = new Date(today); week.setDate(week.getDate() - 7);

  const total   = signups.length;
  const todayN  = signups.filter(s => new Date(s.created_at) >= today).length;
  const weekN   = signups.filter(s => new Date(s.created_at) >= week).length;
  const unsent  = signups.filter(s => !s.launch_email_sent_at).length;

  const filtered = search
    ? signups.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()))
    : signups;

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total", value: total },
          { label: "This week", value: weekN },
          { label: "Today", value: todayN },
          { label: "Not emailed", value: unsent },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1rem 1.25rem" }}>
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.72rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary, #64748b)" }}>{label}</p>
            <p style={{ margin: 0, fontSize: "2rem", fontWeight: "800", background: "linear-gradient(135deg,var(--color-brand),#C2185B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Actions row */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="signup-search" style={{ position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: 0, border: 0, clip: "rect(0,0,0,0)", overflow: "hidden" }}>Search signups by name or email</label>
        <input
          id="signup-search"
          type="text"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "180px", padding: "0.55rem 0.9rem", border: "1.5px solid #e2e8f0", borderRadius: "0.5rem", fontSize: "0.875rem", fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={onRefresh}
          style={{ padding: "0.55rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          ↺ Refresh
        </button>
        <button
          onClick={onTestLaunch}
          disabled={testSending}
          title="Sends one test launch email to your own address only — no signups affected"
          style={{ padding: "0.55rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "#0369a1", fontWeight: "600", fontSize: "0.82rem", cursor: testSending ? "default" : "pointer", fontFamily: "inherit", opacity: testSending ? 0.6 : 1 }}
        >
          {testSending ? "Sending…" : "Send Test Email"}
        </button>
        <button
          onClick={onSendLaunch}
          disabled={launchSending || unsent === 0}
          style={{ padding: "0.55rem 1rem", borderRadius: "0.5rem", border: "none", background: unsent === 0 ? "#e2e8f0" : "linear-gradient(135deg,var(--color-brand),#C2185B)", color: unsent === 0 ? "#64748b" : "white", fontWeight: "700", fontSize: "0.82rem", cursor: (launchSending || unsent === 0) ? "default" : "pointer", fontFamily: "inherit", opacity: launchSending ? 0.6 : 1 }}
        >
          {launchSending ? "Sending…" : unsent === 0 ? "All emailed" : `Send Launch Emails (${unsent})`}
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState label={search ? "No matches found" : "No signups yet"} />
      ) : (
        <div style={{ background: "var(--color-bg-elevated, white)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", overflow: "hidden" }}>
          {filtered.map((s, i) => {
            const initials = s.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            const date = new Date(s.created_at).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.85rem", padding: "0.8rem 1.25rem", borderBottom: i < filtered.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,var(--color-brand),#C2185B)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.75rem", fontWeight: "700", flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-primary, #1e293b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                  <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--color-text-secondary, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.email}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-secondary, #64748b)" }}>{date}</p>
                  {s.launch_email_sent_at && (
                    <p style={{ margin: "0.1rem 0 0", fontSize: "0.68rem", color: "#16a34a", fontWeight: "600" }}>✓ Emailed</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const cardStyle      = { backgroundColor: "var(--color-bg-surface, #f8fafc)", border: "1.5px solid #e2e8f0", borderRadius: "1rem", padding: "1.25rem 1.5rem" };
const docBtn         = { padding: "0.45rem 0.9rem", borderRadius: "0.5rem", border: "1.5px solid #e2e8f0", backgroundColor: "var(--color-bg-elevated, white)", color: "var(--color-brand)", fontWeight: "600", fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" };
const actionBtnBase  = { padding: "0.6rem 1.25rem", borderRadius: "2rem", border: "none", color: "white", fontWeight: "700", fontSize: "0.875rem", cursor: "pointer", fontFamily: "inherit" };
const verifyLinkStyle = { display: "inline-flex", alignItems: "center", padding: "0.3rem 0.75rem", borderRadius: "0.45rem", border: "1.5px solid #bae6fd", backgroundColor: "var(--color-bg-elevated, white)", color: "#0369a1", fontWeight: "600", fontSize: "0.76rem", textDecoration: "none", fontFamily: "inherit" };
