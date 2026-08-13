import { createClient } from '@supabase/supabase-js'

// A plain, session-less Supabase client for reading PUBLIC catalog data
// (regions, reserves, towns, trails, properties, activities, ...) from
// Server Components / generateMetadata.
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
