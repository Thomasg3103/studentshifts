import React from "react";

import PageWrapper from "../components/PageWrapper";





export default function AccountPage({

  currentUser,

  setCurrentUser,

  setPage,

  setLikedJobs,

  setAppliedJobs

}) {





  const handleLogout = () => {

    const confirmLogout = window.confirm("Are you sure you want to logout?");

    if (confirmLogout) {

      setCurrentUser(null);





      // 🔥 CLEAR JOB STATE ON LOGOUT

      setLikedJobs([]);

      setAppliedJobs([]);





      setPage("studentDashboard");

    }

  };





  const goBack = () => {

    setPage(

      currentUser.role === "student"

        ? "studentDashboard"

        : "companyDashboard"

    );

  };





  return (

    <PageWrapper>

      <div style={{ maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>

        <h2>Account Details</h2>





        <p><strong>Name:</strong> {currentUser.name}</p>

        <p><strong>Email:</strong> {currentUser.email}</p>

        <p><strong>Role:</strong> {currentUser.role}</p>





        <button

          onClick={handleLogout}

          style={{ ...buttonStyle, backgroundColor: "#ef4444" }}

        >

          Logout

        </button>





        <button

          onClick={goBack}

          style={{ ...buttonStyle, backgroundColor: "#6b7280", marginTop: "0.5rem" }}

        >

          Back to Dashboard

        </button>

      </div>

    </PageWrapper>

  );

}





const buttonStyle = {

  width: "100%",

  maxWidth: "300px",

  padding: "0.7rem",

  borderRadius: "0.5rem",

  border: "none",

  color: "white",

  fontWeight: "bold",

  cursor: "pointer",

  marginTop: "1rem",

};

