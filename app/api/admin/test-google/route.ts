import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

function safeParseJson(text: string) {
  try { return JSON.parse(text); } catch { return null; }
}

async function fetchRaw(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  const json = safeParseJson(text);
  return { res, text, json };
}

export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    // Step 1: Env vars
    const env = getServerEnv();
    const accountId = env.GOOGLE_BUSINESS_ACCOUNT_ID.replace(/^accounts\//, "");
    const locationId = env.GOOGLE_BUSINESS_LOCATION_ID.replace(/^locations\//, "");
    results.env = {
      hasClientId: !!env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!env.GOOGLE_CLIENT_SECRET,
      accountId,
      locationId,
    };

    // Step 2: Stored token check
    const refreshToken = await getSetting("google_refresh_token");
    results.tokens = {
      hasRefreshToken: !!refreshToken,
      refreshTokenPreview: refreshToken ? refreshToken.slice(0, 8) + "…" : null,
    };
    if (!refreshToken) {
      return NextResponse.json({
        ok: false, step: "tokens",
        error: "No refresh token. Visit /api/auth/google to reconnect.",
        results,
      }, { status: 400 });
    }

    // Step 3: Refresh access token
    const tokenBody = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const { res: tokenRes, json: tokenData } = await fetchRaw(
      "https://oauth2.googleapis.com/token",
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: tokenBody }
    );
    results.tokenRefresh = {
      status: tokenRes.status,
      ok: tokenRes.ok,
      hasAccessToken: !!tokenData?.access_token,
      error: tokenData?.error_description ?? tokenData?.error ?? null,
    };
    if (!tokenRes.ok) {
      return NextResponse.json({ ok: false, step: "token_refresh", results }, { status: 400 });
    }
    const token: string = tokenData.access_token;

    // Step 4: Verify scope
    const { json: tokenInfo } = await fetchRaw(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${token}`
    );
    results.tokenInfo = {
      scope: tokenInfo?.scope ?? null,
      hasBusinessScope: (tokenInfo?.scope ?? "").includes("business.manage"),
      email: tokenInfo?.email ?? null,
    };

    // Step 5: Directly test the media LIST endpoint (what the automation actually uses)
    // This is a safe read-only GET — does NOT create anything
    const mediaUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;
    const { res: mediaRes, text: mediaText, json: mediaData } = await fetchRaw(
      mediaUrl,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const isHtml = mediaText.includes("<!DOCTYPE") || mediaText.includes("<html");
    results.mediaEndpoint = {
      url: mediaUrl,
      status: mediaRes.status,
      ok: mediaRes.ok,
      mediaCount: mediaData?.mediaItems?.length ?? 0,
      error: mediaData?.error?.message ?? (isHtml ? `HTML page returned (status ${mediaRes.status}) — API may not be enabled or IDs are wrong` : (!mediaRes.ok ? mediaText.slice(0, 400) : null)),
    };

    if (!mediaRes.ok) {
      const hint = mediaRes.status === 403
        ? `🔴 HTTP 403 — Google is refusing access. Your account/location IDs may not match the authenticated Google account, or the Business Profile API hasn't been granted access. accountId=${accountId}, locationId=${locationId}`
        : mediaRes.status === 404
        ? `🔴 HTTP 404 — Location not found. Check that locationId=${locationId} belongs to accountId=${accountId}.`
        : mediaRes.status === 429
        ? `⚠️ HTTP 429 — Rate limited. Wait a minute and try again, or check your quota at console.cloud.google.com/apis/api/mybusiness.googleapis.com/quotas`
        : `HTTP ${mediaRes.status}`;

      return NextResponse.json({ ok: false, step: "media_endpoint", results, hint }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      step: "all_passed",
      message: "✅ Google Business Profile API is working correctly. The automation is ready to publish photos.",
      results,
    });

  } catch (err) {
    return NextResponse.json({
      ok: false, step: "exception",
      error: err instanceof Error ? err.message : String(err),
      results,
    }, { status: 500 });
  }
}
