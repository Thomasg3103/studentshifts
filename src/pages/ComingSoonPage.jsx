import { useContext } from "react";
import { supabase } from "../lib/supabase";
import { AppContext } from "../context/AppContext";

export default function ComingSoonPage() {
  const { currentUser } = useContext(AppContext);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #2d1b69 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <img
          src="/favicon.svg"
          alt="StudentShifts"
          style={{ width: "56px", height: "63px", marginBottom: "1.5rem", filter: "brightness(0) invert(1)" }}
        />

        <h1 style={{
          color: "#ffffff",
          fontSize: "2rem",
          fontWeight: "800",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          letterSpacing: "-0.5px",
          margin: "0 0 0.5rem",
        }}>
          StudentShifts.ie
        </h1>

        <div style={{
          display: "inline-block",
          background: "linear-gradient(135deg, #A21D54, #C2185B)",
          color: "#fff",
          fontWeight: "700",
          fontSize: "0.75rem",
          padding: "0.3rem 0.85rem",
          borderRadius: "999px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: "2rem",
        }}>
          Launching soon
        </div>

        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "1.25rem",
          padding: "2rem",
          marginBottom: "1.5rem",
        }}>
          {currentUser && (
            <p style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.875rem",
              margin: "0 0 0.5rem",
            }}>
              Signed in as
            </p>
          )}
          {currentUser && (
            <p style={{
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "1.1rem",
              margin: "0 0 1.5rem",
            }}>
              {currentUser.name}
            </p>
          )}

          <p style={{
            color: "rgba(255,255,255,0.75)",
            lineHeight: "1.7",
            fontSize: "0.95rem",
            margin: "0",
          }}>
            We're putting the finishing touches on Ireland's first platform built for student shifts. We'll send you an email the moment we go live.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          style={{
            background: "transparent",
            border: "1.5px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.6)",
            padding: "0.65rem 1.5rem",
            borderRadius: "0.75rem",
            cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: "600",
            fontSize: "0.875rem",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)";
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
