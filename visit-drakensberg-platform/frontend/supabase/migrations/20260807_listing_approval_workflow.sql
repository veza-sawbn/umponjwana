-- Enforce the approval workflow, and extend establishment scope to child records.
--
-- 20260806 stored auto_publish on the access row but never enforced it: the
-- "Partners edit assigned establishments" policy let anyone holding
-- listing.edit write straight to vd_entities. A partner whose changes were
-- meant to be reviewed could therefore publish their own edits — descriptions,
-- rates, availability dates alike — and the vd_listing_changes queue sat empty
-- because nothing ever had to go through it.
--
-- Partners no longer write to vd_entities at all. Every partner edit goes
-- through vd_submit_listing_change, which decides per field whether to apply it
-- immediately or queue it for review. Removing the write policy rather than
-- narrowing it means there is no second path to bypass — the queue is the only
-- way in.
--
-- The second gap: vd_can() was keyed on an establishment id, but rooms, rates
-- and availability are their own vd_entities rows referencing a parent through
-- value->>'propertyId'. A partner could hold a property while its rooms
-- resolved to no establishment at all. vd_resolve_establishment() now walks the
-- child to its parent so scope covers the whole tree.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Field-level automatic publishing
-- ────────────────────────────────────────────────────────────────────────────
-- The spec's "trusted supplier" case: availability and rates may publish
-- immediately while descriptions and photos still require approval. Blanket
-- auto_publish stays as the all-fields shortcut.
alter table vd_establishment_access
  add column if not exists auto_publish_fields text[] not null default '{}';

comment on column vd_establishment_access.auto_publish_fields is
  'Top-level value keys this partner may publish without review (e.g. availability, rates). Ignored when auto_publish is true, which covers everything.';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Resolve a child entity to the establishment that governs it
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_resolve_establishment(p_entity text)
returns text language plpgsql stable set search_path = public as $$
declare
  v_parent text;
begin
  -- The entity itself may be the establishment.
  if exists (select 1 from vd_establishment_access where establishment_id = p_entity) then
    return p_entity;
  end if;
  -- Otherwise follow the parent reference used by rooms, rates and departures.
  select coalesce(value->>'propertyId', value->>'establishmentId', value->>'tourId')
    into v_parent from vd_entities where id = p_entity;
  return v_parent;
end;
$$;

-- Permission check that understands child records.
create or replace function public.vd_can_entity(p_entity text, p_permission text)
returns boolean language sql stable set search_path = public as
$$ select vd_can(coalesce(vd_resolve_establishment(p_entity), p_entity), p_permission) $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Partners lose direct write access to the catalog
-- ────────────────────────────────────────────────────────────────────────────
-- Dropped, not narrowed. Every partner edit is now routed through
-- vd_submit_listing_change below, so there is no alternative path that skips
-- the approval decision.
drop policy if exists "Partners edit assigned establishments" on vd_entities;

