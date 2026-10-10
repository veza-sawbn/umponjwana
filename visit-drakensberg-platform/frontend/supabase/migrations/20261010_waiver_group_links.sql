-- ============================================================================
-- Visit Drakensberg — Shareable group waiver links
--
-- Run AFTER 20260816_waivers.sql and 20260817_view_security_invoker.sql.
--
-- Until now a waiver reached a participant only by the supplier typing their
-- name and email into /supplier/waivers and the platform mailing them a
-- personal link. For a trip with a busload of guests the supplier rarely has
-- everyone's email, so this adds one link per trip that the supplier can drop
-- into a WhatsApp group, print as a QR code at the meeting point, or paste
-- into their own booking confirmation. Anyone holding it can fill in and sign
-- the waiver for that trip, as many times as there are people.
--
-- How it fits the existing model:
--   * vd_waiver_links holds the trip context (form, activity, date, booking
--     reference, expiry) and its own unguessable token.
--   * Each signature through a link creates an ordinary vd_waiver_requests
--     row (link_id set, status 'signed') plus its vd_waiver_submissions row,
--     in one transaction. Every existing supplier view, the signed-waiver
--     panel, the ops register and the "waiver signed" notification trigger
--     therefore work unchanged.
--   * As before, anon touches no table. vd_waiver_open() learns to recognise
--     a link token, and vd_waiver_link_submit() is the only write path.
--
-- Abuse limits: the link can be closed by the supplier at any time, it
-- honours an optional expiry, and an optional signature cap (sized to the
-- group) is enforced under a row lock so concurrent signers can't overshoot.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

-- ─── 1. Links — one per trip ────────────────────────────────────────────────
create table if not exists vd_waiver_links (
  id                uuid primary key default gen_random_uuid(),
  -- Unguessable public handle, same strength as a request token.
  token             text not null unique,
  template_id       uuid not null references vd_waiver_templates(id) on delete restrict,
  supplier_id       uuid not null references auth.users(id) on delete cascade,
  activity_name     text not null default '',
  service_date      date,
  booking_reference text,
  expires_at        timestamptz,
  -- Null means no cap. Otherwise the link stops accepting signatures once
  -- this many have been recorded against it.
  max_signatures    int,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint vd_waiver_links_max_signatures_check
    check (max_signatures is null or max_signatures between 1 and 1000)
);
create index if not exists vd_waiver_links_supplier_idx on vd_waiver_links (supplier_id);

alter table vd_waiver_links enable row level security;

drop policy if exists "Suppliers manage own waiver links" on vd_waiver_links;
drop policy if exists "Admins manage waiver links"        on vd_waiver_links;
drop policy if exists "Ops manage managed waiver links"   on vd_waiver_links;

create policy "Suppliers manage own waiver links" on vd_waiver_links
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

create policy "Admins manage waiver links" on vd_waiver_links
  for all using (is_admin()) with check (is_admin());

-- Same permission split as vd_waiver_requests: seeing who a link went to is
-- customer data, creating or closing one is managing customers.
create policy "Ops manage managed waiver links" on vd_waiver_links
  for all using (has_supplier_permission(supplier_id, 'view_customers'))
  with check (has_supplier_permission(supplier_id, 'manage_customers'));

-- NOTE: no anon policy. vd_waiver_open() is the only public read path.

-- ─── 2. Requests remember which link produced them ──────────────────────────
-- on delete restrict: a signed waiver is a legal record and must not lose
-- its provenance because someone removed the link it came through.
alter table vd_waiver_requests
  add column if not exists link_id uuid references vd_waiver_links(id) on delete restrict;
create index if not exists vd_waiver_requests_link_idx
  on vd_waiver_requests (link_id) where link_id is not null;

