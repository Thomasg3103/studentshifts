import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Header({ currentUser, setPage, likedJobs, appliedJobs, notifCount }) {
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
    { label: "Help Centre", action: () => { setMenuOpen(false); setPage("about"); } },
    { label: "Contact Us",  action: () => { setMenuOpen(false); setPage("about"); } },
    { separator: true },
    { label: "Sign Out", action: signOut, danger: true },
  ] : [
    { label: "Login",       action: () => { setMenuOpen(false); setPage("login"); } },
    { label: "Sign Up",     action: () => { setMenuOpen(false); setPage("signup"); } },
    { separator: true },
    { label: "About",       action: () => { setMenuOpen(false); setPage("about"); } },
    { label: "Help Centre", action: () => { setMenuOpen(false); setPage("about"); } },
    { label: "Contact Us",  action: () => { setMenuOpen(false); setPage("about"); } },
  ];

  const Hamburger = () => (
    <button
      onClick={() => setMenuOpen(o => !o)}
      style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: "0.5rem", width: "38px", height: "38px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", cursor: "pointer", flexShrink: 0 }}
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
        background: "linear-gradient(135deg, #A21D54 0%, #C2185B 100%)",
        color: "white",
        boxShadow: "0 4px 20px rgba(162,29,84,0.35)",
        position: "sticky", top: 0, zIndex: 100,
        boxSizing: "border-box",
      }}>

        {/* Logo — centered on mobile, left on desktop */}
        <div
          className="header-logo"
          onClick={() => setPage(homeRoute)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.85rem", flexShrink: 0 }}
        >
          <div className="header-logo-icon"><LogoIcon /></div>
          <div className="header-logo-text" style={{ lineHeight: 1.15 }}>
            <span style={{ fontSize: "1.7rem", fontWeight: "800", color: "white", letterSpacing: "-0.02em" }}>
              Student<span style={{ opacity: 0.7 }}>Shifts.ie</span>
            </span>
          </div>
        </div>

        {/* Desktop: full right cluster */}
        {!isMobile && (
          <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "0.5rem", position: "relative" }} ref={menuRef}>
            {currentUser?.role === "student" && (
              <>
                <button onClick={() => setPage("likedJobs")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  ❤️ <span className="nav-label">Liked</span> <CountBadge n={likedJobs.length} />
                </button>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button onClick={() => setPage("appliedJobs")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    📄 <span className="nav-label">Applied</span>
                  </button>
                  {notifCount > 0 && <span style={notifDot}>{notifCount}</span>}
                </div>
                <button onClick={() => setPage("messages")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  💬 <span className="nav-label">Messages</span>
                </button>
              </>
            )}
            {currentUser?.role === "company" && (
              <>
                <button onClick={() => setPage("studentDashboard")} style={navBtnOutline}><span className="nav-label">Browse </span>Jobs</button>
                <button onClick={() => setPage("companyMessages")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>💬 <span className="nav-label">Messages</span></button>
                <button onClick={() => setPage("companyDashboard")} style={navBtnPrimary}><span className="nav-label">My </span>Jobs</button>
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
            {currentUser && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <button onClick={() => setPage("account")} style={{ ...navBtnPrimary, display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                  {currentUser.profilePhoto
                    ? <img src={currentUser.profilePhoto} alt="Profile" style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <PersonIcon />
                  }
                </button>
                {optionalBadge > 0 && <span style={notifDot}>{optionalBadge}</span>}
              </div>
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
          notifCount={notifCount}
          currentUser={currentUser}
          optionalBadge={optionalBadge}
          pathname={location.pathname}
        />
      )}
    </>
  );
}

function MobileBottomNav({ setPage, likedJobs, appliedJobs, notifCount, currentUser, optionalBadge, pathname }) {
  const isHome     = pathname === "/" || pathname.startsWith("/jobs/");
  const isLiked    = pathname === "/liked";
  const isApplied  = pathname === "/applied";
  const isMessages = pathname === "/messages";
  const isAccount  = pathname === "/account";

  const tab = (active) => ({
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "2px", flex: 1, padding: "0.35rem 0",
    background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
    color: active ? "#A21D54" : "#94a3b8",
    fontSize: "0.6rem", fontWeight: active ? 700 : 500,
  });

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: "64px",
      backgroundColor: "white", borderTop: "1.5px solid #e2e8f0",
      display: "flex", alignItems: "stretch", zIndex: 200,
      boxShadow: "0 -4px 16px rgba(0,0,0,0.07)",
    }}>

      {/* Liked */}
      <div style={{ flex: 1, position: "relative" }}>
        <button onClick={() => setPage("likedJobs")} style={{ ...tab(isLiked), width: "100%", height: "100%" }}>
          <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>❤️</span>
          Liked
        </button>
        {likedJobs.length > 0 && (
          <span style={{ position: "absolute", top: "6px", left: "50%", marginLeft: "6px", backgroundColor: "#f43f5e", color: "white", fontSize: "0.55rem", fontWeight: 700, width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{likedJobs.length}</span>
        )}
      </div>

      {/* Applied */}
      <div style={{ flex: 1, position: "relative" }}>
        <button onClick={() => setPage("appliedJobs")} style={{ ...tab(isApplied), width: "100%", height: "100%" }}>
          <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>📄</span>
          Applied
        </button>
        {notifCount > 0 && (
          <span style={{ position: "absolute", top: "6px", left: "50%", marginLeft: "6px", backgroundColor: "#f43f5e", color: "white", fontSize: "0.55rem", fontWeight: 700, width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{notifCount}</span>
        )}
      </div>

      {/* Home — centre */}
      <button onClick={() => setPage("studentDashboard")} style={tab(isHome)}>
        <HomeIcon active={isHome} />
        Home
      </button>

      {/* Messages */}
      <button onClick={() => setPage("messages")} style={tab(isMessages)}>
        <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>💬</span>
        Messages
      </button>

      {/* Account */}
      <div style={{ flex: 1, position: "relative" }}>
        <button onClick={() => setPage("account")} style={{ ...tab(isAccount), width: "100%", height: "100%" }}>
          {currentUser?.profilePhoto
            ? <img src={currentUser.profilePhoto} alt="Profile" style={{ width: "26px", height: "26px", borderRadius: "50%", objectFit: "cover", border: `2px solid ${isAccount ? "#A21D54" : "#e2e8f0"}` }} />
            : <PersonIcon color={isAccount ? "#A21D54" : "#94a3b8"} />
          }
          Account
        </button>
        {optionalBadge > 0 && (
          <span style={{ position: "absolute", top: "6px", left: "50%", marginLeft: "6px", backgroundColor: "#f43f5e", color: "white", fontSize: "0.55rem", fontWeight: 700, width: "14px", height: "14px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{optionalBadge}</span>
        )}
      </div>
    </nav>
  );
}

function LogoIcon() {
  return (
    <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <polygon points="12,3 22,8 12,13 2,8" fill="#A21D54" />
        <path d="M6 10.5v4.5c0 1.93 2.69 3.5 6 3.5s6-1.57 6-3.5v-4.5" stroke="#A21D54" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        <line x1="20" y1="8" x2="20" y2="14" stroke="#A21D54" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="15.5" r="1.5" fill="#A21D54" />
      </svg>
    </div>
  );
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#A21D54" : "none"} stroke={active ? "#A21D54" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PersonIcon({ color = "currentColor" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function CountBadge({ n }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: "999px", padding: "0 0.45rem", fontSize: "0.68rem", fontWeight: "700", minWidth: "18px", height: "18px" }}>
      {n}
    </span>
  );
}

const navBtnPrimary = {
  padding: "0.48rem 1.1rem", borderRadius: "2rem",
  background: "linear-gradient(135deg, #A21D54, #C2185B)",
  color: "white", border: "none", cursor: "pointer",
  fontWeight: "700", fontSize: "0.82rem",
  boxShadow: "0 4px 14px rgba(162,29,84,0.45)", fontFamily: "inherit",
};
const navBtnOutline = {
  padding: "0.45rem 1.1rem", borderRadius: "2rem",
  backgroundColor: "rgba(255,255,255,0.15)", color: "white",
  border: "1.5px solid rgba(255,255,255,0.5)",
  cursor: "pointer", fontWeight: "600", fontSize: "0.82rem", fontFamily: "inherit",
};
const notifDot = {
  position: "absolute", top: "-4px", right: "-4px",
  backgroundColor: "#f43f5e", color: "white",
  fontSize: "0.62rem", fontWeight: "700",
  width: "16px", height: "16px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  pointerEvents: "none", border: "2px solid #C2185B",
};
