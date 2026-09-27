import { ImageResponse } from 'next/og'

// The default share card for any page without a photo of its own (see
// DEFAULT_OG_IMAGE in lib/seo.ts). Rendered once at build time.
export const alt = 'Visit Drakensberg: stays, hikes and experiences in the uKhahlamba-Drakensberg'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#2d6a4f',
          color: '#F7F5F2',
          padding: '72px 80px 0',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 26, letterSpacing: 8, textTransform: 'uppercase', color: '#C9A96E', fontFamily: 'sans-serif' }}>
            uKhahlamba-Drakensberg · South Africa
          </div>
          <div style={{ fontSize: 96, fontStyle: 'italic', marginTop: 24, lineHeight: 1.05 }}>Visit Drakensberg</div>
          <div style={{ fontSize: 34, marginTop: 20, color: 'rgba(247,245,242,0.8)', fontFamily: 'sans-serif' }}>
            Stays, hikes, tours and experiences in the Berg
          </div>
        </div>
        <svg width="1200" height="220" viewBox="0 0 1200 220" style={{ marginLeft: -80 }}>
          <path d="M0 220 L170 90 L280 150 L460 30 L600 120 L740 60 L900 140 L1040 70 L1200 150 L1200 220 Z" fill="#C9A96E" />
          <path d="M460 30 L432 58 L452 52 L464 64 L480 50 L492 56 Z" fill="#F7F5F2" />
        </svg>
      </div>
    ),
    size,
  )
}
