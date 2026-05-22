import { getServerEnv } from "@/lib/env";
import { fetchJson, retry } from "@/lib/http";
import { getSetting, setSetting } from "@/lib/settings";
import type { MediaType } from "@/lib/types";

export type InstagramMedia = {
  id: string;
  media_type: MediaType;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
};

type InstagramMediaResponse = {
  data: InstagramMedia[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
  };
};

type DebugTokenResponse = {
  data?: {
    expires_at?: number;
    is_valid?: boolean;
  };
};

type TokenResponse = {
  access_token: string;
  expires_in?: number;
};

export async function getInstagramAccessToken() {
  const token = await getSetting("instagram_access_token");
  if (!token) {
    throw new Error("Missing encrypted system setting: instagram_access_token");
  }

  return token;
}

export async function refreshInstagramTokenIfNeeded() {
  const env = getServerEnv();
  const token = await getInstagramAccessToken();

  if (!env.META_APP_ID || !env.META_APP_SECRET) return token;

  const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
  const debugUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/debug_token`);
  debugUrl.searchParams.set("input_token", token);
  debugUrl.searchParams.set("access_token", appToken);

  try {
    const debug = await fetchJson<DebugTokenResponse>(debugUrl);
    const expiresAt = debug.data?.expires_at ? debug.data.expires_at * 1000 : null;
    const shouldRefresh = !debug.data?.is_valid || (expiresAt && expiresAt - Date.now() < 1000 * 60 * 60 * 24 * 7);

    if (!shouldRefresh) return token;
  } catch {
    return token;
  }

  const refreshUrl = new URL("https://graph.instagram.com/refresh_access_token");
  refreshUrl.searchParams.set("grant_type", "ig_refresh_token");
  refreshUrl.searchParams.set("access_token", token);

  const refreshed = await fetchJson<TokenResponse>(refreshUrl);
  await setSetting("instagram_access_token", refreshed.access_token, {
    encrypted: true,
    description: "Encrypted long-lived Instagram access token"
  });

  return refreshed.access_token;
}

export async function fetchRecentInstagramMedia() {
  const env = getServerEnv();
  const accessToken = await refreshInstagramTokenIfNeeded();
  const url = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_VERSION}/${env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`
  );
  url.searchParams.set("fields", "id,media_type,media_url,thumbnail_url,permalink,timestamp");
  url.searchParams.set("limit", String(env.SYNC_BATCH_LIMIT));
  url.searchParams.set("access_token", accessToken);

  const response = await retry(() => fetchJson<InstagramMediaResponse>(url), {
    attempts: 3
  });

  return response.data.filter(
    (item) =>
      (item.media_type === "IMAGE" || item.media_type === "CAROUSEL_ALBUM") &&
      (item.media_url || item.thumbnail_url)
  );
}
