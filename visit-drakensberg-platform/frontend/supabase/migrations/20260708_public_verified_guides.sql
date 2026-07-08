-- Run this in the Supabase SQL editor.
--
-- Verified supplier guides must be publicly visible: the guide rosters on
-- /guides, /guides/operators/[id] and the operator matching on
-- /experiences/request all read `supplier_guides` rows whose status is
-- 'verified'. The public-read policy from 20260704_secure_data_layer.sql
-- only covered 'active' / 'open' / 'confirmed' / 'full', so verified guides
-- were hidden from everyone except the supplier who owns them.

drop policy if exists "Public entities are readable" on vd_entities;
create policy "Public entities are readable" on vd_entities
  for select using (status in ('active', 'open', 'confirmed', 'full', 'verified'));
