import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { supabase, withTimeout } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import BackButton from "../components/BackButton";

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
  const [myVotes, setMyVotes] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const { data, error: err } = await withTimeout(
        () => supabase
          .from("forum_posts")
          .select("id, author_name, category, title, body, upvotes, created_at")
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
    // Optimistic update
    setMyVotes(prev => {
      const next = new Set(prev);
      alreadyVoted ? next.delete(postId) : next.add(postId);
      return next;
    });
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, upvotes: p.upvotes + (alreadyVoted ? -1 : 1) } : p
    ));
    // Persist via RPC
    withTimeout(
      () => supabase.rpc("toggle_forum_vote", { p_post_id: postId }),
      8000
    ).catch(() => {
      // Roll back optimistic update on failure
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
        {!loading && !error && posts.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary, #64748b)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>💬</div>
            <p style={{ fontWeight: 600, margin: "0 0 0.25rem" }}>No posts yet</p>
            {isVerifiedStudent && <p style={{ fontSize: "0.85rem", margin: 0 }}>Be the first to start the conversation!</p>}
          </div>
        )}

        {/* Post list */}
        {!loading && !error && posts.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {posts.map(post => {
              const voted = myVotes.has(post.id);
              const bandColor = CATEGORY_COLORS[post.category] || "#64748b";
              return (
                <div
                  key={post.id}
                  style={{ backgroundColor: "var(--color-bg-elevated, white)", border: "1.5px solid var(--color-border-light, #e2e8f0)", borderLeft: `4px solid ${bandColor}`, borderRadius: "0.85rem", padding: "1rem 1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}
                >
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
    </div>
  );
}
