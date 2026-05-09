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

// Wrap any supabase promise with a timeout so a hanging call never freezes the UI
export function withTimeout(promise, ms = 10000, msg = "Request timed out — please try again.") {
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(msg)), ms)
  );
  return Promise.race([promise, timeout]);
}
