-- ============================================================================
-- Sign-up marketing consent reaches the profile once the email is confirmed
--
-- See supabase/migrations/20261013_marketing_consent_on_confirm.sql.
-- ============================================================================

\set ON_ERROR_STOP on

do $$
declare
  v_opted   uuid;
  v_out     uuid;
  v_silent  uuid;
begin
  raise notice 'marketing consent on confirm';

  perform vdtest.act_as_nobody();

  -- What app/auth/register does: sign up (unconfirmed), then record consent
  -- anonymously because there is no session yet.
  v_opted := vdtest.make_user('mc-opted@example.test', 'visitor');
  perform vd_set_consent('MC-Opted@Example.test', 'marketing_email', true, 'registration');
  perform vdtest.eq((select marketing_consent from vd_customer_profiles where user_id = v_opted), false,
    'an unconfirmed account is not marked as consenting');

  update auth.users set email_confirmed_at = now() where id = v_opted;
  perform vdtest.eq((select marketing_consent from vd_customer_profiles where user_id = v_opted), true,
    'confirming the email applies the recorded opt-in');

  -- The latest choice wins: opted in, then unsubscribed anonymously.
  v_out := vdtest.make_user('mc-out@example.test', 'visitor');
  perform vd_set_consent('mc-out@example.test', 'marketing_email', true, 'registration');
  perform vd_set_consent('mc-out@example.test', 'marketing_email', false, 'unsubscribe_link');
  update auth.users set email_confirmed_at = now() where id = v_out;
  perform vdtest.eq((select marketing_consent from vd_customer_profiles where user_id = v_out), false,
    'a later opt-out wins');

  -- No choice on record: nothing changes, and confirming still works.
  v_silent := vdtest.make_user('mc-silent@example.test', 'visitor');
  update auth.users set email_confirmed_at = now() where id = v_silent;
  perform vdtest.eq(coalesce((select marketing_consent from vd_customer_profiles where user_id = v_silent), false), false,
    'an account with no recorded choice is not opted in');

  -- Not callable from the client. The harness runs as a superuser (act_as
  -- only sets the JWT GUCs), so grants are checked directly.
  perform vdtest.eq(has_function_privilege('authenticated', 'public.vd_sync_marketing_consent(uuid, text)', 'execute'), false,
    'a signed-in user cannot copy someone else''s consent onto their profile');
  perform vdtest.eq(has_function_privilege('anon', 'public.vd_sync_marketing_consent(uuid, text)', 'execute'), false,
    'nor can an anonymous caller');

  raise notice 'marketing consent on confirm: all assertions passed';
end $$;
