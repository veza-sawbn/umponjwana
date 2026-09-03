-- ============================================================================
-- Visit Drakensberg — Supplier compliance, agreement acceptance, concerns
-- Run AFTER 20260904_layered_field_guide.sql.
--
-- Three things a supplier campaign cannot launch without, and none of which
-- existed:
--
--   1. Accreditation evidence. The verification office must see, for every
--      operator, either an up-to-date EDTEA tourism operator registration
--      certificate or proof of membership of a recognised Community Tourism
--      Organisation. Both arrive as a PDF certificate, both expire, and both
--      carry business registration detail that must never be world-readable
--      — so they get their own PRIVATE bucket rather than riding along in
--      `media`, which is public-read (20260719) and which the listing photo
--      policy in 20260807 deliberately limits to things an applicant would
--      publish. That comment is the reason this migration exists separately.
--
--   2. A record of what a supplier accepted, and which version. Commission
--      terms today live only as microcopy in the /list-with-us UI, and the
--      signup checkbox binds applicants to the *visitor* terms of use. An
--      append-only acceptance log is what makes a rate or a conduct rule
--      enforceable six months later.
--
--   3. A grievance channel. The Supplier Code requires suppliers to route
--      concerns somewhere; "somewhere" has to exist, be reachable without an
--      account, and allow anonymity, or the non-retaliation promise is
--      hollow.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. The private compliance bucket
--
--    public = false, so nothing here is served over a CDN URL. Every read
--    goes through createSignedUrl(), which requires a session that satisfies
--    the select policies below. 15 MB is generous for a scanned certificate
--    and small enough that the anonymous insert path can't be used to park
--    large files.
-- ────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance',
  'compliance',
  false,
  15728640, -- 15 MB
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Applicants upload compliance docs"  on storage.objects;
drop policy if exists "Suppliers upload own compliance"    on storage.objects;
drop policy if exists "Suppliers read own compliance"      on storage.objects;
drop policy if exists "Verification office reads all"      on storage.objects;
drop policy if exists "Admins manage compliance objects"   on storage.objects;

-- Pre-account applicants write into applications/<reference>/…
--
-- Insert only: no update, no delete, no overwrite, nothing outside the
-- prefix. Same unauthenticated-write caveat as the listing photo policy —
-- rate-limit the form before this sees campaign traffic. What is different,
-- and the point of the private bucket, is that a bot that finds this
-- endpoint can write but can never read: no select policy covers anon.
create policy "Applicants upload compliance docs" on storage.objects
  for insert with check (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = 'applications'
  );

