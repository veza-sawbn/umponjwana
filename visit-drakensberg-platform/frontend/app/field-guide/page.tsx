import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Leaf } from 'lucide-react'
import Footer from '@/components/layout/Footer'
import { getFieldGuideIndex } from '@/lib/field-guide'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visitdrakensberg.com'

export const metadata: Metadata = {
  title: 'Field Guides | Visit Drakensberg',
  description:
    'Illustrated field guides to the flora and wildlife of the Drakensberg escarpment, drawn layer by layer as you read.',
  alternates: { canonical: `${SITE_URL}/field-guide` },
}

export default async function FieldGuideIndexPage() {
  let guides: Awaited<ReturnType<typeof getFieldGuideIndex>> = []
  try {
    guides = await getFieldGuideIndex()
  } catch {
    guides = []
  }

  return (
    <main className="bg-mist min-h-screen pt-16">
      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16 pb-12">
        <p className="font-sans text-[10px] tracking-[0.22em] uppercase text-gold mb-4">Natural History</p>
        <h1 className="font-display italic text-4xl md:text-6xl leading-[1.05] text-forest max-w-3xl">
          Field Guides
        </h1>
        <p className="mt-6 font-sans text-[15px] md:text-base leading-[1.75] text-forest/65 max-w-2xl">
          Species of the escarpment, drawn the way a naturalist meets them — the animal first, then the
          detail that explains it, then the ground it lives on.
        </p>
      </section>

      <section className="max-w-[1440px] mx-auto px-6 lg:px-12 pb-28">
        {guides.length === 0 ? (
          <p className="py-20 font-sans text-sm text-forest/40">No field guides have been published yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {guides.map(guide => (
              <Link
                key={guide.slug}
                href={`/field-guide/${guide.slug}`}
                className="group block bg-white border border-black/8 hover:border-gold transition-colors"
              >
                <div className="aspect-[4/3] overflow-hidden bg-forest/5">
                  {guide.coverUrl ? (
                    <img
                      src={guide.coverUrl}
                      alt={guide.coverAlt || ''}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Leaf className="w-8 h-8 text-forest/15" />
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-forest/35 mb-3">
                    {guide.chapterCount} {guide.chapterCount === 1 ? 'specimen' : 'specimens'}
                  </p>
                  <h2 className="font-display italic text-2xl leading-tight text-forest">{guide.title}</h2>
                  {guide.intro && (
                    <p className="mt-3 font-sans text-sm leading-[1.7] text-forest/60 line-clamp-3">{guide.intro}</p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-2 font-sans text-xs tracking-[0.1em] uppercase text-gold">
                    Open the guide <ArrowRight size={13} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
