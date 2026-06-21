import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase, withTimeout } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import BackButton from "../components/BackButton";
import toast from "react-hot-toast";
import ReportModal from "../components/ReportModal";

const CATEGORIES = ["General", "Jobs & Shifts", "Pay & Rights", "Best Companies", "Tips & Advice", "Events"];

const CATEGORY_COLORS = {
  "General":        "#64748b",
  "Jobs & Shifts":  "#0369a1",
  "Pay & Rights":   "#15803d",
  "Best Companies": "#b45309",
  "Tips & Advice":  "#7c3aed",
  "Events":         "#dc2626",
};

export default function ForumPage() {
  const { currentUser } = useApp();
  const isVerifiedStudent = currentUser?.role === "student" && currentUser?.verificationStatus === "verified";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("top");
  const [myVotes, setMyVotes] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const [reportStudent, setReportStudent] = useState(null); // { id, name }

  // Comments state
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({}); // { [postId]: { loading, data: [] } }
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Delete post confirm state
  const [deletingPostId, setDeletingPostId] = useState(null);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const { data, error: err } = await withTimeout(
        () => supabase
          .from("forum_posts")
          .select("id, author_id, author_name, category, title, body, upvotes, created_at")
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100),
        10000
      );
      if (err) throw err;
      setPosts(data || []);

      if (currentUser) {
        const { data: votes } = await withTimeout(
          () => supabase.from("forum_votes").select("post_id").eq("user_id", currentUser.id),
          8000
        );
        setMyVotes(new Set((votes || []).map(v => v.post_id)));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleVote = async (postId) => {
    if (!currentUser) return;
    const alreadyVoted = myVotes.has(postId);
    setMyVotes(prev => {
      const next = new Set(prev);
      alreadyVoted ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, upvotes: p.upvotes + (alreadyVoted ? -1 : 1) } : p
    ));
    withTimeout(
      () => supabase.rpc("toggle_forum_vote", { p_post_id: postId }),
      8000
    ).catch(() => {
      setMyVotes(prev => {
        const next = new Set(prev);
        alreadyVoted ? next.add(postId) : next.delete(postId);
        return next;
      });
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, upvotes: p.upvotes + (alreadyVoted ? 1 : -1) } : p
      ));
    });
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newBody.trim()) { setPostError("Please fill in both title and message."); return; }
    if (newTitle.trim().length < 5) { setPostError("Title must be at least 5 characters."); return; }
    setPosting(true);
    setPostError("");
    try {
      const { error: err } = await withTimeout(
        () => supabase.from("forum_posts").insert({
          author_id: currentUser.id,
          author_name: currentUser.name,
          category: newCategory,
          title: newTitle.trim(),
          body: newBody.trim(),
        }),
        8000
      );
      if (err) throw err;
      setNewTitle("");
      setNewBody("");
      setNewCategory("General");
      setShowForm(false);
      loadPosts();
    } catch (e) {
      setPostError(e.message || "Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const { error: err } = await withTimeout(
        () => supabase.from("forum_posts").delete().eq("id", postId),
        8000
      );
      if (err) throw err;
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
      setDeletingPostId(null);
    } catch {
      toast.error("Failed to delete post.");
    }
  };

  const loadComments = useCallback(async (postId) => {
    setCommentsMap(prev => ({ ...prev, [postId]: { loading: true, data: prev[postId]?.data || [] } }));
    try {
      const { data, error: err } = await withTimeout(
        () => supabase
          .from("forum_comments")
          .select("id, author_id, author_name, body, created_at")
          .eq("post_id", postId)
          .order("created_at", { ascending: true }),
        8000
      );
      if (err) throw err;
      setCommentsMap(prev => ({ ...prev, [postId]: { loading: false, data: data || [] } }));
    } catch {
      setCommentsMap(prev => ({ ...prev, [postId]: { loading: false, data: prev[postId]?.data || [], error: true } }));
    }
  }, []);

  const toggleComments = (postId) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setCommentDraft("");
    } else {
      setExpandedPostId(postId);
      setCommentDraft("");
      if (!commentsMap[postId]?.data?.length && !commentsMap[postId]?.loading) {
        loadComments(postId);
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentDraft.trim()) return;
    setSubmittingComment(true);
    try {
      const { data, error: err } = await withTimeout(
        () => supabase.from("forum_comments").insert({
          post_id: postId,
          author_id: currentUser.id,
          author_name: currentUser.name,
          body: commentDraft.trim(),
        }).select("id, author_id, author_name, body, created_at").single(),
        8000
      );
      if (err) throw err;
      setCommentsMap(prev => ({
        ...prev,
        [postId]: { loading: false, data: [...(prev[postId]?.data || []), data] },
      }));
      setCommentDraft("");
    } catch {
      toast.error("Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId, postId) => {
    try {
      const { error: err } = await withTimeout(
        () => supabase.from("forum_comments").delete().eq("id", commentId),
        8000
      );
      if (err) throw err;
      setCommentsMap(prev => ({
        ...prev,
        [postId]: { ...prev[postId], data: prev[postId].data.filter(c => c.id !== commentId) },
      }));
    } catch {
      toast.error("Failed to delete comment.");
    }
  };

  const filtered = (selectedCategory === "All" ? posts : posts.filter(p => p.category === selectedCategory))
    .slice()
    .sort((a, b) => sortBy === "recent"
      ? new Date(b.created_at) - new Date(a.created_at)
      : b.upvotes - a.upvotes
    );

  const relTime = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000;
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ backgroundColor: "var(--color-bg-subtle, #fafafa)", minHeight: "100vh", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Helmet>
        <title>Community Forum — StudentShifts</title>
        <meta name="description" content="Tips, advice, and job talk from students across Ireland." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="StudentShifts" />
        <meta property="og:title" content="Community Forum — StudentShifts" />
        <meta property="og:description" content="Tips, advice, and job talk from students across Ireland." />
        <meta property="og:url" content="https://studentshifts.ie/forum" />
        <meta property="og:image" content="https://studentshifts.ie/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="StudentShifts — Part-Time Jobs for Irish Students" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Community Forum — StudentShifts" />
        <meta name="twitter:description" content="Tips, advice, and job talk from students across Ireland." />
        <meta name="twitter:image" content="https://studentshifts.ie/og-image.png" />
      </Helmet>

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.25rem" }}>
        <BackButton />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: "1.75rem", color: "var(--color-text-primary, #1e293b)" }}>Community Forum</h1>
            <p style={{ margin: "0.3rem 0 0", color: "var(--color-text-secondary, #64748b)", fontSize: "0.88rem" }}>
              Tips, advice, and job talk from students across Ireland
            </p>
          </div>
          {isVerifiedStudent && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ padding: "0.6rem 1.25rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(162,29,84,0.3)", whiteSpace: "nowrap" }}
            >
              + New Post
            </button>
          )}
        </div>

        {/* New post form */}
        {showForm && (
          <div style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderRadius: "1rem", padding: "1.25rem", marginBottom: "1.25rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 1rem", fontWeight: 700, fontSize: "1rem", color: "var(--color-text-primary, #1e293b)" }}>New Post</h3>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.75rem" }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Title (e.g. 'Best bars hiring in Galway?')"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              maxLength={120}
              style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", marginBottom: "0.75rem", boxSizing: "border-box" }}
            />
            <textarea
              placeholder="Share your tip, question, or experience…"
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              maxLength={1000}
              rows={4}
              style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.875rem", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", resize: "vertical", boxSizing: "border-box", marginBottom: "0.75rem" }}
            />
            {postError && <p style={{ margin: "0 0 0.6rem", fontSize: "0.8rem", color: "#ef4444" }}>{postError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => { setShowForm(false); setPostError(""); }} style={{ padding: "0.5rem 1rem", borderRadius: "2rem", border: "1.5px solid #e2e8f0", background: "var(--color-bg-elevated, white)", color: "var(--color-text-secondary, #64748b)", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handlePost} disabled={posting} style={{ padding: "0.5rem 1.25rem", borderRadius: "2rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.85rem", cursor: posting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: posting ? 0.7 : 1 }}>
                {posting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        )}

        {/* Category filter tabs + sort */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            {["All", ...CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{ padding: "0.35rem 0.85rem", borderRadius: "999px", border: `1.5px solid ${selectedCategory === cat ? "var(--color-brand)" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: selectedCategory === cat ? "#fce7f3" : "var(--color-bg-elevated, white)", color: selectedCategory === cat ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", fontWeight: selectedCategory === cat ? 700 : 500, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
            {[["top", "Top"], ["recent", "Recent"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                style={{ padding: "0.35rem 0.85rem", borderRadius: "999px", border: `1.5px solid ${sortBy === val ? "#0369a1" : "var(--color-border-light, #e2e8f0)"}`, backgroundColor: sortBy === val ? "#f0f9ff" : "var(--color-bg-elevated, white)", color: sortBy === val ? "#0369a1" : "var(--color-text-secondary, #64748b)", fontWeight: sortBy === val ? 700 : 500, fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* States */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: "90px", borderRadius: "0.85rem" }} />)}
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary, #64748b)" }}>
            <p style={{ fontWeight: 600 }}>Couldn't load posts. <button onClick={loadPosts} style={{ background: "none", border: "none", color: "var(--color-brand)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Retry</button></p>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #64748b)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</div>
            <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>No posts yet in this category</p>
            {isVerifiedStudent && <p style={{ fontSize: "0.85rem", margin: 0 }}>Be the first to start the conversation!</p>}
          </div>
        )}

        {/* Post list */}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {filtered.map(post => {
              const voted = myVotes.has(post.id);
              const bandColor = CATEGORY_COLORS[post.category] || "#64748b";
              const isExpanded = expandedPostId === post.id;
              const isOwnPost = post.author_id === currentUser?.id;
              const isDeletingThis = deletingPostId === post.id;
              const commentState = commentsMap[post.id];
              const commentCount = commentState?.data?.length ?? null;

              return (
                <div key={post.id} style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderLeft: `4px solid ${bandColor}`, borderRadius: "0.85rem", overflow: "hidden" }}>

                  {/* Post body row */}
                  <div style={{ padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    {/* Vote column */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.15rem", flexShrink: 0 }}>
                      <button
                        onClick={() => handleVote(post.id)}
                        disabled={!currentUser}
                        aria-label={voted ? "Remove upvote" : "Upvote"}
                        style={{ background: voted ? "#fce7f3" : "none", border: `1.5px solid ${voted ? "var(--color-brand)" : "#e2e8f0"}`, borderRadius: "0.5rem", padding: "0.3rem 0.5rem", cursor: currentUser ? "pointer" : "default", color: voted ? "var(--color-brand)" : "#94a3b8", fontWeight: 700, fontSize: "0.9rem", lineHeight: 1 }}
                      >
                        ▲
                      </button>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: voted ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)" }}>
                        {post.upvotes}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--color-brand)", backgroundColor: "#fce7f3", borderRadius: "999px", padding: "0.1rem 0.55rem" }}>
                          {post.category}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #94a3b8)" }}>
                          {post.author_name} · {relTime(post.created_at)}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 0.3rem", fontWeight: 700, fontSize: "0.95rem", color: "var(--color-text-primary, #1e293b)" }}>{post.title}</p>
                      <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {post.body}
                      </p>
                    </div>
                  </div>

                  {/* Post footer: Comments toggle + delete */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 1.25rem", borderTop: "1px solid var(--color-border-light, #e2e8f0)", backgroundColor: "var(--color-bg-subtle, #fafafa)" }}>
                    <button
                      onClick={() => toggleComments(post.id)}
                      style={{ background: "none", border: "none", padding: "0.2rem 0", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, color: isExpanded ? "var(--color-brand)" : "var(--color-text-secondary, #64748b)", display: "flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      💬 {isExpanded ? "Hide" : "Comments"}
                      {commentCount !== null && <span style={{ fontWeight: 500 }}>({commentCount})</span>}
                    </button>

                    {currentUser && !isOwnPost && (
                      <button
                        onClick={() => setReportStudent({ id: post.author_id, name: post.author_name })}
                        title={`Report ${post.author_name}`}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0.3rem", color: "#cbd5e1", fontSize: "0.78rem", fontFamily: "inherit" }}
                      >🚩 Report</button>
                    )}
                    {isOwnPost && (
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {isDeletingThis ? (
                          <>
                            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Delete this post?</span>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              style={{ padding: "0.2rem 0.6rem", borderRadius: "0.4rem", border: "1.5px solid #fca5a5", backgroundColor: "#fef2f2", color: "#dc2626", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}
                            >Yes, delete</button>
                            <button
                              onClick={() => setDeletingPostId(null)}
                              style={{ padding: "0.2rem 0.6rem", borderRadius: "0.4rem", border: "1.5px solid #e2e8f0", backgroundColor: "transparent", color: "#64748b", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer", fontFamily: "inherit" }}
                            >Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeletingPostId(post.id)}
                            style={{ background: "none", border: "none", padding: "0.2rem 0", cursor: "pointer", fontFamily: "inherit", fontSize: "0.78rem", fontWeight: 600, color: "#dc2626" }}
                          >Delete post</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comments section */}
                  {isExpanded && (
                    <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--color-border-light, #e2e8f0)" }}>
                      {commentState?.loading && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                          {[1,2].map(i => <div key={i} className="skeleton" style={{ height: "48px", borderRadius: "0.5rem" }} />)}
                        </div>
                      )}
                      {commentState?.error && (
                        <p style={{ fontSize: "0.82rem", color: "#ef4444", marginBottom: "0.75rem" }}>
                          Couldn't load comments. <button onClick={() => loadComments(post.id)} style={{ background: "none", border: "none", color: "var(--color-brand)", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Retry</button>
                        </p>
                      )}
                      {!commentState?.loading && commentState?.data?.length === 0 && (
                        <p style={{ fontSize: "0.82rem", color: "var(--color-text-muted, #94a3b8)", marginBottom: "0.75rem", fontStyle: "italic" }}>No comments yet. Be the first!</p>
                      )}
                      {commentState?.data?.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "0.75rem" }}>
                          {commentState.data.map(comment => (
                            <div key={comment.id} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#fce7f3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: "0.75rem", color: "var(--color-brand)" }}>
                                {comment.author_name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, backgroundColor: "var(--color-bg-subtle, #f8fafc)", borderRadius: "0.6rem", padding: "0.5rem 0.75rem" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
                                  <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--color-text-primary, #1e293b)" }}>{comment.author_name}</span>
                                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted, #94a3b8)" }}>{relTime(comment.created_at)}</span>
                                  {comment.author_id === currentUser?.id && (
                                    <button
                                      onClick={() => handleDeleteComment(comment.id, post.id)}
                                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.72rem", color: "#94a3b8", padding: 0 }}
                                      title="Delete comment"
                                    >✕</button>
                                  )}
                                </div>
                                <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-text-secondary, #64748b)", lineHeight: 1.5 }}>{comment.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment input */}
                      {isVerifiedStudent ? (
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
                          <textarea
                            placeholder="Write a comment…"
                            value={commentDraft}
                            onChange={e => setCommentDraft(e.target.value)}
                            maxLength={500}
                            rows={2}
                            onKeyDown={e => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment(post.id);
                              }
                            }}
                            style={{ flex: 1, padding: "0.5rem 0.7rem", borderRadius: "0.6rem", border: "1.5px solid #e2e8f0", fontSize: "0.82rem", fontFamily: "inherit", color: "var(--color-text-primary, #1e293b)", resize: "none", lineHeight: 1.5 }}
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={submittingComment || !commentDraft.trim()}
                            style={{ padding: "0.5rem 1rem", borderRadius: "0.6rem", border: "none", background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))", color: "white", fontWeight: 700, fontSize: "0.8rem", cursor: submittingComment || !commentDraft.trim() ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: submittingComment || !commentDraft.trim() ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0 }}
                          >
                            {submittingComment ? "…" : "Reply"}
                          </button>
                        </div>
                      ) : (
                        <p style={{ fontSize: "0.78rem", color: "var(--color-text-muted, #94a3b8)", margin: 0 }}>
                          {currentUser ? "Verified students can comment." : "Sign in to comment."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isVerifiedStudent && !loading && (
          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--color-text-muted, #94a3b8)", marginTop: "1.5rem" }}>
            {currentUser ? "Verified students can post and vote." : "Sign up or log in to participate."}
          </p>
        )}
      </div>
      {reportStudent && (
        <ReportModal
          targetType="student"
          targetId={reportStudent.id}
          targetName={reportStudent.name}
          onClose={() => setReportStudent(null)}
        />
      )}
    </div>
  );
}
