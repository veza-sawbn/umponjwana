'use client'
import Editable from './Editable'
import EditableSection from './EditableSection'
import { useSiteSection } from '@/lib/use-site-section'
import type { SiteContentKey } from '@/lib/site-content'

// Shared page header (eyebrow / heading / subheading) driven by a site-content
// section, with every element clickable in the admin visual editor. `children`
// renders inside the same hero band, for pages that carry extra hero content
// (a live stat line, a signup CTA…) that isn't part of the CMS copy.
export default function EditablePageHeader({ section, subClassName = '', children }: { section: SiteContentKey; subClassName?: string; children?: React.ReactNode }) {
  const c = useSiteSection(section) as unknown as Record<string, string>
  return (
    <EditableSection id={section} label="Page Header" className="bg-forest text-white py-16 px-6 lg:px-12">
      <div className="max-w-[1440px] mx-auto">
        <Editable section={section} fieldKey="eyebrow" value={c.eyebrow} label="Eyebrow" type="text">
          <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-3">{c.eyebrow}</p>
        </Editable>
        <Editable section={section} fieldKey="heading" value={c.heading} label="Heading" type="text">
          <h1 className="font-display text-5xl lg:text-6xl text-white leading-none mb-4">{c.heading}</h1>
        </Editable>
        <Editable section={section} fieldKey="subheading" value={c.subheading} label="Subheading" type="textarea">
          <p className={`font-sans text-sm text-white/50 ${subClassName}`}>{c.subheading}</p>
        </Editable>
        {children}
      </div>
    </EditableSection>
  )
}
