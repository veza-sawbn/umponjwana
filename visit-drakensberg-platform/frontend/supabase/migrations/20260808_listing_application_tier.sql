-- ============================================================================
-- Visit Drakensberg — Commission tier on listing applications
-- Run AFTER 20260807_listing_applications.sql.
--
-- The public form now asks an applicant which commission tier they want
-- (12% floor → 30% ceiling, see COMMISSION_TIERS in lib/listing-applications.ts).
-- The whole selection already rides along inside `value`; this mirrors it into
-- a column so the review queue can sort and filter on it like the other
-- mirrored fields.
--
-- What this column is NOT: a rate anything charges. Commission is enforced
-- server-side from vd_supplier_terms, which only an admin can write, and the
-- ledger reads it from there (see 20260716_order_management.sql). This is the
-- tier the applicant *asked for*, recorded so the reviewer can honour it —
-- or not — when they set the real terms on approval.
--
-- Likewise the tier's commercial rules the form has an applicant accept — a
-- rate increase applying immediately to new bookings, a reduction needing
-- notice and a 90-day minimum hold, neither ever touching bookings already
-- confirmed — are captured as consent here. Nothing in the finance layer
-- enforces them yet; that is effective-dated supplier terms, and it does not
-- exist.
-- ============================================================================

alter table vd_listing_applications
  add column if not exists commission_tier text not null default '';

create index if not exists vd_listing_applications_tier_idx
  on vd_listing_applications (commission_tier);
