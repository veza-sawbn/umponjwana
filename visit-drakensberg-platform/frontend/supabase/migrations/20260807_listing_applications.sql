-- ============================================================================
-- Visit Drakensberg — Public listing applications ("List your property")
-- Run AFTER 20260726_supplier_media.sql.
--
-- The supplier portal already has a full property wizard, but it sits behind
-- two gates: a supplier account and an admin approval flag (is_active_supplier
-- guards every vd_entities insert). That is correct for the live catalog and
-- wrong for the front door — an establishment owner who has never heard of the
-- platform cannot be asked to create an account before they are allowed to
-- tell us who they are.
--
-- So the public form writes here instead of into vd_entities. A row in this
-- table is an *application*, not a listing: it is invisible to visitors, it
-- never reaches the catalog on its own, and the team promotes an approved one
-- into a real property (supplier account + vd_entities row) by hand.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. The applications table
--    `value` carries the whole submitted form; the columns are only the
--    fields the review queue sorts and filters on, mirrored out of the JSON.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_listing_applications (
  id             text primary key,
  reference      text not null,
  status         text not null default 'new',
  property_name  text not null default '',
  contact_email  text not null default '',
  region         text not null default '',
  value          jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists vd_listing_applications_status_idx
  on vd_listing_applications (status);
create index if not exists vd_listing_applications_created_idx
  on vd_listing_applications (created_at desc);

alter table vd_listing_applications enable row level security;

drop policy if exists "Anyone can apply to list"   on vd_listing_applications;
drop policy if exists "Admins read applications"   on vd_listing_applications;
drop policy if exists "Admins manage applications" on vd_listing_applications;

-- Write-only for the public, exactly like vd_newsletter_subscribers: an
-- applicant may lodge an application and can never read one back — not their
-- own, and not anybody else's. `status = 'new'` in the check stops a caller
-- from self-approving on the way in; only an admin can move it from there.
create policy "Anyone can apply to list" on vd_listing_applications
  for insert with check (status = 'new');

create policy "Admins read applications" on vd_listing_applications
  for select using (is_admin());

create policy "Admins manage applications" on vd_listing_applications
  for all using (is_admin()) with check (is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Photos attached to an application
--
--    Applicants are not suppliers yet, so neither storage write policy from
--    20260719/20260726 covers them, and a listing application without photos
--    is most of the way to useless for the reviewer. This opens exactly one
--    prefix — media/listing-applications/... — to anonymous INSERT.
--
--    What that does and does not permit:
--      * insert only — no update, no delete, no overwriting anything that is
--        already there, and nothing outside this prefix.
--      * the bucket's own limits still apply: 50 MB per object and the
--        allowed_mime_types list (images, video, pdf) from 20260719.
--      * the `media` bucket is public-read, so an object here is world
--        readable once written — treat these as public photos, never as a
--        channel for documents an applicant would not publish.
--
--    It is still an unauthenticated write endpoint: a bot that finds it can
--    fill the bucket. Put the platform behind a rate limit / captcha before
--    this sees real traffic, or drop this policy and collect photos after the
--    supplier account exists (the form degrades to a "photos later" note on
--    its own when uploads fail).
-- ────────────────────────────────────────────────────────────────────────────
drop policy if exists "Applicants upload listing photos" on storage.objects;

create policy "Applicants upload listing photos" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'listing-applications'
  );
