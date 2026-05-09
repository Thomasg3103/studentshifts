import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import * as Sentry from "@sentry/react";
import "./index.css";
import "./StudentShiftWeb.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <StudentShiftsWeb />
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);