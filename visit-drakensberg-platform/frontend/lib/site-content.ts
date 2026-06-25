import { supabase } from './auth'

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
  await supabase.from('site_content').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}
