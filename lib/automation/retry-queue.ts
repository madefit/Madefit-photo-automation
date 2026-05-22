import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { errorMessage } from "@/lib/automation/logging";
import type { FailedJob } from "@/lib/types";

export function nextRetryAt(attempts: number) {
  const delayMinutes = Math.min(24 * 60, Math.round(2 ** Math.max(0, attempts)));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

export async function enqueueFailedJob(input: {
  mediaId?: string | null;
  jobType: string;
  error: unknown;
  payload?: Record<string, unknown>;
  attempts?: number;
}) {
  const env = getServerEnv();
  const attempts = input.attempts ?? 0;
  const supabase = createAdminClient();
  const { error } = await supabase.from("failed_jobs").insert({
    media_id: input.mediaId ?? null,
    job_type: input.jobType,
    status: "pending",
    attempts,
    max_attempts: env.MAX_RETRY_ATTEMPTS,
    next_run_at: nextRetryAt(attempts),
    error_message: errorMessage(input.error),
    payload: input.payload ?? {}
  });

  if (error) throw error;
}

export async function getDueFailedJobs(limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("failed_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as FailedJob[];
}

export async function markJobRunning(jobId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("failed_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markJobResolved(jobId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("failed_jobs")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) throw error;
}

export async function markJobFailed(job: FailedJob, error: unknown) {
  const attempts = job.attempts + 1;
  const status = attempts >= job.max_attempts ? "dead" : "pending";
  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("failed_jobs")
    .update({
      status,
      attempts,
      next_run_at: nextRetryAt(attempts),
      error_message: errorMessage(error),
      updated_at: new Date().toISOString()
    })
    .eq("id", job.id);

  if (updateError) throw updateError;
}
