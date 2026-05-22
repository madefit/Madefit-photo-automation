import { NextRequest, NextResponse } from "next/server";
import { runCleanup } from "@/lib/automation/cleanup";
import { errorMessage } from "@/lib/automation/logging";
import { requireCronAuth } from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authError = requireCronAuth(request);
  if (authError) return authError;

  try {
    const result = await runCleanup();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
