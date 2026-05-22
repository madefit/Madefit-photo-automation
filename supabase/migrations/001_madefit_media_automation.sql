create extension if not exists "pgcrypto";

create table if not exists public.synced_media (
  id uuid primary key default gen_random_uuid(),
  instagram_media_id text not null unique,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  media_url text,
  thumbnail_url text,
  permalink text,
  instagram_timestamp timestamptz not null,
  google_media_name text,
  google_publish_status text not null default 'pending' check (google_publish_status in ('pending', 'success', 'failed', 'skipped')),
  gallery_publish_status text not null default 'pending' check (gallery_publish_status in ('pending', 'success', 'failed', 'skipped')),
  temp_storage_path text,
  gallery_storage_path text,
  gallery_public_url text,
  checksum text,
  retry_count integer not null default 0,
  last_error text,
  published_to_google_at timestamptz,
  published_to_gallery_at timestamptz,
  cleanup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_logs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid references public.synced_media(id) on delete set null,
  channel text not null,
  action text not null,
  status text not null check (status in ('pending', 'success', 'failed', 'skipped')),
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.failed_jobs (
  id uuid primary key default gen_random_uuid(),
  media_id uuid references public.synced_media(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'resolved', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  next_run_at timestamptz not null default now(),
  error_code text,
  error_message text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value text,
  encrypted boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cron_status (
  job_name text primary key,
  status text not null default 'idle' check (status in ('idle', 'running', 'success', 'failed')),
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists synced_media_instagram_timestamp_idx
  on public.synced_media (instagram_timestamp desc);

create index if not exists synced_media_google_status_idx
  on public.synced_media (google_publish_status);

create index if not exists synced_media_gallery_status_idx
  on public.synced_media (gallery_publish_status);

create index if not exists publish_logs_media_created_idx
  on public.publish_logs (media_id, created_at desc);

create index if not exists failed_jobs_status_next_run_idx
  on public.failed_jobs (status, next_run_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_synced_media_updated_at on public.synced_media;
create trigger set_synced_media_updated_at
before update on public.synced_media
for each row execute function public.set_updated_at();

drop trigger if exists set_failed_jobs_updated_at on public.failed_jobs;
create trigger set_failed_jobs_updated_at
before update on public.failed_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

alter table public.synced_media enable row level security;
alter table public.publish_logs enable row level security;
alter table public.failed_jobs enable row level security;
alter table public.system_settings enable row level security;
alter table public.cron_status enable row level security;

drop policy if exists "Public can read published gallery media" on public.synced_media;
create policy "Public can read published gallery media"
on public.synced_media
for select
to anon, authenticated
using (
  gallery_publish_status = 'success'
  and gallery_public_url is not null
);

drop policy if exists "Service role can manage synced media" on public.synced_media;
create policy "Service role can manage synced media"
on public.synced_media
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage publish logs" on public.publish_logs;
create policy "Service role can manage publish logs"
on public.publish_logs
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage failed jobs" on public.failed_jobs;
create policy "Service role can manage failed jobs"
on public.failed_jobs
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage system settings" on public.system_settings;
create policy "Service role can manage system settings"
on public.system_settings
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage cron status" on public.cron_status;
create policy "Service role can manage cron status"
on public.cron_status
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-temp', 'media-temp', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('gallery-media', 'gallery-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read gallery media files" on storage.objects;
create policy "Public can read gallery media files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'gallery-media');

drop policy if exists "Service role can manage MadeFit media files" on storage.objects;
create policy "Service role can manage MadeFit media files"
on storage.objects
for all
to service_role
using (bucket_id in ('media-temp', 'gallery-media'))
with check (bucket_id in ('media-temp', 'gallery-media'));

insert into public.cron_status (job_name, status, metadata)
values
  ('instagram-sync', 'idle', '{}'::jsonb),
  ('retry-failed', 'idle', '{}'::jsonb),
  ('cleanup', 'idle', '{}'::jsonb)
on conflict (job_name) do nothing;
