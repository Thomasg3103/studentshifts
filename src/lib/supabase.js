import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Bypass the Web Locks API to prevent auth deadlocks in Chrome/Edge
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});

// Wrap any supabase promise with a timeout so a hanging call never freezes the UI
export function withTimeout(promise, ms = 10000, msg = "Request timed out — please try again.") {
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(msg)), ms)
  );
  return Promise.race([promise, timeout]);
}
