import { finishCron, startCron } from "@/lib/automation/logging";
import {
  getDueFailedJobs,
  markJobFailed,
  markJobResolved,
  markJobRunning
} from "@/lib/automation/retry-queue";
import { retryMediaJob } from "@/lib/automation/media-pipeline";

export async function runRetryWorker() {
  const startedAt = Date.now();
  const jobName = "retry-failed";
  await startCron(jobName);

  const result = {
    checked: 0,
    resolved: 0,
    failed: 0
  };

  try {
    const jobs = await getDueFailedJobs();
    result.checked = jobs.length;

    for (const job of jobs) {
      await markJobRunning(job.id);
      try {
        if (job.job_type === "full_media_sync") {
          await retryMediaJob(job);
        } else {
          throw new Error(`Unknown job type: ${job.job_type}`);
        }
        await markJobResolved(job.id);
        result.resolved += 1;
      } catch (error) {
        await markJobFailed(job, error);
        result.failed += 1;
      }
    }

    await finishCron(jobName, "success", startedAt, result);
    return result;
  } catch (error) {
    await finishCron(jobName, "failed", startedAt, result, error);
    throw error;
  }
}
