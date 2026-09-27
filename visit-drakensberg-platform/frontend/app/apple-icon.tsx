import { ImageResponse } from 'next/og'

// Home-screen icon for iOS. Same mountain mark as app/icon.svg; iOS rounds the
// corners itself, so the tile is square here.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#2d6a4f' }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path d="M6 50 L22 24 L30 36 L41 16 L58 50 Z" fill="#C9A96E" />
          <path d="M41 16 L35.5 26 L39 24.5 L41.5 27 L44.5 24 L47 25.5 Z" fill="#F7F5F2" />
        </svg>
      </div>
    ),
    size,
  )
}
