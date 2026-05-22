"use client";

import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X } from "lucide-react";
import type { GalleryMedia } from "@/lib/gallery";
import { Button } from "@/components/ui/button";

export function GalleryGrid({ media }: { media: GalleryMedia[] }) {
  if (media.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed bg-white/70 p-8 text-center">
        <p className="max-w-md text-sm leading-6 text-neutral-500">
          The automation is ready. New Instagram posts will appear here after the first successful sync.
        </p>
      </div>
    );
  }

  return (
    <div className="masonry-grid">
      {media.map((item, index) => (
        <Dialog.Root key={item.id}>
          <Dialog.Trigger asChild>
            <button
              className="masonry-item group relative block w-full overflow-hidden rounded-lg bg-neutral-100 text-left shadow-sm outline-none transition duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-emerald-700"
              aria-label={`Open MadeFit media from ${new Date(item.instagram_timestamp).toLocaleDateString()}`}
            >
              {item.media_type === "VIDEO" ? (
                <div className="relative aspect-[4/5] bg-neutral-950">
                  {item.thumbnail_url ? (
                    <Image
                      src={item.thumbnail_url}
                      alt="MadeFit gallery video preview"
                      fill
                      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover opacity-90 transition duration-300 group-hover:scale-105"
                      priority={index < 2}
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-950 shadow-lg">
                      <Play className="h-5 w-5 fill-current" />
                    </span>
                  </span>
                </div>
              ) : (
                <Image
                  src={item.gallery_public_url}
                  alt="MadeFit gallery image"
                  width={900}
                  height={1125}
                  sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="h-auto w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  priority={index < 2}
                />
              )}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[92vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none">
              <Dialog.Title className="sr-only">MadeFit gallery preview</Dialog.Title>
              {item.media_type === "VIDEO" ? (
                <video
                  src={item.gallery_public_url}
                  className="max-h-[92vh] w-full rounded-lg bg-neutral-950 object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <Image
                  src={item.gallery_public_url}
                  alt="MadeFit gallery preview"
                  width={1400}
                  height={1750}
                  className="max-h-[92vh] w-auto rounded-lg object-contain"
                />
              )}
              <Dialog.Close asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-3 top-3 rounded-full bg-white/90"
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ))}
    </div>
  );
}
