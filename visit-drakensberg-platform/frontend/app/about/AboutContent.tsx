'use client'
import Link from 'next/link'
import Footer from '@/components/layout/Footer'
import Editable from '@/components/editor/Editable'
import { useSiteSection } from '@/lib/use-site-section'

export default function AboutContent() {
  const c = useSiteSection('about_page')

  return (
    <main className="bg-mist min-h-screen">
      <section className="bg-forest text-white pt-32 pb-16 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto">
          <Editable section="about_page" fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-gold mb-3">{c.eyebrow}</p>
          </Editable>
          <Editable section="about_page" fieldKey="heading" value={c.heading} label="Heading" type="text">
            <h1 className="font-display italic text-4xl lg:text-5xl">{c.heading}</h1>
          </Editable>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <Editable section="about_page" fieldKey="body_1" value={c.body_1} label="Intro Paragraph" type="textarea">
          <p className="font-sans text-base text-forest/70 leading-relaxed">{c.body_1}</p>
        </Editable>
        <Editable section="about_page" fieldKey="body_2" value={c.body_2} label="Second Paragraph" type="textarea">
          <p className="font-sans text-base text-forest/70 leading-relaxed">{c.body_2}</p>
        </Editable>
        <div>
          <Editable section="about_page" fieldKey="suppliers_heading" value={c.suppliers_heading} label="Suppliers Heading" type="text">
            <h2 className="font-display italic text-2xl text-forest mb-3">{c.suppliers_heading}</h2>
          </Editable>
          <Editable section="about_page" fieldKey="suppliers_body" value={c.suppliers_body} label="Suppliers Body" type="textarea">
            <p className="font-sans text-base text-forest/70 leading-relaxed mb-4">{c.suppliers_body}</p>
          </Editable>
          <Editable section="about_page" fieldKey="suppliers_cta" value={c.suppliers_cta} label="Suppliers CTA Label" type="text" as="span">
            <Link
              href="/list-with-us"
              className="inline-block px-6 py-3 bg-forest text-white font-sans text-sm hover:bg-sage transition-colors"
            >
              {c.suppliers_cta}
            </Link>
          </Editable>
        </div>
        <div>
          <Editable section="about_page" fieldKey="contact_heading" value={c.contact_heading} label="Contact Heading" type="text">
            <h2 className="font-display italic text-2xl text-forest mb-3">{c.contact_heading}</h2>
          </Editable>
          <p className="font-sans text-base text-forest/70 leading-relaxed">
            Questions, feedback or press enquiries:{' '}
            <Editable section="about_page" fieldKey="contact_email" value={c.contact_email} label="Contact Email" type="text" as="span">
              <a href={`mailto:${c.contact_email}`} className="text-forest underline hover:text-gold transition-colors">
                {c.contact_email}
              </a>
            </Editable>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  )
}
