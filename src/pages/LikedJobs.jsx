import React from "react";
import PageWrapper from "../components/PageWrapper";
import BackButton from "../components/BackButton";
import "../StudentShiftWeb.css";
import { unlikeJob } from "../lib/auth";

export default function LikedJobs({ likedJobs, setLikedJobs, setSavedLikedJobIds, setSelectedJob, setPage, currentUser }) {

  const removeLike = (job) => {
    setLikedJobs(prev => prev.filter(j => j.id !== job.id));
    setSavedLikedJobIds(prev => prev.filter(id => id !== job.id));
    unlikeJob(currentUser.id, job.id).catch(console.error);
  };

  return (
    <><BackButton />
    <PageWrapper>
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ margin: 0, fontWeight: "800", fontSize: "1.85rem", color: "#1e293b" }}>❤️ Liked Jobs</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>Jobs you've saved for later</p>
      </div>

      {likedJobs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>❤️</p>
          <p style={{ fontSize: "1.1rem", fontWeight: "600", marginBottom: "0.4rem" }}>No liked jobs yet</p>
          <p style={{ fontSize: "0.875rem", marginBottom: "1.5rem" }}>Browse available jobs and like the ones that interest you.</p>
          <button onClick={() => setPage("studentDashboard")} style={btnGray}>Browse Jobs</button>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            {likedJobs.map((job) => {
              const photo = job.photos?.[0] || null;
              const crop  = job.photoCrops?.[0] || { zoom: 1, offsetX: 0, offsetY: 0 };
              return (
                <div key={job.id} className="job-card" style={{ display: "flex", alignItems: "flex-start", padding: 0, overflow: "hidden", marginBottom: 0 }}>
                  <div style={{ width: "120px", height: "120px", flexShrink: 0, position: "relative", overflow: "hidden", borderRadius: "1rem 0 0 0" }}>
                    {photo ? (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, transform: `scale(${crop.zoom}) translate(${crop.offsetX}%, ${crop.offsetY}%)`, transformOrigin: "center" }}>
                        <img src={photo} alt={job.company} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    ) : (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#e2e8f0" }}>
                        <span style={{ fontSize: "2rem", opacity: 0.5 }}>🏢</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "0.85rem 1rem", minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.2rem" }}>
                      <h2 style={{ fontWeight: "800", fontSize: "1.05rem", margin: 0, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</h2>
                      <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                        <button onClick={() => { setSelectedJob(job); setPage("jobDetails"); }} style={btnBlue}>View</button>
                        <button onClick={() => removeLike(job)} style={btnRed}>Remove</button>
                      </div>
                    </div>
                    <p style={{ color: "#6b7280", marginBottom: "0.15rem", fontSize: "0.85rem" }}>{job.company} · {job.location}</p>
                    <p style={{ fontWeight: "700", color: "#111827", marginBottom: "0.4rem", fontSize: "0.9rem" }}>{job.pay}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                      {job.days.map(day => (
                        <span key={day} style={{ fontSize: "0.7rem", backgroundColor: "#eef2ff", color: "#4f46e5", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: "600" }}>
                          {day.slice(0, 3)} · {job.times[day]?.join(", ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button onClick={() => setPage("studentDashboard")} style={btnGray}>Back to Jobs</button>
          </div>
        </>
      )}
    </PageWrapper></>
  );
}

const btnBase = { padding: "0.38rem 0.9rem", borderRadius: "2rem", color: "white", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "0.8rem", fontFamily: "inherit" };
const btnBlue = { ...btnBase, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" };
const btnRed  = { ...btnBase, background: "linear-gradient(135deg, #f43f5e, #e11d48)", boxShadow: "0 2px 8px rgba(244,63,94,0.3)" };
const btnGray = { ...btnBase, backgroundColor: "#64748b", padding: "0.75rem 1.75rem", fontSize: "0.9rem", borderRadius: "2rem" };
