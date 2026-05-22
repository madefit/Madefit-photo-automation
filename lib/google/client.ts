import { getServerEnv } from "@/lib/env";
import { fetchJson, retry } from "@/lib/http";
import { getSetting, setSetting } from "@/lib/settings";
import type { MediaType } from "@/lib/types";

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type GoogleMediaResponse = {
  name?: string;
  mediaFormat?: string;
  sourceUrl?: string;
};

async function getGoogleAccessToken() {
  const cachedToken = await getSetting("google_access_token");
  const expiresAt = await getSetting("google_access_token_expires_at");

  if (cachedToken && expiresAt && Number(expiresAt) - Date.now() > 1000 * 60 * 2) {
    return cachedToken;
  }

  const refreshToken = await getSetting("google_refresh_token");
  if (!refreshToken) {
    throw new Error("Missing encrypted system setting: google_refresh_token");
  }

  const env = getServerEnv();
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const token = await fetchJson<GoogleTokenResponse>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  await setSetting("google_access_token", token.access_token, {
    encrypted: true,
    description: "Encrypted short-lived Google access token"
  });
  await setSetting("google_access_token_expires_at", String(Date.now() + token.expires_in * 1000), {
    encrypted: false,
    description: "Google access token expiration timestamp in milliseconds"
  });

  return token.access_token;
}

function googleMediaFormat(mediaType: MediaType) {
  if (mediaType === "VIDEO") return "VIDEO";
  return "PHOTO";
}

export async function publishMediaToGoogleBusiness(input: {
  mediaType: MediaType;
  sourceUrl: string;
  requestId: string;
}) {
  const env = getServerEnv();
  const accessToken = await getGoogleAccessToken();
  const accountId = env.GOOGLE_BUSINESS_ACCOUNT_ID.replace(/^accounts\//, "");
  const locationId = env.GOOGLE_BUSINESS_LOCATION_ID.replace(/^locations\//, "");
  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/media`;

  const created = await retry(
    () =>
      fetchJson<GoogleMediaResponse>(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-goog-request-params": `parent=accounts/${accountId}/locations/${locationId}`
        },
        body: JSON.stringify({
          mediaFormat: googleMediaFormat(input.mediaType),
          sourceUrl: input.sourceUrl,
          locationAssociation: {
            category: "ADDITIONAL"
          },
          requestId: input.requestId
        })
      }),
    { attempts: 3 }
  );

  if (!created.name) {
    throw new Error("Google Business media creation did not return a media resource name");
  }

  await verifyGoogleBusinessMedia(created.name, accessToken);
  return created;
}

async function verifyGoogleBusinessMedia(name: string, accessToken: string) {
  await retry(
    () =>
      fetchJson<GoogleMediaResponse>(`https://mybusiness.googleapis.com/v4/${name}`, {
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      }),
    { attempts: 3, baseDelayMs: 800 }
  );
}
