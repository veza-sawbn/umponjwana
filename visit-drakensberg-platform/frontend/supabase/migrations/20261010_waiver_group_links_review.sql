-- ============================================================================
-- Visit Drakensberg — Group waiver links: review follow-ups
--
-- Run AFTER 20261010_waiver_group_links.sql (already applied to production
-- and recorded in vd_schema_migrations, so it is amended here rather than
-- edited in place).
--
-- 1. Deleting a link needs manage_customers, not just view_customers.
--    "Ops manage managed waiver links" is FOR ALL with view_customers in
--    USING and manage_customers in WITH CHECK. That covers INSERT and UPDATE,
--    but DELETE evaluates USING only, so a view-only ops employee could delete
--    a link (one without signatures; signed ones are held by the foreign key)
--    through the REST API. A RESTRICTIVE delete policy is ANDed with every
--    permissive one, so the owner, admins and manage_customers holders are the
--    only ones left who can delete.
--
-- 2. vd_waiver_link_submit stored p_acknowledged exactly as sent. It is
--    anon-callable, and unlike the signature and answers that object had no
--    size bound. It now stores only the template's own clause ids, each true.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

-- ─── 1. Delete needs manage permission ──────────────────────────────────────
drop policy if exists "Only managers delete waiver links" on vd_waiver_links;
create policy "Only managers delete waiver links" on vd_waiver_links
  as restrictive for delete
  using (
    supplier_id = auth.uid()
    or is_admin()
    or has_supplier_permission(supplier_id, 'manage_customers')
  );

-- ─── 2. Acknowledged clauses are stored from the template, not the caller ───
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
  v_ack jsonb;
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

  -- Store only the clauses this template actually has, each as true. The
  -- caller's object is never persisted as sent, so its size can't grow the
  -- table no matter what an anonymous caller puts in it.
  select coalesce(jsonb_object_agg(c->>'id', true), '{}'::jsonb)
    into v_ack
    from jsonb_array_elements(t.clauses) as c
   where coalesce((p_acknowledged->>(c->>'id'))::boolean, false);

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
    v_ack,
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
grant execute on function public.vd_waiver_link_submit(text, text, jsonb, jsonb, text, text, text)
  to anon, authenticated;
