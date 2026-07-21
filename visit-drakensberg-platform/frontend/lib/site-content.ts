import { supabase } from './auth'

// Per-section presentation overrides applied by the visual editor.
export type SectionStyle = {
  background?: string   // CSS colour; overrides the section's default background
  paddingY?: number     // vertical padding in px; overrides the default
}

export type HomeCard = Record<string, string | boolean> & { id: string; visible?: boolean }

// Default values mirror exactly what the live site renders.
// The admin website editor reads these as initial state; Supabase overrides them when saved.
export const SITE_CONTENT_DEFAULTS = {
  hero: {
    headline: 'The Barrier\nof Spears',
    subheadline: "Africa's highest mountain range. A UNESCO World Heritage Site. Two hundred kilometres of wild escarpment.",
    cta_label: 'Plan Your Trip',
    cta_link: '/plan',
    image_url: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=1800&q=85',
    video_url: '',
    overlay_opacity: 40,
    location_label: 'KwaZulu-Natal · South Africa',
  },
  promotions: {
    enabled: false,
    banner_text: 'Winter Special — 20% off selected lodges this July',
    banner_link: '/stays',
    banner_color: '#2d6a4f',
    deals_heading: 'Current Deals & Offers',
    max_deals: 3,
  },
  footer: {
    tagline: "Africa's alpine wilderness",
    copyright: 'visitdrakensberg.com',
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    youtube: 'https://youtube.com',
    contact_email: 'hello@visitdrakensberg.com',
    address: 'KwaZulu-Natal, South Africa',
  },
  about: {
    heading: 'About Visit Drakensberg',
    body: 'Visit Drakensberg is the premier tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site.',
    platform_description: "Africa's highest mountain range. Book stays, hikes, and experiences across the Drakensberg escarpment.",
  },
  homepage_featured: {
    heading: 'Handpicked Experiences',
    subheading: 'From summit hikes to starlit stays — curated by our local experts.',
    max_listings: 6,
    regions: ['All'],
    types: ['Accommodation', 'Hiking', 'Activities', 'Experiences'],
  },
  // Repeating card collections on the homepage — fully editable in the visual
  // editor (add / duplicate / reorder / hide / delete).
  home_cards: {
    categories: [
      { id: 'cat-stays', label: 'Stays', href: '/stays', img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80', visible: true },
      { id: 'cat-hikes', label: 'Hikes', href: '/hikes', img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80', visible: true },
      { id: 'cat-activities', label: 'Activities', href: '/activities', img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80', visible: true },
      { id: 'cat-reserves', label: 'Reserves', href: '/nature-reserves', img: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=600&q=80', visible: true },
      { id: 'cat-packages', label: 'Packages', href: '/packages', img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', visible: true },
    ] as HomeCard[],
    regions: [
      {
        id: 'reg-north', name: 'North Berg', subtitle: 'Royal Natal · Bergville · Amphitheatre',
        desc: 'Home to the iconic Amphitheatre and Tugela Falls — the second highest waterfall in the world. Gateway town: Bergville.',
        img: 'https://images.unsplash.com/photo-1590098563548-8f14eed3a47f?w=900&q=80', href: '/regions#northern', visible: true,
      },
      {
        id: 'reg-central', name: 'Central Berg', subtitle: 'Cathedral Peak · Winterton · Champagne Valley',
        desc: 'Alpine meadows, the richest San rock art in the world and dramatic escarpment views stretching to Lesotho. Gateway town: Winterton.',
        img: 'https://images.unsplash.com/photo-1542587222-e14b891ee40b?w=900&q=80', href: '/regions#central', visible: true,
      },
      {
        id: 'reg-south', name: 'South Berg', subtitle: 'Sani Pass · Underberg · Himeville',
        desc: 'The legendary Sani Pass climbs to Lesotho through a raw mountain landscape. Boutique villages Himeville and Underberg sit at its foot.',
        img: 'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?w=900&q=80', href: '/regions#southern', visible: true,
      },
    ] as HomeCard[],
    stories: [
      {
        id: 'story-vulture', tag: 'Wildlife', title: "Africa's rarest raptor: the bearded vulture of the Berg",
        img: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80',
        href: '/mydrakensberg/bearded-vulture-lammergeier', date: 'March 2025', visible: true,
      },
      {
        id: 'story-rock-art', tag: 'Heritage', title: "The ancient language of the San: rock art at Giant's Castle",
        img: 'https://images.unsplash.com/photo-1529946179074-1f3cf40c0a0e?w=800&q=80',
        href: '/mydrakensberg/san-bushmen-rock-art-giants-castle', date: 'January 2025', visible: true,
      },
      {
        id: 'story-chain-ladder', tag: 'Adventure', title: 'Climbing the Chain Ladder: what nobody tells you',
        img: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80',
        href: '/mydrakensberg/tugela-falls-chain-ladder-guide', date: 'November 2024', visible: true,
      },
    ] as HomeCard[],
  },
  // Section layout for the homepage: render order, hidden sections, and
  // per-section style overrides (keyed by section id, shared by all pages).
  home_layout: {
    section_order: ['stats', 'categories', 'regions', 'stories', 'trails', 'newsletter'] as string[],
    hidden: [] as string[],
    styles: {} as Record<string, SectionStyle>,
  },
  home_sections: {
    stat_1_value: '3,482m', stat_1_label: 'Highest Peak',
    stat_2_value: '243,000', stat_2_label: 'Hectares Protected',
    stat_3_value: '500+', stat_3_label: 'Bird Species',
    stat_4_value: '20,000+', stat_4_label: 'San Rock Art Sites',
    categories_eyebrow: 'What to do', categories_heading: 'Explore the Berg',
    regions_eyebrow: 'By region', regions_heading: 'Choose your Berg',
    stories_eyebrow: 'Journal', stories_heading: 'Stories from the Berg',
    trails_eyebrow: 'On foot', trails_heading: 'Top trails',
    newsletter_eyebrow: 'Stay informed', newsletter_heading: 'Berg dispatches',
    newsletter_body: 'Seasonal trail conditions, new accommodation, and stories from the escarpment — delivered monthly.',
  },
  stays_page: {
    eyebrow: 'Where to sleep',
    heading: 'Places to Stay',
    subheading: 'Lodges, resorts, camps and cabins across the Drakensberg',
  },
  hikes_page: {
    eyebrow: 'On foot',
    heading: 'Hikes & Trails',
    subheading: 'From gentle valley walks to multi-day escarpment routes',
  },
  activities_page: {
    eyebrow: 'Things to do',
    heading: 'Activities',
    subheading: 'Guided experiences, tours and adventures across the Drakensberg',
  },
  reserves_page: {
    eyebrow: 'Protected wilderness',
    heading: 'Nature Reserves',
    subheading: "Explore South Africa's most iconic mountain wilderness through named peaks and curated trails.",
  },
  regions_page: {
    eyebrow: 'Where to go',
    heading: 'Choose your Berg',
    subheading: 'Regions are configured by the admin team and used as the source of truth for stays, hikes, activities, routes and customer journey tracking.',
    towns_eyebrow: 'Where to base yourself',
    towns_heading: 'Surrounding Towns & Villages',
    towns_subheading: 'Gateway towns, boutique villages and farm stops that frame the Drakensberg experience.',
  },
  towns_page: {
    eyebrow: 'Where to base yourself',
    heading: 'Towns & Cities',
    subheading: 'Gateway towns, boutique villages and farm stops that frame the Drakensberg experience — grouped by the region they serve.',
  },
  stories_page: {
    eyebrow: 'MyDrakensberg',
    heading: 'Stories from the Berg',
    subheading: 'In-depth writing on the culture, history, wildlife and landscapes of the Drakensberg — from guides, historians, naturalists and storytellers who know the Berg deeply.',
  },
  plan_page: {
    eyebrow: 'Your journey',
    heading: 'Plan your\nBerg trip',
    subheading: 'The Drakensberg rewards a little preparation. Use this guide to choose when to go, where to stay, and what to bring.',
    seasons_eyebrow: 'Timing', seasons_heading: 'When to go',
    itineraries_eyebrow: 'Itineraries', itineraries_heading: 'How long to stay',
    essentials_eyebrow: 'Need to know', essentials_heading: 'Essentials',
    essential_1_title: 'Getting there',
    essential_1_body: 'Fly to Durban (King Shaka) or Johannesburg (OR Tambo). From Durban it\'s a 3.5-hour drive to the Northern Berg, 2.5 hours to the Central Berg. Car hire is recommended.',
    essential_2_title: 'Entry & permits',
    essential_2_body: 'A daily conservation fee applies in all KZN Wildlife reserves. Hiking permits for overnight trails must be pre-booked. No entry visa required for most nationalities for stays under 90 days.',
    essential_3_title: 'What to bring',
    essential_3_body: 'Layers are essential at any time of year — temperatures drop fast above 2,000 m. A waterproof shell, broken-in hiking boots, sun protection, and a 2-litre water capacity are minimum requirements.',
    essential_4_title: 'Safety',
    essential_4_body: 'Never hike alone above the escarpment. Register your route with the camp office. Carry a whistle, first aid kit, and a charged phone. Afternoon lightning is common in summer — be off exposed ridges by 1 pm.',
  },
  about_page: {
    eyebrow: 'Our story',
    heading: 'About Visit Drakensberg',
    body_1: 'Visit Drakensberg is the premier tourism discovery and booking platform for the uKhahlamba-Drakensberg Park, a UNESCO World Heritage Site. We connect visitors with local accommodation providers, mountain guides, activity operators and shuttle services across the full 200-kilometre escarpment — from Royal Natal in the north to Sani Pass and Bushman\'s Nek in the south.',
    body_2: 'Every listing on the platform is operated by a local supplier. Booking through Visit Drakensberg keeps tourism revenue in the communities that call these mountains home, and helps fund the conservation of one of the richest natural and cultural landscapes in Southern Africa — including more than 20,000 San rock art sites, the highest waterfall in Africa, and the last South African stronghold of the bearded vulture.',
    suppliers_heading: 'For suppliers',
    suppliers_body: 'Run a lodge, guide hikes, operate shuttles or host experiences in the Berg? List your business on Visit Drakensberg and reach travellers planning their trip.',
    suppliers_cta: 'List your property',
    contact_heading: 'Contact',
    contact_email: 'hello@visitdrakensberg.com',
  },
}

export type SiteContentKey = keyof typeof SITE_CONTENT_DEFAULTS
export type SiteContent = typeof SITE_CONTENT_DEFAULTS

async function fetchKey<K extends SiteContentKey>(key: K): Promise<SiteContent[K]> {
  try {
    const { data } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (data?.value) {
      return { ...SITE_CONTENT_DEFAULTS[key], ...data.value } as SiteContent[K]
    }
  } catch {
    // table may not exist yet — fall through to defaults
  }
  return SITE_CONTENT_DEFAULTS[key]
}

export async function getSiteContent<K extends SiteContentKey>(key: K): Promise<SiteContent[K]> {
  return fetchKey(key)
}

export async function getAllSiteContent(): Promise<SiteContent> {
  try {
    const { data } = await supabase.from('site_content').select('key, value')
    if (data && data.length > 0) {
      const result = structuredClone(SITE_CONTENT_DEFAULTS) as SiteContent
      for (const row of data) {
        const k = row.key as SiteContentKey
        if (k in result) {
          result[k] = { ...result[k], ...row.value }
        }
      }
      return result
    }
  } catch {
    // fall through
  }
  return structuredClone(SITE_CONTENT_DEFAULTS) as SiteContent
}

export async function setSiteContent<K extends SiteContentKey>(key: K, value: SiteContent[K]): Promise<void> {
  const { error } = await supabase.from('site_content').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

/* ── Visual editor: drafts, publishing, rollback ─────────────────────────────
 * Draft changes live in the `site_editor_draft` row of site_content as
 * { sections: { [sectionKey]: { [fieldKey]: value } } } and never affect the
 * live site until published. Publishing snapshots the previous live values
 * into `site_editor_backup` so the last publish can be rolled back.
 */

export type EditorPending = Record<string, Record<string, any>>

async function getRawRow(key: string): Promise<any | null> {
  const { data, error } = await supabase.from('site_content').select('value').eq('key', key).maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

async function setRawRow(key: string, value: any): Promise<void> {
  const { error } = await supabase.from('site_content').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) throw error
}

export async function getEditorDraft(): Promise<{ sections: EditorPending; updatedAt?: string } | null> {
  const value = await getRawRow('site_editor_draft')
  if (value && typeof value.sections === 'object' && Object.keys(value.sections).length > 0) return value
  return null
}

export async function saveEditorDraft(sections: EditorPending): Promise<void> {
  await setRawRow('site_editor_draft', { sections, updatedAt: new Date().toISOString() })
}

export async function clearEditorDraft(): Promise<void> {
  await setRawRow('site_editor_draft', { sections: {} })
}

/** Publish draft changes: back up current live values, then merge each
 *  changed field into its live section. */
export async function publishEditorSections(sections: EditorPending): Promise<void> {
  const keys = Object.keys(sections) as SiteContentKey[]
  if (keys.length === 0) return
  const backup: Record<string, any> = {}
  const merged: Record<string, any> = {}
  for (const key of keys) {
    const current = await getSiteContent(key)
    backup[key] = current
    merged[key] = { ...current, ...sections[key] }
  }
  await setRawRow('site_editor_backup', { sections: backup, publishedAt: new Date().toISOString() })
  for (const key of keys) {
    await setSiteContent(key, merged[key])
  }
  await clearEditorDraft()
}

export async function getEditorBackup(): Promise<{ sections: Record<string, any>; publishedAt?: string } | null> {
  const value = await getRawRow('site_editor_backup')
  if (value && typeof value.sections === 'object' && Object.keys(value.sections).length > 0) return value
  return null
}

/** Restore the live values captured at the last publish. */
export async function rollbackLastPublish(): Promise<boolean> {
  const backup = await getEditorBackup()
  if (!backup) return false
  for (const key of Object.keys(backup.sections)) {
    await setSiteContent(key as SiteContentKey, backup.sections[key])
  }
  await setRawRow('site_editor_backup', { sections: {} })
  return true
}
