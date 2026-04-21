export default function Header({ currentUser, setPage, likedJobs, appliedJobs, notifCount }) {

  const optionalBadge = (() => {
    if (currentUser?.role !== "student") return 0;
    let missing = 0;
    if (!currentUser.cvName) missing++;
    if (!currentUser.coverLetterName) missing++;
    if (!currentUser.linkedIn) missing++;
    return missing;
  })();

  return (
    <header style={{
      display: "grid",
      gridTemplateColumns: "1fr auto 1fr",
      alignItems: "center",
      padding: "0.9rem 2.5rem",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      color: "white",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>

      {/* Left — Account (when logged in) + About */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {currentUser && (
          <div style={{ position: "relative", display: "inline-block" }}>
            <button onClick={() => setPage("account")} style={{ ...navBtnPrimary, display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
              {currentUser.profilePhoto
                ? <img src={currentUser.profilePhoto} alt="Profile" style={{ width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover", display: "block", flexShrink: 0 }} />
                : <PersonIcon />
              }
            </button>
            {optionalBadge > 0 && <span style={notifDot}>{optionalBadge}</span>}
          </div>
        )}
        <button onClick={() => setPage("about")} style={navBtnOutline}>About</button>
      </div>

      {/* Centre — Logo */}
      <div
        className="header-logo"
        style={{ display: "flex", alignItems: "center", gap: "0.85rem", cursor: "pointer" }}
        onClick={() => setPage("studentDashboard")}
      >
        <div className="header-logo-icon"><LogoIcon /></div>
        <div className="header-logo-text" style={{ lineHeight: "1.15" }}>
          <div className="logo-student" style={{ margin: 0, fontSize: "2.1rem", fontWeight: "800", background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>Student</div>
          <div className="logo-shifts" style={{ margin: 0, fontSize: "2.1rem", fontWeight: "800", letterSpacing: "-0.02em" }}>
            <span style={{ color: "white" }}>Shifts</span><span style={{ color: "#6366f1" }}>.ie</span>
          </div>
        </div>
      </div>

      {/* Right — Liked/Applied (student) or Login/Sign Up (logged out) */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
        {currentUser ? (
          <>
            {currentUser.role === "admin" ? (
              <button onClick={() => setPage("admin")} style={navBtnPrimary}>Admin Dashboard</button>
            ) : currentUser.role === "student" ? (
              <>
                <div className="nav-liked-wrap" style={{ position: "relative", display: "inline-block" }}>
                  <button onClick={() => setPage("likedJobs")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    ❤️ <span className="nav-label">Liked</span> <CountBadge n={likedJobs.length} />
                  </button>
                </div>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <button onClick={() => setPage("appliedJobs")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                    ✅ <span className="nav-label">Applied</span> <CountBadge n={appliedJobs.length} />
                  </button>
                  {notifCount > 0 && <span style={notifDot}>{notifCount}</span>}
                </div>
                <button onClick={() => setPage("messages")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                  💬 <span className="nav-label">Messages</span>
                </button>
              </>
            ) : (
              <>
                <div className="nav-browse-wrap" style={{ display: "inline-block" }}>
                  <button onClick={() => setPage("studentDashboard")} style={navBtnOutline}>Browse Jobs</button>
                </div>
                <button onClick={() => setPage("companyMessages")} style={{ ...navBtnOutline, display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>💬 <span className="nav-label">Messages</span></button>
                <button onClick={() => setPage("companyDashboard")} style={navBtnPrimary}><span className="nav-label">My </span>Jobs</button>
              </>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setPage("login")} style={navBtnOutline}>Login</button>
            <button onClick={() => setPage("signup")} style={navBtnPrimary}>Sign Up</button>
          </>
        )}
      </div>
    </header>
  );
}

function LogoIcon() {
  return (
    <svg width="68" height="76" viewBox="0 0 46 52" fill="none">
      <defs>
        <linearGradient id="logoHeart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <clipPath id="logoHeartClip">
          <path d="M23 48 C23 48 3 36 3 22 C3 14 9 8 16.5 8 C19.8 8 22.5 9.6 23 12 C23.5 9.6 26.2 8 29.5 8 C37 8 43 14 43 22 C43 36 23 48 23 48Z" />
        </clipPath>
      </defs>
      <path d="M23 48 C23 48 3 36 3 22 C3 14 9 8 16.5 8 C19.8 8 22.5 9.6 23 12 C23.5 9.6 26.2 8 29.5 8 C37 8 43 14 43 22 C43 36 23 48 23 48Z" fill="url(#logoHeart)" />
      <g clipPath="url(#logoHeartClip)">
        <line x1="3" y1="20" x2="43" y2="20" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        <line x1="3" y1="28" x2="43" y2="28" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
        <line x1="3" y1="36" x2="43" y2="36" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
      </g>
      <rect x="14" y="3" width="4" height="9" rx="2" fill="white" opacity="0.8" />
      <rect x="28" y="3" width="4" height="9" rx="2" fill="white" opacity="0.8" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  padding: "0.48rem 1.1rem",
  borderRadius: "2rem",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "white",
  border: "none",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "0.82rem",
  boxShadow: "0 4px 14px rgba(99,102,241,0.45)",
  fontFamily: "inherit",
};

const navBtnOutline = {
  padding: "0.45rem 1.1rem",
  borderRadius: "2rem",
  backgroundColor: "transparent",
  color: "white",
  border: "1.5px solid rgba(255,255,255,0.28)",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.82rem",
  fontFamily: "inherit",
};

const notifDot = {
  position: "absolute",
  top: "-4px",
  right: "-4px",
  backgroundColor: "#f43f5e",
  color: "white",
  fontSize: "0.62rem",
  fontWeight: "700",
  width: "16px",
  height: "16px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  border: "2px solid #0f172a",
};
