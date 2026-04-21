import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <StudentShiftsWeb />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);