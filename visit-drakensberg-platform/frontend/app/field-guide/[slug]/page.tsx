import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Footer from '@/components/layout/Footer'
import LayeredFieldGuide from '@/components/field-guide/LayeredFieldGuide'
import { getPublishedFieldGuide } from '@/lib/field-guide'

// Published snapshots change only when someone presses Publish in the
// console, so this matches the revalidation the rest of the CMS-backed public
// pages use (see app/mydrakensberg/[slug]).
export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

async function load(slug: string) {
  try {
    return await getPublishedFieldGuide(slug)
  } catch {
    // A guide is content, not infrastructure — a Supabase outage should 404
    // this page, not take the whole route segment down.
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const guide = await load(params.slug)
  if (!guide) return { title: 'Field Guide | Visit Drakensberg' }

  const title = guide.page.seoTitle || `${guide.page.title} | Visit Drakensberg`
  const description = guide.page.seoDescription || guide.page.intro || undefined
  const cover = guide.chapters[0]?.mainMediaUrl || undefined

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/field-guide/${guide.page.slug}` },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${SITE_URL}/field-guide/${guide.page.slug}`,
      images: cover ? [cover] : undefined,
    },
  }
}

export default async function FieldGuidePage({ params }: { params: { slug: string } }) {
  const guide = await load(params.slug)
  // Unpublished, or never published: there is no snapshot, so there is
  // nothing to render — draft work is not reachable from a public URL.
  if (!guide) notFound()

  return (
    <main>
      <LayeredFieldGuide guide={guide} />
      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  )
}
