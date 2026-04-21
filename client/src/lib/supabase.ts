import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://katpbbmhprximuxyjicf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdHBiYm1ocHJ4aW11eHlqaWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Mjk2MDUsImV4cCI6MjA5MjMwNTYwNX0.IFJJhMWpEnK14mP8KU8I1CiLBOS0QWq99oPIoBwg5Os";

// Safari blocks localStorage in PWA/private mode — use a safe wrapper that
// falls back to an in-memory store so auth never silently fails.
function safariSafeStorage() {
  const mem: Record<string, string> = {};
  let ls: Storage | null = null;
  try {
    localStorage.setItem("__test__", "1");
    localStorage.removeItem("__test__");
    ls = localStorage;
  } catch {
    ls = null;
  }
  return {
    getItem: (key: string) => {
      try { return ls ? ls.getItem(key) : (mem[key] ?? null); } catch { return mem[key] ?? null; }
    },
    setItem: (key: string, value: string) => {
      try { if (ls) ls.setItem(key, value); else mem[key] = value; } catch { mem[key] = value; }
    },
    removeItem: (key: string) => {
      try { if (ls) ls.removeItem(key); else delete mem[key]; } catch { delete mem[key]; }
    },
  };
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: safariSafeStorage(),
    storageKey: "fittrack-auth",
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

export type { User, Session } from "@supabase/supabase-js";
