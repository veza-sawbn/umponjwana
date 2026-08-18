-- ============================================================================
-- Visit Drakensberg — ops-managed delete on vd_entities; ops-managed media
--
-- Bug report: uploading media while acting-as a supplier returned 400 from
-- Supabase Storage. Two independent causes, both fixed here + in code:
--
-- 1. lib/supplier-media.ts's uploadMedia() built the storage path from the
--    raw signed-in user id, not the effective (possibly managed) supplier —
--    the same class of bug fixed everywhere else in the delegated-management
--    work, just missed in this one file. Fixed in code alongside this
--    migration; not a database change.
--
-- 2. Even with the correct path, "Suppliers upload/update/delete own media"
--    (20260726_supplier_media.sql) checks `(storage.foldername(name))[2] =
--    auth.uid()::text` and `is_active_supplier()` — both of which describe
--    the uploader acting on their OWN account only. There has never been an
--    ops-delegation equivalent for the media bucket, unlike vd_entities
--    (which got "Managed ops agents write/update entities" in
--    20260811_delegated_management.sql). An ops employee acting-as a
--    supplier can never satisfy either check, since auth.uid() is always
--    their own id and is_active_supplier() checks their own (non-supplier)
--    profile. Fixed here with new storage policies mirroring the vd_entities
--    pattern: folder segment must be a supplier the caller actively manages,
--    gated on manage_content (same permission /supplier/media already
--    requires client-side per lib/ops-permissions.ts).
--
-- Separately found while tracing the above: vd_entities has an ops-delegated
-- INSERT and UPDATE policy but no DELETE policy at all. An ops employee can
-- create and edit a managed supplier's catalog rows but not remove one —
-- "Owners delete own" only matches owner_id = auth.uid() (the supplier
-- themself), and "Admins write all" only matches admins. Added here,
-- mirroring the UPDATE policy's permission set exactly.
-- ============================================================================

-- ─── 1. vd_entities: ops-delegated delete ───────────────────────────────────
drop policy if exists "Managed ops agents delete entities" on vd_entities;

create policy "Managed ops agents delete entities" on vd_entities
  for delete using (
    owner_id is not null
    and (
      has_supplier_permission(owner_id, 'manage_inventory')
      or has_supplier_permission(owner_id, 'manage_content')
    )
  );

-- ─── 2. media bucket: ops-delegated insert/update/delete ────────────────────
-- Folder layout is supplier/{supplierId}/filename — validate the segment is
-- uuid-shaped before casting, so a malformed path fails the check rather
-- than raising a cast error.
drop policy if exists "Ops agents upload managed supplier media" on storage.objects;
drop policy if exists "Ops agents update managed supplier media" on storage.objects;
drop policy if exists "Ops agents delete managed supplier media" on storage.objects;

create policy "Ops agents upload managed supplier media" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and has_supplier_permission(((storage.foldername(name))[2])::uuid, 'manage_content')
  );

create policy "Ops agents update managed supplier media" on storage.objects
  for update using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and has_supplier_permission(((storage.foldername(name))[2])::uuid, 'manage_content')
  );

create policy "Ops agents delete managed supplier media" on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'supplier'
    and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
    and has_supplier_permission(((storage.foldername(name))[2])::uuid, 'manage_content')
  );
