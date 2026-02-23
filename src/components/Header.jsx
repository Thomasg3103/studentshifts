import React from "react";





export default function Header({ currentUser, setPage, likedJobs, appliedJobs }) {

  return (

    <header

      style={{

        display: "flex",

        justifyContent: "space-between",

        alignItems: "center",

        padding: "1rem 3rem",

        backgroundColor: "#1f2937",

        color: "white",

        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",

      }}

    >

      <h1

        style={{ fontSize: "1.8rem", fontWeight: "bold", cursor: "pointer" }}

        onClick={() => setPage(currentUser?.role === "company" ? "companyDashboard" : "studentDashboard")}

      >

        StudentShifts.ie

      </h1>





      <div style={{ display: "flex", gap: "1rem" }}>

        {currentUser ? (

          <>

            {currentUser.role === "student" && (

              <>

                <button onClick={() => setPage("likedJobs")} style={buttonStyle}>

                  ❤️ Liked Jobs ({likedJobs.length})

                </button>

                <button onClick={() => setPage("appliedJobs")} style={buttonStyle}>

                  ✅ Applied Jobs ({appliedJobs.length})

                </button>

              </>

            )}

            <button onClick={() => setPage("account")} style={buttonStyle}>

              Account

            </button>

          </>

        ) : (

          <>

            <button onClick={() => setPage("login")} style={buttonStyle}>

              Login

            </button>

            <button onClick={() => setPage("signup")} style={buttonStyle}>

              Signup

            </button>

          </>

        )}

      </div>

    </header>

  );

}





const buttonStyle = {

  padding: "0.6rem 1.2rem",

  borderRadius: "0.5rem",

  backgroundColor: "#3b82f6",

  color: "white",

  border: "none",

  cursor: "pointer",

};

