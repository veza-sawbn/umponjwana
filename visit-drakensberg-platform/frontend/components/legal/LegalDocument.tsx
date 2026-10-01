import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import type { LegalSection } from '@/lib/supplier-agreement'

/**
 * Shared shell for a legal document page — the hero, the measured column and
 * the section list that /terms and /privacy already render by hand.
 *
 * Adds two things those pages don't need and the supplier documents do: a
 * version stamp (an acceptance is only evidence if it names a version) and
 * bulleted lists, since a code of conduct that renders its obligations as
 * prose paragraphs is a code of conduct nobody reads.
 */
export default function LegalDocument({
  eyebrow = 'Legal',
  title,
  intro,
  version,
  updated,
  sections,
  companion,
}: {
  eyebrow?: string
  title: string
  intro?: string
  version?: string
  updated: string
  sections: LegalSection[]
  /** The document's sibling, linked at the foot — the two are accepted together. */
  companion?: { href: string; label: string }
}) {
  return (
    <main className="bg-mist min-h-screen">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">{eyebrow}</p>
          <h1 className="font-display italic text-4xl lg:text-5xl">{title}</h1>
          {intro && (
            <p className="font-sans text-sm text-white/70 leading-relaxed mt-5 max-w-2xl">{intro}</p>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mb-10">
          <p className="font-sans text-sm text-forest/50">Last updated: {updated}</p>
          {version && (
            <p className="font-sans text-xs tracking-[0.12em] uppercase text-forest/40">
              Version {version}
            </p>
          )}
        </div>

        <div className="space-y-10">
          {sections.map(s => (
            <div key={s.heading}>
              <h2 className="font-display italic text-xl text-forest mb-3">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="font-sans text-sm text-forest/70 leading-relaxed mb-3">{p}</p>
              ))}
              {s.list && (
                <ul className="mt-2 space-y-2">
                  {s.list.map((item, i) => (
                    <li key={i} className="font-sans text-sm text-forest/70 leading-relaxed flex gap-3">
                      <span aria-hidden className="text-gold shrink-0 mt-[2px]">—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {companion && (
          <div className="mt-14 border-t border-forest/10 pt-6">
            <p className="font-sans text-sm text-forest/60 leading-relaxed">
              This document is accepted together with the{' '}
              <Link href={companion.href} className="text-[#2d6a4f] underline underline-offset-2">
                {companion.label}
              </Link>
              . Questions about either:{' '}
              <a href="mailto:hello@visitdrakensberg.com" className="text-[#2d6a4f] underline underline-offset-2">
                hello@visitdrakensberg.com
              </a>
              .
            </p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  )
}
