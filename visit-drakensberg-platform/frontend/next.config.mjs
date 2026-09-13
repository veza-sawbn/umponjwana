// Supabase project host, so a project fronted by a custom domain (rather
// than the default *.supabase.co) still gets picked up by the remotePattern
// below — otherwise every trail/region/property photo uploaded to Storage
// would hit next/image's "hostname not configured" error, which crashes
// the whole page it's on, not just that one photo.
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
      { protocol: 'https', hostname: '*.supabase.co' },
      ...(supabaseHostname && !supabaseHostname.endsWith('.supabase.co')
        ? [{ protocol: 'https', hostname: supabaseHostname }]
        : []),
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
  async redirects() {
    return [
      {
        // The listing journey started out stays-only and lived at
        // /list-your-property. It now covers activities, tours, transport and
        // experiences, so the name was wrong — but that URL has been shared
        // and has already taken a real application, so it keeps working.
        source: '/list-your-property',
        destination: '/list-with-us',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
