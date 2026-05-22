import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="mt-6 h-28 w-full" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-72" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    </main>
  );
}
