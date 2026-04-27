/**
 * withings-sync — fetches the latest body measurements from Withings
 * and upserts them into weight_entries.
 *
 * Called:
 *   - Immediately after OAuth connect (fire-and-forget from withings-callback)
 *   - On-demand from the FitTrack Profile page ("Sync Now" button)
 *   - Via Supabase cron / pg_cron for daily auto-sync
 *
 * Body: { user_id: string }
 *
 * Meastype reference (Withings API):
 *   1  = Weight (kg)
 *   6  = Fat Ratio (%)
 *   5  = Fat Free Mass (kg)
 *   8  = Fat Mass Weight (kg)
 *   76 = Muscle Mass (kg)
 *   88 = Bone Mass (kg)
 *   77 = Hydration (kg)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WITHINGS_CLIENT_ID     = Deno.env.get("WITHINGS_CLIENT_ID")!;
const WITHINGS_CLIENT_SECRET = Deno.env.get("WITHINGS_CLIENT_SECRET")!;
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT_URI           = Deno.env.get("WITHINGS_REDIRECT_URI") ??
  "https://katpbbmhprximuxyjicf.supabase.co/functions/v1/withings-callback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Refresh an expired access token using the stored refresh token */
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: string;
}> {
  const res = await fetch("https://wbsapi.withings.net/v2/oauth2", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      action:        "requesttoken",
      grant_type:    "refresh_token",
      client_id:     WITHINGS_CLIENT_ID,
      client_secret: WITHINGS_CLIENT_SECRET,
      refresh_token: refreshToken,
      redirect_uri:  REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (data.status !== 0) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  const { access_token, refresh_token: newRefresh, expires_in } = data.body;
  return {
    access_token,
    refresh_token: newRefresh,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Load stored tokens
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("withings_tokens")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "No Withings connection found. Please connect first." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { access_token, refresh_token, expires_at } = tokenRow;

    // Refresh token if expired (with 5 min buffer)
    if (new Date(expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
      console.log("Access token expired, refreshing...");
      const refreshed = await refreshAccessToken(refresh_token);
      access_token  = refreshed.access_token;
      refresh_token = refreshed.refresh_token;
      expires_at    = refreshed.expires_at;

      await supabase
        .from("withings_tokens")
        .update({ access_token, refresh_token, expires_at, updated_at: new Date().toISOString() })
        .eq("user_id", user_id);
    }

    // Fetch body measurements from Withings
    // meastype 1 = weight (kg), go back 365 days
    const startdate = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);
    const enddate   = Math.floor(Date.now() / 1000);

    const measRes = await fetch("https://wbsapi.withings.net/measure", {
      method: "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${access_token}`,
      },
      body: new URLSearchParams({
        action:    "getmeas",
        meastype:  "1",          // weight only for now
        category:  "1",          // real measures (not objectives)
        startdate: String(startdate),
        enddate:   String(enddate),
      }),
    });

    const measData = await measRes.json();

    if (measData.status !== 0) {
      return new Response(
        JSON.stringify({ error: `Withings API error: ${measData.error ?? measData.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const measuregroups: any[] = measData.body?.measuregroups ?? [];

    // Build weight_entries rows
    // Withings weight is in kg with a unit exponent (value * 10^unit)
    const entries: Array<{ user_id: string; date: string; weight: number; note: string }> = [];

    for (const group of measuregroups) {
      const weightMeas = group.measures?.find((m: any) => m.type === 1);
      if (!weightMeas) continue;

      const weightKg  = weightMeas.value * Math.pow(10, weightMeas.unit);
      const weightLbs = Math.round(weightKg * 2.20462 * 10) / 10;

      // Date from Unix timestamp
      const date = new Date(group.date * 1000).toISOString().split("T")[0];

      entries.push({
        user_id: user_id,
        date,
        weight:  weightLbs,
        note:    "Synced from Withings",
      });
    }

    let upserted = 0;
    if (entries.length > 0) {
      // Upsert by user_id + date (avoid duplicates)
      const { error: upsertErr, count } = await supabase
        .from("weight_entries")
        .upsert(entries, { onConflict: "user_id,date", ignoreDuplicates: false });

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        // Fall back to insert-or-skip approach
        for (const entry of entries) {
          await supabase.from("weight_entries").upsert(entry, { onConflict: "user_id,date" });
        }
      }
      upserted = entries.length;
    }

    // Update last_synced_at on the token row
    await supabase
      .from("withings_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user_id);

    return new Response(
      JSON.stringify({
        success: true,
        synced:  upserted,
        message: `Synced ${upserted} weight reading${upserted !== 1 ? "s" : ""} from Withings`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("withings-sync error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
