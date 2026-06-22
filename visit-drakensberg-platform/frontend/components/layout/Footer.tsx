import Link from 'next/link'
import { Instagram, Facebook, Youtube } from 'lucide-react'

const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { label: 'Stays', href: '/stays' },
      { label: 'Hikes', href: '/hikes' },
      { label: 'Activities', href: '/activities' },
      { label: 'Packages', href: '/packages' },
      { label: 'Nature Reserves', href: '/nature-reserves' },
    ],
  },
  {
    heading: 'Regions',
    links: [
      { label: 'Northern Berg', href: '/regions#northern' },
      { label: 'Central Berg', href: '/regions#central' },
      { label: 'Southern Berg', href: '/regions#southern' },
      { label: 'Royal Natal', href: '/regions#royal-natal' },
    ],
  },
  {
    heading: 'Discover',
    links: [
      { label: 'Stories', href: '/stories' },
      { label: 'Plan Your Trip', href: '/plan' },
      { label: 'Trail Map', href: '/hikes' },
      { label: 'Rock Art', href: '/activities' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'List Property', href: '/supplier' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Use', href: '/terms' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="bg-forest text-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-10">
          <Link href="/" className="font-display italic text-3xl text-gold leading-none">
            Visit Drakensberg
          </Link>
          <span className="font-sans text-sm text-white/30 sm:ml-4 mb-0.5">
            Africa&apos;s alpine wilderness
          </span>
        </div>

        <div className="h-px bg-white/10 mb-10" />

        {/* Nav grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-14">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-white/30 mb-4">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-sans text-sm text-white/55 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="h-px bg-white/10 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5">
            <p className="font-sans text-xs text-white/25">
              &copy; {new Date().getFullYear()} visitdrakensberg.com
            </p>
            <span className="hidden sm:block text-white/15">·</span>
            <p className="font-sans text-xs text-white/25">
              KwaZulu-Natal, South Africa
            </p>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
               className="text-white/25 hover:text-white transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
               className="text-white/25 hover:text-white transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube"
               className="text-white/25 hover:text-white transition-colors">
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
