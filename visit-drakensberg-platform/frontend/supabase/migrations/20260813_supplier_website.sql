-- ============================================================================
-- Visit Drakensberg — Add website column to supplier profiles
--
-- The supplier management UI exposes a website field on the detail panel.
-- This migration adds the backing column and grants suppliers the ability
-- to update their own website URL.
-- ============================================================================

alter table profiles
  add column if not exists website text;

-- Allow authenticated users to update their own website
-- (joins the existing partial grant on profiles)
grant update (website) on profiles to authenticated;
