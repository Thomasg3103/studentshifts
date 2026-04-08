import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Bypass the Web Locks API to prevent auth deadlocks in Chrome/Edge
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
