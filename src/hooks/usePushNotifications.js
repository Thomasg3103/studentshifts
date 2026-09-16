import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * usePushNotifications — lets a user opt in to browser/OS push notifications
 * (e.g. "you got a new message", "your application status changed") even
 * when the StudentShifts tab/app isn't open. This is the client half of the
 * Web Push feature; the actual notification is displayed by the service
 * worker (see src/sw.js's "push" event listener) since push messages arrive
 * even when no page is open — only a service worker can catch them.
 *
 * How Web Push works, briefly: the browser generates a unique subscription
 * (an endpoint URL + encryption keys) tied to this device+browser. We save
 * that subscription to our `push_subscriptions` table so our backend knows
 * where to send push messages for this user. VAPID_PUBLIC_KEY identifies
 * *our* server to the push service (so it can only send pushes we authorize)
 * without either side needing to share private keys.
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// The Push API requires the VAPID key as a raw byte array, but env vars can
// only store strings — this converts the URL-safe base64 string (the format
// the key is generated/stored in) into the Uint8Array the browser API expects.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(userId) {
  // Not every browser/platform supports push (notably: iOS Safari only added
  // support fairly recently, and only for installed/home-screen PWAs) — this
  // lets calling components hide the "enable notifications" UI entirely
  // rather than showing a button that would just fail.
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [permission, setPermission] = useState(() =>
    supported ? Notification.permission : "denied"
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // On mount (or when the user logs in), check whether THIS browser already
  // has an active push subscription — e.g. they enabled notifications on a
  // previous visit — so the UI can reflect that instead of assuming "off".
  useEffect(() => {
    if (!supported || !userId) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      setSubscribed(!!existing);
    });
  }, [supported, userId]);

  const subscribe = useCallback(async () => {
    if (!supported || !userId || !VAPID_PUBLIC_KEY) return;
    setLoading(true);
    try {
      // This triggers the browser's native permission prompt — can only be
      // called from a user-initiated action (e.g. a button click), not on
      // page load, or the browser will silently ignore/block it.
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save this device's subscription so our backend knows where to send
      // pushes for this user. onConflict upsert means re-subscribing on the
      // same device just refreshes the existing row instead of duplicating it.
      await supabase.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: sub.endpoint, subscription: sub.toJSON() },
        { onConflict: "user_id,endpoint" }
      );

      setSubscribed(true);
    } catch (e) {
      console.error("[push] subscribe failed", e);
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !userId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("user_id", userId)
          .eq("endpoint", sub.endpoint);
      }
      setSubscribed(false);
    } catch (e) {
      console.error("[push] unsubscribe failed", e);
    } finally {
      setLoading(false);
    }
  }, [supported, userId]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
