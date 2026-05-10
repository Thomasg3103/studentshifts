import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import "./index.css";
import "./StudentShiftWeb.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", import.meta.env.VITE_GA_MEASUREMENT_ID);
}

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
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <StudentShiftsWeb />
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);