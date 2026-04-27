/**
 * withings-auth — generates the Withings OAuth2 authorization URL
 * and redirects the user to Withings to grant access.
 *
 * Called from FitTrack frontend: GET /functions/v1/withings-auth?user_id=<uuid>
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WITHINGS_CLIENT_ID = Deno.env.get("WITHINGS_CLIENT_ID")!;
const REDIRECT_URI = Deno.env.get("WITHINGS_REDIRECT_URI") ??
  "https://katpbbmhprximuxyjicf.supabase.co/functions/v1/withings-callback";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // State encodes the user_id so the callback knows who to store tokens for
    const state = btoa(JSON.stringify({ user_id: userId, ts: Date.now() }));

    const authUrl = new URL("https://account.withings.com/oauth2_user/authorize2");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", WITHINGS_CLIENT_ID);
    authUrl.searchParams.set("scope", "user.metrics");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    // Redirect user directly to Withings OAuth page
    return Response.redirect(authUrl.toString(), 302);
  } catch (err) {
    console.error("withings-auth error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
