import { createPublicClient } from "@/lib/supabase/public";

export type GalleryMedia = {
  id: string;
  instagram_media_id: string;
  permalink: string | null;
  instagram_timestamp: string;
  gallery_public_url: string;
};

export async function getPublishedGalleryMedia() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("synced_media")
    .select("id, instagram_media_id, permalink, instagram_timestamp, gallery_public_url")
    .eq("gallery_publish_status", "success")
    .not("gallery_public_url", "is", null)
    .in("media_type", ["IMAGE", "CAROUSEL_ALBUM"])
    .order("instagram_timestamp", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data ?? []) as GalleryMedia[];
}
