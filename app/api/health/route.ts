import { NextRequest, NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { errorMessage } from "@/lib/automation/logging";
import { rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limitError = rateLimit(request, 30, 60000);
  if (limitError) return limitError;

  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json({
      ok: snapshot.health.ok,
      lastSync: snapshot.lastSync,
      failedJobs: snapshot.counts.failedJobs,
      tempFiles: snapshot.storage.tempFiles
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
