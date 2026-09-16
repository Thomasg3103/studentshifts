/**
 * main.jsx — the actual entry point of the app.
 *
 * This is the very first JS file that runs in the browser (referenced from
 * index.html). Its job is narrow and mechanical: set up third-party services
 * (Google Analytics, Microsoft Clarity, Sentry error tracking), then mount
 * the React component tree — <StudentShiftsWeb /> — onto the real DOM node
 * (`#root` in index.html). Everything about routing, auth, and pages lives
 * in StudentShiftsWeb.jsx and beyond; this file's only concern is "get React
 * running and wire up the outermost providers it needs" (routing context via
 * BrowserRouter, SEO tag management via HelmetProvider, and a top-level
 * ErrorBoundary so a crash anywhere doesn't take down the whole page to a
 * blank white screen).
 */
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import * as Sentry from "@sentry/react";
import "./index.css";
import "./StudentShiftWeb.css";
import StudentShiftsWeb from "./StudentShiftsWeb.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Google Analytics 4 — loaded manually (rather than via a plugin) so it can
// be skipped entirely when no measurement ID is configured (e.g. local dev).
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

initGA();

// Microsoft Clarity — heatmaps + session recordings (a free tool for seeing
// how real users actually move through the app: where they click, how far
// they scroll, where they get stuck). Loaded the same guarded way as GA.
const CLARITY_ID = import.meta.env.VITE_CLARITY_PROJECT_ID;
export function initClarity() {
  if (!CLARITY_ID || window.__clarity_initialised) return;
  window.__clarity_initialised = true;
  (function(c, l, a, r, i, t, y) {
    c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.bing.com/clarity/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}
initClarity();

// Sentry — captures JS errors/crashes from real users in production and
// reports them with a stack trace, so bugs can be found and fixed even
// though nobody's watching the browser console. tracesSampleRate: 0.2 means
// only 20% of page loads/navigations get detailed performance tracing (to
// control Sentry's usage/cost) — error capturing itself isn't sampled down.
export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN || window.__sentry_initialised) return;
  window.__sentry_initialised = true;
  const UUID_RE  = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const scrub = (s) => typeof s === "string" ? s.replace(UUID_RE, "[id]").replace(EMAIL_RE, "[email]") : s;
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,
    // beforeSend runs on every error/event right before it's sent to Sentry's
    // servers — this is where we scrub personal data so error reports don't
    // leak who a real user is (important for GDPR, since Sentry is a
    // third-party processor). Only the anonymous user id is kept; any UUID
    // or email address that shows up in a breadcrumb (Sentry's log of recent
    // actions leading up to the error) gets masked out.
    beforeSend(event) {
      // Strip user PII — keep only anonymised id
      if (event.user) event.user = { id: event.user.id };
      // Scrub UUIDs and email addresses from breadcrumb messages and data
      if (Array.isArray(event.breadcrumbs?.values)) {
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

initSentry();

// When Render deploys a new build, old chunk hashes no longer exist.
// Any user with a cached index.html will hit a 404 on dynamic imports.
// Vite fires this event instead of throwing, so we can recover silently.
window.addEventListener("vite:preloadError", () => { window.location.reload(); });

const rootEl = document.getElementById("root");
// The full provider stack every page in the app sits inside:
//  - HelmetProvider: lets any page set its own <title>/meta tags (for SEO)
//    via react-helmet-async, without those pages needing direct DOM access.
//  - BrowserRouter: enables React Router's URL-based navigation — this is
//    what makes useNavigate()/useLocation()/<Routes> work inside StudentShiftsWeb.
//  - ErrorBoundary: catches any render-time crash below it and shows a
//    fallback UI instead of a blank white screen.
const app = (
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

// hydrateRoot vs createRoot: if the #root div already has content (server- or
// prerendered HTML was sent down, so there's something to "hydrate" — attach
// React's event handlers to existing DOM instead of wiping and re-rendering
// from scratch), use hydrateRoot. Otherwise (a plain empty div, the normal
// client-side-rendered case) use createRoot to render fresh.
if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}