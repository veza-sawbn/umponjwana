-- ============================================================================
-- Visit Drakensberg — Media Storage bucket
--
-- The admin console (Media Library, visual website editor) uploads files to
-- the Supabase Storage bucket `media`, but no migration ever created it, so
-- every upload failed with "Bucket not found". This migration:
--   1. Creates the `media` bucket (public read via CDN URLs, 50 MB limit,
--      images + video only). If the bucket already exists it is made public.
--   2. Adds storage.objects policies: anyone can read, admins can write.
-- Run in the Supabase SQL editor.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800, -- 50 MB
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','image/avif',
        'video/mp4','video/webm','video/quicktime','application/pdf']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies on storage.objects (RLS is enabled by Supabase out of the box)
drop policy if exists "Media is publicly readable"  on storage.objects;
drop policy if exists "Admins upload media"         on storage.objects;
drop policy if exists "Admins update media"         on storage.objects;
drop policy if exists "Admins delete media"         on storage.objects;

create policy "Media is publicly readable" on storage.objects
  for select using (bucket_id = 'media');

create policy "Admins upload media" on storage.objects
  for insert with check (bucket_id = 'media' and is_admin());

create policy "Admins update media" on storage.objects
  for update using (bucket_id = 'media' and is_admin());

create policy "Admins delete media" on storage.objects
  for delete using (bucket_id = 'media' and is_admin());
