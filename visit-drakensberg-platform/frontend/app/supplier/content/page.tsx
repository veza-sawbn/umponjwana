'use client'

import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { LayoutDashboard, List, BedDouble, User, Package, CalendarDays, Image, Eye, Pencil, Archive, ToggleLeft, ToggleRight, ExternalLink } from 'lucide-react'

type Section = 'overview' | 'listings' | 'rooms' | 'guides' | 'packages' | 'events' | 'media'

const LISTINGS_DATA = [
  { id: 'l1', title: 'Cathedral Peak Mountain Lodge', category: 'Stay', status: 'published', views: 1420, bookings: 18, updated: '2026-06-20' },
  { id: 'l2', title: 'Berg Valley Guesthouse', category: 'Stay', status: 'published', views: 870, bookings: 11, updated: '2026-06-18' },
  { id: 'l3', title: 'Guided Rock Climbing Experience', category: 'Activity', status: 'draft', views: 0, bookings: 0, updated: '2026-06-15' },
  { id: 'l4', title: 'Tugela Falls Day Hike', category: 'Hike', status: 'published', views: 640, bookings: 7, updated: '2026-06-10' },
]

const ROOMS_DATA = [
  { id: 'r1', property: 'Cathedral Peak Mountain Lodge', name: 'Mountain View Suite', price: 2200, status: 'available' },
  { id: 'r2', property: 'Cathedral Peak Mountain Lodge', name: 'Garden Chalet', price: 1850, status: 'available' },
  { id: 'r3', property: 'Cathedral Peak Mountain Lodge', name: 'Classic Double', price: 1450, status: 'available' },
  { id: 'r4', property: 'Cathedral Peak Mountain Lodge', name: 'Backpacker Dorm', price: 380, status: 'blocked' },
  { id: 'r5', property: 'Berg Valley Guesthouse', name: 'Honeymoon Suite', price: 1600, status: 'available' },
  { id: 'r6', property: 'Berg Valley Guesthouse', name: 'Family Room', price: 1200, status: 'available' },
]

const GUIDES_DATA = [
  { id: 'g1', name: 'Sipho Dlamini', cert: 'FGASA-****-3', guide_no: 'TBCSA-G-0091', status: 'verified' },
  { id: 'g2', name: 'Anele Mokoena', cert: 'FGASA-****-2', guide_no: 'TBCSA-G-0144', status: 'pending' },
]

const PACKAGES_DATA = [
  { id: 'pk1', title: 'Drakensberg Royal Traverse', collaborators: 2, status: 'published', tour_start: '2026-07-15', tour_end: '2026-07-22' },
  { id: 'pk2', title: 'Sani Pass Explorer', collaborators: 1, status: 'draft', tour_start: '2026-08-01', tour_end: '2026-08-05' },
]

const EVENTS_DATA = [
  { id: 'e1', title: 'Drakensberg Star Gazing Night', type: 'Event', date: '2026-07-20', sold: 12, total: 30, revenue: 4200 },
  { id: 'e2', title: 'Winter Wildflower Walk Special', type: 'Special', date: 'Jul 2026', sold: 45, total: 100, revenue: 8100 },
]

