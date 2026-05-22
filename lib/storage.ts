import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { sha256 } from "@/lib/security";
import type { InstagramMedia } from "@/lib/meta/client";

function extensionFor(contentType: string, mediaType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4") || mediaType === "VIDEO") return "mp4";
  return "jpg";
}

export async function fetchMediaBuffer(media: InstagramMedia) {
  const url = media.media_url ?? media.thumbnail_url;
  if (!url) throw new Error(`Instagram media ${media.id} has no downloadable URL`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Instagram media ${media.id}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    contentType,
    checksum: sha256(buffer),
    extension: extensionFor(contentType, media.media_type)
  };
}

export async function uploadTemporaryMedia(input: {
  instagramMediaId: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
}) {
  const env = getServerEnv();
  const supabase = createAdminClient();
  const path = `${input.instagramMediaId}/${Date.now()}.${input.extension}`;
  const { error } = await supabase.storage.from(env.SUPABASE_TEMP_BUCKET).upload(path, input.buffer, {
    contentType: input.contentType,
    upsert: true
  });

  if (error) throw error;
  return path;
}

export async function uploadGalleryMedia(input: {
  instagramMediaId: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
}) {
  const env = getServerEnv();
  const supabase = createAdminClient();
  const path = `${input.instagramMediaId}.${input.extension}`;
  const { error } = await supabase.storage.from(env.SUPABASE_GALLERY_BUCKET).upload(path, input.buffer, {
    contentType: input.contentType,
    upsert: true,
    cacheControl: "31536000"
  });

  if (error) throw error;

  const { data } = supabase.storage.from(env.SUPABASE_GALLERY_BUCKET).getPublicUrl(path);

  return {
    path,
    publicUrl: data.publicUrl
  };
}

export async function deleteTemporaryMedia(path?: string | null) {
  if (!path) return;
  const env = getServerEnv();
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(env.SUPABASE_TEMP_BUCKET).remove([path]);
  if (error) throw error;
}

export async function countTemporaryFiles() {
  const env = getServerEnv();
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(env.SUPABASE_TEMP_BUCKET).list("", {
    limit: 1000
  });

  if (error) return 0;
  return data?.length ?? 0;
}
