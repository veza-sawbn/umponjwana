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
