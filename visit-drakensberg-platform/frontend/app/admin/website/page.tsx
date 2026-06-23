'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, Plus, Trash2, ExternalLink, Paintbrush } from 'lucide-react'
import Link from 'next/link'
import { getAllSiteContent, setSiteContent, SITE_CONTENT_DEFAULTS } from '@/lib/site-content'

type Section = 'hero' | 'featured' | 'promos' | 'footer' | 'nav' | 'about'

const SECTIONS: { id: Section; label: string; desc: string }[] = [
  { id: 'hero', label: 'Hero Banner', desc: 'Homepage headline, background image/video, CTA' },
  { id: 'featured', label: 'Homepage Featured', desc: 'Featured listings section config' },
  { id: 'promos', label: 'Promotions & Offers', desc: 'Promotional banner and deals section' },
  { id: 'footer', label: 'Footer Content', desc: 'Tagline, copyright, social links, contact' },
  { id: 'nav', label: 'Navigation Links', desc: 'Main site navigation items' },
  { id: 'about', label: 'About / Platform Copy', desc: 'Platform description and about text' },
]

const REGION_OPTIONS = ['All', 'Northern Berg', 'Central Berg', 'Southern Berg']
const TYPE_OPTIONS = ['Accommodation', 'Hiking', 'Activities', 'Experiences', 'Events']

type NavItem = { id: string; label: string; href: string; visible: boolean }

const DEFAULT_NAV: NavItem[] = [
  { id: 'n1', label: 'Stays', href: '/stays', visible: true },
  { id: 'n2', label: 'Hikes', href: '/hikes', visible: true },
  { id: 'n3', label: 'Activities', href: '/activities', visible: true },
  { id: 'n4', label: 'Reserves', href: '/nature-reserves', visible: true },
  { id: 'n5', label: 'Regions', href: '/regions', visible: true },
  { id: 'n6', label: 'Stories', href: '/mydrakensberg', visible: true },
  { id: 'n7', label: 'Plan', href: '/plan', visible: true },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]'
const textareaCls = `${inputCls} resize-none`

