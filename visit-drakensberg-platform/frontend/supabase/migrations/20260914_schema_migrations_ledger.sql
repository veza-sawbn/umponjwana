-- ============================================================================
-- Visit Drakensberg — A ledger of what has actually been applied
--
-- Run AFTER 20260914_inventory_holds.sql. This is the one migration that must
-- be applied by hand; scripts/migrate.sh applies every later one and records
-- it here.
--
-- Audit finding M6.
--
-- ────────────────────────────────────────────────────────────────────────────
-- THE PROBLEM
-- ────────────────────────────────────────────────────────────────────────────
-- Every migration in this directory carries a header telling a human to run it
-- in the Supabase SQL editor, and several sequence themselves in prose ("Run
-- AFTER 20260809_…"). Nothing records what was applied, to which environment,
-- when, or by whom. The consequences were all visible in this codebase before
-- anyone went looking for them:
--
--   * 20260823_blog_author_fields.sql fails outright against a database built
--     from the migrations alone — it alters blog_posts, which only
--     supabase/schema.sql creates. Nothing said so; the audit found it by
--     loading everything into an empty database.
--
--   * app/api/payments/ikhokha/create/route.ts contains isMissingTipColumn(),
--     which pattern-matches PostgREST error strings to detect that
--     20260806_activity_tips.sql has not been run, and degrades the payment
--     flow accordingly. That function is load-bearing RUNTIME code whose only
--     job is to survive an unapplied migration.
--
--   * Re-running a migration by hand is the normal recovery from "did that
--     one go through?", so every migration has had to be written idempotent.
--     That is a good habit, but it has been doing the job a ledger should.
--
-- ────────────────────────────────────────────────────────────────────────────
-- WHAT THIS GIVES
-- ────────────────────────────────────────────────────────────────────────────
-- One table, and a checksum. scripts/migrate.sh applies pending migrations in
-- filename order inside a transaction each, records the filename, its SHA-256
-- and the wall-clock duration, and refuses to run if a file that was already
-- applied no longer matches its recorded checksum — because editing an applied
-- migration means production and the repository disagree about what the schema
-- is, and finding that out later is how a deploy takes the site down.
--
-- Deliberately NOT a full framework. There is no down-migration column,
-- because most of these genuinely cannot be reversed and a column implying
-- otherwise would be a lie. Rollback intent is declared in each migration's
-- header instead, in the @rollback tag the runner checks for — see
-- docs/security/RESILIENCE_RUNBOOK.md §3.2.
-- ============================================================================
-- @rollback: reversible — drop table vd_schema_migrations;

create table if not exists vd_schema_migrations (
  filename    text primary key,
  checksum    text not null,
  applied_at  timestamptz not null default now(),
  -- Who ran it. Null for a service-role connection, which is how CI and the
  -- runner connect; useful when it was a person in the SQL editor.
  applied_by  uuid,
  duration_ms int
);

alter table vd_schema_migrations enable row level security;

drop policy if exists "Staff read schema migrations" on vd_schema_migrations;

-- Readable by staff so the console can show schema state; writable only by
-- the service role (the runner), which bypasses RLS.
--
-- Guarded on is_ops() existing, because this is the ONE migration applied by
-- hand to a brand-new database — before 20260716_order_management.sql, which
-- defines that function. Without the guard this file cannot bootstrap an
-- empty database at all, which is exactly the case it has to work in. On a
-- fresh database the table starts with RLS on and no read policy, which is
-- the safe state; re-running this file after the rest of the migrations have
-- landed adds the policy.
do $$
begin
  if to_regprocedure('public.is_ops()') is not null then
    execute 'create policy "Staff read schema migrations" on vd_schema_migrations
               for select using (is_ops())';
  end if;
end $$;

/**
 * Backfill: on a database that already carries this schema, everything in
 * this directory up to and including this migration is by definition already
 * applied. Recording them with the sentinel checksum 'pre-ledger' means the
 * runner skips them rather than trying to re-apply a year of history — and
 * the sentinel is distinguishable from a real checksum, so nobody mistakes
 * these rows for verified ones.
 *
 * GUARDED on vd_entities existing, which is the oldest table in the set
 * (20260704). Without that guard, applying this one file to an EMPTY database
 * would record 60 migrations as applied when none of them are, and the runner
 * would then cheerfully report "nothing pending" against a database with no
 * schema at all. On an empty database the backfill does nothing and every
 * migration is correctly pending.
 */
insert into vd_schema_migrations (filename, checksum, applied_at)
select unnest(array[
  '20260704_secure_data_layer.sql',
  '20260705_booking_orders.sql',
  '20260706_room_inventory.sql',
  '20260707_marketplace.sql',
  '20260708_public_verified_guides.sql',
  '20260709_supplier_moderation.sql',
  '20260716_order_management.sql',
  '20260718_guest_orders.sql',
  '20260718_transport_marketplace.sql',
  '20260719_media_storage.sql',
  '20260720_channel_connections.sql',
  '20260724_ikhokha_payments.sql',
  '20260725_business_quotes_roles.sql',
  '20260726_supplier_media.sql',
  '20260802_checkout_pending_payment.sql',
  '20260803_expire_pending_bookings.sql',
  '20260803_invoice_drafts_lines_edit.sql',
  '20260804_guest_orders_repair.sql',
  '20260805_admin_fee_tax_override.sql',
  '20260806_activity_tips.sql',
  '20260807_listing_applications.sql',
  '20260808_invoice_share_links.sql',
  '20260808_listing_application_tier.sql',
  '20260809_invoice_link_revocation.sql',
  '20260809_signup_role_hardening.sql',
  '20260810_invoice_open_by_id.sql',
  '20260811_delegated_management.sql',
  '20260811_invoice_payment_declined.sql',
  '20260812_void_invoice.sql',
  '20260813_supplier_website.sql',
  '20260814_entity_owner_backfill.sql',
  '20260815_approval_consistency.sql',
  '20260816_waivers.sql',
  '20260817_view_security_invoker.sql',
  '20260818_ops_write_permission_fix.sql',
  '20260819_ops_read_managed_supplier_profile.sql',
  '20260820_ops_delete_and_managed_media.sql',
  '20260821_departure_guests.sql',
  '20260822_booking_staff_assignment.sql',
  '20260823_blog_author_fields.sql',
  '20260824_customer_intelligence_foundation.sql',
  '20260825_email_campaign_foundation.sql',
  '20260826_supplier_contacts.sql',
  '20260827_supplier_contacts_import.sql',
  '20260828_journey_notifications.sql',
  '20260828_manual_guest_package_and_contacts.sql',
  '20260829_activity_timeslots.sql',
  '20260901_trip_requests_managed_supplier_access.sql',
  '20260902_stay_booking_requests.sql',
  '20260903_null_safe_admin_guards.sql',
  '20260904_layered_field_guide.sql',
  '20260905_supplier_compliance.sql',
  '20260906_suspension_hides_listings.sql',
  '20260912_orphan_entities_are_not_public.sql',
  '20260913_payment_authorization_and_idempotency.sql',
  '20260913_notification_provenance_and_seat_authorization.sql',
  '20260913_media_bucket_no_active_content.sql',
  '20260913_least_privilege_profiles_and_entities.sql',
  '20260914_inventory_holds.sql',
  '20260914_schema_migrations_ledger.sql'
]), 'pre-ledger', now()
where to_regclass('public.vd_entities') is not null
on conflict (filename) do nothing;
