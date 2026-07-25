-- ============================================================================
-- Visit Drakensberg — Supplier-owned Media
--
-- The `media` storage bucket (20260719_media_storage.sql) only allowed admins
-- to write to it, so suppliers had no way to upload their own photos — every
-- media input outside the admin console fell back to pasting a raw URL.
-- This adds a write policy scoped to each supplier's own folder
-- (supplier/{auth.uid()}/...), so suppliers can build a real media library of
-- their own uploads without being able to touch admin's or another
-- supplier's files. Metadata for these uploads is stored as vd_entities rows
-- (kind='media', status='private' so it's never publicly browsable — only
-- the owner and admins can read it), reusing the existing entity RLS model
-- instead of inventing a new table.
-- ============================================================================

drop policy if exists "Suppliers upload own media" on storage.objects;
drop policy if exists "Suppliers update own media" on storage.objects;
drop policy if exists "Suppliers delete own media" on storage.objects;

create policy "Suppliers upload own media" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and is_active_supplier()
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Suppliers update own media" on storage.objects
  for update using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Suppliers delete own media" on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
