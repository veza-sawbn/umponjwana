-- ============================================================================
-- Visit Drakensberg — Company billing details on invoice drafts
-- Run AFTER 20261014_order_customer_details.sql.
--
-- The New Invoice form can now bill a company (name, VAT number, registration
-- number, billing address). Drafts keep those details here until the draft is
-- issued, at which point they are written to the order through
-- vd_update_order_customer like any other customer correction.
--
-- Shape: { "isCompany": bool, "company": text, "vatNumber": text,
--          "registrationNumber": text, "address": text }
-- Null = an individual with no billing address.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

alter table vd_invoice_drafts add column if not exists customer_billing jsonb;
