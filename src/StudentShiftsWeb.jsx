import React, { useState } from "react";

import Header from "./components/Header";

import StudentDashboard from "./pages/StudentDashboard";

import CompanyDashboard from "./pages/CompanyDashboard";

import LoginPage from "./pages/LoginPage";

import SignupPage from "./pages/SignupPage";

import AccountPage from "./pages/AccountPage";

import JobDetails from "./pages/JobDetails";

import LikedJobs from "./pages/LikedJobs";

import AppliedJobs from "./pages/AppliedJobs"; // new page





const mockUsers = [

  { name: "John Student", email: "student@test.com", password: "123456", role: "student" },

  { name: "Acme Corp", email: "company@test.com", password: "abcdef", role: "company" },

];





export default function StudentShiftsWeb() {

  const [page, setPage] = useState("studentDashboard");

  const [currentUser, setCurrentUser] = useState(null);

  const [selectedJob, setSelectedJob] = useState(null);

  const [likedJobs, setLikedJobs] = useState([]);

  const [appliedJobs, setAppliedJobs] = useState([]);





  const renderPage = () => {

    switch (page) {

      case "login":

        return <LoginPage setPage={setPage} setCurrentUser={setCurrentUser} mockUsers={mockUsers} />;

      case "signup":

        return <SignupPage setPage={setPage} />;

      case "studentDashboard":

        return (

          <StudentDashboard

            setPage={setPage}

            setSelectedJob={setSelectedJob}

            likedJobs={likedJobs}

            setLikedJobs={setLikedJobs}

            appliedJobs={appliedJobs} // pass appliedJobs

            currentUser={currentUser}

          />

        );

      case "companyDashboard":

        return <CompanyDashboard setPage={setPage} currentUser={currentUser} />;

      case "account":

        return currentUser ? (

          <AccountPage currentUser={currentUser} setCurrentUser={setCurrentUser} setPage={setPage} setLikedJobs={setLikedJobs} setAppliedJobs={setAppliedJobs}/>

        ) : null;

      case "jobDetails":

        return selectedJob && (

          <JobDetails

            job={selectedJob}

            setPage={setPage}

            currentUser={currentUser}

            likedJobs={likedJobs}

            setLikedJobs={setLikedJobs}

            appliedJobs={appliedJobs} // pass appliedJobs

            setAppliedJobs={setAppliedJobs}

          />

        );

      case "likedJobs":

        return currentUser && (

          <LikedJobs

            likedJobs={likedJobs}

            setLikedJobs={setLikedJobs}

            setSelectedJob={setSelectedJob}

            setPage={setPage}

          />

        );

      case "appliedJobs": // new page

        return currentUser && (

          <AppliedJobs

            appliedJobs={appliedJobs}

            setSelectedJob={setSelectedJob}

            setPage={setPage}

          />

        );

      default:

        return (

          <StudentDashboard

            setPage={setPage}

            setSelectedJob={setSelectedJob}

            likedJobs={likedJobs}

            setLikedJobs={setLikedJobs}

            appliedJobs={appliedJobs} // default case also passes appliedJobs

            currentUser={currentUser}

          />

        );

    }

  };





  return (

    <>

      <Header

        currentUser={currentUser}

        setPage={setPage}

        likedJobs={likedJobs}

        appliedJobs={appliedJobs} // pass appliedJobs

      />

      {renderPage()}

    </>

  );

}