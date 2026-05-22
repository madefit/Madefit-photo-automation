import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { setSetting } from "@/lib/settings";
import { fetchJson } from "@/lib/http";

export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
};

type GoogleAccountsResponse = {
  accounts?: Array<{
    name: string;
    accountName: string;
    type: string;
  }>;
};

type GoogleLocationsResponse = {
  locations?: Array<{
    name: string;
    locationName: string;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/dashboard?error=${error ?? "no_code"}`, request.url));
  }

  const env = getServerEnv();
  const origin = url.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    const body = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    });

    const token = await fetchJson<GoogleTokenResponse>("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body
    });

    if (token.refresh_token) {
      await setSetting("google_refresh_token", token.refresh_token, {
        encrypted: true,
        description: "Google Business OAuth Refresh Token"
      });
    }

    await setSetting("google_access_token", token.access_token, {
      encrypted: true,
      description: "Google Business OAuth Access Token"
    });

    await setSetting("google_access_token_expires_at", String(Date.now() + token.expires_in * 1000), {
      encrypted: false,
      description: "Google Business OAuth Access Token Expiry"
    });

    // Try to fetch Account ID and Location ID to make it easier for the user
    try {
      const accountsRes = await fetchJson<GoogleAccountsResponse>("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
        headers: { authorization: `Bearer ${token.access_token}` }
      });
      
      const account = accountsRes.accounts?.[0];
      if (account) {
        await setSetting("google_fetched_account_id", account.name, { encrypted: false });

        const locationsRes = await fetchJson<GoogleLocationsResponse>(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,locationName`, {
          headers: { authorization: `Bearer ${token.access_token}` }
        });

        const location = locationsRes.locations?.[0];
        if (location) {
          await setSetting("google_fetched_location_id", location.name, { encrypted: false });
        }
      }
    } catch (e) {
      console.error("Failed to auto-fetch account/location IDs", e);
    }

    return NextResponse.redirect(new URL("/dashboard?google_connected=true", request.url));
  } catch (err) {
    console.error("OAuth exchange failed:", err);
    return NextResponse.redirect(new URL("/dashboard?error=oauth_failed", request.url));
  }
}