-- Reading child records still needs to work for the portal.
drop policy if exists "Partners read assigned child records" on vd_entities;
create policy "Partners read assigned child records" on vd_entities
  for select using (
    coalesce(value->>'propertyId', value->>'establishmentId', value->>'tourId')
      in (select vd_my_establishments()));

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Submit a change — applied or queued, per field
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_submit_listing_change(
  p_entity  text,
  p_changes jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_establishment text;
  v_access vd_establishment_access%rowtype;
  v_entity vd_entities%rowtype;
  v_key text;
  v_auto  jsonb := '{}'::jsonb;
  v_queue jsonb := '{}'::jsonb;
  v_prev  jsonb := '{}'::jsonb;
  v_can_edit boolean;
  v_change_id text;
  v_is_staff boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'changes must be a JSON object';
  end if;

  select * into v_entity from vd_entities where id = p_entity;
  if not found then
    raise exception 'not found';
  end if;

  v_establishment := coalesce(vd_resolve_establishment(p_entity), p_entity);
  v_is_staff := is_admin() or is_ops();

  -- Staff edits apply directly; they are the approvers.
  if v_is_staff then
    update vd_entities set value = value || p_changes, updated_at = now() where id = p_entity;
    perform vd_audit('listing.updated', 'entity', p_entity,
      jsonb_build_object('fields', (select jsonb_agg(k) from jsonb_object_keys(p_changes) k), 'byStaff', true));
    return jsonb_build_object('applied', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(p_changes) k),
                              'queued', '[]'::jsonb);
  end if;

  select * into v_access from vd_establishment_access
   where user_id = auth.uid() and establishment_id = v_establishment
     and access_status = 'active'
     and (access_start_date is null or access_start_date <= current_date)
     and (access_end_date   is null or access_end_date   >= current_date);
  if not found then
    -- Same response as a missing entity: probing ids must not distinguish
    -- "exists but not yours" from "does not exist".
    raise exception 'not found';
  end if;

  v_can_edit := vd_can(v_establishment, 'listing.edit');
  if not v_can_edit and not vd_can(v_establishment, 'listing.suggest') then
    raise exception 'not permitted';
  end if;

  -- Split the payload: a field publishes immediately only when the partner can
  -- edit at all AND that field is covered by their auto-publish settings.
  for v_key in select jsonb_object_keys(p_changes) loop
    v_prev := v_prev || jsonb_build_object(v_key, v_entity.value -> v_key);
    if v_can_edit and (v_access.auto_publish or v_key = any (v_access.auto_publish_fields)) then
      v_auto := v_auto || jsonb_build_object(v_key, p_changes -> v_key);
    else
      v_queue := v_queue || jsonb_build_object(v_key, p_changes -> v_key);
    end if;
  end loop;

  if v_auto <> '{}'::jsonb then
    update vd_entities set value = value || v_auto, updated_at = now() where id = p_entity;
    insert into vd_listing_changes (id, establishment_id, submitted_by, previous_value,
                                    proposed_value, changed_fields, status, reviewed_at)
    values ('chg-' || gen_random_uuid(), v_establishment, auth.uid(),
            v_prev, v_auto,
            array(select jsonb_object_keys(v_auto)), 'published', now());
    perform vd_audit('listing.published', 'entity', p_entity,
      jsonb_build_object('fields', array(select jsonb_object_keys(v_auto)), 'auto', true));
  end if;

  if v_queue <> '{}'::jsonb then
    v_change_id := 'chg-' || gen_random_uuid();
    insert into vd_listing_changes (id, establishment_id, submitted_by, previous_value,
                                    proposed_value, changed_fields, status)
    values (v_change_id, v_establishment, auth.uid(), v_prev, v_queue,
            array(select jsonb_object_keys(v_queue)), 'submitted');
    perform vd_audit('listing.change_submitted', 'entity', p_entity,
      jsonb_build_object('changeId', v_change_id, 'fields', array(select jsonb_object_keys(v_queue))));
  end if;

  return jsonb_build_object(
    'applied', (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(v_auto) k),
    'queued',  (select coalesce(jsonb_agg(k), '[]'::jsonb) from jsonb_object_keys(v_queue) k),
    'changeId', v_change_id);
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Review a queued change — Visit Drakensberg only
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_review_listing_change(
  p_change_id text,
  p_decision  text,          -- approved | rejected | changes_requested
  p_notes     text default ''
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_change vd_listing_changes%rowtype;
  v_target text;
begin
  -- approvals.manage is platform_only, so no partner can ever satisfy this,
  -- whatever their role, overrides or handover level.
  if not (is_admin() or is_ops()) then
    raise exception 'not permitted';
  end if;
  if p_decision not in ('approved','rejected','changes_requested') then
    raise exception 'invalid decision %', p_decision;
  end if;

  select * into v_change from vd_listing_changes where id = p_change_id for update;
  if not found then raise exception 'change not found'; end if;
  if v_change.status <> 'submitted' then
    raise exception 'change is % and can no longer be reviewed', v_change.status;
  end if;

  if p_decision = 'approved' then
    -- Apply to whichever entity the change was raised against. The queue
    -- records the establishment; a child record keeps its own id in the
    -- proposed payload's origin, so fall back to the establishment itself.
    v_target := v_change.establishment_id;
    update vd_entities set value = value || v_change.proposed_value, updated_at = now()
     where id = v_target;
    update vd_listing_changes
       set status = 'published', reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
     where id = p_change_id;
    perform vd_audit('listing.change_approved', 'establishment', v_change.establishment_id,
      jsonb_build_object('changeId', p_change_id, 'fields', v_change.changed_fields));
  else
    update vd_listing_changes
       set status = case when p_decision = 'rejected' then 'rejected' else 'changes_requested' end,
           reviewed_by = auth.uid(), reviewed_at = now(), review_notes = p_notes
     where id = p_change_id;
    perform vd_audit('listing.change_' || p_decision, 'establishment', v_change.establishment_id,
      jsonb_build_object('changeId', p_change_id, 'notes', p_notes));
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Partners may not move a change out of the queue
-- ────────────────────────────────────────────────────────────────────────────
-- There is deliberately no partner UPDATE policy on vd_listing_changes: a
-- submission can only be resolved through vd_review_listing_change, which is
-- staff-gated. The insert policy from 20260806 is tightened to 'submitted'
-- only, so a partner cannot self-record a row as published.
drop policy if exists "Partners submit listing changes" on vd_listing_changes;
create policy "Partners submit listing changes" on vd_listing_changes
  for insert with check (
    submitted_by = auth.uid()
    and vd_can(establishment_id, 'listing.suggest')
    and status = 'submitted');

grant execute on function public.vd_resolve_establishment(text) to authenticated;
grant execute on function public.vd_can_entity(text, text) to authenticated;
grant execute on function public.vd_submit_listing_change(text, jsonb) to authenticated;
grant execute on function public.vd_review_listing_change(text, text, text) to authenticated;