-- ─── 3. Public read: a link token opens the form too ────────────────────────
-- Request tokens are looked up first, exactly as before. A token that isn't a
-- request is then tried as a link. Both are 64 hex characters drawn from two
-- random UUIDs, so the two spaces never meaningfully overlap.
create or replace function public.vd_waiver_open(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  l record;
  t record;
  v_signed boolean;
  v_count int;
begin
  select * into r from vd_waiver_requests where token = p_token;
  if found then
    if r.status = 'void' then
      return jsonb_build_object('ok', false, 'reason', 'void');
    end if;

    if r.expires_at is not null and r.expires_at < now() then
      return jsonb_build_object('ok', false, 'reason', 'expired');
    end if;

    select exists(select 1 from vd_waiver_submissions where request_id = r.id)
      into v_signed;
    if v_signed or r.status = 'signed' then
      return jsonb_build_object('ok', false, 'reason', 'already_signed');
    end if;

    select * into t from vd_waiver_templates where id = r.template_id;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'not_found');
    end if;

    return jsonb_build_object(
      'ok', true,
      'shared', false,
      'request', jsonb_build_object(
        'participantName', r.participant_name,
        'activityName',    r.activity_name,
        'serviceDate',     r.service_date,
        'bookingReference', r.booking_reference
      ),
      'template', jsonb_build_object(
        'title',    t.title,
        'intro',    t.intro,
        'clauses',  t.clauses,
        'fields',   t.fields,
        'minorAge', t.minor_age
      ),
      'supplierName', coalesce(
        (select full_name from profiles where id = r.supplier_id), ''
      )
    );
  end if;

  -- ── Shared group link ──
  select * into l from vd_waiver_links where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if not l.is_active then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;

  if l.expires_at is not null and l.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if l.max_signatures is not null then
    select count(*) into v_count from vd_waiver_requests where link_id = l.id;
    if v_count >= l.max_signatures then
      return jsonb_build_object('ok', false, 'reason', 'full');
    end if;
  end if;

  select * into t from vd_waiver_templates where id = l.template_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Deliberately no signature count or list of who has signed: a link is
  -- shared widely, and the people holding it must not learn about each other.
  return jsonb_build_object(
    'ok', true,
    'shared', true,
    'request', jsonb_build_object(
      'participantName', '',
      'activityName',    l.activity_name,
      'serviceDate',     l.service_date,
      'bookingReference', l.booking_reference
    ),
    'template', jsonb_build_object(
      'title',    t.title,
      'intro',    t.intro,
      'clauses',  t.clauses,
      'fields',   t.fields,
      'minorAge', t.minor_age
    ),
    'supplierName', coalesce(
      (select full_name from profiles where id = l.supplier_id), ''
    )
  );
end;
$$;
grant execute on function public.vd_waiver_open(text) to anon, authenticated;

