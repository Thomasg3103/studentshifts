import React from "react";





export default function PageWrapper({ children }) {

  return (

    <main

      style={{

        minHeight: "100vh",

        display: "flex",

        justifyContent: "center",

        padding: "3rem 1rem",

        backgroundColor: "#f9fafb",

        fontFamily: "Arial, sans-serif",

        color: "#000",

      }}

    >

      <div

        style={{

          width: "100%",

          maxWidth: "600px",

          padding: "2rem",

          backgroundColor: "white",

          borderRadius: "0.75rem",

          boxShadow: "0 6px 18px rgba(0,0,0,0.1)",

        }}

      >

        {children}

      </div>

    </main>

  );

}