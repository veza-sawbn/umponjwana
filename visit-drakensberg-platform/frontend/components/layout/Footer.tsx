'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Instagram, Facebook, Youtube } from 'lucide-react'
import { getSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import { useEditMode } from '@/lib/edit-mode-context'
import Editable from '@/components/editor/Editable'

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
      { label: 'Stories', href: '/mydrakensberg' },
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
  const [content, setContent] = useState(SITE_CONTENT_DEFAULTS.footer)
  const editMode = useEditMode()

  useEffect(() => {
    getSiteContent('footer').then(setContent)
  }, [])

  const tagline = editMode?.getValue('footer', 'tagline', content.tagline) ?? content.tagline
  const copyright = editMode?.getValue('footer', 'copyright', content.copyright) ?? content.copyright
  const address = editMode?.getValue('footer', 'address', content.address) ?? content.address
  const contactEmail = editMode?.getValue('footer', 'contact_email', content.contact_email) ?? content.contact_email

  return (
    <footer className="bg-forest text-white">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-16">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-10">
          <Link href="/" className="font-display italic text-3xl text-gold leading-none">
            Visit Drakensberg
          </Link>
          <Editable section="footer" fieldKey="tagline" value={tagline} label="Tagline" type="text" as="span">
            <span className="font-sans text-sm text-white/30 sm:ml-4 mb-0.5">
              {tagline}
            </span>
          </Editable>
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
            <Editable section="footer" fieldKey="copyright" value={copyright} label="Copyright" type="text">
              <p className="font-sans text-xs text-white/25">
                &copy; {new Date().getFullYear()} {copyright}
              </p>
            </Editable>
            <span className="hidden sm:block text-white/15">·</span>
            <Editable section="footer" fieldKey="address" value={address} label="Address" type="text">
              <p className="font-sans text-xs text-white/25">
                {address}
              </p>
            </Editable>
          </div>
          <div className="flex items-center gap-5">
            <a href={content.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
               className="text-white/25 hover:text-white transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <a href={content.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
               className="text-white/25 hover:text-white transition-colors">
              <Facebook className="w-4 h-4" />
            </a>
            <a href={content.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
               className="text-white/25 hover:text-white transition-colors">
              <Youtube className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
