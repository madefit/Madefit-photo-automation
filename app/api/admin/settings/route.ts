import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setSetting } from "@/lib/settings";
import { requireAdminAuth } from "@/lib/security";
import { errorMessage } from "@/lib/automation/logging";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  instagramAccessToken: z.string().min(10).optional(),
  googleRefreshToken: z.string().min(10).optional()
});

export async function POST(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = settingsSchema.parse(await request.json());

    if (body.instagramAccessToken) {
      await setSetting("instagram_access_token", body.instagramAccessToken, {
        encrypted: true,
        description: "Encrypted long-lived Instagram Business access token"
      });
    }

    if (body.googleRefreshToken) {
      await setSetting("google_refresh_token", body.googleRefreshToken, {
        encrypted: true,
        description: "Encrypted Google OAuth refresh token"
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
