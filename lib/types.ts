export type PublishStatus = "pending" | "success" | "failed" | "skipped";
export type JobStatus = "pending" | "running" | "resolved" | "dead";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

export type SyncedMedia = {
  id: string;
  instagram_media_id: string;
  media_type: MediaType;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  instagram_timestamp: string;
  google_media_name: string | null;
  google_publish_status: PublishStatus;
  gallery_publish_status: PublishStatus;
  temp_storage_path: string | null;
  gallery_storage_path: string | null;
  gallery_public_url: string | null;
  checksum: string | null;
  retry_count: number;
  last_error: string | null;
  published_to_google_at: string | null;
  published_to_gallery_at: string | null;
  cleanup_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FailedJob = {
  id: string;
  media_id: string | null;
  job_type: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  error_code: string | null;
  error_message: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CronStatus = {
  job_name: string;
  status: "idle" | "running" | "success" | "failed";
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  updated_at: string;
};

export type PublishLog = {
  id: string;
  media_id: string | null;
  channel: string;
  action: string;
  status: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
