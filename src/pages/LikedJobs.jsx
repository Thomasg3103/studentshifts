import React from "react";

import PageWrapper from "../components/PageWrapper";





export default function LikedJobs({

  likedJobs,

  setLikedJobs,

  setSelectedJob,

  setPage,

}) {





  const removeLike = (jobId) => {

    setLikedJobs(likedJobs.filter((job) => job.id !== jobId));

  };





  return (

    <PageWrapper>

      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>

        ❤️ Liked Jobs

      </h1>





      {/* If No Liked Jobs */}

      {likedJobs.length === 0 ? (

        <div style={{ textAlign: "center" }}>

          <p style={{ marginBottom: "1.5rem" }}>

            You haven’t liked any jobs yet.

          </p>





          <button

            onClick={() => setPage("studentDashboard")}

            style={backButtonStyle}

          >

            Back to Home

          </button>

        </div>

      ) : (

        <>

          {likedJobs.map((job) => (

            <div

              key={job.id}

              style={{

                padding: "1.5rem",

                marginBottom: "1.5rem",

                borderRadius: "0.75rem",

                backgroundColor: "white",

                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",

                display: "flex",

                justifyContent: "space-between",

                alignItems: "center",

              }}

            >

              <div>

                <h2 style={{ fontWeight: "bold", fontSize: "1.5rem" }}>

                  {job.title}

                </h2>

                <p>{job.company}</p>

              </div>





              <div style={{ display: "flex", gap: "0.5rem" }}>

                <button

                  onClick={() => {

                    setSelectedJob(job);

                    setPage("jobDetails");

                  }}

                  style={viewButtonStyle}

                >

                  View

                </button>





                <button

                  onClick={() => removeLike(job.id)}

                  style={removeButtonStyle}

                >

                  Remove

                </button>

              </div>

            </div>

          ))}





          {/* Back Button when jobs exist */}

          <div style={{ textAlign: "center", marginTop: "2rem" }}>

            <button

              onClick={() => setPage("studentDashboard")}

              style={backButtonStyle}

            >

              Back to Home

            </button>

          </div>

        </>

      )}

    </PageWrapper>

  );

}





const viewButtonStyle = {

  padding: "0.5rem 1rem",

  borderRadius: "0.5rem",

  backgroundColor: "#3b82f6",

  color: "white",

  border: "none",

  cursor: "pointer",

};





const removeButtonStyle = {

  padding: "0.5rem 1rem",

  borderRadius: "0.5rem",

  backgroundColor: "#ef4444",

  color: "white",

  border: "none",

  cursor: "pointer",

};





const backButtonStyle = {

  padding: "0.75rem 1.5rem",

  borderRadius: "0.5rem",

  backgroundColor: "#6b7280",

  color: "white",

  border: "none",

  cursor: "pointer",

};

