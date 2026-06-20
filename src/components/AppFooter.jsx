import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function AppFooter() {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  const handleAdvertise = () => {
    if (currentUser?.role === "company") navigate("/company");
    else navigate("/login");
  };

  return (
    <footer className="app-footer" style={{ backgroundColor: "#0f172a", color: "rgba(255,255,255,0.55)", fontFamily: "'Plus Jakarta Sans', sans-serif", padding: "3.5rem 1.5rem 1.5rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "2.5rem", marginBottom: "2.5rem" }}>

          <div>
            <p style={fHead}>Navigate</p>
            <FLink onClick={() => navigate("/about")}>About Us</FLink>
            <FLink onClick={() => navigate("/")}>Jobs</FLink>
            <FLink onClick={() => navigate("/leaderboard")}>Top Employers</FLink>
            <FLink onClick={() => navigate("/forum")}>Community Forum</FLink>
            <FLink onClick={() => navigate("/login")}>Login</FLink>
            <FLink onClick={() => navigate("/signup")}>Sign Up</FLink>
          </div>

          <div>
            <p style={fHead}>Support</p>
            <FLink onClick={() => navigate("/help")}>Help Centre</FLink>
            <FLink onClick={handleAdvertise}>Advertise a Job</FLink>
            <FLink onClick={() => navigate("/contact")}>Contact Us</FLink>
          </div>

          <div>
            <p style={fHead}>Legal</p>
            <FLink onClick={() => navigate("/privacy")}>Privacy Policy</FLink>
            <FLink onClick={() => navigate("/terms")}>Terms &amp; Conditions</FLink>
            {/* TODO: add Cookies page before launch */}
          </div>

          <div>
            <p style={fHead}>Let's Connect</p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
              <a href="https://www.instagram.com/studentshifts/" target="_blank" rel="noopener noreferrer" title="StudentShifts on Instagram" style={{ display: "inline-block", width: "40px", height: "40px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, transition: "opacity 0.15s", opacity: 1 }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <img src="/instagram-icon.svg" alt="Instagram" width="40" height="40" style={{ display: "block" }} />
              </a>
              <a href="https://www.linkedin.com/company/studentshifts/" target="_blank" rel="noopener noreferrer" title="StudentShifts on LinkedIn" style={{ display: "inline-block", width: "40px", height: "40px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, transition: "opacity 0.15s", opacity: 1 }} onMouseEnter={e => e.currentTarget.style.opacity = "0.8"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <img src="/linkedin-icon.svg" alt="LinkedIn" width="40" height="40" style={{ display: "block" }} />
              </a>
            </div>
          </div>

        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1.5rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center", fontSize: "0.76rem" }}>
          <span>© {new Date().getFullYear()} StudentShifts · Ireland</span>
          <span>Made with ❤️ for students across Ireland</span>
        </div>
      </div>
    </footer>
  );
}

function FLink({ onClick, href, children }) {
  const style = { margin: "0.45rem 0", fontSize: "0.83rem", cursor: "pointer", color: "rgba(255,255,255,0.5)", textDecoration: "none", display: "block" };
  const hover = e => e.currentTarget.style.color = "white";
  const unhover = e => e.currentTarget.style.color = "rgba(255,255,255,0.5)";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style} onMouseEnter={hover} onMouseLeave={unhover}>
        {children}
      </a>
    );
  }
  return (
    <p onClick={onClick} style={style} onMouseEnter={hover} onMouseLeave={unhover}>
      {children}
    </p>
  );
}

const fHead = {
  fontWeight: 700, fontSize: "0.78rem", color: "white",
  textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 0 0.75rem",
};