-- ─── 4. Public write: sign through a group link ─────────────────────────────
-- Creates the participant's request row and their submission together. The
-- link row is locked for the duration so the signature cap holds under
-- concurrent signers.
create or replace function public.vd_waiver_link_submit(
  p_token             text,
  p_participant_email text,
  p_answers           jsonb,
  p_acknowledged      jsonb,
  p_signed_name       text,
  p_signature         text default null,
  p_guardian_name     text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record;
  t record;
  v_email text := lower(trim(coalesce(p_participant_email, '')));
  v_name  text := trim(coalesce(p_signed_name, ''));
  v_count int;
  v_request_id uuid;
  v_submission_id uuid;
begin
  if v_name = '' then
    raise exception 'A signature name is required.';
  end if;
  if length(v_name) > 200 then
    raise exception 'That name is too long.';
  end if;
  if v_email <> '' and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Please enter a valid email address.';
  end if;
  -- The link is public, so bound what one anonymous call can store. A drawn
  -- signature PNG is normally well under 100 KB.
  if p_signature is not null and length(p_signature) > 500000 then
    raise exception 'That signature is too large. Please clear it and sign again.';
  end if;
  if p_answers is not null and length(p_answers::text) > 20000 then
    raise exception 'Your answers are too long.';
  end if;

  select * into l from vd_waiver_links where token = p_token for update;
  if not found then raise exception 'This waiver link is not valid.'; end if;
  if not l.is_active then raise exception 'This waiver link has been closed.'; end if;
  if l.expires_at is not null and l.expires_at < now() then
    raise exception 'This waiver link has expired.';
  end if;

  if l.max_signatures is not null then
    select count(*) into v_count from vd_waiver_requests where link_id = l.id;
    if v_count >= l.max_signatures then
      raise exception 'This waiver link has reached its signature limit.';
    end if;
  end if;

  select * into t from vd_waiver_templates where id = l.template_id;
  if not found then raise exception 'This waiver form is no longer available.'; end if;

  -- Every clause marked required must be acknowledged.
  if exists (
    select 1
      from jsonb_array_elements(t.clauses) as c
     where coalesce((c->>'required')::boolean, true)
       and coalesce((p_acknowledged->>(c->>'id'))::boolean, false) is not true
  ) then
    raise exception 'All required clauses must be accepted.';
  end if;

  insert into vd_waiver_requests (
    token, template_id, supplier_id, link_id,
    participant_name, participant_email,
    activity_name, service_date, booking_reference,
    status, expires_at
  ) values (
    -- The request's own token is never handed out (the participant signs in
    -- this same call), but the column is unique and not null.
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    l.template_id, l.supplier_id, l.id,
    v_name, v_email,
    l.activity_name, l.service_date, l.booking_reference,
    'signed', null
  )
  returning id into v_request_id;

  insert into vd_waiver_submissions (
    request_id, supplier_id, answers, acknowledged, template_snapshot,
    signed_name, signature_data, guardian_name
  ) values (
    v_request_id, l.supplier_id, coalesce(p_answers, '{}'::jsonb),
    coalesce(p_acknowledged, '{}'::jsonb),
    jsonb_build_object(
      'title', t.title, 'intro', t.intro,
      'clauses', t.clauses, 'fields', t.fields, 'minorAge', t.minor_age
    ),
    v_name, p_signature, nullif(trim(coalesce(p_guardian_name, '')), '')
  )
  returning id into v_submission_id;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id);
end;
$$;
revoke all on function public.vd_waiver_link_submit(text, text, jsonb, jsonb, text, text, text) from public;
grant execute on function public.vd_waiver_link_submit(text, text, jsonb, jsonb, text, text, text)
  to anon, authenticated;

-- ─── 5. Supplier views ──────────────────────────────────────────────────────
-- link_id appended (create or replace view may only add columns at the end).
create or replace view vd_waiver_request_details
  with (security_invoker = on) as
  select
    r.id,
    r.token,
    r.template_id,
    r.supplier_id,
    r.participant_name,
    r.participant_email,
    r.activity_name,
    r.service_date,
    r.booking_reference,
    r.status,
    r.expires_at,
    r.created_at,
    t.title            as template_title,
    s.id               as submission_id,
    s.signed_name,
    s.signed_at,
    s.guardian_name,
    r.link_id
  from vd_waiver_requests r
  join vd_waiver_templates t on t.id = r.template_id
  left join vd_waiver_submissions s on s.request_id = r.id;
revoke all on public.vd_waiver_request_details from anon;

-- Links with how many people have signed through each.
create or replace view vd_waiver_link_details
  with (security_invoker = on) as
  select
    l.id,
    l.token,
    l.template_id,
    l.supplier_id,
    l.activity_name,
    l.service_date,
    l.booking_reference,
    l.expires_at,
    l.max_signatures,
    l.is_active,
    l.created_at,
    t.title as template_title,
    (select count(*) from vd_waiver_requests r where r.link_id = l.id)::int as signature_count
  from vd_waiver_links l
  join vd_waiver_templates t on t.id = l.template_id;
revoke all on public.vd_waiver_link_details from anon;

-- Supabase's default privileges already grant these; stated so a database
-- built without them (and the SQL test harness) matches production.
grant select, insert, update on vd_waiver_links to authenticated;
grant select on public.vd_waiver_request_details, public.vd_waiver_link_details to authenticated;
