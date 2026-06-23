'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

type Section =
  | 'hero'
  | 'featured'
  | 'promos'
  | 'footer'
  | 'nav'
  | 'about'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'hero', label: 'Hero Banner' },
  { id: 'featured', label: 'Homepage Featured' },
  { id: 'promos', label: 'Promotions & Offers' },
  { id: 'footer', label: 'Footer Content' },
  { id: 'nav', label: 'Navigation Links' },
  { id: 'about', label: 'About / Platform Copy' },
]

type NavItem = { id: string; label: string; href: string; visible: boolean }

export default function AdminWebsitePage() {
  const [activeSection, setActiveSection] = useState<Section>('hero')
  const [savedSection, setSavedSection] = useState<Section | null>(null)

  // Hero
  const [hero, setHero] = useState({
    headline: "Africa's Greatest Mountain Range",
    subheadline: 'Discover world-class hiking, luxury lodges, and ancient San rock art in the uKhahlamba-Drakensberg.',
    ctaLabel: 'Explore the Berg',
    ctaLink: '/explore',
    bgImage: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
    bgVideo: '',
    overlayOpacity: 40,
  })

  // Featured
  const [featured, setFeatured] = useState({
    heading: 'Handpicked Experiences',
    subheading: 'From summit hikes to starlit stays — curated by our local experts.',
    maxListings: 6,
    regions: ['All'] as string[],
    types: ['Accommodation', 'Hiking', 'Activities', 'Experiences'] as string[],
  })

  // Promos
  const [promos, setPromos] = useState({
    bannerEnabled: true,
    bannerText: 'Winter Special: 20% off selected lodges — book before 31 July',
    bannerLink: '/deals',
    bannerColor: '#2d6a4f',
    dealsHeading: 'Current Deals & Offers',
    maxDeals: 3,
  })

  // Footer
  const [footer, setFooter] = useState({
    tagline: 'Your trusted guide to the uKhahlamba-Drakensberg World Heritage Site.',
    copyright: `© ${new Date().getFullYear()} Visit Drakensberg. All rights reserved.`,
    instagram: 'https://instagram.com/visitdrakensberg',
    facebook: 'https://facebook.com/visitdrakensberg',
    twitter: 'https://twitter.com/visitdrakensberg',
    email: 'hello@visitdrakensberg.co.za',
    address: 'KwaZulu-Natal, South Africa',
  })

  // Nav
  const [navItems, setNavItems] = useState<NavItem[]>([
    { id: 'n1', label: 'Explore', href: '/explore', visible: true },
    { id: 'n2', label: 'Hiking Trails', href: '/trails', visible: true },
    { id: 'n3', label: 'Accommodation', href: '/accommodation', visible: true },
    { id: 'n4', label: 'Regions', href: '/regions', visible: true },
    { id: 'n5', label: 'Blog', href: '/blog', visible: true },
    { id: 'n6', label: 'Contact', href: '/contact', visible: false },
  ])
  const [newNavItem, setNewNavItem] = useState({ label: '', href: '' })

  // About
  const [about, setAbout] = useState({
    heading: 'About Visit Drakensberg',
    body: "Visit Drakensberg is an independent travel platform dedicated to showcasing the best of the uKhahlamba-Drakensberg — a UNESCO World Heritage Site spanning 243,000 hectares of dramatic basalt peaks, ancient San rock art, and extraordinary biodiversity.\n\nWe work with local suppliers, guides, and conservancies to bring you authentic, responsible travel experiences.",
    platformDescription: 'The uKhahlamba-Drakensberg Park is a World Heritage Site in KwaZulu-Natal, South Africa, known for its spectacular mountain scenery, San Bushmen rock paintings, and diverse ecosystems.',
  })

  function save(section: Section) {
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }

  function updateNavItem(id: string, field: keyof NavItem, value: string | boolean) {
    setNavItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  function addNavItem() {
    if (!newNavItem.label || !newNavItem.href) return
    setNavItems(items => [...items, { id: `n${Date.now()}`, ...newNavItem, visible: true }])
    setNewNavItem({ label: '', href: '' })
  }

  function removeNavItem(id: string) {
    setNavItems(items => items.filter(item => item.id !== id))
  }

  function toggleRegion(region: string) {
    setFeatured(f => {
      const has = f.regions.includes(region)
      return { ...f, regions: has ? f.regions.filter(r => r !== region) : [...f.regions, region] }
    })
  }

  function toggleType(type: string) {
    setFeatured(f => {
      const has = f.types.includes(type)
      return { ...f, types: has ? f.types.filter(t => t !== type) : [...f.types, type] }
    })
  }

  const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
  const labelCls = 'block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5'

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
        <h1 className="font-display italic text-3xl text-[#000000]">Website Editor</h1>
      </div>

      <div className="flex gap-6 items-start">
        {/* Left section selector */}
        <div className="w-52 shrink-0 bg-white border border-gray-200">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`w-full text-left px-4 py-3 font-sans text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                activeSection === s.id
                  ? 'bg-[#2d6a4f] text-white'
                  : 'text-gray-700 hover:bg-[#F7F5F2]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Right editor panel */}
        <div className="flex-1 bg-white border border-gray-200 p-6">

          {/* Hero Banner */}
          {activeSection === 'hero' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">Hero Banner</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Headline</label>
                  <input value={hero.headline} onChange={e => setHero(h => ({ ...h, headline: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Subheadline</label>
                  <textarea value={hero.subheadline} onChange={e => setHero(h => ({ ...h, subheadline: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>CTA Button Label</label>
                    <input value={hero.ctaLabel} onChange={e => setHero(h => ({ ...h, ctaLabel: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>CTA Button Link</label>
                    <input value={hero.ctaLink} onChange={e => setHero(h => ({ ...h, ctaLink: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Background Image URL</label>
                  <input value={hero.bgImage} onChange={e => setHero(h => ({ ...h, bgImage: e.target.value }))} className={inputCls} placeholder="https://…" />
                  {hero.bgImage && (
                    <img src={hero.bgImage} alt="Preview" className="mt-2 h-20 object-cover w-full" />
                  )}
                </div>
                <div>
                  <label className={labelCls}>Background Video URL (optional — overrides image)</label>
                  <input value={hero.bgVideo} onChange={e => setHero(h => ({ ...h, bgVideo: e.target.value }))} className={inputCls} placeholder="https://…mp4" />
                </div>
                <div>
                  <label className={labelCls}>Overlay Opacity — {hero.overlayOpacity}%</label>
                  <input
                    type="range" min={0} max={100} value={hero.overlayOpacity}
                    onChange={e => setHero(h => ({ ...h, overlayOpacity: Number(e.target.value) }))}
                    className="w-full accent-[#2d6a4f]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Homepage Featured */}
          {activeSection === 'featured' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">Homepage Featured</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Section Heading</label>
                  <input value={featured.heading} onChange={e => setFeatured(f => ({ ...f, heading: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Section Subheading</label>
                  <textarea value={featured.subheading} onChange={e => setFeatured(f => ({ ...f, subheading: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Max Listings to Show (1–12)</label>
                  <input type="number" min={1} max={12} value={featured.maxListings} onChange={e => setFeatured(f => ({ ...f, maxListings: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Filter by Region</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['All', 'Northern Berg', 'Central Berg', 'Southern Berg'].map(r => (
                      <label key={r} className="flex items-center gap-1.5 font-sans text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={featured.regions.includes(r)} onChange={() => toggleRegion(r)} className="accent-[#2d6a4f]" />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Filter by Type</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {['Accommodation', 'Hiking', 'Activities', 'Experiences'].map(t => (
                      <label key={t} className="flex items-center gap-1.5 font-sans text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={featured.types.includes(t)} onChange={() => toggleType(t)} className="accent-[#2d6a4f]" />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Promotions */}
          {activeSection === 'promos' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">Promotions & Offers</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">Promo Banner</label>
                  <button
                    onClick={() => setPromos(p => ({ ...p, bannerEnabled: !p.bannerEnabled }))}
                    className={`w-10 h-5 relative transition-colors ${promos.bannerEnabled ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white transition-all ${promos.bannerEnabled ? 'left-5' : 'left-0.5'}`} />
                  </button>
                  <span className="font-sans text-sm text-gray-500">{promos.bannerEnabled ? 'On' : 'Off'}</span>
                </div>
                {promos.bannerEnabled && (
                  <>
                    <div>
                      <label className={labelCls}>Banner Text</label>
                      <input value={promos.bannerText} onChange={e => setPromos(p => ({ ...p, bannerText: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Banner Link</label>
                      <input value={promos.bannerLink} onChange={e => setPromos(p => ({ ...p, bannerLink: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Banner Background Colour</label>
                      <input type="color" value={promos.bannerColor} onChange={e => setPromos(p => ({ ...p, bannerColor: e.target.value }))} className="h-10 w-20 border border-gray-200 bg-[#F7F5F2] cursor-pointer p-1" />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>Featured Deals Heading</label>
                  <input value={promos.dealsHeading} onChange={e => setPromos(p => ({ ...p, dealsHeading: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Max Deals Shown (1–6)</label>
                  <input type="number" min={1} max={6} value={promos.maxDeals} onChange={e => setPromos(p => ({ ...p, maxDeals: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          {activeSection === 'footer' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">Footer Content</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Footer Tagline</label>
                  <textarea value={footer.tagline} onChange={e => setFooter(f => ({ ...f, tagline: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Copyright Text</label>
                  <input value={footer.copyright} onChange={e => setFooter(f => ({ ...f, copyright: e.target.value }))} className={inputCls} />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={labelCls}>Instagram URL</label>
                    <input value={footer.instagram} onChange={e => setFooter(f => ({ ...f, instagram: e.target.value }))} className={inputCls} placeholder="https://instagram.com/…" />
                  </div>
                  <div>
                    <label className={labelCls}>Facebook URL</label>
                    <input value={footer.facebook} onChange={e => setFooter(f => ({ ...f, facebook: e.target.value }))} className={inputCls} placeholder="https://facebook.com/…" />
                  </div>
                  <div>
                    <label className={labelCls}>Twitter / X URL</label>
                    <input value={footer.twitter} onChange={e => setFooter(f => ({ ...f, twitter: e.target.value }))} className={inputCls} placeholder="https://twitter.com/…" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Contact Email</label>
                  <input value={footer.email} onChange={e => setFooter(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Physical Address</label>
                  <textarea value={footer.address} onChange={e => setFooter(f => ({ ...f, address: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          {activeSection === 'nav' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">Navigation Links</h2>
              <table className="w-full mb-6 border border-gray-200">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Label', 'Href', 'Visible', ''].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {navItems.map(item => (
                    <tr key={item.id} className="hover:bg-[#F7F5F2] transition-colors">
                      <td className="px-4 py-2.5">
                        <input
                          value={item.label}
                          onChange={e => updateNavItem(item.id, 'label', e.target.value)}
                          className="w-full border border-gray-200 px-2 py-1.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          value={item.href}
                          onChange={e => updateNavItem(item.id, 'href', e.target.value)}
                          className="w-full border border-gray-200 px-2 py-1.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="checkbox" checked={item.visible} onChange={e => updateNavItem(item.id, 'visible', e.target.checked)} className="accent-[#2d6a4f]" />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => removeNavItem(item.id)} className="font-sans text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-3">
                <input
                  value={newNavItem.label}
                  onChange={e => setNewNavItem(n => ({ ...n, label: e.target.value }))}
                  className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] w-40"
                  placeholder="Label"
                />
                <input
                  value={newNavItem.href}
                  onChange={e => setNewNavItem(n => ({ ...n, href: e.target.value }))}
                  className="border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] w-40"
                  placeholder="/path"
                />
                <button onClick={addNavItem} className="bg-[#2d6a4f] text-white px-4 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors">Add Item</button>
              </div>
            </div>
          )}

          {/* About */}
          {activeSection === 'about' && (
            <div>
              <h2 className="font-display italic text-xl mb-6">About / Platform Copy</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>About Heading</label>
                  <input value={about.heading} onChange={e => setAbout(a => ({ ...a, heading: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>About Body</label>
                  <textarea value={about.body} onChange={e => setAbout(a => ({ ...a, body: e.target.value }))} rows={8} className={`${inputCls} resize-none`} />
                </div>
                <div>
                  <label className={labelCls}>Platform Description (meta / SEO fallback)</label>
                  <textarea value={about.platformDescription} onChange={e => setAbout(a => ({ ...a, platformDescription: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center gap-4">
            <button
              onClick={() => save(activeSection)}
              className="bg-[#2d6a4f] text-white px-6 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
            >
              Save Section
            </button>
            {savedSection === activeSection && (
              <span className="flex items-center gap-1.5 font-sans text-sm text-[#2d6a4f]">
                <Check size={15} /> Saved ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
