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

// Microsoft Clarity — heatmaps + session recordings (consent-gated, same as GA4)
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;
export function initClarity() {
  if (!CLARITY_ID || window.__clarity_initialised) return;
  window.__clarity_initialised = true;
  /* eslint-disable */
  (function(c, l, a, r, i, t, y) {
    c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.bing.com/clarity/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
  /* eslint-enable */
}
if (localStorage.getItem("ss_cookie_notice_dismissed") === "1") {
  initClarity();
}

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN || window.__sentry_initialised) return;
  window.__sentry_initialised = true;
  const UUID_RE  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const scrub = (s) => typeof s === "string" ? s.replace(UUID_RE, "[id]").replace(EMAIL_RE, "[email]") : s;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    beforeSend(event) {
      // Strip user PII — keep only anonymised id
      if (event.user) event.user = { id: event.user.id };
      // Scrub UUIDs and email addresses from breadcrumb messages and data
      if (event.breadcrumbs?.values) {
        event.breadcrumbs.values = event.breadcrumbs.values.map(b => ({
          ...b,
          message: scrub(b.message),
          data: b.data ? Object.fromEntries(
            Object.entries(b.data).map(([k, v]) => [k, scrub(v)])
          ) : b.data,
        }));
      }
      return event;
    },
  });
}

if (localStorage.getItem("ss_cookie_notice_dismissed") === "1") {
  initSentry();
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