'use client'

/**
 * Tool 13: Content Brief Generator — /admin/seo/new
 *
 * Template-driven (not AI) structured brief for a new page. Three steps:
 *   1  Pick page type
 *   2  Enter entity name, target audience, region, focus keyword
 *   3  View the brief — required sections, suggested internal links,
 *      structured data type, focus keyword, title/H1/meta templates
 *
 * The brief is printable and copyable but never saved to the DB;
 * it's a planning artefact the editor uses while building the entity.
 */

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, Copy, CheckCircle2, Printer } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type PageType = 'trail' | 'destination' | 'property' | 'activity' | 'package' | 'article'

type BriefSection = {
  label: string
  description: string
  required: boolean
}

type BriefTemplate = {
  type: PageType
  label: string
  searchIntent: string
  structuredDataType: string
  sections: BriefSection[]
  internalLinkSuggestions: string[]
  titleTemplate: string   // uses {name}, {region}
  h1Template: string
  descTemplate: string
}

// ── Templates ─────────────────────────────────────────────────────────────────

const TEMPLATES: Record<PageType, BriefTemplate> = {
  trail: {
    type: 'trail',
    label: 'Trail / Hike',
    searchIntent: 'Informational + Commercial (find guided hike)',
    structuredDataType: 'HowTo / Hike schema',
    sections: [
      { label: 'Introduction', description: 'What makes this trail significant; why come here specifically.', required: true },
      { label: 'Trail statistics', description: 'Distance, elevation gain, difficulty rating, estimated duration.', required: true },
      { label: 'Route overview', description: 'Trailhead, key waypoints, terrain type, and the summit/highlight moment.', required: true },
      { label: 'Day-by-day breakdown', description: 'Required for multi-day hikes; optional for day hikes with multiple route options.', required: false },
      { label: 'What to bring', description: 'Gear list, water sources, permit requirements, seasonal conditions.', required: true },
      { label: 'Guided experiences', description: 'Link to operators offering guided departures on this trail.', required: false },
      { label: 'Nearby accommodation', description: '"Where to stay" section pulling from region properties.', required: false },
      { label: 'Related trails', description: 'Same-region trails at similar difficulty or covering complementary terrain.', required: false },
      { label: 'Safety & permits', description: 'Emergency contacts, conservation fees, permit offices.', required: true },
      { label: 'Getting there', description: 'Trailhead GPS coordinates, driving directions from nearest town.', required: false },
    ],
    internalLinkSuggestions: [
      '/regions/{regionSlug} — destination parent page',
      '/guides — filtered to region operators',
      '/stays?region={region} — nearby accommodation',
      '/hikes — trails listing page',
      'Related trail detail pages (same region)',
    ],
    titleTemplate: '{name}: Complete Hiking Guide | Visit Drakensberg',
    h1Template: '{name} — Difficulty, Route & What to Expect',
    descTemplate:
      'Plan your {name} hike in the Drakensberg. Distance, elevation, difficulty, what to bring, and guided options for {region}.',
  },

  destination: {
    type: 'destination',
    label: 'Destination / Region',
    searchIntent: 'Informational + Navigational (explore a specific area)',
    structuredDataType: 'TouristDestination / Place schema',
    sections: [
      { label: 'Introduction', description: 'Character of the region; the one thing it\'s most known for.', required: true },
      { label: 'Highlights & landmarks', description: 'Top 3–5 natural features, historical sites, or must-see spots.', required: true },
      { label: 'Trails in this region', description: 'Curated list linking to trail detail pages.', required: true },
      { label: 'Where to stay', description: 'Property cards filtered to this region.', required: true },
      { label: 'Things to do', description: 'Activity listings filtered to this region.', required: true },
      { label: 'When to visit', description: 'Seasonal guide — best months for hiking, swimming, birding, photography.', required: true },
      { label: 'Getting there', description: 'Driving routes from Johannesburg, Durban, and nearest airports.', required: true },
      { label: 'Nature reserves & parks', description: 'Named conservation areas within or adjacent to the region.', required: false },
      { label: 'Guided experiences', description: 'Tour operators based in or specialising in this region.', required: false },
      { label: 'FAQs', description: 'Top 3–5 questions for this destination surfaced from search intent.', required: false },
    ],
    internalLinkSuggestions: [
      '/regions — regions listing page',
      '/hikes?region={region} — trail listing filtered to region',
      '/stays?region={region} — accommodation filtered to region',
      '/activities?region={region} — activity listings filtered to region',
      'Nature reserve pages adjacent to this region',
    ],
    titleTemplate: '{name} — Hiking, Accommodation & Things to Do | Visit Drakensberg',
    h1Template: '{name}: Your Complete Drakensberg Guide',
    descTemplate:
      'Explore {name} in the Drakensberg — trails, accommodation, activities, and the best times to visit.',
  },

  property: {
    type: 'property',
    label: 'Stay / Accommodation',
    searchIntent: 'Commercial (book accommodation)',
    structuredDataType: 'LodgingBusiness / Hotel schema',
    sections: [
      { label: 'Introduction', description: 'What sets this property apart; its unique selling point in one sentence.', required: true },
      { label: 'Room types & rates', description: 'Unit names, capacity, nightly rates, what\'s included (meals, activities).', required: true },
      { label: 'Amenities', description: 'Pool, braai, restaurant, Wi-Fi, pet policy, wheelchair access.', required: true },
      { label: 'Location & access', description: 'GPS coordinates, driving directions, road conditions (4×4 required?).', required: true },
      { label: 'Nearby trails', description: 'Trail pages adjacent to the property with distances.', required: false },
      { label: 'Activities on-site or nearby', description: 'Activities the property arranges, or nearby activity operators.', required: false },
      { label: 'Check-in / check-out', description: 'Times, key collection process, self-catering vs hosted.', required: true },
      { label: 'Cancellation policy', description: 'Standard policy wording with deposit and refund terms.', required: true },
      { label: 'Booking', description: 'CTA — availability calendar and book-now button.', required: true },
    ],
    internalLinkSuggestions: [
      '/stays — accommodation listing page',
      '/regions/{regionSlug} — destination parent page',
      'Nearby trail detail pages',
      '/activities?region={region} — activities for guests',
      '/packages — if the property features in any packages',
    ],
    titleTemplate: '{name} — {region} Accommodation | Visit Drakensberg',
    h1Template: '{name}: Drakensberg {type} in {region}',
    descTemplate:
      'Book {name} in {region}, Drakensberg. {type} accommodation with easy access to hiking, wildlife, and mountain scenery.',
  },

  activity: {
    type: 'activity',
    label: 'Activity / Experience',
    searchIntent: 'Commercial + Informational (find and book an activity)',
    structuredDataType: 'Event / TouristAttraction schema',
    sections: [
      { label: 'Introduction', description: 'What the activity is; why this operator/location is the best place to do it.', required: true },
      { label: 'Activity details', description: 'Duration, group size, difficulty, minimum age, meeting point.', required: true },
      { label: 'What\'s included', description: 'Equipment, guide, meals, transfers — what the price covers.', required: true },
      { label: 'What to wear / bring', description: 'Clothing, footwear, fitness level required.', required: true },
      { label: 'Pricing', description: 'Per-person rate, group discount, deposit terms.', required: true },
      { label: 'Booking', description: 'Availability calendar, CTA, and cancellation policy summary.', required: true },
      { label: 'Location & meeting point', description: 'GPS, landmark description, and how to find the guide on the day.', required: true },
      { label: 'Nearby accommodation', description: 'Stays guests typically book alongside this activity.', required: false },
      { label: 'Related activities', description: 'Other experiences the same operator offers, or complementary activities nearby.', required: false },
    ],
    internalLinkSuggestions: [
      '/activities — activities listing page',
      '/regions/{regionSlug} — destination parent page',
      '/stays?region={region} — accommodation for activity guests',
      '/guides — operator profile page',
      'Related trail detail pages if activity is trail-based',
    ],
    titleTemplate: '{name} in {region} | Visit Drakensberg',
    h1Template: '{name}: {category} in the Drakensberg',
    descTemplate:
      'Book {name} in {region}, Drakensberg. {duration} experience — {whatIncluded}. {minAge}+ years.',
  },

  package: {
    type: 'package',
    label: 'Package / Itinerary',
    searchIntent: 'Commercial (buy a ready-made trip)',
    structuredDataType: 'Offer / Product schema',
    sections: [
      { label: 'Package headline', description: 'One sentence: what\'s included and who it\'s for.', required: true },
      { label: 'Itinerary overview', description: 'Night-by-night breakdown with activity and accommodation for each day.', required: true },
      { label: "What's included", description: 'Accommodation, meals, activities, transfers, guide — itemised.', required: true },
      { label: "What's excluded", description: 'Flights, personal insurance, gratuities, extras.', required: true },
      { label: 'Pricing & availability', description: 'Price per person, group size range, seasonal pricing if applicable.', required: true },
      { label: 'Booking & deposit', description: 'How to book, deposit amount, final payment deadline.', required: true },
      { label: 'Cancellation policy', description: 'Refund tiers by days before arrival.', required: true },
      { label: 'Fitness & requirements', description: 'Fitness level, minimum age, gear the guest must bring.', required: false },
      { label: 'Highlights', description: 'The 3 moments guests most often mention in reviews.', required: false },
    ],
    internalLinkSuggestions: [
      '/packages — packages listing page',
      '/regions/{regionSlug} — destination the package is based in',
      'Trail detail pages included in the package itinerary',
      'Property detail pages used in the accommodation nights',
      '/tours — individual guided tour pages',
    ],
    titleTemplate: '{name} — {nights}-Night Drakensberg Package | Visit Drakensberg',
    h1Template: '{name}: All-Inclusive Drakensberg Experience',
    descTemplate:
      '{nights} nights in the Drakensberg — {highlights}. Includes accommodation, {trailsOrActivities}, and expert guiding.',
  },

  article: {
    type: 'article',
    label: 'Article / Guide',
    searchIntent: 'Informational (learn about a topic)',
    structuredDataType: 'Article schema',
    sections: [
      { label: 'Introduction / hook', description: 'Open with the most compelling fact or story from the subject.', required: true },
      { label: 'Main body', description: 'The substance — structured with H2/H3 headings matching search sub-queries.', required: true },
      { label: 'Key facts / quick reference box', description: 'Scannable summary for readers who don\'t read end-to-end.', required: false },
      { label: 'Where to see / experience this', description: 'Link to specific trails, regions, or activities where the subject is encountered.', required: true },
      { label: 'Practical information', description: 'Best season, access points, what to bring, guided options.', required: false },
      { label: 'Related articles', description: 'Links to 2–3 complementary articles on the same theme.', required: false },
      { label: 'Author / expert note', description: 'One-line attribution if the content is from a local expert or guide.', required: false },
    ],
    internalLinkSuggestions: [
      '/mydrakensberg — editorial home',
      '/regions/{regionSlug} — region where the subject is found',
      'Trail pages relevant to the topic',
      'Activity pages if the article covers an experience',
      'Related editorial articles on the same theme',
    ],
    titleTemplate: '{name} | Drakensberg Guide — Visit Drakensberg',
    h1Template: '{name}: Everything You Need to Know',
    descTemplate:
      '{intro} — a complete guide from Visit Drakensberg covering what to see, where to go, and when to visit.',
  },
}