export default function AdminWebsitePage() {
  const [activeSection, setActiveSection] = useState<Section>('hero')
  const [savedSection, setSavedSection] = useState<Section | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Section states — initialised from defaults, overwritten when Supabase loads
  const [hero, setHero] = useState(SITE_CONTENT_DEFAULTS.hero)
  const [featured, setFeatured] = useState(SITE_CONTENT_DEFAULTS.homepage_featured)
  const [promos, setPromos] = useState(SITE_CONTENT_DEFAULTS.promotions)
  const [footer, setFooter] = useState(SITE_CONTENT_DEFAULTS.footer)
  const [about, setAbout] = useState(SITE_CONTENT_DEFAULTS.about)
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV)
  const [newNavItem, setNewNavItem] = useState({ label: '', href: '' })

  useEffect(() => {
    getAllSiteContent().then(content => {
      setHero(content.hero)
      setFeatured(content.homepage_featured)
      setPromos(content.promotions)
      setFooter(content.footer)
      setAbout(content.about)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    const saves: Promise<void>[] = []
    if (activeSection === 'hero') saves.push(setSiteContent('hero', hero))
    if (activeSection === 'featured') saves.push(setSiteContent('homepage_featured', featured))
    if (activeSection === 'promos') saves.push(setSiteContent('promotions', promos))
    if (activeSection === 'footer') saves.push(setSiteContent('footer', footer))
    if (activeSection === 'about') saves.push(setSiteContent('about', about))
    // nav: store as homepage_featured for now (would need its own key in production)
    await Promise.all(saves)
    setSaving(false)
    setSavedSection(activeSection)
    setTimeout(() => setSavedSection(null), 2500)
  }

  function toggleMulti<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-400">
        <Loader2 size={16} className="animate-spin" />
        <span className="font-sans text-sm">Loading site content from Supabase…</span>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-1">Admin Console</p>
          <h1 className="font-display italic text-3xl text-[#000000]">Website Editor</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Changes save to Supabase and reflect on the live site immediately.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/editor"
            className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
          >
            <Paintbrush size={13} />
            Visual Editor
          </Link>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-500 px-4 py-2.5 font-sans text-sm hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors"
          >
            <ExternalLink size={13} />
            View Live Site
          </a>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Section selector */}
        <aside className="w-56 shrink-0">
          <div className="bg-white border border-gray-200 overflow-hidden">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-100 last:border-0 transition-colors ${
                  activeSection === s.id
                    ? 'bg-[#2d6a4f] text-white'
                    : 'text-gray-700 hover:bg-[#F7F5F2]'
                }`}
              >
                <p className={`font-sans text-sm font-medium ${activeSection === s.id ? 'text-white' : ''}`}>{s.label}</p>
                <p className={`font-sans text-xs mt-0.5 leading-tight ${activeSection === s.id ? 'text-white/60' : 'text-gray-400'}`}>{s.desc}</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-200 p-6">

            {/* ── Hero Banner ── */}
            {activeSection === 'hero' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">Hero Banner</h2>

                <Field label="Location Label">
                  <input value={hero.location_label} onChange={e => setHero(h => ({ ...h, location_label: e.target.value }))} className={inputCls} placeholder="KwaZulu-Natal · South Africa" />
                </Field>

                <Field label="Headline">
                  <textarea value={hero.headline} onChange={e => setHero(h => ({ ...h, headline: e.target.value }))} rows={2} className={textareaCls} placeholder="The Barrier\nof Spears" />
                  <p className="font-sans text-xs text-gray-400 mt-1">Use \n or a new line for line breaks in the heading.</p>
                </Field>

                <Field label="Subheadline">
                  <textarea value={hero.subheadline} onChange={e => setHero(h => ({ ...h, subheadline: e.target.value }))} rows={3} className={textareaCls} />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="CTA Button Label">
                    <input value={hero.cta_label} onChange={e => setHero(h => ({ ...h, cta_label: e.target.value }))} className={inputCls} placeholder="Plan Your Trip" />
                  </Field>
                  <Field label="CTA Button Link">
                    <input value={hero.cta_link} onChange={e => setHero(h => ({ ...h, cta_link: e.target.value }))} className={inputCls} placeholder="/plan" />
                  </Field>
                </div>

                <Field label="Background Image URL">
                  <input value={hero.image_url} onChange={e => setHero(h => ({ ...h, image_url: e.target.value }))} className={inputCls} placeholder="https://…" />
                  {hero.image_url && (
                    <img src={hero.image_url} alt="Hero preview" className="mt-2 h-28 w-full object-cover border border-gray-200" />
                  )}
                </Field>

                <Field label="Background Video URL (overrides image when set)">
                  <input value={hero.video_url} onChange={e => setHero(h => ({ ...h, video_url: e.target.value }))} className={inputCls} placeholder="https://… (mp4 or webm)" />
                  <p className="font-sans text-xs text-gray-400 mt-1">Leave blank to use the image above. Video autoplays muted.</p>
                </Field>

                <Field label={`Overlay Opacity: ${hero.overlay_opacity}%`}>
                  <input
                    type="range" min={0} max={90} value={hero.overlay_opacity}
                    onChange={e => setHero(h => ({ ...h, overlay_opacity: Number(e.target.value) }))}
                    className="w-full accent-[#2d6a4f]"
                  />
                  <p className="font-sans text-xs text-gray-400 mt-1">Controls the dark overlay on the hero image/video. Higher = darker.</p>
                </Field>
              </div>
            )}

            {/* ── Homepage Featured ── */}
            {activeSection === 'featured' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">Homepage Featured Section</h2>
                <Field label="Section Heading">
                  <input value={featured.heading} onChange={e => setFeatured(f => ({ ...f, heading: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Section Subheading">
                  <textarea value={featured.subheading} onChange={e => setFeatured(f => ({ ...f, subheading: e.target.value }))} rows={2} className={textareaCls} />
                </Field>
                <Field label="Max Listings to Show">
                  <input type="number" min={1} max={12} value={featured.max_listings} onChange={e => setFeatured(f => ({ ...f, max_listings: Number(e.target.value) }))} className={inputCls} />
                </Field>
                <Field label="Filter by Region">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {REGION_OPTIONS.map(r => (
                      <button key={r} type="button" onClick={() => setFeatured(f => ({ ...f, regions: toggleMulti(f.regions, r) }))}
                        className={`px-3 py-1.5 font-sans text-xs border transition-colors ${featured.regions.includes(r) ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Filter by Type">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TYPE_OPTIONS.map(t => (
                      <button key={t} type="button" onClick={() => setFeatured(f => ({ ...f, types: toggleMulti(f.types, t) }))}
                        className={`px-3 py-1.5 font-sans text-xs border transition-colors ${featured.types.includes(t) ? 'bg-[#2d6a4f] text-white border-[#2d6a4f]' : 'border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── Promotions ── */}
            {activeSection === 'promos' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">Promotions & Offers</h2>

                <div className="flex items-center justify-between p-4 bg-[#F7F5F2] border border-gray-200">
                  <div>
                    <p className="font-sans text-sm font-medium text-gray-800">Promo Banner</p>
                    <p className="font-sans text-xs text-gray-400 mt-0.5">Show a top-of-page announcement banner on all pages</p>
                  </div>
                  <button
                    onClick={() => setPromos(p => ({ ...p, enabled: !p.enabled }))}
                    className={`w-11 h-6 transition-colors relative shrink-0 ${promos.enabled ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white transition-all ${promos.enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {promos.enabled && (
                  <>
                    <Field label="Banner Text">
                      <input value={promos.banner_text} onChange={e => setPromos(p => ({ ...p, banner_text: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="Banner Link">
                      <input value={promos.banner_link} onChange={e => setPromos(p => ({ ...p, banner_link: e.target.value }))} className={inputCls} placeholder="/stays" />
                    </Field>
                    <Field label="Banner Background Colour">
                      <div className="flex items-center gap-3">
                        <input type="color" value={promos.banner_color} onChange={e => setPromos(p => ({ ...p, banner_color: e.target.value }))} className="w-10 h-10 border border-gray-200 cursor-pointer bg-transparent p-0.5" />
                        <input value={promos.banner_color} onChange={e => setPromos(p => ({ ...p, banner_color: e.target.value }))} className="flex-1 border border-gray-200 px-3 py-2 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2] font-mono" />
                      </div>
                      <div className="mt-2 px-4 py-2 font-sans text-sm text-white text-center" style={{ backgroundColor: promos.banner_color }}>
                        Preview: {promos.banner_text || 'Banner preview'}
                      </div>
                    </Field>
                  </>
                )}

                <Field label="Deals Section Heading">
                  <input value={promos.deals_heading} onChange={e => setPromos(p => ({ ...p, deals_heading: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Max Deals Shown">
                  <input type="number" min={1} max={6} value={promos.max_deals} onChange={e => setPromos(p => ({ ...p, max_deals: Number(e.target.value) }))} className={inputCls} />
                </Field>
              </div>
            )}

            {/* ── Footer ── */}
            {activeSection === 'footer' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">Footer Content</h2>
                <Field label="Tagline (shown next to logo)">
                  <input value={footer.tagline} onChange={e => setFooter(f => ({ ...f, tagline: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Copyright Text">
                  <input value={footer.copyright} onChange={e => setFooter(f => ({ ...f, copyright: e.target.value }))} className={inputCls} />
                  <p className="font-sans text-xs text-gray-400 mt-1">The current year is automatically prepended with ©</p>
                </Field>
                <Field label="Contact Email">
                  <input type="email" value={footer.contact_email} onChange={e => setFooter(f => ({ ...f, contact_email: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Physical Address">
                  <input value={footer.address} onChange={e => setFooter(f => ({ ...f, address: e.target.value }))} className={inputCls} />
                </Field>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Instagram URL">
                    <input value={footer.instagram} onChange={e => setFooter(f => ({ ...f, instagram: e.target.value }))} className={inputCls} placeholder="https://instagram.com/…" />
                  </Field>
                  <Field label="Facebook URL">
                    <input value={footer.facebook} onChange={e => setFooter(f => ({ ...f, facebook: e.target.value }))} className={inputCls} placeholder="https://facebook.com/…" />
                  </Field>
                  <Field label="YouTube URL">
                    <input value={footer.youtube} onChange={e => setFooter(f => ({ ...f, youtube: e.target.value }))} className={inputCls} placeholder="https://youtube.com/…" />
                  </Field>
                </div>
              </div>
            )}

            {/* ── Navigation Links ── */}
            {activeSection === 'nav' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-2">Navigation Links</h2>
                <p className="font-sans text-sm text-gray-500 mb-6">These reflect the actual nav items in the Navbar component. Edit the order and visibility here, then update the Navbar if needed.</p>

                <div className="border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                        {['Label', 'Path', 'Visible', ''].map(h => (
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
                              onChange={e => setNavItems(nav => nav.map(n => n.id === item.id ? { ...n, label: e.target.value } : n))}
                              className="border border-gray-200 px-2 py-1.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white w-28"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              value={item.href}
                              onChange={e => setNavItems(nav => nav.map(n => n.id === item.id ? { ...n, href: e.target.value } : n))}
                              className="border border-gray-200 px-2 py-1.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white w-36 font-mono text-xs"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setNavItems(nav => nav.map(n => n.id === item.id ? { ...n, visible: !n.visible } : n))}
                              className={`w-10 h-5 transition-colors relative ${item.visible ? 'bg-[#2d6a4f]' : 'bg-gray-200'}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white transition-all ${item.visible ? 'left-5' : 'left-1'}`} />
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => setNavItems(nav => nav.filter(n => n.id !== item.id))} className="text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">New Label</label>
                    <input value={newNavItem.label} onChange={e => setNewNavItem(n => ({ ...n, label: e.target.value }))} className={inputCls} placeholder="Events" />
                  </div>
                  <div className="flex-1">
                    <label className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5">Path</label>
                    <input value={newNavItem.href} onChange={e => setNewNavItem(n => ({ ...n, href: e.target.value }))} className={inputCls} placeholder="/events" />
                  </div>
                  <button
                    onClick={() => {
                      if (!newNavItem.label || !newNavItem.href) return
                      setNavItems(nav => [...nav, { id: `n${Date.now()}`, ...newNavItem, visible: true }])
                      setNewNavItem({ label: '', href: '' })
                    }}
                    className="inline-flex items-center gap-1.5 bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors shrink-0"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
                <p className="font-sans text-xs text-gray-400">Note: visibility changes here are for reference. To make nav changes live, the Navbar component also needs updating.</p>
              </div>
            )}

            {/* ── About ── */}
            {activeSection === 'about' && (
              <div className="space-y-5">
                <h2 className="font-display italic text-2xl text-[#000000] mb-6">About / Platform Copy</h2>
                <Field label="About Heading">
                  <input value={about.heading} onChange={e => setAbout(a => ({ ...a, heading: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="About Body">
                  <textarea value={about.body} onChange={e => setAbout(a => ({ ...a, body: e.target.value }))} rows={6} className={textareaCls} />
                </Field>
                <Field label="Platform Description (used in SEO fallback and auth pages)">
                  <textarea value={about.platform_description} onChange={e => setAbout(a => ({ ...a, platform_description: e.target.value }))} rows={3} className={textareaCls} />
                </Field>
              </div>
            )}

            {/* Save bar */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <p className="font-sans text-xs text-gray-400">
                Saves to Supabase · Live site updates immediately on next page load
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`inline-flex items-center gap-2 px-6 py-3 font-sans text-sm transition-colors ${
                  savedSection === activeSection
                    ? 'bg-[#2d6a4f] text-white'
                    : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                } disabled:opacity-60`}
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving…</>
                ) : savedSection === activeSection ? (
                  <><Check size={14} /> Saved to Supabase</>
                ) : (
                  'Save Section'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