const MEDIA_DATA = [
  { id: 'm1', label: 'Lodge exterior', url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&q=60', listing: 'Cathedral Peak Mountain Lodge' },
  { id: 'm2', label: 'Mountain view', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60', listing: 'Cathedral Peak Mountain Lodge' },
  { id: 'm3', label: 'Guesthouse garden', url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=60', listing: 'Berg Valley Guesthouse' },
]

const NAV_ITEMS: { id: Section; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'listings', label: 'Listings', icon: List },
  { id: 'rooms', label: 'Rooms', icon: BedDouble },
  { id: 'guides', label: 'Guides', icon: User },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'media', label: 'Media Library', icon: Image },
]

const STATUS_CHIP: Record<string, string> = {
  published: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  draft: 'bg-gray-100 text-gray-500',
  verified: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  pending: 'bg-[#C9A96E]/10 text-[#9a7840]',
  available: 'bg-[#2d6a4f]/10 text-[#2d6a4f]',
  blocked: 'bg-red-50 text-red-500',
}

export default function ContentManagerPage() {
  const [section, setSection] = useState<Section>('overview')
  const [rooms, setRooms] = useState(ROOMS_DATA)

  function toggleRoomStatus(id: string) {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'available' ? 'blocked' : 'available' } : r))
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <div className="mt-16 flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-200 pt-8 pb-8 flex flex-col gap-1 fixed top-16 bottom-0 overflow-y-auto z-10">
          <p className="font-sans text-[10px] tracking-[0.16em] uppercase text-gray-400 px-5 mb-3">Content</p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-3 px-5 py-2.5 font-sans text-sm text-left transition-colors ${section === item.id ? 'bg-[#2d6a4f]/5 text-[#2d6a4f] border-r-2 border-[#2d6a4f]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                <Icon size={15} />
                {item.label}
              </button>
            )
          })}
          <div className="mt-auto px-5 pt-6 border-t border-gray-100">
            <Link href="/supplier" className="font-sans text-xs text-gray-400 hover:text-gray-700 transition-colors">← Back to Dashboard</Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-56 flex-1 p-8">
          {section === 'overview' && (
            <div>
              <h1 className="font-display italic text-3xl text-[#000000] mb-8">Content Overview</h1>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {[
                  { label: 'Published Listings', value: LISTINGS_DATA.filter(l => l.status === 'published').length },
                  { label: 'Draft Listings', value: LISTINGS_DATA.filter(l => l.status === 'draft').length },
                  { label: 'Total Rooms', value: ROOMS_DATA.length },
                  { label: 'Verified Guides', value: GUIDES_DATA.filter(g => g.status === 'verified').length },
                  { label: 'Active Packages', value: PACKAGES_DATA.filter(p => p.status === 'published').length },
                  { label: 'Upcoming Events', value: EVENTS_DATA.length },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-gray-200 p-5">
                    <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-2">{s.label}</p>
                    <p className="font-display italic text-3xl text-[#2d6a4f]">{s.value}</p>
                  </div>
                ))}
              </div>
              <p className="font-sans text-sm text-gray-500">Use the sidebar to manage your listings, rooms, guides, packages, events, and media.</p>
            </div>
          )}

          {section === 'listings' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Listings</h1>
                <Link href="/supplier/listings/new" className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">+ New Listing</Link>
              </div>
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                      {['Title', 'Category', 'Status', 'Views', 'Bookings', 'Updated', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {LISTINGS_DATA.map(l => (
                      <tr key={l.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-sm font-medium">{l.title}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{l.category}</td>
                        <td className="px-4 py-3"><span className={`font-sans text-xs px-2.5 py-1 ${STATUS_CHIP[l.status]}`}>{l.status}</span></td>
                        <td className="px-4 py-3 font-sans text-sm">{l.views.toLocaleString()}</td>
                        <td className="px-4 py-3 font-sans text-sm">{l.bookings}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-400">{l.updated}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Link href={`/supplier/listings/${l.id}/edit`} className="text-[#2d6a4f] hover:text-[#235a3f]"><Pencil size={14} /></Link>
                            <Link href={`/stays/${l.id}`} className="text-gray-400 hover:text-gray-600"><ExternalLink size={14} /></Link>
                            <button className="text-gray-300 hover:text-gray-500"><Archive size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {section === 'rooms' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Rooms</h1>
                <Link href="/supplier/property" className="border border-[#2d6a4f] text-[#2d6a4f] px-5 py-2.5 font-sans text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">Property Manager →</Link>
              </div>
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                      {['Property', 'Room', 'Price/Night', 'Status', 'Toggle'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rooms.map(r => (
                      <tr key={r.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{r.property}</td>
                        <td className="px-4 py-3 font-sans text-sm font-medium">{r.name}</td>
                        <td className="px-4 py-3 font-display italic text-lg text-[#2d6a4f]">R {r.price.toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={`font-sans text-xs px-2.5 py-1 ${STATUS_CHIP[r.status]}`}>{r.status}</span></td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRoomStatus(r.id)}>
                            {r.status === 'available' ? <ToggleRight size={22} className="text-[#2d6a4f]" /> : <ToggleLeft size={22} className="text-gray-400" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {section === 'guides' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Guides</h1>
                <Link href="/supplier/guides" className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">+ Register Guide</Link>
              </div>
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                      {['Name', 'Certificate', 'Guide Number', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {GUIDES_DATA.map(g => (
                      <tr key={g.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-sm font-medium">{g.name}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{g.cert}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{g.guide_no}</td>
                        <td className="px-4 py-3"><span className={`font-sans text-xs px-2.5 py-1 ${STATUS_CHIP[g.status]}`}>{g.status}</span></td>
                        <td className="px-4 py-3">
                          <Link href={`/guides/${g.id}`} className="text-gray-400 hover:text-[#2d6a4f]"><ExternalLink size={14} /></Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {section === 'packages' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Packages</h1>
                <Link href="/supplier/packages" className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">Manage Packages →</Link>
              </div>
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                      {['Title', 'Collaborators', 'Tour Start', 'Tour End', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {PACKAGES_DATA.map(p => (
                      <tr key={p.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-sm font-medium">{p.title}</td>
                        <td className="px-4 py-3 font-sans text-sm">{p.collaborators}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{p.tour_start}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{p.tour_end}</td>
                        <td className="px-4 py-3"><span className={`font-sans text-xs px-2.5 py-1 ${STATUS_CHIP[p.status]}`}>{p.status}</span></td>
                        <td className="px-4 py-3">
                          <Link href="/supplier/packages" className="text-[#2d6a4f] hover:underline font-sans text-xs">Edit →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {section === 'events' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Events & Specials</h1>
                <Link href="/supplier/events" className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">Manage Events →</Link>
              </div>
              <div className="bg-white border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F7F5F2]">
                      {['Title', 'Type', 'Date', 'Tickets Sold', 'Revenue', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {EVENTS_DATA.map(e => (
                      <tr key={e.id} className="hover:bg-[#F7F5F2] transition-colors">
                        <td className="px-4 py-3 font-sans text-sm font-medium">{e.title}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{e.type}</td>
                        <td className="px-4 py-3 font-sans text-xs text-gray-500">{e.date}</td>
                        <td className="px-4 py-3 font-sans text-sm">{e.sold}/{e.total}</td>
                        <td className="px-4 py-3 font-display italic text-lg text-[#2d6a4f]">R {e.revenue.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Link href="/supplier/events" className="text-[#2d6a4f] hover:underline font-sans text-xs">Edit →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          )}

          {section === 'media' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display italic text-3xl text-[#000000]">Media Library</h1>
                <button className="bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">+ Add Image</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {MEDIA_DATA.map(m => (
                  <div key={m.id} className="bg-white border border-gray-200">
                    <div className="aspect-[4/3] overflow-hidden">
                      <img src={m.url} alt={m.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="font-sans text-sm font-medium mb-1">{m.label}</p>
                      <p className="font-sans text-xs text-gray-400 mb-2">{m.listing}</p>
                      <input defaultValue={m.url} className="w-full border border-gray-200 px-2.5 py-1.5 font-sans text-[11px] text-gray-500 focus:outline-none focus:border-[#2d6a4f]" />
                    </div>
                  </div>
                ))}
                <div className="border border-dashed border-gray-300 aspect-[4/3] flex items-center justify-center hover:border-[#2d6a4f] transition-colors cursor-pointer">
                  <div className="text-center">
                    <Image size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="font-sans text-sm text-gray-400">Add image</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Footer />
    </div>
  )
}
