import React, { useState } from "react";

import PageWrapper from "../components/PageWrapper";



export default function SignupPage({ setPage }) {

  const [name, setName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [role, setRole] = useState("student");





  const handleSignup = () => {

    if (!name || !email || !password) {

      alert("Fill all fields");

      return;

    }





    const users = JSON.parse(localStorage.getItem("users")) || [];





    // Check duplicate email

    if (users.find(u => u.email === email)) {

      alert("Email already exists");

      return;

    }





    const newUser = { id: Date.now(), name, email, password, role };

    users.push(newUser);

    localStorage.setItem("users", JSON.stringify(users));

    localStorage.setItem("currentUser", JSON.stringify(newUser));





    setPage(role === "student" ? "studentDashboard" : "companyDashboard");

  };





  return (

    <div>

      <h2>Signup</h2>

      <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />

      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />

      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

      <select value={role} onChange={e => setRole(e.target.value)}>

        <option value="student">Student</option>

        <option value="company">Company</option>

      </select>

      <button onClick={handleSignup}>Sign Up</button>

      <p onClick={() => setPage("login")}>Already have an account? Login</p>

    </div>

  );

}