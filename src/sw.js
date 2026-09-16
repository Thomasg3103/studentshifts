/**
 * sw.js — the app's Service Worker.
 *
 * What a service worker is: a special JS script the browser runs in a
 * separate background thread, SEPARATE from any open tab — it keeps running
 * (subject to the browser's own lifecycle rules) even if the user closes the
 * StudentShifts tab entirely. It can intercept network requests the page
 * makes, serve cached responses instead of hitting the network, and receive
 * push messages from a server — none of which a normal page script can do
 * once its tab is closed.
 *
 * What this one is for, specifically:
 *  1. PWA/offline support — caches app assets and API responses (via
 *     Workbox helpers below) so the app can still load, and show recently-seen
 *     data, even with a flaky or no connection.
 *  2. Push notifications — the ONLY way to receive and display a push
 *     notification when the app isn't open in any tab is via a service
 *     worker's "push" event listener (see below). This is the receiving end
 *     of the subscribe flow set up in src/hooks/usePushNotifications.js.
 *
 * This file is built separately from the main app bundle (Vite's PWA plugin
 * compiles it into its own worker script) and registered by the browser to
 * run alongside, not inside, the React app.
 */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Removes caches left over from a previous, now-outdated service worker
// version, then pre-caches this build's static assets (JS/CSS/HTML) so the
// app shell can load instantly, even offline, on repeat visits.
// self.__WB_MANIFEST is filled in automatically at build time by the Vite
// PWA plugin with the list of files to precache — it isn't written by hand.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Supabase REST API (job listings, applications, etc.) — NetworkFirst means
// "always try the real network request first, and only fall back to a
// cached copy if the network fails" (e.g. offline, or the request times out
// after 10s). This data changes often, so freshness matters more than
// speed — the cache here exists purely as an offline fallback, not to skip
// the network on purpose. maxAgeSeconds: 5 min keeps that fallback from ever
// going too stale.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
  new NetworkFirst({
    cacheName: "supabase-api",
    networkTimeoutSeconds: 10,
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
  })
);

// Supabase Storage (photos, avatars) — CacheFirst is the opposite strategy:
// "if we already have this cached, use the cache immediately and don't
// bother hitting the network at all." Safe here because images at a given
// URL essentially never change once uploaded, so there's no freshness to
// lose — and it saves the user's data/bandwidth on repeat views.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  new CacheFirst({
    cacheName: "supabase-storage",
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
);

// Push notification received from the server (even with no StudentShifts tab
// open). event.data is the payload the backend sent when it triggered the
// push — falls back to a generic message if a push somehow arrives with no
// data attached. event.waitUntil() tells the browser "don't kill this service
// worker until the promise inside finishes" — without it, the worker could be
// terminated mid-way through showing the notification.
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "StudentShifts", body: "You have a new notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag || "studentshifts",
      data: { url: data.url || "/" },
    })
  );
});

// Notification clicked — focus existing window or open new tab.
// If StudentShifts is already open in a tab at the target URL, just bring
// that tab to the front (better UX than opening a duplicate tab); otherwise
// open a fresh tab/window navigated to the relevant page (e.g. the
// conversation the notification was about).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.endsWith(url) && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