-- Approved suppliers write and read only their own subtree.
create policy "Suppliers upload own compliance" on storage.objects
  for insert with check (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = 'suppliers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Suppliers read own compliance" on storage.objects
  for select using (
    bucket_id = 'compliance'
    and (storage.foldername(name))[1] = 'suppliers'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- The verification office: admins, finance and operations staff (is_ops()
-- from 20260716 already means exactly that set).
create policy "Verification office reads all" on storage.objects
  for select using (bucket_id = 'compliance' and is_ops());

create policy "Admins manage compliance objects" on storage.objects
  for all using (bucket_id = 'compliance' and is_admin())
  with check (bucket_id = 'compliance' and is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 2. The document registry
--
--    One row per uploaded certificate. The storage object is the evidence;
--    this row is what the verification office works from — who it belongs
--    to, what it claims, when it expires, and whether a human has actually
--    looked at it.
--
--    A document belongs to EITHER an application (pre-account, keyed by the
--    LP-xxxxxx reference) OR a supplier account. Never both, never neither.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_compliance_documents (
  id               text primary key,
  supplier_id      uuid references auth.users(id) on delete cascade,
  application_ref  text,

  doc_type         text not null,
  -- What the certificate says. issuer is the EDTEA office or the CTO's name;
  -- reference_number is the registration/membership number printed on it.
  issuer           text not null default '',
  reference_number text not null default '',
  issued_on        date,
  expires_on       date,

  -- The object in the private `compliance` bucket.
  storage_path     text not null,
  file_name        text not null default '',
  mime_type        text not null default '',
  byte_size        integer not null default 0,

  -- Verification office decision.
  review_status    text not null default 'pending',
  review_note      text not null default '',
  reviewed_by      uuid references auth.users(id) on delete set null,
  reviewed_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint vd_compliance_documents_owner_chk check (
    (supplier_id is not null and application_ref is null)
    or (supplier_id is null and application_ref is not null)
  ),
  constraint vd_compliance_documents_type_chk check (doc_type in (
    'edtea_registration',        -- KZN EDTEA tourism operator registration
    'cto_membership',            -- Community Tourism Organisation membership
    'public_liability_insurance',
    'company_registration',      -- CIPC
    'tax_clearance',
    'guide_registration',        -- CATHSSETA / provincial tourist guide
    'fire_compliance',           -- occupancy / fire clearance for stays
    'other'
  )),
  constraint vd_compliance_documents_review_chk check (
    review_status in ('pending', 'verified', 'rejected')
  )
);

create index if not exists vd_compliance_documents_supplier_idx
  on vd_compliance_documents (supplier_id);
create index if not exists vd_compliance_documents_application_idx
  on vd_compliance_documents (application_ref);
create index if not exists vd_compliance_documents_review_idx
  on vd_compliance_documents (review_status);
-- Drives the "expiring soon" queue without a full scan.
create index if not exists vd_compliance_documents_expiry_idx
  on vd_compliance_documents (expires_on)
  where expires_on is not null;

alter table vd_compliance_documents enable row level security;

drop policy if exists "Applicants lodge compliance docs"  on vd_compliance_documents;
drop policy if exists "Suppliers read own compliance docs" on vd_compliance_documents;
drop policy if exists "Suppliers lodge own compliance docs" on vd_compliance_documents;
drop policy if exists "Verification office reads docs"    on vd_compliance_documents;
drop policy if exists "Admins manage compliance docs"     on vd_compliance_documents;

-- Anonymous applicants may lodge a document against an application, and can
-- never read one back — not their own, not anyone's. The check pins
-- review_status so an applicant cannot self-verify on the way in, and pins
-- supplier_id to null so a lodged document can never be attached to somebody
-- else's account.
create policy "Applicants lodge compliance docs" on vd_compliance_documents
  for insert with check (
    review_status = 'pending'
    and supplier_id is null
    and application_ref is not null
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Suppliers lodge own compliance docs" on vd_compliance_documents
  for insert with check (
    supplier_id = auth.uid()
    and review_status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

create policy "Suppliers read own compliance docs" on vd_compliance_documents
  for select using (supplier_id = auth.uid());

create policy "Verification office reads docs" on vd_compliance_documents
  for select using (is_ops());

create policy "Admins manage compliance docs" on vd_compliance_documents
  for all using (is_admin()) with check (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Accreditation rule
--
--    "Up-to-date EDTEA operator registration OR CTO membership." Expressed
--    once, here, so the application form, the review queue and the approval
--    route cannot drift apart on what counts.
--
--    Verified-and-unexpired is the bar. A document with no expiry date is
--    treated as current — some CTO letters carry none — which is why the
--    review step matters: a human decides whether an undated letter is good
--    enough, and that decision is what this function reads.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_accreditation_ok(
  p_supplier_id uuid default null,
  p_application_ref text default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vd_compliance_documents d
    where d.doc_type in ('edtea_registration', 'cto_membership')
      and d.review_status = 'verified'
      and (d.expires_on is null or d.expires_on >= current_date)
      and (
        (p_supplier_id is not null and d.supplier_id = p_supplier_id)
        or (p_application_ref is not null and d.application_ref = p_application_ref)
      )
  )
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Agreement acceptance — append-only
--
--    Deliberately no update and no delete policy, for anybody, admins
--    included. A row here is evidence of what a named person accepted, from
--    what address, at what moment. Something that can be edited afterwards is
--    not evidence. Corrections are made by appending a newer acceptance.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_supplier_agreements (
  id              text primary key,
  supplier_id     uuid references auth.users(id) on delete set null,
  application_ref text,

  document        text not null,   -- 'supplier_terms' | 'code_of_conduct'
  version         text not null,   -- e.g. '2026-09-05'

  accepted_name   text not null default '',
  accepted_email  text not null default '',
  accepted_role   text not null default '',
  -- Commercial terms as shown at the moment of acceptance, so a later change
  -- to COMMISSION_TIERS cannot rewrite what somebody agreed to.
  accepted_terms  jsonb not null default '{}'::jsonb,
  user_agent      text not null default '',

  accepted_at     timestamptz not null default now(),

  constraint vd_supplier_agreements_document_chk check (
    document in ('supplier_terms', 'code_of_conduct')
  )
);

create index if not exists vd_supplier_agreements_supplier_idx
  on vd_supplier_agreements (supplier_id);
create index if not exists vd_supplier_agreements_application_idx
  on vd_supplier_agreements (application_ref);

alter table vd_supplier_agreements enable row level security;

drop policy if exists "Anyone records an acceptance"     on vd_supplier_agreements;
drop policy if exists "Suppliers read own acceptances"   on vd_supplier_agreements;
drop policy if exists "Verification office reads acceptances" on vd_supplier_agreements;

-- An applicant has no account yet, so the insert has to be open to anon with
-- supplier_id null — the same unauthenticated-write surface as
-- vd_listing_applications, and it wants the same rate limit in front of it
-- before campaign traffic arrives. A signed-in caller may only write an
-- acceptance against their own account, never somebody else's.
create policy "Anyone records an acceptance" on vd_supplier_agreements
  for insert with check (
    supplier_id is null or supplier_id = auth.uid()
  );

create policy "Suppliers read own acceptances" on vd_supplier_agreements
  for select using (supplier_id = auth.uid());

create policy "Verification office reads acceptances" on vd_supplier_agreements
  for select using (is_ops());


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Concerns — the grievance channel
--
--    Reachable without an account and anonymously by design: a worker at a
--    supplier, or a guest, must be able to report something without first
--    proving who they are. Nobody but the verification office can read these.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists vd_concerns (
  id             text primary key,
  reference      text not null,
  category       text not null default 'other',
  -- Free text: the reporter names the business as they know it, which is
  -- rarely the trading name we hold.
  about_business text not null default '',
  body           text not null,

  is_anonymous   boolean not null default false,
  reporter_name  text not null default '',
  reporter_email text not null default '',

  status         text not null default 'new',
  admin_note     text not null default '',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint vd_concerns_status_chk check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  constraint vd_concerns_category_chk check (category in (
    'safety', 'listing_accuracy', 'guest_treatment', 'worker_treatment',
    'bribery_or_fraud', 'data_protection', 'environmental', 'other'
  )),
  -- An anonymous report must not carry identifying contact details: if the
  -- reporter ticked anonymous, the columns are enforced empty rather than
  -- trusting the client to have cleared them.
  constraint vd_concerns_anonymity_chk check (
    not is_anonymous or (reporter_name = '' and reporter_email = '')
  )
);

create index if not exists vd_concerns_status_idx  on vd_concerns (status);
create index if not exists vd_concerns_created_idx on vd_concerns (created_at desc);

alter table vd_concerns enable row level security;

drop policy if exists "Anyone raises a concern"        on vd_concerns;
drop policy if exists "Verification office reads concerns" on vd_concerns;
drop policy if exists "Admins manage concerns"         on vd_concerns;

-- Write-only for the public, like vd_listing_applications: a reporter lodges
-- and can never read anything back. status pinned so nobody self-resolves.
create policy "Anyone raises a concern" on vd_concerns
  for insert with check (status = 'new');

create policy "Verification office reads concerns" on vd_concerns
  for select using (is_ops());

create policy "Admins manage concerns" on vd_concerns
  for all using (is_admin()) with check (is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Application mirror columns
--
--    The whole submission still lives in `value`; these are only what the
--    review queue sorts and filters on, matching how the table already
--    treats property_name / contact_email / region / commission_tier.
-- ────────────────────────────────────────────────────────────────────────────
alter table vd_listing_applications
  add column if not exists accreditation_type text,
  add column if not exists accreditation_ref  text;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Review decision
--
--    Writing review_status directly would need the admin-manage policy and
--    would let a reviewer set reviewed_by to somebody else. This records the
--    decision with the caller's own identity and refuses anyone outside the
--    verification office.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_review_compliance_document(
  p_id text,
  p_status text,
  p_note text default ''
) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- coalesce(): see 20260903 — auth.role() is NULL on a connection with no
  -- JWT, and `not (false or NULL)` is NULL, which IF reads as false.
  if not coalesce(is_ops(), false) then
    raise exception 'verification office only';
  end if;
  if p_status not in ('pending', 'verified', 'rejected') then
    raise exception 'invalid review status: %', p_status;
  end if;

  update vd_compliance_documents
     set review_status = p_status,
         review_note   = coalesce(p_note, ''),
         reviewed_by   = auth.uid(),
         reviewed_at   = now(),
         updated_at    = now()
   where id = p_id;

  if not found then
    raise exception 'compliance document not found: %', p_id;
  end if;
end;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Re-home an approved application's evidence onto the account
--
--    On approval the applicant becomes a supplier, and their certificates and
--    acceptances have to follow — otherwise the renewal queue, which watches
--    expiry per supplier, never sees the certificate that is about to lapse.
--
--    vd_supplier_agreements has no update policy for anybody, on purpose: an
--    acceptance that can be edited afterwards is not evidence. This function
--    is the single, narrow exception, and it is narrow by construction rather
--    than by promise — it can only fill in supplier_id where it is still
--    null, and touches no other column. What was accepted, by whom, and when
--    stays exactly as written.
--
--    Called by the approval route with the reviewing admin's own session, so
--    is_admin() is a real check rather than a service-role bypass.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.vd_link_application_to_supplier(
  p_application_ref text,
  p_supplier_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'admin only';
  end if;
  if p_application_ref is null or p_supplier_id is null then
    raise exception 'an application reference and a supplier are both required';
  end if;

  -- The owner check constraint means application_ref must clear in the same
  -- statement that sets supplier_id.
  update vd_compliance_documents
     set supplier_id = p_supplier_id,
         application_ref = null,
         updated_at = now()
   where application_ref = p_application_ref;

  update vd_supplier_agreements
     set supplier_id = p_supplier_id
   where application_ref = p_application_ref
     and supplier_id is null;
end;
$$;

grant execute on function public.vd_review_compliance_document(text, text, text) to authenticated;
grant execute on function public.vd_link_application_to_supplier(text, uuid) to authenticated;
grant execute on function public.vd_accreditation_ok(uuid, text) to authenticated, anon;
