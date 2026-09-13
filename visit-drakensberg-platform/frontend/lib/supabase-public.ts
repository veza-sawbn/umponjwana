import { createClient } from '@supabase/supabase-js'

// A plain, session-less Supabase client for reading PUBLIC catalog data
// (regions, reserves, towns, trails, properties, activities, ...) from
// Server Components / generateMetadata, and from the client components
// behind the public catalog pages.
//
// Public pages must read through THIS client, never the session-bound
// client. The supplier gate on vd_entities lives in RLS ("Public entities
// are readable" — status is live AND vd_owner_is_listable(owner_id)), and
// permissive policies OR-combine: "Admins read all entities" and "Managed
// ops agents read entities" hand a privileged session rows the public
// policy hides. Read the catalog with a signed-in admin's client and a
// suspended supplier's listings come back — the public site then renders
// something no visitor can see, which is how suspended suppliers kept
// showing up for the staff who had just suspended them.
//
// This is deliberately NOT lib/auth.ts's `supabase` (createClientComponentClient,
// which manages browser session storage via cookies and is designed for
// client components) and NOT lib/supabase-server.ts's `createServerClient`
// (cookie-bound to the current request, for reading the signed-in user's
// own session). Public catalog pages need neither — every visitor sees the
// same data, so a plain anon-key client avoids any dependency on browser
// APIs or request cookies, and is safe to construct in any render context.
// Anon-key only: RLS still applies, so this can only read what an
// anonymous visitor could already see via the client-side `supabase`.
export const publicSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
)
