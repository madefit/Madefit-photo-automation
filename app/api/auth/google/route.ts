import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getServerEnv();
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/plus.business.manage");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent"); // Force consent to guarantee a refresh_token

  return NextResponse.redirect(url);
}
