import { createAdminClient } from "@/lib/supabase/admin";
import { deleteTemporaryMedia } from "@/lib/storage";
import { finishCron, startCron } from "@/lib/automation/logging";
import type { SyncedMedia } from "@/lib/types";

export async function runCleanup() {
  const startedAt = Date.now();
  const jobName = "cleanup";
  await startCron(jobName);

  const result = {
    scanned: 0,
    deleted: 0
  };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("synced_media")
      .select("*")
      .not("temp_storage_path", "is", null)
      .eq("google_publish_status", "success")
      .eq("gallery_publish_status", "success")
      .limit(100);

    if (error) throw error;
    const records = (data ?? []) as SyncedMedia[];
    result.scanned = records.length;

    for (const record of records) {
      await deleteTemporaryMedia(record.temp_storage_path);
      const { error: updateError } = await supabase
        .from("synced_media")
        .update({
          temp_storage_path: null,
          cleanup_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", record.id);
      if (updateError) throw updateError;
      result.deleted += 1;
    }

    await finishCron(jobName, "success", startedAt, result);
    return result;
  } catch (error) {
    await finishCron(jobName, "failed", startedAt, result, error);
    throw error;
  }
}
