import React from "react";

import PageWrapper from "../components/PageWrapper";





export default function Home({ setPage }) {

  return (

    <PageWrapper>

      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "2rem", textAlign: "center" }}>

        StudentShifts Mock

      </h1>





      <button

        style={{

          backgroundColor: "#3b82f6",

          color: "white",

          padding: "0.75rem 1.5rem",

          borderRadius: "0.5rem",

          marginBottom: "1rem",

          border: "none",

          cursor: "pointer",

          width: "100%",

        }}

        onClick={() => setPage("student")}

      >

        Login as Student

      </button>





      <button

        style={{

          backgroundColor: "#10b981",

          color: "white",

          padding: "0.75rem 1.5rem",

          borderRadius: "0.5rem",

          border: "none",

          cursor: "pointer",

          width: "100%",

        }}

        onClick={() => setPage("company")}

      >

        Login as Company

      </button>

    </PageWrapper>

  );

}