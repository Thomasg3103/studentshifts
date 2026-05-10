import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Serialise auth lock operations without using Web Locks (which deadlock in Chrome/Edge).
// Each call waits for the previous one to finish before running, preventing concurrent
// token refreshes from corrupting the session.
let _lockChain = Promise.resolve();
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    lock: async (_name, _acquireTimeout, fn) => {
      const result = _lockChain.then(() => fn(), () => fn());
      _lockChain = result.then(() => {}, () => {});
      return result;
    },
  },
});

// Wrap any supabase promise with a timeout.
// Pass a factory function () => promise to get exponential-backoff retries (2s, 4s).
// Passing a promise directly works the same as before — single attempt, no retry.
export async function withTimeout(promiseOrFactory, ms = 10000, msg = "Request timed out — please try again.") {
  const isFactory = typeof promiseOrFactory === "function";
  const run = () => {
    const p = isFactory ? promiseOrFactory() : promiseOrFactory;
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms));
    return Promise.race([p, timeout]);
  };

  if (!isFactory) return run();

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

// Deduplicated session check — only ONE getSession() goes through the lock per 30-second
// window. Parallel callers share the same in-flight promise instead of queuing 28 separate
// lock acquisitions, which was the cause of slow/failed page loads.
let _sessionCheckedAt = 0;
let _sessionCheckInFlight = null;

export function ensureValidSession() {
  if (Date.now() - _sessionCheckedAt < 30_000) return Promise.resolve();
  if (!_sessionCheckInFlight) {
    _sessionCheckInFlight = supabase.auth.getSession()
      .then(() => { _sessionCheckedAt = Date.now(); })
      .catch(() => {})
      .finally(() => { _sessionCheckInFlight = null; });
  }
  return _sessionCheckInFlight;
}

export function invalidateSessionCache() {
  _sessionCheckedAt = 0;
}
