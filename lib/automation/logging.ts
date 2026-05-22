import { createAdminClient } from "@/lib/supabase/admin";

export async function writePublishLog(input: {
  mediaId?: string | null;
  channel: string;
  action: string;
  status: "success" | "failed" | "pending" | "skipped";
  message?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("publish_logs").insert({
    media_id: input.mediaId ?? null,
    channel: input.channel,
    action: input.action,
    status: input.status,
    message: input.message ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) throw error;
}

export async function startCron(jobName: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cron_status").upsert(
    {
      job_name: jobName,
      status: "running",
      last_run_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "job_name" }
  );
  if (error) throw error;
}

export async function finishCron(
  jobName: string,
  status: "success" | "failed",
  startedAt: number,
  metadata?: Record<string, unknown>,
  error?: unknown
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("cron_status").upsert(
    {
      job_name: jobName,
      status,
      last_success_at: status === "success" ? now : undefined,
      last_error: status === "failed" ? errorMessage(error) : null,
      duration_ms: Date.now() - startedAt,
      metadata: metadata ?? {},
      updated_at: now
    },
    { onConflict: "job_name" }
  );
  if (updateError) throw updateError;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}
