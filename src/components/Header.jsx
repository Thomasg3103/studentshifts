import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

export default function Header() {
  const { currentUser, setPage, likedJobs, appliedJobs, notifCount, msgCount } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const menuRef = useRef(null);
  const location = useLocation();

  const isMobile = windowWidth < 1024;

  const optionalBadge = (() => {
    if (currentUser?.role !== "student") return 0;
    let n = 0;
    if (!currentUser.cvName) n++;
    if (!currentUser.coverLetterName) n++;
    if (!currentUser.linkedIn) n++;
    return n;
  })();

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const homeRoute = currentUser?.role === "company" ? "companyDashboard"
    : currentUser?.role === "admin" ? "admin"
    : "studentDashboard";

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  const menuItems = currentUser ? [
    { label: "About",       action: () => { setMenuOpen(false); setPage("about"); } },
    { label: "Help Centre", action: () => { setMenuOpen(false); setPage("help"); } },
    { label: "Contact Us",  action: () => { setMenuOpen(false); setPage("help"); } },
    { separator: true },
    { label: "Sign Out", action: signOut, danger: true },
  ] : [
    { label: "Login",       action: () => { setMenuOpen(false); setPage("login"); } },
    { label: "Sign Up",     action: () => { setMenuOpen(false); setPage("signup"); } },
    { separator: true },
    { label: "About",       action: () => { setMenuOpen(false); setPage("about"); } },
    { label: "Help Centre", action: () => { setMenuOpen(false); setPage("help"); } },
    { label: "Contact Us",  action: () => { setMenuOpen(false); setPage("help"); } },
  ];

  const Hamburger = () => (
    <button
      aria-label={menuOpen ? "Close menu" : "Open menu"}
      aria-expanded={menuOpen}
      onClick={() => setMenuOpen(o => !o)}
      style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.5rem", width: "44px", height: "44px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer", flexShrink: 0 }}
    >
      <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
      <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
      <span style={{ width: "18px", height: "2px", background: "white", borderRadius: "1px", display: "block" }} />
    </button>
  );

  const Dropdown = () => menuOpen ? (
    <div style={{ position: "absolute", top: "48px", right: 0, backgroundColor: "white", border: "1.5px solid #e2e8f0", borderRadius: "1rem", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 300, minWidth: "180px", overflow: "hidden" }}>
      {menuItems.map((item, i) =>
        item.separator ? (
          <hr key={i} style={{ border: "none", borderTop: "1px solid #fafafa", margin: "0.25rem 0" }} />
        ) : (
          <button key={item.label} onClick={item.action}
            style={{ display: "block", width: "100%", padding: "0.75rem 1.25rem", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: item.danger ? "#ef4444" : "#1e293b" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  ) : null;

  return (
    <>
      <header style={{
        display: "flex", alignItems: "center",
        justifyContent: isMobile ? "center" : "space-between",
        padding: isMobile ? "0.6rem 1rem" : "0.85rem 2.5rem",
        background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-dark) 100%)",
        color: "white",
        boxShadow: "0 4px 20px rgba(162,29,84,0.35)",
        position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>

        {/* Logo — centered on mobile, left on desktop */}
        <div
          className="header-logo"
          onClick={() => setPage(homeRoute)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem", flexShrink: 0, transition: "transform 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <div className="header-logo-icon"><LogoIcon /></div>
          <div className="header-logo-text" style={{ lineHeight: 1.15 }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "800", color: "white", letterSpacing: "-0.02em" }}>
              Student<span style={{ opacity: 0.7 }}>Shifts</span>
            </span>
          </div>
        </div>

        {/* Desktop: full right cluster */}
        {!isMobile && (
          <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "0.5rem", position: "relative" }} ref={menuRef}>
            {currentUser?.role === "student" && (
              <>
                {/* Active page detection */}
                {(() => {
                  const p = location.pathname;
                  const isLiked    = p === "/liked";
                  const isApplied  = p === "/applied";
                  const isMessages = p === "/messages";
                  const isAccount  = p === "/account";
                  return (
                    <>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button aria-label="Liked jobs" onClick={() => setPage("likedJobs")} style={{ ...navBtn(isLiked), display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <HeartIcon active={isLiked} color={isLiked ? "var(--color-brand)" : "white"} /> <span className="nav-label">Liked</span>
                        </button>
                        {likedJobs.length > 0 && <span className={`notif-dot${isLiked ? " notif-dot--active" : ""}`}>{likedJobs.length}</span>}
                      </div>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button aria-label="Applied jobs" onClick={() => setPage("appliedJobs")} style={{ ...navBtn(isApplied), display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <DocumentIcon active={isApplied} color={isApplied ? "var(--color-brand)" : "white"} /> <span className="nav-label">Applied</span>
                        </button>
                        {appliedJobs.length > 0 && <span className={`notif-dot${isApplied ? " notif-dot--active" : ""}`}>{appliedJobs.length}</span>}
                      </div>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button aria-label="Messages" onClick={() => setPage("messages")} style={{ ...navBtn(isMessages), display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                          <ChatIcon active={isMessages} color={isMessages ? "var(--color-brand)" : "white"} /> <span className="nav-label">Messages</span>
                        </button>
                        {msgCount > 0 && <span className={`notif-dot${isMessages ? " notif-dot--active" : ""}`}>{msgCount}</span>}
                      </div>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button aria-label="Account" onClick={() => setPage("account")} style={{ ...navBtn(isAccount), display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                          {currentUser.profilePhoto
                            ? <img loading="lazy" src={currentUser.profilePhoto} alt="Profile" style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: isAccount ? "2px solid var(--color-brand)" : "none" }} />
                            : <PersonIcon color={isAccount ? "var(--color-brand)" : "white"} />
                          }
                          <span className="nav-label">Account</span>
                        </button>
                        {optionalBadge > 0 && <span className={`notif-dot${isAccount ? " notif-dot--active" : ""}`}>{optionalBadge}</span>}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
            {currentUser?.role === "company" && (
              <>
                {(() => {
                  const p = location.pathname;
                  const isBrowse   = p === "/";
                  const isMessages = p === "/company/messages";
                  const isMyJobs   = p === "/company";
                  const isAccount  = p === "/account";
                  return (
                    <>
                      <button onClick={() => setPage("studentDashboard")} style={navBtn(isBrowse)}><span className="nav-label">Browse </span>Home</button>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button onClick={() => setPage("companyMessages")} style={{ ...navBtn(isMessages), display: "inline-flex", alignItems: "center", gap: "0.4rem" }}><ChatIcon active={isMessages} color={isMessages ? "var(--color-brand)" : "white"} /> <span className="nav-label">Messages</span></button>
                        {msgCount > 0 && <span className={`notif-dot${isMessages ? " notif-dot--active" : ""}`}>{msgCount}</span>}
                      </div>
                      <button onClick={() => setPage("companyDashboard")} style={navBtn(isMyJobs)}><span className="nav-label">My </span>Jobs</button>
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button onClick={() => setPage("account")} style={{ ...navBtn(isAccount), display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                          {currentUser.profilePhoto
                            ? <img loading="lazy" src={currentUser.profilePhoto} alt="Profile" style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: isAccount ? "2px solid var(--color-brand)" : "none" }} />
                            : <PersonIcon color={isAccount ? "var(--color-brand)" : "white"} />
                          }
                          <span className="nav-label">Account</span>
                        </button>
                        {optionalBadge > 0 && <span className={`notif-dot${isAccount ? " notif-dot--active" : ""}`}>{optionalBadge}</span>}
                      </div>
                    </>
                  );
                })()}
              </>
            )}
            {currentUser?.role === "admin" && (
              <button onClick={() => setPage("admin")} style={navBtnPrimary}>Admin Dashboard</button>
            )}
            {!currentUser && (
              <>
                <button onClick={() => setPage("login")} style={navBtnOutline}>Login</button>
                <button onClick={() => setPage("signup")} style={navBtnPrimary}>Sign Up</button>
              </>
            )}
            <Hamburger />
            <Dropdown />
          </div>
        )}

        {/* Mobile: hamburger only, absolutely right */}
        {isMobile && (
          <div ref={menuRef} style={{ position: "absolute", right: "1rem", display: "flex", alignItems: "center" }}>
            <Hamburger />
            <Dropdown />
          </div>
        )}
      </header>

      {/* Mobile bottom nav — students only */}
      {isMobile && currentUser?.role === "student" && (
        <MobileBottomNav
          setPage={setPage}
          likedJobs={likedJobs}
          appliedJobs={appliedJobs}
          msgCount={msgCount}
          currentUser={currentUser}
          optionalBadge={optionalBadge}
          pathname={location.pathname}
        />
      )}

      {/* Mobile bottom nav — companies */}
      {isMobile && currentUser?.role === "company" && (
        <CompanyMobileBottomNav
          setPage={setPage}
          pathname={location.pathname}
          msgCount={msgCount}
        />
      )}
    </>
  );
}

function MobileBottomNav({ setPage, likedJobs, appliedJobs, msgCount, currentUser, optionalBadge, pathname }) {
  const isHome     = pathname === "/" || pathname.startsWith("/jobs/");
  const isLiked    = pathname === "/liked";
  const isApplied  = pathname === "/applied";
  const isMessages = pathname === "/messages";
  const isAccount  = pathname === "/account";

  const tab = (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "2px", flex: 1, padding: "0.35rem 0",
    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
    color: active ? "var(--color-brand)" : "#94a3b8",
    fontSize: "0.6rem", fontWeight: active ? 700 : 500,
  });

  return (
    <nav aria-label="Main navigation" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
      backgroundColor: "white", borderTop: "1.5px solid #e2e8f0",
      display: "flex", alignItems: "stretch", zIndex: 200,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.07)",
    }}>

      {/* Liked */}
      <div style={{ flex: 1, position: "relative" }}>
        <button aria-label="Liked jobs" onClick={() => setPage("likedJobs")} style={{ ...tab(isLiked), width: "100%", height: "100%" }}>
          <HeartIcon active={isLiked} />
          Liked
        </button>
        {likedJobs.length > 0 && <span className="nav-dot">{likedJobs.length}</span>}
      </div>

      {/* Applied */}
      <div style={{ flex: 1, position: "relative" }}>
        <button aria-label="Applied jobs" onClick={() => setPage("appliedJobs")} style={{ ...tab(isApplied), width: "100%", height: "100%" }}>
          <DocumentIcon active={isApplied} />
          Applied
        </button>
        {appliedJobs.length > 0 && <span className="nav-dot">{appliedJobs.length}</span>}
      </div>

      {/* Home — centre */}
      <button aria-label="Home" onClick={() => setPage("studentDashboard")} style={tab(isHome)}>
        <HomeIcon active={isHome} />
        Home
      </button>

      {/* Messages */}
      <div style={{ flex: 1, position: "relative" }}>
        <button aria-label="Messages" onClick={() => setPage("messages")} style={{ ...tab(isMessages), width: "100%", height: "100%" }}>
          <ChatIcon active={isMessages} />
          Messages
        </button>
        {msgCount > 0 && <span className="nav-dot nav-dot--right">{msgCount}</span>}
      </div>

      {/* Account */}
      <div style={{ flex: 1, position: "relative" }}>
        <button aria-label="Account" onClick={() => setPage("account")} style={{ ...tab(isAccount), width: "100%", height: "100%" }}>
          {currentUser?.profilePhoto
            ? <img loading="lazy" src={currentUser.profilePhoto} alt="Profile" style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${isAccount ? "var(--color-brand)" : "#e2e8f0"}` }} />
            : <PersonIcon color={isAccount ? "var(--color-brand)" : "#94a3b8"} />
          }
          Account
        </button>
        {optionalBadge > 0 && <span className="nav-dot">{optionalBadge}</span>}
      </div>
    </nav>
  );
}

function CompanyMobileBottomNav({ setPage, pathname, msgCount }) {
  const isBrowse   = pathname === "/";
  const isMessages = pathname === "/company/messages";
  const isMyJobs   = pathname === "/company";
  const isAccount  = pathname === "/account";

  const tab = (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "2px", flex: 1, padding: "0.35rem 0",
    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
    color: active ? "var(--color-brand)" : "#94a3b8",
    fontSize: "0.6rem", fontWeight: active ? 700 : 500,
  });

  return (
    <nav aria-label="Main navigation" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
      backgroundColor: "white", borderTop: "1.5px solid #e2e8f0",
      display: "flex", alignItems: "stretch", zIndex: 200,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.07)",
    }}>
      <button aria-label="Browse students" onClick={() => setPage("studentDashboard")} style={tab(isBrowse)}>
        <BrowseIcon active={isBrowse} />
        Browse Home
      </button>
      <div style={{ flex: 1, position: "relative" }}>
        <button aria-label="Messages" onClick={() => setPage("companyMessages")} style={{ ...tab(isMessages), width: "100%", height: "100%" }}>
          <ChatIcon active={isMessages} />
          Messages
        </button>
        {msgCount > 0 && <span className="nav-dot nav-dot--right">{msgCount}</span>}
      </div>
      <button aria-label="My jobs" onClick={() => setPage("companyDashboard")} style={tab(isMyJobs)}>
        <BriefcaseIcon active={isMyJobs} />
        My Jobs
      </button>
      <button aria-label="Account" onClick={() => setPage("account")} style={tab(isAccount)}>
        <PersonIcon color={isAccount ? "var(--color-brand)" : "#94a3b8"} />
        Account
      </button>
    </nav>
  );
}

function LogoIcon() {
  return (
    <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <polygon points="12,3 22,8 12,13 2,8" fill="var(--color-brand)" />
        <path d="M6 10.5v4.5c0 1.93 2.69 3.5 6 3.5s6-1.57 6-3.5v-4.5" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        <line x1="20" y1="8" x2="20" y2="14" stroke="var(--color-brand)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="15.5" r="1.5" fill="var(--color-brand)" />
      </svg>
    </div>
  );
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "var(--color-brand)" : "none"} stroke={active ? "var(--color-brand)" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PersonIcon({ color = "white" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function BrowseIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-brand)" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

function BriefcaseIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-brand)" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}

function HeartIcon({ active, color }) {
  const c = color || (active ? "var(--color-brand)" : "#94a3b8");
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? c : "none"} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function DocumentIcon({ active, color }) {
  const c = color || (active ? "var(--color-brand)" : "#94a3b8");
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function ChatIcon({ active, color }) {
  const c = color || (active ? "var(--color-brand)" : "#94a3b8");
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

const navBtnPrimary = {
  padding: "0.48rem 1.1rem", borderRadius: "2rem",
  background: "linear-gradient(135deg, var(--color-brand), var(--color-brand-dark))",
  color: "white", border: "none", cursor: "pointer",
  fontWeight: "700", fontSize: "0.82rem",
  boxShadow: "0 4px 14px rgba(162,29,84,0.45)", fontFamily: "inherit",
};
const navBtnOutline = {
  padding: "0.45rem 1.1rem", borderRadius: "2rem",
  backgroundColor: "rgba(255,255,255,0.15)", color: "white",
  border: "1.5px solid rgba(255,255,255,0.45)",
  cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", fontFamily: "inherit",
};
const navBtnActive = {
  padding: "0.45rem 1.1rem", borderRadius: "2rem",
  backgroundColor: "white", color: "var(--color-brand)",
  border: "1.5px solid white",
  cursor: "default", fontWeight: "800", fontSize: "0.82rem", fontFamily: "inherit",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
};
const navBtn = (active) => active ? navBtnActive : navBtnOutline;
