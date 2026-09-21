-- ============================================================================
-- Visit Drakensberg — two least-privilege corrections
--
-- Run AFTER 20260913_media_bucket_no_active_content.sql.
--
-- Audit findings L3 and L4. Both are small, and both are the same shape: a
-- grant that is wider than the thing it was written for.
--
-- ────────────────────────────────────────────────────────────────────────────
-- L3 — a user could rewrite their own notification address
-- ────────────────────────────────────────────────────────────────────────────
-- 20260704_secure_data_layer.sql is careful about this table. It revokes the
-- blanket UPDATE and grants back only the contact fields, precisely so a user
-- cannot set their own role, is_approved or loyalty_points:
--
--   grant update (full_name, phone, avatar_url, bio, email, supplier_type)
--     on profiles to authenticated;
--
-- But `email` is not a contact field like the others. It is the address
-- notify-server.ts and /api/notifications/email resolve a recipient to, and
-- the one /api/admin/recover-admin now looks an account up by. A user who
-- edits it redirects their own platform mail to an address they may not
-- control — and, set to a colleague's address, quietly collects a second copy
-- of that colleague's notifications.
--
-- Nothing in the app writes it from a user session: every write goes through
-- the service-role client in app/api/admin/* (which bypasses column grants),
-- and the authoritative address lives in auth.users anyway, changed through
-- Supabase's own verified email-change flow. So the grant is simply removed.
--
-- ────────────────────────────────────────────────────────────────────────────
-- L4 — a suspended supplier could still edit their catalogue
-- ────────────────────────────────────────────────────────────────────────────
-- The insert policy on vd_entities requires an approved supplier; the update
-- policy asks only about ownership:
--
--   create policy "Suppliers insert own" on vd_entities
--     for insert with check (owner_id = auth.uid() and is_active_supplier());
--   create policy "Owners update own" on vd_entities
--     for update using (owner_id = auth.uid());
--
-- So an operator whose approval was revoked could no longer create a listing
-- but could still rewrite every existing one — prices, descriptions, contact
-- details — and flip its status.
--
-- 20260906_suspension_hides_listings.sql already keeps a suspended supplier's
-- rows off the public catalogue, so this was never a route to publishing to
-- visitors. It is a write they should not have, on rows staff are reviewing,
-- while they are suspended.
--
-- The update policy now matches the insert policy. Admins are unaffected
-- ("Admins write all"), and so are ops employees managing a supplier
-- ("Managed ops agents update entities"), both of which are separate policies
-- — RLS ORs them together, so tightening this one narrows only the owner's own
-- path.
-- ============================================================================
-- @rollback: reversible — grant update (email) on profiles to authenticated; and restore the "Owners update own" policy from 20260704_secure_data_layer.sql

-- ── L3 ──────────────────────────────────────────────────────────────────────
revoke update (email) on profiles from authenticated;

-- ── L4 ──────────────────────────────────────────────────────────────────────
drop policy if exists "Owners update own" on vd_entities;

create policy "Owners update own" on vd_entities
  for update
  using (owner_id = auth.uid() and is_active_supplier())
  -- Explicit WITH CHECK as well as USING. Without one Postgres reuses USING
  -- for the new row, which happens to be right here — but stating it means a
  -- later edit to USING cannot silently change what the row may become.
  with check (owner_id = auth.uid() and is_active_supplier());
