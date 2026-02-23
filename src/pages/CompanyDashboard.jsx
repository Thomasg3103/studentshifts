import React from "react";

import PageWrapper from "../components/PageWrapper";





export default function CompanyDashboard({ setPage }) {

  const postings = [

  { id: 1, title: "Bar Staff", applicants: 3, status: "Active" },

  { id: 2, title: "Retail Assistant", applicants: 5, status: "Active" },

  { id: 3, title: "Library Assistant", applicants: 2, status: "Closed" },

  { id: 4, title: "Waiter", applicants: 4, status: "Active" },

  { id: 5, title: "Cleaner", applicants: 1, status: "Active" },

  { id: 6, title: "Barista", applicants: 6, status: "Active" },

  { id: 7, title: "Receptionist", applicants: 3, status: "Active" },

  { id: 8, title: "Stockroom Assistant", applicants: 2, status: "Active" },

  { id: 9, title: "Food Prep", applicants: 1, status: "Active" },

  { id: 10, title: "Security Guard", applicants: 2, status: "Active" },

  { id: 11, title: "Dishwasher", applicants: 3, status: "Active" },

  { id: 12, title: "Promoter", applicants: 1, status: "Active" },

  { id: 13, title: "Host", applicants: 2, status: "Active" },

  { id: 14, title: "Catering Assistant", applicants: 4, status: "Active" },

  { id: 15, title: "Cashier", applicants: 6, status: "Active" },

  { id: 16, title: "Kitchen Staff", applicants: 3, status: "Active" },

  { id: 17, title: "Bar Staff", applicants: 2, status: "Active" },

  { id: 18, title: "Delivery Assistant", applicants: 1, status: "Active" },

  { id: 19, title: "Stock Clerk", applicants: 3, status: "Active" },

  { id: 20, title: "Waiter", applicants: 4, status: "Active" },

  { id: 21, title: "Food Runner", applicants: 2, status: "Active" },

  { id: 22, title: "Barista", applicants: 5, status: "Active" },

  { id: 23, title: "Receptionist", applicants: 3, status: "Active" },

  { id: 24, title: "Cleaner", applicants: 1, status: "Active" },

  { id: 25, title: "Catering Assistant", applicants: 2, status: "Active" },

  { id: 26, title: "Bar Staff", applicants: 3, status: "Active" },

  { id: 27, title: "Dishwasher", applicants: 1, status: "Active" },

  { id: 28, title: "Promoter", applicants: 2, status: "Active" },

  { id: 29, title: "Stockroom Assistant", applicants: 3, status: "Active" },

  { id: 30, title: "Kitchen Staff", applicants: 4, status: "Active" },

  { id: 31, title: "Cashier", applicants: 5, status: "Active" },

  { id: 32, title: "Waiter", applicants: 2, status: "Active" },

  { id: 33, title: "Barista", applicants: 3, status: "Active" },

  { id: 34, title: "Receptionist", applicants: 2, status: "Active" },

  { id: 35, title: "Cleaner", applicants: 1, status: "Active" },

  { id: 36, title: "Food Prep", applicants: 4, status: "Active" },

  { id: 37, title: "Dishwasher", applicants: 2, status: "Active" },

  { id: 38, title: "Promoter", applicants: 3, status: "Active" },

  { id: 39, title: "Stock Clerk", applicants: 5, status: "Active" },

  { id: 40, title: "Kitchen Staff", applicants: 3, status: "Active" },

];









  return (

    <PageWrapper>

      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1.5rem", textAlign: "center" }}>Company Dashboard</h1>

      <p>Your job postings:</p>





      <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {postings.map(job => (

          <div key={job.id} style={{ padding: "1rem", borderRadius: "0.5rem", backgroundColor: "#f9fafb", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>

            <div>

              <h2 style={{ fontWeight: "bold" }}>{job.title}</h2>

              <p>Applicants: {job.applicants}</p>

              <p>Status: {job.status}</p>

            </div>

            <button

              style={{ padding: "0.4rem 0.8rem", borderRadius: "0.4rem", backgroundColor: "#10b981", color: "white", border: "none", cursor: "pointer" }}

              onClick={() => alert(`Viewing applicants for ${job.title}`)}

            >

              View Applicants

            </button>

          </div>

        ))}

      </div>





      <button

        style={{ marginTop: "2rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#6b7280", color: "white", cursor: "pointer" }}

        onClick={() => setPage("student")}

      >

        Back to Home

      </button>

    </PageWrapper>

  );

}

