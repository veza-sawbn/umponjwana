-- ============================================================================
-- Visit Drakensberg — supplier rates are fractions, enforce it
--
-- Run AFTER 20261009_grand_tour_features.sql.
--
-- vd_supplier_terms.commission_rate and platform_fee_rate are fractions:
-- vd_create_order() charges round(net * rate, 2), and the listing-application
-- approval route stores 0.12 for 12%. The managed-supplier admin form saved
-- what the admin typed instead, so "30" (meaning 30%) sat in the table as a
-- 3000% commission. No order was created against those rows before this
-- fix, so only the terms need repairing.
--
-- 1. Rows at or above 1 can only be percentages typed into that form (a
--    100%+ commission or fee is meaningless), so divide them by 100.
-- 2. Check constraints keep any future writer — form, script or SQL — from
--    storing a percentage again.
-- ============================================================================
-- @rollback: reversible — alter table vd_supplier_terms drop constraint vd_supplier_terms_commission_rate_fraction, drop constraint vd_supplier_terms_platform_fee_rate_fraction; (the repaired values stay repaired)

update vd_supplier_terms
   set commission_rate = commission_rate / 100, updated_at = now()
 where commission_rate >= 1;

update vd_supplier_terms
   set platform_fee_rate = platform_fee_rate / 100, updated_at = now()
 where platform_fee_rate >= 1;

alter table vd_supplier_terms
  drop constraint if exists vd_supplier_terms_commission_rate_fraction,
  drop constraint if exists vd_supplier_terms_platform_fee_rate_fraction;

alter table vd_supplier_terms
  add constraint vd_supplier_terms_commission_rate_fraction
    check (commission_rate is null or (commission_rate >= 0 and commission_rate < 1)),
  add constraint vd_supplier_terms_platform_fee_rate_fraction
    check (platform_fee_rate is null or (platform_fee_rate >= 0 and platform_fee_rate < 1));
