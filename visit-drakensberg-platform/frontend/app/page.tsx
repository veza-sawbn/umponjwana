import type { Metadata } from 'next'
import HomeContent from './HomeContent'

// The homepage's canonical lives here rather than in the root layout: a
// layout's `alternates` is inherited by every page beneath it that doesn't set
// its own, so a canonical of '/' at the root told search engines that those
// pages were duplicates of the homepage.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return <HomeContent />
}
