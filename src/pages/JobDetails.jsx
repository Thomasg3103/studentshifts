import React from "react";

import PageWrapper from "../components/PageWrapper";





export default function JobDetails({

  job,

  setPage,

  currentUser,

  likedJobs,

  setLikedJobs,

  appliedJobs,

  setAppliedJobs,

}) {

  if (!job) return null;





  const isLiked = likedJobs.some((j) => j.id === job.id);

  const isApplied = appliedJobs.some((j) => j.id === job.id);





  const toggleLike = () => {

    if (!currentUser) {

      setPage("login");

      return;

    }

    if (isApplied) return; // cannot like applied jobs

    if (isLiked) {

      setLikedJobs(likedJobs.filter((j) => j.id !== job.id));

    } else {

      setLikedJobs([...likedJobs, job]);

    }

  };





  const handleApply = () => {

    if (!currentUser) {

      setPage("login");

      return;

    }





    if (!isApplied) {

      const confirmApply = window.confirm("Do you want to apply for this job?");

      if (confirmApply) {

        setAppliedJobs([...appliedJobs, job]);





        // Remove from liked jobs if it was liked

        if (isLiked) {

          setLikedJobs(likedJobs.filter((j) => j.id !== job.id));

        }

      }

    }

  };





  return (

    <PageWrapper>

      <h1>{job.title}</h1>

      <p><strong>Company:</strong> {job.company}</p>

      <p><strong>Location:</strong> {job.location}</p>

      <p><strong>Pay:</strong> {job.pay}</p>





      {/* Display availability */}

      <div style={{ marginTop: "1rem" }}>

        <p><strong>Available Days:</strong> {job.days.join(", ")}</p>

        <p><strong>Times:</strong></p>

        <ul>

          {job.days.map(day => (

            <li key={day}>

              {day}: {job.times[day]?.join(", ") || "N/A"}

            </li>

          ))}

        </ul>

        <p><strong>Weekend Required:</strong> {job.weekendRequired ? "Yes" : "No"}</p>

      </div>





      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>

        {/* Show Like button only if not applied */}

        {!isApplied && (

          <button

            onClick={toggleLike}

            style={{

              ...buttonStyle,

              backgroundColor: isLiked ? "#16a34a" : "#f87171",

            }}

          >

            {isLiked ? "✅ Liked" : "❤️ Like"}

          </button>

        )}





        <button

          onClick={handleApply}

          style={{

            ...buttonStyle,

            backgroundColor: isApplied ? "#16a34a" : "#3b82f6",

          }}

        >

          {isApplied ? "✅ Applied" : "Apply"}

        </button>





        <button

          onClick={() => setPage("studentDashboard")}

          style={{ ...buttonStyle, backgroundColor: "#6b7280" }}

        >

          Back

        </button>

      </div>

    </PageWrapper>

  );

}





const buttonStyle = {

  padding: "0.75rem 1.5rem",

  borderRadius: "0.5rem",

  color: "white",

  border: "none",

  cursor: "pointer",

};

