# MadeFit Media Automation(instagram)

Production-ready background media distribution for MadeFit.

Instagram Business post -> automatic detection -> temporary fetch -> Google Business Profile media upload -> website Gallery publish -> verification -> temporary cleanup.

## Stack

- Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui-style components
- Supabase Postgres, RLS, Storage
- Vercel Cron Jobs
- Meta Graph API
- Google Business Profile API

## Architecture

- `app/api/cron/instagram-sync`: runs every 5 minutes, fetches recent Instagram Business media, deduplicates by Instagram media ID, publishes to Gallery and Google Business Profile.
- `app/api/cron/retry-failed`: retries failed jobs with exponential backoff.
- `app/api/cron/cleanup`: deletes temporary files after both publishing targets are verified.
- `app/page.tsx`: public Gallery with responsive masonry, lazy images, video preview, and lightbox.
- `app/dashboard/page.tsx`: read-only monitoring dashboard.
- `lib/automation/*`: pipeline, retry queue, cleanup, and logging.
- `lib/meta/*`, `lib/google/*`: API clients.

The gallery keeps one CDN-friendly published asset in Supabase Storage. Temporary original/cache files are deleted after successful Google and Gallery verification.

## Database

Run `supabase/migrations/001_madefit_media_automation.sql` in Supabase SQL editor or through the Supabase CLI.

Required tables are included:

- `synced_media`
- `publish_logs`
- `failed_jobs`
- `system_settings`
- `cron_status`

The migration also creates:

- `media-temp` private storage bucket
- `gallery-media` public storage bucket
- RLS policies for public gallery reads and service-role automation writes
- indexes and timestamp triggers

## Environment

Copy `.env.example` to `.env.local` for local development and add the same values in Vercel.

Generate a 32-byte encryption key:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Required secrets:

- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase key.
- `CRON_SECRET`: Vercel cron bearer secret.
- `DASHBOARD_AUTH_TOKEN`: token used to open `/dashboard?token=...`.
- `ENCRYPTION_KEY`: encrypts provider tokens stored in `system_settings`.
- `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`: Instagram Business account ID.
- `GOOGLE_BUSINESS_ACCOUNT_ID`: Google Business account ID.
- `GOOGLE_BUSINESS_LOCATION_ID`: Google Business location ID.

## Provider Token Setup

After deployment, store provider tokens through the encrypted setup endpoint:

```powershell
$body = @{
  instagramAccessToken = "YOUR_LONG_LIVED_META_TOKEN"
  googleRefreshToken = "YOUR_GOOGLE_REFRESH_TOKEN"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "https://YOUR_DOMAIN/api/admin/settings" `
  -Headers @{ Authorization = "Bearer YOUR_DASHBOARD_AUTH_TOKEN" } `
  -ContentType "application/json" `
  -Body $body
```

The tokens are encrypted before being written to Supabase.

## Meta Graph API

The Instagram token needs access to the Instagram Business account and permissions for reading media, typically:

- `instagram_basic`
- `pages_show_list`
- `business_management`

The sync engine calls:

`/{IG_BUSINESS_ACCOUNT_ID}/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp`

## Google Business Profile API

Create an OAuth client, enable Business Profile APIs, and store a refresh token for an account that can manage the target location.

The integration creates media through:

`POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/media`

Each upload is verified by reading the returned media resource.

## Local Development

```powershell
npm install
npm run dev
```

Open:

- Gallery: `http://localhost:3000`
- Dashboard: `http://localhost:3000/dashboard?token=YOUR_DASHBOARD_AUTH_TOKEN`

Trigger cron locally:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/cron/instagram-sync" `
  -Headers @{ Authorization = "Bearer YOUR_CRON_SECRET" }
```

## Deployment

1. Create Supabase project.
2. Run the SQL migration.
3. Create Vercel project from this repo.
4. Add all environment variables from `.env.example`.
5. Set Vercel `CRON_SECRET` to match your environment value.
6. Deploy.
7. Store provider tokens with `/api/admin/settings`.
8. Open `/dashboard?token=YOUR_DASHBOARD_AUTH_TOKEN` and confirm cron health.

`vercel.json` schedules:

- Instagram sync every 5 minutes.
- Retry worker every 10 minutes.
- Cleanup hourly.

## Failure Recovery

If any publish step fails:

- temporary files are retained
- the error is logged to `publish_logs`
- a row is created in `failed_jobs`
- retry uses exponential backoff
- files are cleaned only after both Google and Gallery are successful

## Future Channels

Add new automatic destinations by creating a channel client and registering it in `lib/automation/media-pipeline.ts`. The existing record, log, status, and retry model can support Facebook, Threads, Pinterest, and WhatsApp Business without changing the public Gallery.
