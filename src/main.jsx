import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import "./index.css";
import "./StudentShiftWeb.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// R3-C6/C7: GA4 must not load before cookie consent (ePrivacy / GDPR).
// initGA() is called by CookieBanner once the user dismisses the notice.
// On subsequent page loads, if consent was already given, it fires immediately.
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
export function initGA() {
  if (!GA_ID || window.__ga_initialised) return;
  window.__ga_initialised = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

// Fire immediately only if the user has already consented in a previous session
if (localStorage.getItem("ss_cookie_notice_dismissed") === "1") {
  initGA();
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