import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StudentShiftsWeb />
  </StrictMode>
);