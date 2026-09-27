import { securityHeaders } from './security-headers.mjs'

// Supabase project host, so a project fronted by a custom domain (rather
// than the default *.supabase.co) still gets picked up by the remotePattern
// below — otherwise every trail/region/property photo uploaded to Storage
// would hit next/image's "hostname not configured" error, which crashes
// the whole page it's on, not just that one photo.
// Canonical production host, e.g. visitdrakensberg.com. Used to send the
// production deploy's own *.vercel.app alias to the real domain (below).
let siteHostname
try {
  siteHostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || '').hostname
} catch {
  siteHostname = null
}

// Vercel preview/branch deploys. Everything they serve gets
// X-Robots-Tag: noindex, so a shared preview link never ends up in Google
// competing with the real site. Unset outside Vercel, so local and other
// hosts are unaffected.
const isPreviewDeploy = !!process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'

let supabaseHostname
try {
  supabaseHostname = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname
} catch {
  supabaseHostname = null
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // @react-pdf/renderer (invoice PDF generation) pulls in yoga-layout, which
  // ships its layout engine as an embedded WASM/asm.js binary. Webpack's
  // bundling of that — module resolution rewritten, the binary re-emitted as
  // an asset — is a well-known source of it working in a plain Node script
  // but breaking once bundled into a Vercel serverless function. Marking it
  // (and its own dependency tree) external makes Next require() it straight
  // from node_modules at runtime instead, same as a plain Node process would.
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  images: {
    remotePatterns: [
      // This project's own Supabase host, not '*.supabase.co'. The wildcard
      // meant next/image would fetch and re-serve an image from ANY Supabase
      // project on the internet, under our domain and our image-optimisation
      // budget (audit finding M2). Falls back to the wildcard only when
      // NEXT_PUBLIC_SUPABASE_URL is unset — otherwise every Storage photo
      // breaks at build time with "hostname not configured", which crashes
      // the whole page it is on rather than just that one photo.
      ...(supabaseHostname
        ? [{ protocol: 'https', hostname: supabaseHostname }]
        : [{ protocol: 'https', hostname: '*.supabase.co' }]),
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },

      // Third-party hosts that live content actually points at. Admins and
      // suppliers paste image URLs from wherever they found them, and an
      // un-allow-listed host is not a soft failure: in production the loader
      // still emits /_next/image?url=… and the optimizer answers 400, so the
      // photo is simply blank. That is what emptied the homepage "What's on"
      // reel — the three soonest hike cards and one activity all sit on hosts
      // in this list, while the 89 images on Supabase/Unsplash were fine.
      //
      // Allow-listing beats letting the browser fetch these directly: the
      // optimizer fetches server-side with no Referer, so hotlink protection
      // (wixstatic and gstatic in particular) does not trip, and the result is
      // cached and resized instead of shipped full-size.
      //
      // This is a snapshot of what is in the database, not a policy — a URL
      // pasted from a new host tomorrow still won't match, which is why
      // components/ui/SafeImage.tsx keeps its unoptimized fallback. The
      // durable fix is uploading photos through Admin → Media Library so they
      // land in Supabase Storage.
      { protocol: 'https', hostname: 'hiking-trails.com' },
      { protocol: 'https', hostname: 'www.alexnail.com' },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: 'https', hostname: 'www.champagnesportsresort.com' },
      { protocol: 'https', hostname: 'wildmanranch.com' },
      { protocol: 'https', hostname: 'static.wixstatic.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'southafrica.co.za' },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },
  // No browser source maps in production (Next's default, pinned here so it
  // isn't switched on by accident): they would publish the full original
  // source of every client component.
  productionBrowserSourceMaps: false,
  // The codebase has no console.log/debug calls today; this keeps a stray one
  // from shipping to visitors' consoles. error/warn/info are kept: the server
  // logs (lib/observability.ts) are written with console.info.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn', 'info'] } : false,
  },
  async headers() {
    return [
      ...securityHeaders(),
      ...(isPreviewDeploy
        ? [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
        : []),
    ]
  },
  async redirects() {
    return [
      // The production deploy also answers on its <project>.vercel.app alias.
      // That copy is indexable (it IS production), so it competes with the
      // real domain as a duplicate. Send it to the canonical host. Only when
      // the canonical host is a custom domain, never when NEXT_PUBLIC_SITE_URL
      // is itself a vercel.app address, which would redirect to itself.
      // /api and /auth are left alone: Vercel Cron and payment webhooks call
      // the deployment URL and do not follow redirects, and an auth callback
      // must finish on the origin that holds its PKCE cookie.
      ...(process.env.VERCEL_ENV === 'production' && siteHostname && !siteHostname.endsWith('.vercel.app')
        ? [{
            source: '/:path((?!api/|auth/).*)',
            has: [{ type: 'host', value: '.+\\.vercel\\.app' }],
            destination: `https://${siteHostname}/:path`,
            permanent: true,
          }]
        : []),
      {
        // The listing journey started out stays-only and lived at
        // /list-your-property. It now covers activities, tours, transport and
        // experiences, so the name was wrong — but that URL has been shared
        // and has already taken a real application, so it keeps working.
        source: '/list-your-property',
        destination: '/list-with-us',
        permanent: true,
      },
      {
        // The journal lives at /mydrakensberg. Nothing on the site links to
        // /blog, but it is the path crawlers and old inbound links guess for
        // it — PetalBot walked into a 404 there. /stories, the other name this
        // content has had, already redirects from app/stories/page.tsx; this
        // is the same handling for the conventional one, as a 308 so search
        // engines move on rather than re-crawling a dead path.
        source: '/blog',
        destination: '/mydrakensberg',
        permanent: true,
      },
      {
        // Post slugs are shared between the two paths, so a deep link lands on
        // its article; an unknown slug 404s at /mydrakensberg/[slug] as it
        // would have anyway.
        source: '/blog/:slug',
        destination: '/mydrakensberg/:slug',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
