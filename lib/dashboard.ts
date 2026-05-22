import { createAdminClient } from "@/lib/supabase/admin";
import { countTemporaryFiles } from "@/lib/storage";
import type { CronStatus, FailedJob, SyncedMedia } from "@/lib/types";

export async function getDashboardSnapshot() {
  const supabase = createAdminClient();

  const [latestMedia, failedJobs, cronStatuses, googlePublished, deadJobs, tempFiles] =
    await Promise.all([
      supabase
        .from("synced_media")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("failed_jobs")
        .select("*")
        .in("status", ["pending", "running", "dead"])
        .order("next_run_at", { ascending: true })
        .limit(8),
      supabase.from("cron_status").select("*"),
      supabase
        .from("synced_media")
        .select("id", { count: "exact", head: true })
        .eq("google_publish_status", "success"),
      supabase
        .from("failed_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "running", "dead"]),
      countTemporaryFiles()
    ]);

  if (latestMedia.error) throw latestMedia.error;
  if (failedJobs.error) throw failedJobs.error;
  if (cronStatuses.error) throw cronStatuses.error;
  if (googlePublished.error) throw googlePublished.error;
  if (deadJobs.error) throw deadJobs.error;

  const statuses = (cronStatuses.data ?? []) as CronStatus[];
  const lastSync = statuses.find((status) => status.job_name === "instagram-sync") ?? null;
  const unhealthyCron = statuses.some((status) => status.status === "failed");
  const hasDeadJobs = ((failedJobs.data ?? []) as FailedJob[]).some((job) => job.status === "dead");

  return {
    latestMedia: (latestMedia.data ?? []) as SyncedMedia[],
    failedJobs: (failedJobs.data ?? []) as FailedJob[],
    lastSync,
    cronStatuses: statuses,
    counts: {
      googlePublished: googlePublished.count ?? 0,
      failedJobs: deadJobs.count ?? 0
    },
    storage: {
      tempFiles
    },
    health: {
      ok: !unhealthyCron && !hasDeadJobs,
      unhealthyCron,
      hasDeadJobs
    }
  };
}
