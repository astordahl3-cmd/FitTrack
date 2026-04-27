/**
 * withings-callback — handles the OAuth2 redirect from Withings.
 * Exchanges the authorization code for access + refresh tokens,
 * stores them in the withings_tokens table, then redirects to FitTrack.
 *
 * Withings redirects here with: ?code=xxx&state=yyy
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WITHINGS_CLIENT_ID     = Deno.env.get("WITHINGS_CLIENT_ID")!;
const WITHINGS_CLIENT_SECRET = Deno.env.get("WITHINGS_CLIENT_SECRET")!;
const SUPABASE_URL           = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REDIRECT_URI           = Deno.env.get("WITHINGS_REDIRECT_URI") ??
  "https://katpbbmhprximuxyjicf.supabase.co/functions/v1/withings-callback";
const APP_URL = "https://astordahl3-cmd.github.io/FitTrack/#/profile";

serve(async (req) => {
  try {
    const url    = new URL(req.url);
    const code   = url.searchParams.get("code");
    const state  = url.searchParams.get("state");
    const errMsg = url.searchParams.get("error");

    if (errMsg) {
      console.error("Withings OAuth error:", errMsg);
      return Response.redirect(`${APP_URL}?withings=error&reason=${encodeURIComponent(errMsg)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${APP_URL}?withings=error&reason=missing_params`, 302);
    }

    // Decode state to get user_id
    let userId: string;
    try {
      const decoded = JSON.parse(atob(state));
      userId = decoded.user_id;
    } catch {
      return Response.redirect(`${APP_URL}?withings=error&reason=invalid_state`, 302);
    }

    // Exchange code for tokens — Withings uses a POST with form body
    const tokenRes = await fetch("https://wbsapi.withings.net/v2/oauth2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action:        "requesttoken",
        grant_type:    "authorization_code",
        client_id:     WITHINGS_CLIENT_ID,
        client_secret: WITHINGS_CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.status !== 0) {
      console.error("Token exchange failed:", tokenData);
      return Response.redirect(
        `${APP_URL}?withings=error&reason=${encodeURIComponent(tokenData.error ?? "token_exchange_failed")}`,
        302
      );
    }

    const { access_token, refresh_token, expires_in, userid: withingsUserId } = tokenData.body;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in Supabase using service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error: upsertError } = await supabase
      .from("withings_tokens")
      .upsert({
        user_id:          userId,
        withings_user_id: String(withingsUserId),
        access_token,
        refresh_token,
        expires_at:       expiresAt,
        updated_at:       new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return Response.redirect(`${APP_URL}?withings=error&reason=token_storage_failed`, 302);
    }

    // Trigger an immediate sync so data appears right away
    fetch(
      `${SUPABASE_URL}/functions/v1/withings-sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ user_id: userId }),
      }
    ).catch(console.error); // fire-and-forget

    return Response.redirect(`${APP_URL}?withings=connected`, 302);
  } catch (err) {
    console.error("withings-callback error:", err);
    return Response.redirect(
      `https://astordahl3-cmd.github.io/FitTrack/#/profile?withings=error&reason=unknown`,
      302
    );
  }
});