const PAGE_TYPES: { type: PageType; emoji: string; description: string }[] = [
  { type: 'trail',       emoji: '🥾', description: 'Day hike, multi-day hike, or speciality walk' },
  { type: 'destination', emoji: '🏔️', description: 'Region or destination area page' },
  { type: 'property',    emoji: '🏡', description: 'Lodge, guesthouse, campsite, or self-catering' },
  { type: 'activity',    emoji: '🪂', description: 'Guided experience or outdoor activity' },
  { type: 'package',     emoji: '📦', description: 'Multi-day itinerary package' },
  { type: 'article',     emoji: '📖', description: 'Editorial guide or information article' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'
const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContentBriefPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [pageType, setPageType] = useState<PageType | null>(null)
  const [entityName, setEntityName] = useState('')
  const [region, setRegion] = useState('')
  const [audience, setAudience] = useState('')
  const [focusKeyword, setFocusKeyword] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const template = pageType ? TEMPLATES[pageType] : null

  const vars: Record<string, string> = {
    name: entityName || '{name}',
    region: region || '{region}',
    regionSlug: region.toLowerCase().replace(/\s+/g, '-') || '{regionSlug}',
    audience: audience || '{audience}',
  }

  const generatedTitle = template ? fill(template.titleTemplate, vars) : ''
  const generatedH1    = template ? fill(template.h1Template, vars) : ''
  const generatedDesc  = template ? fill(template.descTemplate, vars) : ''

  const briefText = useMemo(() => {
    if (!template) return ''
    const lines: string[] = [
      `CONTENT BRIEF — ${template.label.toUpperCase()}`,
      `Entity: ${entityName || '(name)'}`,
      `Region: ${region || '(region)'}`,
      `Target audience: ${audience || '(audience)'}`,
      `Focus keyword: ${focusKeyword || '(keyword)'}`,
      '',
      `SEARCH INTENT: ${template.searchIntent}`,
      `STRUCTURED DATA: ${template.structuredDataType}`,
      '',
      'SEO COPY TEMPLATES',
      `  Title tag : ${generatedTitle}`,
      `  H1        : ${generatedH1}`,
      `  Meta desc : ${generatedDesc}`,
      '',
      'REQUIRED SECTIONS',
      ...template.sections.filter(s => s.required).map(s => `  ☐ ${s.label} — ${s.description}`),
      '',
      'OPTIONAL SECTIONS',
      ...template.sections.filter(s => !s.required).map(s => `  ☐ ${s.label} — ${s.description}`),
      '',
      'SUGGESTED INTERNAL LINKS',
      ...template.internalLinkSuggestions.map(l => `  → ${fill(l, vars)}`),
    ]
    return lines.join('\n')
  }, [template, entityName, region, audience, focusKeyword, generatedTitle, generatedH1, generatedDesc, vars])

  const handleCopy = (key: string, text: string) => {
    copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  // ── Step 1: Pick type ──────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-white border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">← SEO Console</Link>
          </div>
          <h1 className="font-display italic text-2xl text-gray-900">Content Brief Generator</h1>
          <p className="font-sans text-sm text-gray-500 mt-0.5">
            Step 1 of 3 — Choose the page type you're planning.
          </p>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-3">
          {PAGE_TYPES.map(pt => (
            <button
              key={pt.type}
              onClick={() => { setPageType(pt.type); setStep(2) }}
              className={`w-full flex items-center gap-4 p-4 border text-left transition-colors ${
                pageType === pt.type
                  ? 'border-[#2d6a4f] bg-white'
                  : 'border-gray-200 bg-white hover:border-[#2d6a4f]'
              }`}
            >
              <span className="text-2xl shrink-0">{pt.emoji}</span>
              <div>
                <p className="font-sans text-sm font-medium text-gray-900">{TEMPLATES[pt.type].label}</p>
                <p className="font-sans text-xs text-gray-400 mt-0.5">{pt.description}</p>
              </div>
              <ChevronRight size={16} className="ml-auto text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Step 2: Fill details ───────────────────────────────────────────────────
  if (step === 2 && template) {
    const canProceed = entityName.trim().length > 0

    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-white border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">← SEO Console</Link>
            <span className="font-sans text-xs text-gray-300">/</span>
            <button onClick={() => setStep(1)} className="font-sans text-xs text-gray-400 hover:text-gray-600">Choose type</button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">{PAGE_TYPES.find(p => p.type === pageType)?.emoji}</span>
            <div>
              <h1 className="font-display italic text-2xl text-gray-900">{template.label} Brief</h1>
              <p className="font-sans text-sm text-gray-500 mt-0.5">Step 2 of 3 — Enter the entity details.</p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
          <div className="bg-white border border-gray-200 p-5 space-y-5">
            <div>
              <label className={labelCls}>Entity name *</label>
              <input
                className={inputCls}
                placeholder={`e.g. ${pageType === 'trail' ? 'Tugela Falls Circuit' : pageType === 'destination' ? 'Royal Natal National Park' : pageType === 'property' ? 'Mont-Aux-Sources Lodge' : pageType === 'activity' ? 'Abseiling in the Central Berg' : pageType === 'package' ? '5-Day Northern Berg Traverse' : 'Birding in the Drakensberg Guide'}`}
                value={entityName}
                onChange={e => setEntityName(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Region</label>
              <input
                className={inputCls}
                placeholder="e.g. Royal Natal / Northern Berg"
                value={region}
                onChange={e => setRegion(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Target audience</label>
              <input
                className={inputCls}
                placeholder="e.g. Intermediate hikers, families with children, budget travellers"
                value={audience}
                onChange={e => setAudience(e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Primary focus keyword</label>
              <input
                className={inputCls}
                placeholder={`e.g. ${pageType === 'trail' ? 'Tugela falls hike' : pageType === 'destination' ? 'Royal Natal National Park hiking' : 'Drakensberg accommodation'}`}
                value={focusKeyword}
                onChange={e => setFocusKeyword(e.target.value)}
              />
              <p className="font-sans text-[11px] text-gray-400 mt-1">
                The search phrase this page is primarily targeting.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 font-sans text-sm text-gray-500 hover:text-gray-700"
            >
              <ChevronLeft size={14} /> Change type
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceed}
              className={`flex items-center gap-1.5 font-sans text-sm px-6 py-2.5 transition-colors ${
                canProceed
                  ? 'bg-[#2d6a4f] text-white hover:bg-[#235a40]'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Generate brief <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Brief output ───────────────────────────────────────────────────
  if (step === 3 && template) {
    return (
      <div className="min-h-screen bg-[#F7F5F2]">
        <div className="bg-white border-b border-gray-200 px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/admin/seo" className="font-sans text-xs text-gray-400 hover:text-gray-600">← SEO Console</Link>
            <span className="font-sans text-xs text-gray-300">/</span>
            <button onClick={() => setStep(2)} className="font-sans text-xs text-gray-400 hover:text-gray-600">Edit details</button>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xl">{PAGE_TYPES.find(p => p.type === pageType)?.emoji}</span>
              <div>
                <h1 className="font-display italic text-2xl text-gray-900">
                  {entityName}
                </h1>
                <p className="font-sans text-sm text-gray-500 mt-0.5">
                  {template.label} content brief · {region || 'no region set'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopy('all', briefText)}
                className="flex items-center gap-1.5 font-sans text-sm border border-gray-300 text-gray-600 px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                {copied === 'all' ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                Copy brief
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 font-sans text-sm border border-gray-300 text-gray-600 px-4 py-2 hover:bg-gray-100 transition-colors"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => { setStep(1); setEntityName(''); setRegion(''); setAudience(''); setFocusKeyword('') }}
                className="font-sans text-sm bg-[#2d6a4f] text-white px-4 py-2 hover:bg-[#235a40] transition-colors"
              >
                New brief
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-5 print:px-0 print:py-4">

          {/* Meta info */}
          <div className="bg-white border border-gray-200 p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className={labelCls}>Page type</p>
              <p className="font-sans text-sm text-gray-800 font-medium">{template.label}</p>
            </div>
            <div>
              <p className={labelCls}>Search intent</p>
              <p className="font-sans text-sm text-gray-800">{template.searchIntent}</p>
            </div>
            <div>
              <p className={labelCls}>Structured data</p>
              <p className="font-sans text-sm text-gray-800">{template.structuredDataType}</p>
            </div>
            <div>
              <p className={labelCls}>Focus keyword</p>
              <p className="font-sans text-sm text-gray-800 font-medium">{focusKeyword || '—'}</p>
            </div>
          </div>

          {/* SEO copy templates */}
          <div className="bg-white border border-gray-200 p-5 space-y-4">
            <p className={labelCls}>SEO copy templates</p>

            {[
              { key: 'title', label: 'Title tag', value: generatedTitle, limit: 60 },
              { key: 'h1',    label: 'H1',        value: generatedH1,    limit: null },
              { key: 'desc',  label: 'Meta description', value: generatedDesc, limit: 160 },
            ].map(({ key, label, value, limit }) => (
              <div key={key} className="bg-[#F7F5F2] border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className={`${labelCls} mb-0`}>{label}</p>
                  <div className="flex items-center gap-2">
                    {limit && (
                      <span className={`font-sans text-[10px] tabular-nums ${value.length > limit ? 'text-red-500' : value.length > limit * 0.85 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {value.length}/{limit}
                      </span>
                    )}
                    <button
                      onClick={() => handleCopy(key, value)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {copied === key ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <p className="font-sans text-sm text-gray-800">{value}</p>
              </div>
            ))}

            <p className="font-sans text-[11px] text-gray-400">
              Replace any <code className="bg-gray-100 px-1">{'{placeholder}'}</code> with real content before publishing.
            </p>
          </div>

          {/* Required sections */}
          <div className="bg-white border border-gray-200 p-5">
            <p className={labelCls}>Required sections ({template.sections.filter(s => s.required).length})</p>
            <div className="space-y-2">
              {template.sections.filter(s => s.required).map(s => (
                <div key={s.label} className="flex items-start gap-3 border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                  <span className="font-sans text-[11px] text-emerald-600 font-semibold mt-0.5 shrink-0 w-3">☐</span>
                  <div>
                    <p className="font-sans text-sm text-gray-800 font-medium">{s.label}</p>
                    <p className="font-sans text-xs text-gray-500 mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional sections */}
          <div className="bg-white border border-gray-200 p-5">
            <p className={labelCls}>Optional sections ({template.sections.filter(s => !s.required).length})</p>
            <div className="space-y-2">
              {template.sections.filter(s => !s.required).map(s => (
                <div key={s.label} className="flex items-start gap-3 border border-gray-100 px-3 py-2.5">
                  <span className="font-sans text-[11px] text-gray-400 font-semibold mt-0.5 shrink-0 w-3">☐</span>
                  <div>
                    <p className="font-sans text-sm text-gray-800">{s.label}</p>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Internal link suggestions */}
          <div className="bg-white border border-gray-200 p-5">
            <p className={labelCls}>Suggested internal links</p>
            <div className="space-y-1.5">
              {template.internalLinkSuggestions.map((l, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="font-sans text-xs text-[#2d6a4f] mt-0.5 shrink-0">→</span>
                  <p className="font-sans text-sm text-gray-700">{fill(l, vars)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Target audience */}
          {audience && (
            <div className="bg-white border border-gray-200 p-5">
              <p className={labelCls}>Target audience</p>
              <p className="font-sans text-sm text-gray-800">{audience}</p>
            </div>
          )}

          {/* Next steps */}
          <div className="bg-white border border-gray-200 p-5">
            <p className={labelCls}>Next steps</p>
            <div className="space-y-2">
              {[
                { step: '1', text: 'Create the entity in admin', link: pageType === 'trail' ? '/admin/trails' : pageType === 'property' ? '/admin/properties' : pageType === 'activity' ? '/admin/activities' : pageType === 'package' ? '/admin/packages' : '/admin/seo' },
                { step: '2', text: 'Fill in all required sections above', link: null },
                { step: '3', text: 'Set a keyword-rich slug (avoid UUID)', link: null },
                { step: '4', text: 'Run the SEO health check', link: '/admin/seo' },
                { step: '5', text: 'Check sitemap coverage', link: '/admin/seo/sitemap' },
              ].map(({ step: s, text, link }) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="font-sans text-[10px] font-semibold text-gray-400 tabular-nums w-5 shrink-0">{s}</span>
                  {link ? (
                    <Link href={link} className="font-sans text-sm text-[#2d6a4f] hover:underline">{text} →</Link>
                  ) : (
                    <p className="font-sans text-sm text-gray-700">{text}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    )
  }

  return null
}
