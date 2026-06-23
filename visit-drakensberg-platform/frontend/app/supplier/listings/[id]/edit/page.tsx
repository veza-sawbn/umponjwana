'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ArrowLeft, Plus, Trash2, Save, ToggleLeft, ToggleRight, User } from 'lucide-react'

const MOCK_LISTINGS: Record<string, any> = {
  l1: {
    id: 'l1', title: 'Cathedral Peak Mountain Lodge', category: 'stay',
    location: 'Cathedral Peak, Northern Berg', description: 'A stunning mountain lodge nestled at the foot of Cathedral Peak.',
    price: 1850, images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80'],
    rooms: [
      { id: 'r1', name: 'Mountain View Suite', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Fireplace', 'Mountain view'], is_available: true },
      { id: 'r2', name: 'Garden Chalet', max_guests: 4, price_per_night: 1850, amenities: ['Braai', 'Kitchen', 'Garden'], is_available: true },
      { id: 'r3', name: 'Backpacker Dorm', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers'], is_available: false },
    ],
    guides: [],
  },
  l2: {
    id: 'l2', title: 'Guided Rock Climbing Experience', category: 'activity',
    location: 'Amphitheatre, Royal Natal', description: 'Professional guided rock climbing for all levels.',
    price: 750, images: [],
    rooms: [],
    guides: [
      { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Abseiling'], verification_status: 'verified' },
    ],
  },
}

const ALL_AMENITIES = ['En-suite', 'Fireplace', 'Mountain view', 'Braai', 'Kitchen', 'Garden', 'Shared bathroom', 'Lockers', 'WiFi', 'Pool', 'Parking', 'Wheelchair access']
const ALL_GUIDES = [
  { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Birding'], verification_status: 'verified' },
  { id: 'g2', full_name: 'Anele Mokoena', specialties: ['Day hikes', 'Wildflowers'], verification_status: 'verified' },
]

type Tab = 'basic' | 'rooms' | 'guides' | 'media' | 'pricing'

export default function EditListingPage() {
  const { id } = useParams() as { id: string }
  const original = MOCK_LISTINGS[id] || MOCK_LISTINGS['l1']

  const [tab, setTab] = useState<Tab>('basic')
  const [form, setForm] = useState({ title: original.title, description: original.description, location: original.location, category: original.category })
  const [rooms, setRooms] = useState(original.rooms)
  const [guides, setGuides] = useState(original.guides)
  const [images, setImages] = useState<string[]>(original.images)
  const [price, setPrice] = useState(String(original.price))
  const [editingRoom, setEditingRoom] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState({ name: '', max_guests: '2', price_per_night: '', amenities: [] as string[] })
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newImg, setNewImg] = useState('')
  const [saved, setSaved] = useState(false)

  const isStay = form.category === 'stay' || form.category === 'Lodge' || form.category === 'Guesthouse' || form.category === 'Hotel' || form.category === 'Resort' || form.category === 'Cabin' || form.category === 'Camp'
  const isActivity = form.category === 'activity' || form.category === 'Activity' || form.category === 'Hike' || form.category === 'hike'

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleRoomAvailability(rid: string) {
    setRooms((prev: any[]) => prev.map(r => r.id === rid ? { ...r, is_available: !r.is_available } : r))
  }

  function addRoom() {
    if (!newRoom.name || !newRoom.price_per_night) return
    setRooms((prev: any[]) => [...prev, { id: `r${Date.now()}`, ...newRoom, max_guests: parseInt(newRoom.max_guests), price_per_night: parseFloat(newRoom.price_per_night), is_available: true }])
    setNewRoom({ name: '', max_guests: '2', price_per_night: '', amenities: [] })
    setShowNewRoom(false)
  }

  function removeRoom(rid: string) {
    setRooms((prev: any[]) => prev.filter(r => r.id !== rid))
  }

  function toggleGuide(guide: any) {
    const exists = guides.find((g: any) => g.id === guide.id)
    if (exists) setGuides((prev: any[]) => prev.filter((g: any) => g.id !== guide.id))
    else setGuides((prev: any[]) => [...prev, guide])
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basic', label: 'Basic Info' },
    ...(isStay ? [{ id: 'rooms' as Tab, label: `Rooms (${rooms.length})` }] : []),
    ...(isActivity ? [{ id: 'guides' as Tab, label: `Guides (${guides.length})` }] : []),
    { id: 'media', label: 'Media' },
    { id: 'pricing', label: 'Pricing' },
  ]

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      <section className="bg-[#2d6a4f] text-white py-16 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="flex items-end justify-between">
            <div>
              <p className="font-sans text-xs tracking-[0.14em] uppercase text-[#C9A96E] mb-2">Editing Listing</p>
              <h1 className="font-display italic text-4xl lg:text-5xl">{original.title}</h1>
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-3 font-sans text-sm font-medium transition-colors ${saved ? 'bg-white text-[#2d6a4f]' : 'bg-[#C9A96E] text-[#2d2d2d] hover:bg-[#b8935e]'}`}
            >
              <Save size={16} />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        {/* Tab nav */}
        <div className="flex gap-0 border-b border-gray-200 mb-8 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-6 py-3 font-sans text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-[#2d6a4f] text-[#2d6a4f] font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Basic Info */}
        {tab === 'basic' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Listing Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
            </div>
            <div>
              <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
            </div>
            <div>
              <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]">
                {['stay', 'activity', 'hike', 'shuttle', 'event'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5} className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] resize-none" />
            </div>
          </div>
        )}

        {/* Rooms */}
        {tab === 'rooms' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="font-sans text-gray-600">{rooms.length} room{rooms.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowNewRoom(v => !v)} className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm font-medium hover:bg-[#235a3f] transition-colors">
                <Plus size={16} /> Add Room
              </button>
            </div>

            {showNewRoom && (
              <div className="bg-white border border-gray-200 p-6 mb-6">
                <h3 className="font-display italic text-xl text-[#2d6a4f] mb-4">New Room</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Room Name *</label>
                    <input value={newRoom.name} onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Mountain View Suite" className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                  </div>
                  <div>
                    <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Price / Night (R) *</label>
                    <input type="number" value={newRoom.price_per_night} onChange={e => setNewRoom(r => ({ ...r, price_per_night: e.target.value }))} placeholder="1850" className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                  </div>
                  <div>
                    <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Max Guests</label>
                    <input type="number" value={newRoom.max_guests} onChange={e => setNewRoom(r => ({ ...r, max_guests: e.target.value }))} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block font-sans text-xs uppercase text-gray-400 mb-2">Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_AMENITIES.map(a => (
                      <button key={a} onClick={() => setNewRoom(r => ({ ...r, amenities: r.amenities.includes(a) ? r.amenities.filter(x => x !== a) : [...r.amenities, a] }))}
                        className={`px-3 py-1.5 font-sans text-xs transition-colors ${newRoom.amenities.includes(a) ? 'bg-[#2d6a4f] text-white' : 'border border-gray-200 text-gray-600 hover:border-[#2d6a4f]'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={addRoom} className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors">Add Room</button>
                  <button onClick={() => setShowNewRoom(false)} className="border border-gray-300 text-gray-600 px-5 py-2 font-sans text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {rooms.map((room: any) => (
                <div key={room.id} className="bg-white border border-gray-200">
                  <div className="flex items-start justify-between p-5">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-display italic text-xl">{room.name}</h3>
                        <button onClick={() => toggleRoomAvailability(room.id)} className="flex items-center gap-1.5">
                          {room.is_available
                            ? <><ToggleRight size={22} className="text-[#2d6a4f]" /><span className="font-sans text-xs text-[#2d6a4f]">Available</span></>
                            : <><ToggleLeft size={22} className="text-gray-400" /><span className="font-sans text-xs text-gray-400">Blocked</span></>
                          }
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {room.amenities.map((a: string) => <span key={a} className="bg-[#F7F5F2] px-2.5 py-1 font-sans text-xs text-gray-600">{a}</span>)}
                      </div>
                    </div>
                    <div className="text-right ml-6">
                      <p className="font-display italic text-2xl text-[#2d6a4f]">R {room.price_per_night.toLocaleString()}</p>
                      <p className="font-sans text-xs text-gray-400">/night · {room.max_guests} guests max</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-3">
                    <button onClick={() => setEditingRoom(editingRoom === room.id ? null : room.id)} className="font-sans text-xs text-[#2d6a4f] hover:underline">
                      {editingRoom === room.id ? 'Close' : 'Edit details'}
                    </button>
                    <button onClick={() => removeRoom(room.id)} className="font-sans text-xs text-red-400 hover:text-red-600 ml-auto flex items-center gap-1">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                  {editingRoom === room.id && (
                    <div className="border-t border-gray-100 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Room Name</label>
                        <input defaultValue={room.name} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                      </div>
                      <div>
                        <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Price / Night (R)</label>
                        <input type="number" defaultValue={room.price_per_night} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                      </div>
                      <div>
                        <label className="block font-sans text-xs uppercase text-gray-400 mb-1.5">Max Guests</label>
                        <input type="number" defaultValue={room.max_guests} className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guides */}
        {tab === 'guides' && (
          <div>
            <p className="font-sans text-gray-600 mb-6">Attach verified guides to this listing. They will appear on your listing page.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_GUIDES.map(guide => {
                const attached = guides.find((g: any) => g.id === guide.id)
                return (
                  <div key={guide.id} className={`bg-white border p-5 flex items-start justify-between ${attached ? 'border-[#2d6a4f]' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#2d6a4f]/10 flex items-center justify-center">
                        <User size={18} className="text-[#2d6a4f]" />
                      </div>
                      <div>
                        <p className="font-display italic text-lg">{guide.full_name}</p>
                        <p className="font-sans text-xs text-gray-500">{guide.specialties.join(' · ')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleGuide(guide)}
                      className={`px-3 py-1.5 font-sans text-xs transition-colors ${attached ? 'bg-[#2d6a4f] text-white hover:bg-red-500' : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'}`}
                    >
                      {attached ? 'Remove' : 'Attach'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Media */}
        {tab === 'media' && (
          <div className="max-w-2xl">
            <p className="font-sans text-gray-600 mb-6">Add image URLs for your listing. Images appear in the order listed.</p>
            <div className="space-y-3 mb-6">
              {images.map((img, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-20 h-14 bg-gray-100 overflow-hidden shrink-0">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                  <input value={img} onChange={e => setImages(prev => prev.map((x, j) => j === i ? e.target.value : x))} className="flex-1 border border-gray-300 px-3 py-2.5 font-sans text-xs focus:outline-none focus:border-[#2d6a4f]" />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newImg} onChange={e => setNewImg(e.target.value)} placeholder="https://..." className="flex-1 border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
              <button onClick={() => { if (newImg) { setImages(p => [...p, newImg]); setNewImg('') } }} className="bg-[#2d6a4f] text-white px-4 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors">
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Pricing */}
        {tab === 'pricing' && (
          <div className="max-w-lg space-y-6">
            <div>
              <label className="block font-sans text-xs tracking-[0.12em] uppercase text-gray-500 mb-2">Base Price (R)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-gray-300 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f]" />
              <p className="font-sans text-xs text-gray-400 mt-1">This is the displayed "from" price. Individual rooms have their own pricing.</p>
            </div>
            <div className="bg-[#2d6a4f]/5 border border-[#2d6a4f]/20 p-5">
              <p className="font-sans text-sm text-[#2d6a4f] font-medium mb-1">Earnings Estimate</p>
              <p className="font-sans text-xs text-gray-600">At R{parseInt(price || '0').toLocaleString()} base price with 70% occupancy, you could earn approximately <strong>R{Math.round(parseInt(price || '0') * 21).toLocaleString()}</strong>/month.</p>
            </div>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-gray-200">
          <button onClick={handleSave} className={`flex items-center gap-2 px-8 py-3 font-sans text-sm font-medium transition-colors ${saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'}`}>
            <Save size={16} />{saved ? 'Saved!' : 'Save All Changes'}
          </button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
