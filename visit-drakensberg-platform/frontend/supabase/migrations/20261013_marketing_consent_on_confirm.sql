-- ============================================================================
-- Visit Drakensberg — Sign-up marketing consent reaches the customer profile
--
-- THE BUG
--   app/auth/register records the "send me marketing email" tick by calling
--   vd_set_consent() straight after supabase.auth.signUp(). Email
--   confirmation is on, so there is no session yet: the call runs as anon,
--   the consent row lands in vd_customer_consents with user_id = null, and
--   vd_set_consent() only refreshes the cached
--   vd_customer_profiles.marketing_consent for a logged-in caller. Nothing
--   ever caught up later, so no account that opted in at sign-up was ever
--   marked as consenting — and the campaign builder, which lists customers
--   by that flag, showed nobody.
--
-- THE FIX
--   When an account's email is confirmed, apply the latest marketing_email
--   choice on record for that address to its profile. Confirmation is the
--   point where we know the address belongs to the account holder, so an
--   anonymous opt-in for someone else's address can't turn into marketing
--   to them unless they own the account it lands on. An opt-out recorded
--   anonymously (the public /unsubscribe page) syncs the same way.
--
--   Plus a one-off backfill for accounts confirmed before this existed.
-- ============================================================================
-- @rollback: additive — forward-only; safe to leave in place if the deploy is rolled back

create or replace function public.vd_sync_marketing_consent(p_user_id uuid, p_email text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_granted boolean;
begin
  select cc.granted into v_granted
  from vd_customer_consents cc
  where lower(cc.email) = lower(trim(p_email)) and cc.consent_type = 'marketing_email'
  order by cc.created_at desc, cc.id desc  -- id: insertion order breaks a same-instant tie
  limit 1;

  if v_granted is null then
    return; -- no choice on record: leave the profile as it is
  end if;

  insert into vd_customer_profiles (user_id, marketing_consent)
  values (p_user_id, v_granted)
  on conflict (user_id) do update
    set marketing_consent = excluded.marketing_consent, updated_at = now()
    where vd_customer_profiles.marketing_consent is distinct from excluded.marketing_consent;
end;
$$;
-- Internal: only the trigger below and this migration call it.
revoke execute on function public.vd_sync_marketing_consent(uuid, text) from public, anon, authenticated;

create or replace function public.vd_on_auth_email_confirmed()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null or old.email is distinct from new.email) then
    begin
      perform vd_sync_marketing_consent(new.id, new.email);
    exception when others then
      -- Never block a sign-in over a marketing flag.
      raise warning 'vd_on_auth_email_confirmed: % (%)', sqlerrm, new.id;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists vd_marketing_consent_on_confirm on auth.users;
create trigger vd_marketing_consent_on_confirm
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.vd_on_auth_email_confirmed();

-- Backfill: every already-confirmed account picks up its recorded choice.
do $$
declare
  r record;
begin
  for r in select id, email from auth.users where email_confirmed_at is not null and email is not null loop
    perform vd_sync_marketing_consent(r.id, r.email);
  end loop;
end $$;
