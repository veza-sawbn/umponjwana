-- ============================================================================
-- Visit Drakensberg — Digital Waivers
--
-- Activity and Guided Tours suppliers build a waiver template, send it to the
-- participants on a booking, and receive the signed copies back in the portal.
--
-- Why dedicated tables rather than vd_entities:
--   Participants sign without an account. vd_entities has no safe way to let
--   an anonymous visitor read one row and write one row without opening the
--   whole table, so waivers get their own tables with no public policies at
--   all. The public path runs entirely through two SECURITY DEFINER functions
--   keyed on an unguessable token, which is the only surface anon can reach.
--
-- Signed waivers are legal records: they are immutable once submitted, and
-- the token grants access to exactly one request row, never a listing.
-- ============================================================================

-- ─── 1. Templates ───────────────────────────────────────────────────────────
create table if not exists vd_waiver_templates (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  intro         text not null default '',
  -- [{ id, text, required }] — each clause the participant must acknowledge
  clauses       jsonb not null default '[]'::jsonb,
  -- Which participant details to collect, e.g.
  -- { emergencyContact: true, medical: true, dateOfBirth: true }
  fields        jsonb not null default '{}'::jsonb,
  -- Participants under this age must be countersigned by a guardian.
  minor_age     int not null default 18,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists vd_waiver_templates_supplier_idx
  on vd_waiver_templates (supplier_id);

alter table vd_waiver_templates enable row level security;

drop policy if exists "Suppliers manage own waiver templates" on vd_waiver_templates;
drop policy if exists "Admins manage waiver templates"        on vd_waiver_templates;
drop policy if exists "Ops manage managed waiver templates"   on vd_waiver_templates;

create policy "Suppliers manage own waiver templates" on vd_waiver_templates
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

create policy "Admins manage waiver templates" on vd_waiver_templates
  for all using (is_admin()) with check (is_admin());

-- Operations staff reach a managed supplier's templates through the same
-- content permission that governs their other catalog edits.
create policy "Ops manage managed waiver templates" on vd_waiver_templates
  for all using (has_supplier_permission(supplier_id, 'manage_content'))
  with check (has_supplier_permission(supplier_id, 'manage_content'));

-- ─── 2. Requests — one per participant ──────────────────────────────────────
create table if not exists vd_waiver_requests (
  id                uuid primary key default gen_random_uuid(),
  -- Unguessable public handle. This is the participant's entire credential,
  -- so it is generated server-side and never derived from anything guessable.
  token             text not null unique,
  template_id       uuid not null references vd_waiver_templates(id) on delete restrict,
  supplier_id       uuid not null references auth.users(id) on delete cascade,
  participant_name  text not null default '',
  participant_email text not null default '',
  -- Free-text context shown to the participant, e.g. the tour and date.
  activity_name     text not null default '',
  service_date      date,
  booking_reference text,
  status            text not null default 'pending',
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint vd_waiver_requests_status_check
    check (status in ('pending', 'signed', 'expired', 'void'))
);
create index if not exists vd_waiver_requests_supplier_idx on vd_waiver_requests (supplier_id);
create index if not exists vd_waiver_requests_token_idx    on vd_waiver_requests (token);

alter table vd_waiver_requests enable row level security;

drop policy if exists "Suppliers manage own waiver requests" on vd_waiver_requests;
drop policy if exists "Admins manage waiver requests"        on vd_waiver_requests;
drop policy if exists "Ops manage managed waiver requests"   on vd_waiver_requests;

create policy "Suppliers manage own waiver requests" on vd_waiver_requests
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

create policy "Admins manage waiver requests" on vd_waiver_requests
  for all using (is_admin()) with check (is_admin());

create policy "Ops manage managed waiver requests" on vd_waiver_requests
  for all using (has_supplier_permission(supplier_id, 'view_customers'))
  with check (has_supplier_permission(supplier_id, 'manage_customers'));

-- NOTE: no anon policy. Participants never touch this table directly —
-- vd_waiver_open() below is their only read path.

-- ─── 3. Submissions — the signed record ─────────────────────────────────────
create table if not exists vd_waiver_submissions (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid not null unique references vd_waiver_requests(id) on delete cascade,
  supplier_id    uuid not null references auth.users(id) on delete cascade,
  -- Answers to the configured participant fields.
  answers        jsonb not null default '{}'::jsonb,
  -- Clause id -> true. Stored per clause so a later template edit cannot
  -- retroactively change what this participant actually agreed to.
  acknowledged   jsonb not null default '{}'::jsonb,
  -- Snapshot of the template as presented, for the same reason.
  template_snapshot jsonb not null default '{}'::jsonb,
  signed_name    text not null,
  -- Drawn signature as a data URL, when the participant drew rather than typed.
  signature_data text,
  guardian_name  text,
  signed_at      timestamptz not null default now(),
  ip_address     text,
  user_agent     text
);
create index if not exists vd_waiver_submissions_supplier_idx
  on vd_waiver_submissions (supplier_id);

alter table vd_waiver_submissions enable row level security;

drop policy if exists "Suppliers read own waiver submissions" on vd_waiver_submissions;
drop policy if exists "Admins read waiver submissions"        on vd_waiver_submissions;
drop policy if exists "Ops read managed waiver submissions"   on vd_waiver_submissions;

-- Read-only for everyone, including the supplier: a signed waiver is a legal
-- record. Inserts happen only through vd_waiver_submit() below, and there is
-- no update or delete policy at all.
create policy "Suppliers read own waiver submissions" on vd_waiver_submissions
  for select using (supplier_id = auth.uid());

create policy "Admins read waiver submissions" on vd_waiver_submissions
  for select using (is_admin());

create policy "Ops read managed waiver submissions" on vd_waiver_submissions
  for select using (has_supplier_permission(supplier_id, 'view_customers'));

-- ─── 4. Public read: open a waiver by token ─────────────────────────────────
-- Returns only what the participant needs to complete the form. Deliberately
-- excludes supplier_id, the token itself, and anything about other requests.
create or replace function public.vd_waiver_open(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  t record;
  v_signed boolean;
begin
  select * into r from vd_waiver_requests where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

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
end;
$$;
grant execute on function public.vd_waiver_open(text) to anon, authenticated;

-- ─── 5. Public write: submit a signed waiver ────────────────────────────────
-- The only way a row reaches vd_waiver_submissions. Re-validates the token,
-- refuses a second submission, and snapshots the template as presented.
create or replace function public.vd_waiver_submit(
  p_token         text,
  p_answers       jsonb,
  p_acknowledged  jsonb,
  p_signed_name   text,
  p_signature     text default null,
  p_guardian_name text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  t record;
  v_id uuid;
begin
  if coalesce(trim(p_signed_name), '') = '' then
    raise exception 'A signature name is required.';
  end if;

  select * into r from vd_waiver_requests where token = p_token for update;
  if not found then raise exception 'This waiver link is not valid.'; end if;
  if r.status = 'void' then raise exception 'This waiver has been withdrawn.'; end if;
  if r.status = 'signed' then raise exception 'This waiver has already been signed.'; end if;
  if r.expires_at is not null and r.expires_at < now() then
    raise exception 'This waiver link has expired.';
  end if;
  if exists (select 1 from vd_waiver_submissions where request_id = r.id) then
    raise exception 'This waiver has already been signed.';
  end if;

  select * into t from vd_waiver_templates where id = r.template_id;
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

  insert into vd_waiver_submissions (
    request_id, supplier_id, answers, acknowledged, template_snapshot,
    signed_name, signature_data, guardian_name
  ) values (
    r.id, r.supplier_id, coalesce(p_answers, '{}'::jsonb),
    coalesce(p_acknowledged, '{}'::jsonb),
    jsonb_build_object(
      'title', t.title, 'intro', t.intro,
      'clauses', t.clauses, 'fields', t.fields, 'minorAge', t.minor_age
    ),
    trim(p_signed_name), p_signature, nullif(trim(coalesce(p_guardian_name, '')), '')
  )
  returning id into v_id;

  update vd_waiver_requests
     set status = 'signed', updated_at = now()
   where id = r.id;

  return jsonb_build_object('ok', true, 'submissionId', v_id);
end;
$$;
grant execute on function public.vd_waiver_submit(text, jsonb, jsonb, text, text, text)
  to anon, authenticated;

-- ─── 6. Supplier view: requests with their signed status ────────────────────
create or replace view vd_waiver_request_details as
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
    s.guardian_name
  from vd_waiver_requests r
  join vd_waiver_templates t on t.id = r.template_id
  left join vd_waiver_submissions s on s.request_id = r.id;
