-- HAKI V3: optional profile features + media storage.
-- Run this once in Supabase SQL Editor.

alter table public.businesses
  add column if not exists menu_images jsonb not null default '[]'::jsonb,
  add column if not exists booking_url text,
  add column if not exists google_review_url text,
  add column if not exists upi_id text,
  add column if not exists payment_qr_url text;

-- Small public bucket for customer profile media.
-- The app compresses uploads in the browser before storing them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'haki-media',
  'haki-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[];

-- Re-runnable storage policies.
drop policy if exists "Public can view Haki media" on storage.objects;
drop policy if exists "Authenticated admins can upload Haki media" on storage.objects;
drop policy if exists "Authenticated admins can update Haki media" on storage.objects;
drop policy if exists "Authenticated admins can delete Haki media" on storage.objects;

create policy "Public can view Haki media"
on storage.objects
for select
to public
using (bucket_id = 'haki-media');

create policy "Authenticated admins can upload Haki media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'haki-media');

create policy "Authenticated admins can update Haki media"
on storage.objects
for update
to authenticated
using (bucket_id = 'haki-media')
with check (bucket_id = 'haki-media');

create policy "Authenticated admins can delete Haki media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'haki-media');
