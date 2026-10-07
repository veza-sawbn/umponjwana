import HomePage from '@/components/home/HomePage'
import { loadSiteContent } from '@/lib/site-content'
import { DEFAULT_REGIONS, getRegions } from '@/lib/regions'
import { publicSupabase } from '@/lib/supabase-public'
import { SiteContentSeedProvider } from '@/lib/use-site-section'

// The homepage renders its CMS content (hero, cards, copy, layout) and the
// region records on the server, so the first HTML shows the real photos and
// text — not SITE_CONTENT_DEFAULTS' placeholders followed by a swap — and
// the hero image starts downloading with the page. Regenerated every
// minute; the client still refreshes in the background after load.
export const revalidate = 60

export default async function Page() {
  const [content, regions] = await Promise.all([
    loadSiteContent(publicSupabase).catch(() => null),
    getRegions(publicSupabase).catch(() => DEFAULT_REGIONS),
  ])
  // Only the sections the homepage reads — the rest stay out of the payload.
  const homeContent = content && {
    hero: content.hero,
    promotions: content.promotions,
    home_cards: content.home_cards,
    home_sections: content.home_sections,
    home_layout: content.home_layout,
    footer: content.footer,
  }
  return (
    <SiteContentSeedProvider value={homeContent}>
      <HomePage
        initialContent={homeContent ?? undefined}
        // getRegions() returns DEFAULT_REGIONS itself when the read fails;
        // those built-in records are never shown as if they were live.
        initialRegions={regions === DEFAULT_REGIONS ? undefined : regions}
      />
    </SiteContentSeedProvider>
  )
}
