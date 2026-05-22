import { createAdminClient } from "@/lib/supabase/admin";
import { fetchRecentInstagramMedia, type InstagramMedia } from "@/lib/meta/client";
import { publishMediaToGoogleBusiness } from "@/lib/google/client";
import {
  deleteTemporaryMedia,
  fetchMediaBuffer,
  uploadGalleryMedia,
  uploadTemporaryMedia
} from "@/lib/storage";
import { enqueueFailedJob } from "@/lib/automation/retry-queue";
import { errorMessage, finishCron, startCron, writePublishLog } from "@/lib/automation/logging";
import type { FailedJob, SyncedMedia } from "@/lib/types";

type PipelineResult = {
  detected: number;
  inserted: number;
  publishedToGoogle: number;
  publishedToGallery: number;
  skippedDuplicates: number;
  failed: number;
};

async function findExistingMedia(instagramMediaId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("synced_media")
    .select("*")
    .eq("instagram_media_id", instagramMediaId)
    .maybeSingle();

  if (error) throw error;
  return data as SyncedMedia | null;
}

async function createMediaRecord(media: InstagramMedia) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("synced_media")
    .insert({
      instagram_media_id: media.id,
      media_type: media.media_type,
      media_url: media.media_url ?? null,
      thumbnail_url: media.thumbnail_url ?? null,
      permalink: media.permalink ?? null,
      instagram_timestamp: media.timestamp,
      google_publish_status: "pending",
      gallery_publish_status: "pending"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SyncedMedia;
}

async function updateMediaRecord(id: string, values: Partial<SyncedMedia>) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("synced_media")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as SyncedMedia;
}

async function publishGallery(record: SyncedMedia, media: InstagramMedia, bufferData?: Awaited<ReturnType<typeof fetchMediaBuffer>>) {
  const data = bufferData ?? (await fetchMediaBuffer(media));
  const uploaded = await uploadGalleryMedia({
    instagramMediaId: media.id,
    buffer: data.buffer,
    contentType: data.contentType,
    extension: data.extension
  });

  await updateMediaRecord(record.id, {
    gallery_publish_status: "success",
    gallery_storage_path: uploaded.path,
    gallery_public_url: uploaded.publicUrl,
    checksum: data.checksum,
    published_to_gallery_at: new Date().toISOString()
  });

  await writePublishLog({
    mediaId: record.id,
    channel: "website_gallery",
    action: "publish",
    status: "success",
    metadata: { galleryStoragePath: uploaded.path }
  });

  return uploaded.publicUrl;
}

async function publishGoogle(record: SyncedMedia, media: InstagramMedia, sourceUrl: string) {
  const googleMedia = await publishMediaToGoogleBusiness({
    mediaType: media.media_type,
    sourceUrl,
    requestId: media.id
  });

  await updateMediaRecord(record.id, {
    google_publish_status: "success",
    google_media_name: googleMedia.name ?? null,
    published_to_google_at: new Date().toISOString()
  });

  await writePublishLog({
    mediaId: record.id,
    channel: "google_business",
    action: "publish",
    status: "success",
    metadata: googleMedia as Record<string, unknown>
  });
}

async function processInstagramMedia(media: InstagramMedia) {
  const existing = await findExistingMedia(media.id);
  if (existing) {
    return { duplicate: true, google: false, gallery: false };
  }

  let record = await createMediaRecord(media);
  let tempPath: string | null = null;

  try {
    const bufferData = await fetchMediaBuffer(media);
    tempPath = await uploadTemporaryMedia({
      instagramMediaId: media.id,
      buffer: bufferData.buffer,
      contentType: bufferData.contentType,
      extension: bufferData.extension
    });
    record = await updateMediaRecord(record.id, {
      temp_storage_path: tempPath,
      checksum: bufferData.checksum
    });

    const galleryUrl = await publishGallery(record, media, bufferData);
    await publishGoogle(record, media, galleryUrl);
    await deleteTemporaryMedia(tempPath);
    await updateMediaRecord(record.id, {
      temp_storage_path: null,
      cleanup_at: new Date().toISOString()
    });

    return { duplicate: false, google: true, gallery: true };
  } catch (error) {
    await updateMediaRecord(record.id, {
      last_error: errorMessage(error),
      retry_count: record.retry_count + 1
    });
    await writePublishLog({
      mediaId: record.id,
      channel: "pipeline",
      action: "sync",
      status: "failed",
      message: errorMessage(error),
      metadata: { instagramMediaId: media.id, tempPath }
    });
    await enqueueFailedJob({
      mediaId: record.id,
      jobType: "full_media_sync",
      error,
      payload: { instagramMedia: media }
    });
    return { duplicate: false, google: false, gallery: false, failed: true };
  }
}

export async function runInstagramSync() {
  const startedAt = Date.now();
  const jobName = "instagram-sync";
  await startCron(jobName);

  const result: PipelineResult = {
    detected: 0,
    inserted: 0,
    publishedToGoogle: 0,
    publishedToGallery: 0,
    skippedDuplicates: 0,
    failed: 0
  };

  try {
    const media = await fetchRecentInstagramMedia();
    result.detected = media.length;

    for (const item of [...media].reverse()) {
      const processed = await processInstagramMedia(item);
      if (processed.duplicate) result.skippedDuplicates += 1;
      else result.inserted += 1;
      if (processed.google) result.publishedToGoogle += 1;
      if (processed.gallery) result.publishedToGallery += 1;
      if (processed.failed) result.failed += 1;
    }

    await finishCron(jobName, "success", startedAt, result);
    return result;
  } catch (error) {
    await finishCron(jobName, "failed", startedAt, result, error);
    throw error;
  }
}

export async function retryMediaJob(job: FailedJob) {
  const payloadMedia = job.payload.instagramMedia as InstagramMedia | undefined;
  if (!payloadMedia) {
    throw new Error("Retry payload is missing instagramMedia");
  }

  const record = job.media_id ? await getMediaById(job.media_id) : await findExistingMedia(payloadMedia.id);
  if (!record) {
    throw new Error(`Retry media record not found for ${payloadMedia.id}`);
  }

  const bufferData = await fetchMediaBuffer(payloadMedia);
  let nextRecord = record;
  let tempPath = nextRecord.temp_storage_path;

  if (!tempPath) {
    tempPath = await uploadTemporaryMedia({
      instagramMediaId: payloadMedia.id,
      buffer: bufferData.buffer,
      contentType: bufferData.contentType,
      extension: bufferData.extension
    });
    nextRecord = await updateMediaRecord(nextRecord.id, {
      temp_storage_path: tempPath,
      checksum: bufferData.checksum
    });
  }

  let galleryUrl = nextRecord.gallery_public_url;
  if (nextRecord.gallery_publish_status !== "success" || !galleryUrl) {
    galleryUrl = await publishGallery(nextRecord, payloadMedia, bufferData);
    nextRecord = await getMediaById(nextRecord.id);
  }

  if (nextRecord.google_publish_status !== "success") {
    await publishGoogle(nextRecord, payloadMedia, galleryUrl);
  }

  await deleteTemporaryMedia(tempPath);
  await updateMediaRecord(nextRecord.id, {
    temp_storage_path: null,
    cleanup_at: new Date().toISOString(),
    last_error: null
  });
}

async function getMediaById(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("synced_media").select("*").eq("id", id).single();
  if (error) throw error;
  return data as SyncedMedia;
}
