import React, { useState } from "react";

import PageWrapper from "../components/PageWrapper";





export default function LoginPage({ setPage, setCurrentUser, mockUsers }) {

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [role, setRole] = useState("student");

  const [error, setError] = useState("");





  const handleLogin = () => {

    const foundUser = mockUsers.find(u => u.email === email && u.password === password && u.role === role);

    if (foundUser) {

      setCurrentUser(foundUser);

      setPage(role === "student" ? "studentDashboard" : "companyDashboard");

    } else {

      setError("Invalid email, password, or role");

    }

  };





  return (

    <PageWrapper>

      <div style={{ textAlign: "center", maxWidth: "400px", margin: "0 auto" }}>

        <h2 style={{ marginBottom: "1.5rem" }}>Login</h2>





        {error && <p style={{ color: "red" }}>{error}</p>}





        <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle}>

          <option value="student">Student</option>

          <option value="company">Company</option>

        </select>





        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />





        <button onClick={handleLogin} style={buttonStyle}>Login</button>

        <button onClick={() => setPage("studentDashboard")} style={{ ...buttonStyle, backgroundColor: "#6b7280", marginTop: "0.5rem" }}>Back to Home</button>





        <p style={{ marginTop: "1rem" }}>

          Don't have an account?{" "}

          <span style={{ color: "#3b82f6", cursor: "pointer", fontWeight: "bold" }} onClick={() => setPage("signup")}>

            Create an account

          </span>

        </p>

      </div>

    </PageWrapper>

  );

}





const inputStyle = {

  width: "calc(100% - 40px)",

  maxWidth: "300px",

  padding: "0.6rem",

  margin: "0.5rem auto",

  display: "block",

  textAlign: "center",

  borderRadius: "0.5rem",

  border: "1px solid #d1d5db",

};





const selectStyle = {

  width: "calc(100% - 40px)",

  maxWidth: "300px",

  padding: "0.6rem",

  margin: "0.5rem auto",

  display: "block",

  textAlign: "center",

  borderRadius: "0.5rem",

  border: "1px solid #d1d5db",

};





const buttonStyle = {

  width: "100%",

  maxWidth: "300px",

  padding: "0.7rem",

  borderRadius: "0.5rem",

  border: "none",

  backgroundColor: "#3b82f6",

  color: "white",

  fontWeight: "bold",

  cursor: "pointer",

  marginTop: "1rem",

};

