import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://katpbbmhprximuxyjicf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdHBiYm1ocHJ4aW11eHlqaWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Mjk2MDUsImV4cCI6MjA5MjMwNTYwNX0.IFJJhMWpEnK14mP8KU8I1CiLBOS0QWq99oPIoBwg5Os";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "fittrack-auth",
  },
});

export type { User, Session } from "@supabase/supabase-js";
