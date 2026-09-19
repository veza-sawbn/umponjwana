import { ImageResponse } from 'next/og'

/**
 * The site-wide fallback share card.
 *
 * Nothing on the site had one: the root metadata set an OG title, description
 * and locale but no image, so every share of the homepage or of any of the
 * category pages — the pages most likely to be pasted into WhatsApp, which is
 * how a Drakensberg trip actually gets planned — rendered as a bare grey link.
 *
 * A root-level opengraph-image applies to every route that does not resolve
 * one of its own, so the detail pages keep using their listing photo
 * (app/stays/[id]/page.tsx and friends set openGraph.images) and everything
 * else falls back to this. Drawn rather than served as a static file so the
 * wordmark stays sharp at the 1200×630 Facebook/WhatsApp/X all read.
 */
export const runtime = 'edge'
export const alt = 'Visit Drakensberg — stays, hikes, activities and guided tours in the Drakensberg mountains'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(160deg, #0b1a12 0%, #17301f 55%, #2f4a34 100%)',
          padding: '72px 80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 8,
            textTransform: 'uppercase',
            color: '#C9A96E',
          }}
        >
          Visit Drakensberg
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 84, lineHeight: 1.05, color: '#F7F5F2' }}>
            The Drakensberg,
          </div>
          <div style={{ display: 'flex', fontSize: 84, lineHeight: 1.05, color: '#F7F5F2' }}>
            end to end.
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 32, color: 'rgba(247,245,242,0.72)' }}>
            Stays · Hikes · Activities · Guided tours · Shuttles
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 26,
            color: 'rgba(247,245,242,0.6)',
          }}
        >
          <div style={{ display: 'flex' }}>visitdrakensberg.com</div>
          <div style={{ display: 'flex' }}>uKhahlamba · KwaZulu-Natal · South Africa</div>
        </div>
      </div>
    ),
    size,
  )
}
