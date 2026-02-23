import React, { useState } from "react";

import PageWrapper from "../components/PageWrapper";





export default function StudentDashboard({

  setPage,

  setSelectedJob,

  likedJobs,

  setLikedJobs,

  appliedJobs,

  currentUser,

}) {

  const jobs = [

    { id: 1, title: "Bar Staff", company: "Galway Pub", location: "City Centre", pay: "€12/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["11:00","13:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 2, title: "Retail Assistant", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Monday","Wednesday","Friday"], times: { Monday: ["10:00"], Wednesday: ["14:00"], Friday: ["12:00"] }, weekendRequired: false },

    { id: 3, title: "Library Assistant", company: "Campus Library", location: "On-Campus", pay: "€12/hr", days: ["Monday","Tuesday","Thursday"], times: { Monday: ["09:00"], Tuesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: false },

    { id: 4, title: "Waiter", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Wednesday","Friday"], times: { Tuesday: ["11:00"], Wednesday: ["12:00"], Friday: ["14:00"] }, weekendRequired: true },

    { id: 5, title: "Cleaner", company: "City Mall", location: "10 min walk", pay: "€10/hr", days: ["Monday","Thursday"], times: { Monday: ["10:00"], Thursday: ["13:00"] }, weekendRequired: false },

    { id: 6, title: "Barista", company: "Coffee Hub", location: "Near Campus", pay: "€11/hr", days: ["Monday","Tuesday","Wednesday"], times: { Monday: ["09:00"], Tuesday: ["11:00"], Wednesday: ["10:00"] }, weekendRequired: true },

    { id: 7, title: "Receptionist", company: "City Hotel", location: "Downtown", pay: "€13/hr", days: ["Monday","Wednesday","Friday"], times: { Monday: ["08:00"], Wednesday: ["08:00"], Friday: ["08:00"] }, weekendRequired: false },

    { id: 8, title: "Stockroom Assistant", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["12:00"], Thursday: ["14:00"] }, weekendRequired: false },

    { id: 9, title: "Food Prep", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Monday","Wednesday"], times: { Monday: ["09:00"], Wednesday: ["10:00"] }, weekendRequired: true },

    { id: 10, title: "Security Guard", company: "City Mall", location: "10 min walk", pay: "€14/hr", days: ["Friday"], times: { Friday: ["18:00"] }, weekendRequired: true },

    { id: 11, title: "Dishwasher", company: "Galway Pub", location: "City Centre", pay: "€11/hr", days: ["Monday","Tuesday"], times: { Monday: ["12:00"], Tuesday: ["13:00"] }, weekendRequired: true },

    { id: 12, title: "Promoter", company: "Tech Store", location: "Downtown", pay: "€12/hr", days: ["Wednesday","Thursday"], times: { Wednesday: ["14:00"], Thursday: ["16:00"] }, weekendRequired: false },

    { id: 13, title: "Host", company: "City Hotel", location: "Downtown", pay: "€13/hr", days: ["Monday","Friday"], times: { Monday: ["09:00"], Friday: ["11:00"] }, weekendRequired: true },

    { id: 14, title: "Catering Assistant", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 15, title: "Cashier", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Monday","Wednesday","Friday"], times: { Monday: ["10:00"], Wednesday: ["12:00"], Friday: ["14:00"] }, weekendRequired: false },

    { id: 16, title: "Kitchen Staff", company: "City Mall", location: "10 min walk", pay: "€11/hr", days: ["Wednesday","Thursday"], times: { Wednesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 17, title: "Bar Staff", company: "Galway Pub", location: "City Centre", pay: "€12/hr", days: ["Monday","Friday"], times: { Monday: ["13:00"], Friday: ["12:00"] }, weekendRequired: true },

    { id: 18, title: "Delivery Assistant", company: "Tech Store", location: "Downtown", pay: "€12/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["09:00"], Thursday: ["10:00"] }, weekendRequired: false },

    { id: 19, title: "Stock Clerk", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Monday","Wednesday"], times: { Monday: ["08:00"], Wednesday: ["09:00"] }, weekendRequired: false },

    { id: 20, title: "Waiter", company: "City Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Friday"], times: { Tuesday: ["12:00"], Friday: ["14:00"] }, weekendRequired: true },

    { id: 21, title: "Food Runner", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Monday","Thursday"], times: { Monday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 22, title: "Barista", company: "Coffee Hub", location: "Near Campus", pay: "€11/hr", days: ["Wednesday","Friday"], times: { Wednesday: ["10:00"], Friday: ["12:00"] }, weekendRequired: false },

    { id: 23, title: "Receptionist", company: "City Hotel", location: "Downtown", pay: "€13/hr", days: ["Monday","Tuesday","Thursday"], times: { Monday: ["09:00"], Tuesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: false },

    { id: 24, title: "Cleaner", company: "City Mall", location: "10 min walk", pay: "€10/hr", days: ["Wednesday","Friday"], times: { Wednesday: ["08:00"], Friday: ["10:00"] }, weekendRequired: true },

    { id: 25, title: "Catering Assistant", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["12:00"], Thursday: ["14:00"] }, weekendRequired: true },

    { id: 26, title: "Bar Staff", company: "Galway Pub", location: "City Centre", pay: "€12/hr", days: ["Monday","Wednesday"], times: { Monday: ["13:00"], Wednesday: ["12:00"] }, weekendRequired: true },

    { id: 27, title: "Dishwasher", company: "City Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Friday"], times: { Tuesday: ["11:00"], Friday: ["13:00"] }, weekendRequired: true },

    { id: 28, title: "Promoter", company: "Tech Store", location: "Downtown", pay: "€12/hr", days: ["Monday","Thursday"], times: { Monday: ["09:00"], Thursday: ["11:00"] }, weekendRequired: false },

    { id: 29, title: "Stockroom Assistant", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Wednesday","Thursday"], times: { Wednesday: ["10:00"], Thursday: ["12:00"] }, weekendRequired: false },

    { id: 30, title: "Kitchen Staff", company: "City Mall", location: "10 min walk", pay: "€11/hr", days: ["Monday","Tuesday"], times: { Monday: ["11:00"], Tuesday: ["13:00"] }, weekendRequired: true },

    { id: 31, title: "Cashier", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Wednesday","Friday"], times: { Wednesday: ["12:00"], Friday: ["14:00"] }, weekendRequired: false },

    { id: 32, title: "Waiter", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 33, title: "Barista", company: "Coffee Hub", location: "Near Campus", pay: "€11/hr", days: ["Monday","Wednesday","Friday"], times: { Monday: ["10:00"], Wednesday: ["12:00"], Friday: ["14:00"] }, weekendRequired: false },

    { id: 34, title: "Receptionist", company: "City Hotel", location: "Downtown", pay: "€13/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["09:00"], Thursday: ["11:00"] }, weekendRequired: false },

    { id: 35, title: "Cleaner", company: "City Mall", location: "10 min walk", pay: "€10/hr", days: ["Monday","Friday"], times: { Monday: ["08:00"], Friday: ["10:00"] }, weekendRequired: true },

    { id: 36, title: "Food Prep", company: "Galway Bistro", location: "Near Campus", pay: "€11/hr", days: ["Wednesday","Thursday"], times: { Wednesday: ["11:00"], Thursday: ["13:00"] }, weekendRequired: true },

    { id: 37, title: "Dishwasher", company: "City Bistro", location: "Near Campus", pay: "€11/hr", days: ["Monday","Tuesday"], times: { Monday: ["12:00"], Tuesday: ["13:00"] }, weekendRequired: true },

    { id: 38, title: "Promoter", company: "Tech Store", location: "Downtown", pay: "€12/hr", days: ["Wednesday","Friday"], times: { Wednesday: ["14:00"], Friday: ["16:00"] }, weekendRequired: false },

    { id: 39, title: "Stock Clerk", company: "SuperMart", location: "5 min walk", pay: "€10/hr", days: ["Tuesday","Thursday"], times: { Tuesday: ["08:00"], Thursday: ["10:00"] }, weekendRequired: false },

    { id: 40, title: "Kitchen Staff", company: "City Mall", location: "10 min walk", pay: "€11/hr", days: ["Monday","Friday"], times: { Monday: ["11:00"], Friday: ["13:00"] }, weekendRequired: true },

  ];





  const [selectedDays, setSelectedDays] = useState([]);

  const [dayTimes, setDayTimes] = useState({});

  const [warning, setWarning] = useState("");





  // Handle day selection (max 5)

  const toggleDay = (day) => {

    let updated = [...selectedDays];

    if (updated.includes(day)) {

      updated = updated.filter(d => d !== day);

    } else {

      if (updated.length >= 5) {

        setWarning("Are you a student selecting all 5 weekdays?");

      }

      updated.push(day);

    }

    setSelectedDays(updated);

  };





  // Handle time selection per day

  const updateTime = (day, time) => {

    setDayTimes({ ...dayTimes, [day]: time });

  };





  // Filter jobs based on days and times

  const filteredJobs = jobs.filter(job => {

    if (selectedDays.length === 0) return true; // no filter





    return selectedDays.every(day => {

      if (!job.days.includes(day)) return false;

      if (dayTimes[day]) {

        return job.times[day]?.includes(dayTimes[day]);

      }

      return true;

    });

  });





  const toggleLike = (job) => {

    if (!currentUser) {

      setPage("login");

      return;

    }

    if (appliedJobs.some(j => j.id === job.id)) return;





    const isLiked = likedJobs.some((j) => j.id === job.id);

    if (isLiked) {

      setLikedJobs(likedJobs.filter((j) => j.id !== job.id));

    } else {

      setLikedJobs([...likedJobs, job]);

    }

  };





  const weekdays = ["Monday","Tuesday","Wednesday","Thursday","Friday"];





  return (

    <PageWrapper>

      <h1 style={{ textAlign: "center", marginBottom: "1rem" }}>Available Jobs</h1>





      {/* Filter Section */}

      <div style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#f3f4f6", borderRadius: "0.5rem" }}>

        <h3>Filter by Days & Times</h3>

        {warning && <p style={{ color: "red" }}>{warning}</p>}

        {weekdays.map(day => (

          <div key={day} style={{ marginBottom: "0.5rem" }}>

            <label>

              <input

                type="checkbox"

                checked={selectedDays.includes(day)}

                onChange={() => toggleDay(day)}

              />{" "}

              {day}

            </label>

            {selectedDays.includes(day) && (

              <select value={dayTimes[day] || ""} onChange={e => updateTime(day, e.target.value)} style={{ marginLeft: "0.5rem" }}>

                <option value="">Any Time</option>

                {/* All times across jobs for this day */}

                {[...new Set(jobs.flatMap(j => j.times[day] || []))].map(time => (

                  <option key={time} value={time}>{time}</option>

                ))}

              </select>

            )}

          </div>

        ))}

      </div>





      {/* Job List */}

      {filteredJobs.map((job) => {

        const isLiked = likedJobs.some(j => j.id === job.id);

        const isApplied = appliedJobs.some(j => j.id === job.id);





        return (

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

              <h2 style={{ fontWeight: "bold", fontSize: "1.5rem" }}>{job.title}</h2>

              <p>{job.company}</p>

              <p>{job.location}</p>

              <p>{job.pay}</p>

            </div>





            <div style={{ display: "flex", gap: "0.5rem" }}>

              <button

                onClick={() => { setSelectedJob(job); setPage("jobDetails"); }}

                style={buttonStyle}

              >

                View Details

              </button>





              <button

                onClick={() => toggleLike(job)}

                style={{

                  ...likeButtonStyle,

                  backgroundColor: isApplied ? "#16a34a" : (isLiked ? "#16a34a" : "#f87171")

                }}

                disabled={isApplied} // cannot click like if applied

              >

                {isApplied ? "✅ Applied" : (isLiked ? "✅ Liked" : "❤️ Like")}

              </button>

            </div>

          </div>

        );

      })}

    </PageWrapper>

  );

}





const buttonStyle = {

  padding: "0.5rem 1rem",

  borderRadius: "0.5rem",

  backgroundColor: "#3b82f6",

  color: "white",

  border: "none",

  cursor: "pointer",

};





const likeButtonStyle = {

  padding: "0.5rem 1rem",

  borderRadius: "0.5rem",

  color: "white",

  border: "none",

  cursor: "pointer",

};