import { GalleryGrid } from "@/components/gallery/gallery-grid";
import { getPublishedGalleryMedia } from "@/lib/gallery";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function Home() {
  const media = await getPublishedGalleryMedia();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 border-b border-neutral-200 pb-8 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
            MadeFit
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-6xl">
            Gallery
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
            Newest MadeFit Instagram moments, automatically published to the site.
          </p>
        </div>
        <a
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50"
        >
          Automation status
        </a>
      </header>

      <section className="py-8">
        <GalleryGrid media={media} />
      </section>
    </main>
  );
}
