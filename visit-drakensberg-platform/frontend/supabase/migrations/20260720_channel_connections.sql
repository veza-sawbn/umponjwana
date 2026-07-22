-- ============================================================================
-- Visit Drakensberg — Communications Hub channel connections
--
-- Holds the credentials/config for each messaging channel (WhatsApp Cloud API,
-- Meta Graph / Messenger, Instagram, TikTok, email, SMS). These rows contain
-- access tokens and app secrets, so — unlike `site_content` (public read) —
-- this table is admin-only for BOTH read and write. Run in the Supabase SQL
-- editor.
-- ============================================================================

create table if not exists vd_channel_connections (
  channel      text primary key,
  connected    boolean not null default false,
  -- non-secret identifiers (phone number id, page id, from address…)
  config       jsonb not null default '{}'::jsonb,
  -- secrets (access tokens, app secrets, verify tokens)
  secret       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

alter table vd_channel_connections enable row level security;

-- Admin-only: never exposed to the public site or to suppliers.
drop policy if exists "Admins manage channel connections" on vd_channel_connections;
create policy "Admins manage channel connections" on vd_channel_connections
  for all using (is_admin()) with check (is_admin());
