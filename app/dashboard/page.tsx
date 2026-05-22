import { Activity, Database, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardRefreshToast } from "@/components/dashboard/dashboard-refresh-toast";
import { getDashboardSnapshot } from "@/lib/dashboard";
import { getSetting } from "@/lib/settings";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function relativeDate(value?: string | null) {
  if (!value) return "Never";
  return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`;
}

function statusVariant(status?: string | null) {
  if (status === "success" || status === "resolved") return "success";
  if (status === "failed" || status === "dead") return "destructive";
  if (status === "running" || status === "pending") return "secondary";
  return "outline";
}

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const googleConnected = !!(await getSetting("google_refresh_token"));
  const fetchedAccountId = await getSetting("google_fetched_account_id");
  const fetchedLocationId = await getSetting("google_fetched_location_id");

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <DashboardRefreshToast />
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
            MadeFit Media Automation
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-950 sm:text-5xl">
            Monitoring
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Badge variant={snapshot.health.ok ? "success" : "destructive"}>
            {snapshot.health.ok ? "Automation healthy" : "Attention needed"}
          </Badge>
          {!googleConnected ? (
            <Link href="/api/auth/google">
              <Button size="sm">Connect Google Business</Button>
            </Link>
          ) : (
            <div className="flex flex-col items-end text-right text-xs text-neutral-500">
              <span className="font-medium text-emerald-600">Google Connected</span>
              {fetchedAccountId && <span>Account: {fetchedAccountId}</span>}
              {fetchedLocationId && <span>Location: {fetchedLocationId}</span>}
            </div>
          )}
        </div>
      </header>

      <section className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> Last Instagram sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{relativeDate(snapshot.lastSync?.last_success_at)}</p>
            <p className="mt-2 text-sm text-neutral-500">
              Checked {relativeDate(snapshot.lastSync?.last_run_at)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4" /> Google publish
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{snapshot.counts.googlePublished}</p>
            <p className="mt-2 text-sm text-neutral-500">Successful uploads</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TriangleAlert className="h-4 w-4" /> Failed jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{snapshot.counts.failedJobs}</p>
            <p className="mt-2 text-sm text-neutral-500">Queued for retry</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" /> Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{snapshot.storage.tempFiles}</p>
            <p className="mt-2 text-sm text-neutral-500">Temporary files awaiting cleanup</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Latest Synced Media</CardTitle>
          </CardHeader>
          <CardContent>
            {snapshot.latestMedia.length === 0 ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b text-neutral-500">
                    <tr>
                      <th className="py-3 font-medium">Instagram ID</th>
                      <th className="py-3 font-medium">Type</th>
                      <th className="py-3 font-medium">Google</th>
                      <th className="py-3 font-medium">Gallery</th>
                      <th className="py-3 font-medium">Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.latestMedia.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="py-4 font-medium">{item.instagram_media_id}</td>
                        <td className="py-4">{item.media_type}</td>
                        <td className="py-4">
                          <Badge variant={statusVariant(item.google_publish_status)}>
                            {item.google_publish_status}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <Badge variant={statusVariant(item.gallery_publish_status)}>
                            {item.gallery_publish_status}
                          </Badge>
                        </td>
                        <td className="py-4 text-neutral-500">{relativeDate(item.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" /> Retry Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {snapshot.failedJobs.length === 0 ? (
                <p className="text-sm text-neutral-500">No failed jobs in queue.</p>
              ) : (
                snapshot.failedJobs.map((job) => (
                  <div key={job.id} className="rounded-md border bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{job.job_type}</p>
                      <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      Attempt {job.attempts} of {job.max_attempts}
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{job.error_message}</p>
                    <p className="mt-2 text-xs text-neutral-400">
                      Next run {relativeDate(job.next_run_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
