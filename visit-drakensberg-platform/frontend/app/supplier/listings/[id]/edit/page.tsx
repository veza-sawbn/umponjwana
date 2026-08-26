'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import { formatMoney } from '@/lib/allocation'
import {
  ArrowLeft, Plus, Trash2, Save, ToggleLeft, ToggleRight,
  User, Eye, EyeOff, CheckCircle, AlertCircle, Image,
  BedDouble, Mountain, MapPin, Tag, DollarSign, Camera,
  ChevronRight, GripVertical, Pencil, X,
} from 'lucide-react'

const MOCK_LISTINGS: Record<string, any> = {
  l1: {
    id: 'l1', title: 'Cathedral Peak Mountain Lodge', category: 'stay', status: 'published',
    location: 'Cathedral Peak, Northern Berg',
    description: 'A stunning mountain lodge nestled at the foot of Cathedral Peak. Offering world-class hospitality, fine dining and direct access to some of the Drakensberg\'s finest trails.',
    price: 1850,
    images: [
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
    ],
    rooms: [
      { id: 'r1', name: 'Mountain View Suite', max_guests: 2, price_per_night: 2200, amenities: ['En-suite', 'Fireplace', 'Mountain view', 'King bed'], is_available: true },
      { id: 'r2', name: 'Garden Chalet', max_guests: 4, price_per_night: 1850, amenities: ['Braai', 'Kitchen', 'Garden access', 'Family room'], is_available: true },
      { id: 'r3', name: 'Backpacker Dorm', max_guests: 6, price_per_night: 380, amenities: ['Shared bathroom', 'Lockers', 'Bunk beds'], is_available: false },
    ],
    guides: [],
  },
  l2: {
    id: 'l2', title: 'Guided Rock Climbing Experience', category: 'activity', status: 'draft',
    location: 'Amphitheatre, Royal Natal',
    description: 'Professional guided rock climbing for all levels. FGASA-certified instructors, all equipment provided.',
    price: 750, images: [],
    rooms: [],
    guides: [
      { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Abseiling'], verification_status: 'verified' },
    ],
  },
  l3: {
    id: 'l3', title: 'Tugela Falls Guided Hike', category: 'hike', status: 'published',
    location: 'Royal Natal National Park',
    description: 'Guided hike to the base and summit of Tugela Falls — the second highest waterfall in the world. Chain ladder ascent, certified guides.',
    price: 580, images: [],
    rooms: [],
    guides: [
      { id: 'g3', full_name: 'Thabo Ndlovu', specialties: ['Multi-day hikes', 'Wilderness traverses'], verification_status: 'verified' },
    ],
  },
}

const ALL_AMENITIES = [
  'En-suite', 'Fireplace', 'Mountain view', 'Braai', 'Kitchen', 'Garden access',
  'Shared bathroom', 'Lockers', 'WiFi', 'Pool', 'Parking', 'Wheelchair access',
  'King bed', 'Twin beds', 'Balcony', 'Air conditioning', 'Soaking tub', 'Outdoor shower',
]

const ALL_GUIDES = [
  { id: 'g1', full_name: 'Sipho Dlamini', specialties: ['Rock climbing', 'Abseiling'], verification_status: 'verified', initials: 'SD' },
  { id: 'g2', full_name: 'Anele Mokoena', specialties: ['Day hikes', 'Flora & fynbos'], verification_status: 'verified', initials: 'AM' },
  { id: 'g3', full_name: 'Thabo Ndlovu', specialties: ['Wilderness traverses', 'Wildlife'], verification_status: 'verified', initials: 'TN' },
  { id: 'g4', full_name: 'Lerato Sithole', specialties: ['San rock art', 'Heritage tours'], verification_status: 'pending', initials: 'LS' },
]

const CATEGORY_ICON: Record<string, any> = {
  stay: BedDouble, activity: Mountain, hike: Mountain, shuttle: Tag, event: Tag,
}

type Section = 'basic' | 'rooms' | 'guides' | 'media' | 'pricing' | 'availability'

export default function EditListingPage() {
  const { id } = useParams() as { id: string }
  const original = MOCK_LISTINGS[id] || MOCK_LISTINGS['l1']

  const [section, setSection] = useState<Section>('basic')
  const [form, setForm] = useState({
    title: original.title,
    description: original.description,
    location: original.location,
    category: original.category,
  })
  const [status, setStatus] = useState<'published' | 'draft'>(original.status)
  const [rooms, setRooms] = useState(original.rooms)
  const [guides, setGuides] = useState(original.guides)
  const [images, setImages] = useState<string[]>(original.images)
  const [price, setPrice] = useState(String(original.price))
  const [editingRoom, setEditingRoom] = useState<string | null>(null)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoom, setNewRoom] = useState({ name: '', max_guests: '2', price_per_night: '', amenities: [] as string[] })
  const [newImg, setNewImg] = useState('')
  const [saved, setSaved] = useState(false)

  const isStay = ['stay', 'Lodge', 'Guesthouse', 'Hotel', 'Resort', 'Cabin', 'Camp'].includes(form.category)
  const isActivity = ['activity', 'hike'].includes(form.category)

  const CategoryIcon = CATEGORY_ICON[form.category] || Tag

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function toggleRoomAvailability(rid: string) {
    setRooms((prev: any[]) => prev.map(r => r.id === rid ? { ...r, is_available: !r.is_available } : r))
  }

  function addRoom() {
    if (!newRoom.name || !newRoom.price_per_night) return
    setRooms((prev: any[]) => [...prev, {
      id: `r${Date.now()}`,
      ...newRoom,
      max_guests: parseInt(newRoom.max_guests),
      price_per_night: parseFloat(newRoom.price_per_night),
      is_available: true,
    }])
    setNewRoom({ name: '', max_guests: '2', price_per_night: '', amenities: [] })
    setShowNewRoom(false)
  }

  function removeRoom(rid: string) {
    setRooms((prev: any[]) => prev.filter(r => r.id !== rid))
    if (editingRoom === rid) setEditingRoom(null)
  }

  function toggleGuide(guide: any) {
    const exists = guides.find((g: any) => g.id === guide.id)
    if (exists) setGuides((prev: any[]) => prev.filter((g: any) => g.id !== guide.id))
    else setGuides((prev: any[]) => [...prev, guide])
  }

  const navItems: { id: Section; label: string; count?: number }[] = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'media', label: 'Photos & Media', count: images.length },
    { id: 'pricing', label: 'Pricing' },
    ...(isStay ? [{ id: 'rooms' as Section, label: 'Rooms', count: rooms.length }] : []),
    ...(isActivity ? [{ id: 'guides' as Section, label: 'Guides & Instructors', count: guides.length }] : []),
    { id: 'availability', label: 'Availability' },
  ]

  const completeness = [
    form.title.length > 0,
    form.description.length > 40,
    form.location.length > 0,
    images.length > 0,
    parseFloat(price) > 0,
    isStay ? rooms.length > 0 : true,
    isActivity ? guides.length > 0 : true,
  ]
  const complete = completeness.filter(Boolean).length
  const total = completeness.length

  return (
    <div className="min-h-screen bg-[#F7F5F2]">
      <Navbar />

      {/* Header */}
      <section className="bg-[#000000] text-white pt-20 pb-0 px-6 lg:px-12 mt-16">
        <div className="max-w-[1440px] mx-auto">
          <Link href="/supplier" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-xs tracking-wide mb-6 transition-colors">
            <ArrowLeft size={14} /> Supplier Dashboard
          </Link>
          <div className="flex items-end justify-between pb-0">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.14em] uppercase bg-[#C9A96E]/15 text-[#C9A96E] px-2.5 py-1">
                  <CategoryIcon size={10} />{form.category}
                </span>
                <button
                  onClick={() => setStatus(s => s === 'published' ? 'draft' : 'published')}
                  className={`inline-flex items-center gap-1.5 font-sans text-[10px] tracking-[0.14em] uppercase px-2.5 py-1 transition-colors ${
                    status === 'published'
                      ? 'bg-[#2d6a4f]/20 text-[#4ade80]'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {status === 'published' ? <Eye size={10} /> : <EyeOff size={10} />}
                  {status === 'published' ? 'Published' : 'Draft'}
                </button>
              </div>
              <h1 className="font-display italic text-4xl lg:text-5xl mb-1">{form.title || 'Untitled Listing'}</h1>
              <p className="font-sans text-sm text-white/40 pb-6">{form.location}</p>
            </div>
            <div className="pb-6 flex items-center gap-3">
              <Link
                href={`/${form.category === 'stay' ? 'stays' : form.category === 'activity' ? 'activities' : 'hikes'}/${id}`}
                className="inline-flex items-center gap-2 border border-white/20 text-white/60 hover:text-white hover:border-white/40 px-4 py-2.5 font-sans text-sm transition-colors"
                target="_blank"
              >
                <Eye size={14} /> Preview
              </Link>
              <button
                onClick={handleSave}
                className={`inline-flex items-center gap-2 px-6 py-2.5 font-sans text-sm font-medium transition-colors ${
                  saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#C9A96E] text-[#1a1a1a] hover:bg-[#b8935e]'
                }`}
              >
                {saved ? <CheckCircle size={15} /> : <Save size={15} />}
                {saved ? 'Saved' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-10">
        <div className="flex gap-8 items-start">

          {/* Left sidebar nav */}
          <aside className="w-56 shrink-0 sticky top-24">
            <nav className="bg-white border border-gray-200 overflow-hidden">
              {navItems.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 font-sans text-sm text-left transition-colors border-b border-gray-100 last:border-0 ${
                    section === item.id
                      ? 'bg-[#2d6a4f] text-white'
                      : 'text-gray-700 hover:bg-[#F7F5F2]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`font-sans text-xs ${section === item.id ? 'text-white/60' : 'text-gray-400'}`}>
                    {item.count !== undefined ? item.count : <ChevronRight size={13} />}
                  </span>
                </button>
              ))}
            </nav>

            {/* Completeness */}
            <div className="mt-5 bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-sans text-xs tracking-[0.1em] uppercase text-gray-400">Profile</p>
                <span className={`font-sans text-xs font-medium ${complete === total ? 'text-[#2d6a4f]' : 'text-[#C9A96E]'}`}>
                  {complete}/{total}
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-[#2d6a4f] transition-all"
                  style={{ width: `${Math.round((complete / total) * 100)}%` }}
                />
              </div>
              {complete < total && (
                <p className="font-sans text-xs text-gray-400 mt-2">Complete all sections to maximise visibility.</p>
              )}
              {complete === total && (
                <p className="font-sans text-xs text-[#2d6a4f] mt-2 flex items-center gap-1"><CheckCircle size={11} /> Listing complete</p>
              )}
            </div>

            {/* Listing actions */}
            <div className="mt-5 bg-white border border-gray-200 p-4 space-y-2">
              <p className="font-sans text-xs tracking-[0.1em] uppercase text-gray-400 mb-3">Actions</p>
              <button className="w-full text-left font-sans text-sm text-gray-600 hover:text-[#2d6a4f] py-1 transition-colors">Duplicate listing</button>
              <button className="w-full text-left font-sans text-sm text-gray-600 hover:text-[#2d6a4f] py-1 transition-colors">View bookings</button>
              <button className="w-full text-left font-sans text-sm text-red-400 hover:text-red-600 py-1 transition-colors">Archive listing</button>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">

            {/* Basic Info */}
            {section === 'basic' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-2xl text-[#000000] mb-6">Basic Information</h2>
                  <div className="space-y-5">
                    <div>
                      <label className="block font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Listing Title</label>
                      <input
                        value={form.title}
                        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full border border-gray-200 px-4 py-3 font-display italic text-xl focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                        placeholder="Give your listing a descriptive title"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Category</label>
                        <select
                          value={form.category}
                          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full border border-gray-200 px-4 py-3 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]"
                        >
                          {['stay', 'activity', 'hike', 'shuttle', 'event'].map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Location</label>
                        <div className="flex items-center gap-2 border border-gray-200 px-4 py-3 bg-[#F7F5F2] focus-within:border-[#2d6a4f]">
                          <MapPin size={14} className="text-gray-400 shrink-0" />
                          <input
                            value={form.location}
                            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                            className="flex-1 font-sans text-sm focus:outline-none bg-transparent"
                            placeholder="e.g. Cathedral Peak, Northern Berg"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Description</label>
                      <textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        rows={6}
                        className="w-full border border-gray-200 px-4 py-3 font-sans text-sm leading-relaxed focus:outline-none focus:border-[#2d6a4f] resize-none bg-[#F7F5F2]"
                        placeholder="Describe what makes your listing special. Include what guests can expect, key features and the surrounding environment."
                      />
                      <p className="font-sans text-xs text-gray-400 mt-1">{form.description.length} characters · aim for 150+</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl text-[#000000] mb-4">Listing Status</h2>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-sans text-sm text-gray-700 font-medium">
                        {status === 'published' ? 'Visible to visitors' : 'Hidden from visitors'}
                      </p>
                      <p className="font-sans text-xs text-gray-400 mt-0.5">
                        {status === 'published'
                          ? 'Your listing appears in search results and category pages.'
                          : 'Your listing is saved but not yet visible on the public site.'}
                      </p>
                    </div>
                    <button
                      onClick={() => setStatus(s => s === 'published' ? 'draft' : 'published')}
                      className={`flex items-center gap-2 px-5 py-2.5 font-sans text-sm transition-colors ${
                        status === 'published'
                          ? 'bg-[#2d6a4f]/10 text-[#2d6a4f] border border-[#2d6a4f]/30 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                          : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                      }`}
                    >
                      {status === 'published' ? <><EyeOff size={14} /> Unpublish</> : <><Eye size={14} /> Publish</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Media */}
            {section === 'media' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-display italic text-2xl text-[#000000]">Photos & Media</h2>
                      <p className="font-sans text-xs text-gray-400 mt-1">The first photo is your cover image. Drag to reorder.</p>
                    </div>
                    <span className="font-sans text-xs text-gray-400">{images.length} photo{images.length !== 1 ? 's' : ''}</span>
                  </div>

                  {images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                      {images.map((img, i) => (
                        <div key={i} className="relative group">
                          <div className={`aspect-[4/3] overflow-hidden ${i === 0 ? 'ring-2 ring-[#C9A96E]' : ''}`}>
                            <img src={img} alt="" className="w-full h-full object-cover" />
                          </div>
                          {i === 0 && (
                            <span className="absolute top-2 left-2 bg-[#C9A96E] text-white font-sans text-[9px] tracking-[0.1em] uppercase px-2 py-0.5">Cover</span>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                              className="bg-red-500 text-white p-1.5 hover:bg-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical size={16} className="text-white/80" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload area */}
                  <div className="border-2 border-dashed border-gray-200 hover:border-[#2d6a4f]/40 transition-colors p-8 text-center mb-4">
                    <Camera size={28} className="text-gray-300 mx-auto mb-3" />
                    <p className="font-sans text-sm text-gray-500 mb-1">Drop photos here or add a URL below</p>
                    <p className="font-sans text-xs text-gray-400">JPG, PNG · Max 10MB per image · Min 1200×800px recommended</p>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 border border-gray-200 px-3 py-2.5 focus-within:border-[#2d6a4f]">
                      <Image size={14} className="text-gray-400 shrink-0" />
                      <input
                        value={newImg}
                        onChange={e => setNewImg(e.target.value)}
                        placeholder="Paste image URL…"
                        className="flex-1 font-sans text-sm focus:outline-none bg-transparent"
                      />
                    </div>
                    <button
                      onClick={() => { if (newImg) { setImages(p => [...p, newImg]); setNewImg('') } }}
                      className="bg-[#2d6a4f] text-white px-5 font-sans text-sm hover:bg-[#235a3f] transition-colors flex items-center gap-1.5"
                    >
                      <Plus size={15} /> Add
                    </button>
                  </div>
                </div>

                {images.length === 0 && (
                  <div className="bg-[#C9A96E]/10 border border-[#C9A96E]/30 p-4 flex items-start gap-3">
                    <AlertCircle size={16} className="text-[#C9A96E] shrink-0 mt-0.5" />
                    <p className="font-sans text-sm text-[#8B6914]">Listings without photos receive significantly fewer enquiries. Add at least 3 high-quality images.</p>
                  </div>
                )}
              </div>
            )}

            {/* Pricing */}
            {section === 'pricing' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-2xl text-[#000000] mb-6">Pricing</h2>
                  <div className="max-w-sm space-y-5">
                    <div>
                      <label className="block font-sans text-[10px] tracking-[0.14em] uppercase text-gray-400 mb-2">Base / "From" Price (R)</label>
                      <div className="flex items-center gap-2 border border-gray-200 px-4 py-3 bg-[#F7F5F2] focus-within:border-[#2d6a4f]">
                        <DollarSign size={14} className="text-gray-400 shrink-0" />
                        <input
                          type="number"
                          value={price}
                          onChange={e => setPrice(e.target.value)}
                          className="flex-1 font-sans text-sm focus:outline-none bg-transparent"
                          placeholder="1850"
                        />
                      </div>
                      <p className="font-sans text-xs text-gray-400 mt-1.5">This is the starting price shown on listing cards and search results.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl text-[#000000] mb-4">Earnings Estimate</h2>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: '50% occupancy', nights: 15 },
                      { label: '70% occupancy', nights: 21 },
                      { label: '90% occupancy', nights: 27 },
                    ].map(s => (
                      <div key={s.label} className="bg-[#F7F5F2] p-4">
                        <p className="font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400 mb-1">{s.label}</p>
                        <p className="font-display italic text-2xl text-[#2d6a4f]">
                          {formatMoney(Math.round(parseFloat(price || '0') * s.nights))}
                        </p>
                        <p className="font-sans text-xs text-gray-400 mt-0.5">/month estimate</p>
                      </div>
                    ))}
                  </div>
                  <p className="font-sans text-xs text-gray-400 mt-4">Estimates based on base price × nights booked. Actual earnings depend on room selection and seasonality.</p>
                </div>

                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-xl text-[#000000] mb-4">Cancellation Policy</h2>
                  <div className="space-y-2">
                    {[
                      { id: 'flexible', label: 'Flexible', desc: 'Full refund up to 24 hours before check-in' },
                      { id: 'moderate', label: 'Moderate', desc: 'Full refund up to 5 days before check-in' },
                      { id: 'strict', label: 'Strict', desc: '50% refund up to 7 days before check-in, no refund after' },
                    ].map(p => (
                      <label key={p.id} className="flex items-start gap-3 border border-gray-200 p-4 cursor-pointer hover:border-[#2d6a4f]/40 transition-colors">
                        <input type="radio" name="cancellation" value={p.id} defaultChecked={p.id === 'moderate'} className="mt-0.5 accent-[#2d6a4f]" />
                        <div>
                          <p className="font-sans text-sm font-medium text-gray-800">{p.label}</p>
                          <p className="font-sans text-xs text-gray-500 mt-0.5">{p.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Rooms */}
            {section === 'rooms' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-display italic text-2xl text-[#000000]">Rooms & Units</h2>
                      <p className="font-sans text-xs text-gray-400 mt-1">Each room can be individually priced, configured and toggled on/off.</p>
                    </div>
                    <button
                      onClick={() => setShowNewRoom(v => !v)}
                      className="inline-flex items-center gap-2 bg-[#2d6a4f] text-white px-5 py-2.5 font-sans text-sm hover:bg-[#235a3f] transition-colors"
                    >
                      <Plus size={15} /> Add Room
                    </button>
                  </div>

                  {showNewRoom && (
                    <div className="bg-[#F7F5F2] border border-gray-200 p-5 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display italic text-xl text-[#2d6a4f]">New Room</h3>
                        <button onClick={() => setShowNewRoom(false)}><X size={16} className="text-gray-400" /></button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Room Name *</label>
                          <input
                            value={newRoom.name}
                            onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))}
                            placeholder="e.g. Mountain View Suite"
                            className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Price / Night (R) *</label>
                          <input
                            type="number"
                            value={newRoom.price_per_night}
                            onChange={e => setNewRoom(r => ({ ...r, price_per_night: e.target.value }))}
                            placeholder="1850"
                            className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                          />
                        </div>
                        <div>
                          <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Max Guests</label>
                          <input
                            type="number"
                            value={newRoom.max_guests}
                            onChange={e => setNewRoom(r => ({ ...r, max_guests: e.target.value }))}
                            min={1} max={20}
                            className="w-full border border-gray-300 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-white"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block font-sans text-[10px] uppercase text-gray-400 mb-2">Amenities</label>
                        <div className="flex flex-wrap gap-2">
                          {ALL_AMENITIES.map(a => (
                            <button
                              key={a}
                              onClick={() => setNewRoom(r => ({
                                ...r,
                                amenities: r.amenities.includes(a) ? r.amenities.filter(x => x !== a) : [...r.amenities, a],
                              }))}
                              className={`px-3 py-1.5 font-sans text-xs transition-colors ${newRoom.amenities.includes(a) ? 'bg-[#2d6a4f] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-[#2d6a4f]'}`}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={addRoom} className="bg-[#2d6a4f] text-white px-5 py-2 font-sans text-sm hover:bg-[#235a3f] transition-colors">Save Room</button>
                        <button onClick={() => setShowNewRoom(false)} className="border border-gray-300 text-gray-600 px-5 py-2 font-sans text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {rooms.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-gray-200">
                        <BedDouble size={28} className="text-gray-300 mx-auto mb-2" />
                        <p className="font-sans text-sm text-gray-400">No rooms yet. Add your first room above.</p>
                      </div>
                    )}
                    {rooms.map((room: any) => (
                      <div key={room.id} className={`bg-[#F7F5F2] border transition-colors ${room.is_available ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <GripVertical size={16} className="text-gray-300 shrink-0 cursor-grab" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-display italic text-lg">{room.name}</h3>
                                <span className="font-sans text-xs text-gray-400">· up to {room.max_guests} guests</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {room.amenities.slice(0, 4).map((a: string) => (
                                  <span key={a} className="bg-white border border-gray-200 px-2 py-0.5 font-sans text-xs text-gray-500">{a}</span>
                                ))}
                                {room.amenities.length > 4 && (
                                  <span className="font-sans text-xs text-gray-400">+{room.amenities.length - 4} more</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 ml-4 shrink-0">
                            <div className="text-right">
                              <p className="font-display italic text-xl text-[#2d6a4f]">{formatMoney(room.price_per_night)}</p>
                              <p className="font-sans text-xs text-gray-400">/night</p>
                            </div>
                            <button
                              onClick={() => toggleRoomAvailability(room.id)}
                              className="flex items-center gap-1.5 shrink-0"
                              title={room.is_available ? 'Mark as unavailable' : 'Mark as available'}
                            >
                              {room.is_available
                                ? <ToggleRight size={24} className="text-[#2d6a4f]" />
                                : <ToggleLeft size={24} className="text-gray-300" />
                              }
                            </button>
                          </div>
                        </div>
                        <div className="border-t border-gray-200 px-4 py-2.5 flex items-center gap-4">
                          <button
                            onClick={() => setEditingRoom(editingRoom === room.id ? null : room.id)}
                            className="font-sans text-xs text-[#2d6a4f] hover:underline flex items-center gap-1"
                          >
                            <Pencil size={11} /> {editingRoom === room.id ? 'Close editor' : 'Edit details'}
                          </button>
                          <span className={`font-sans text-xs ${room.is_available ? 'text-[#2d6a4f]' : 'text-gray-400'}`}>
                            {room.is_available ? '● Available' : '○ Blocked'}
                          </span>
                          <button
                            onClick={() => removeRoom(room.id)}
                            className="font-sans text-xs text-red-400 hover:text-red-600 ml-auto flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        </div>
                        {editingRoom === room.id && (
                          <div className="border-t border-gray-200 p-4 bg-white grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Room Name</label>
                              <input defaultValue={room.name} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                            </div>
                            <div>
                              <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Price / Night (R)</label>
                              <input type="number" defaultValue={room.price_per_night} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                            </div>
                            <div>
                              <label className="block font-sans text-[10px] uppercase text-gray-400 mb-1.5">Max Guests</label>
                              <input type="number" defaultValue={room.max_guests} className="w-full border border-gray-200 px-3 py-2.5 font-sans text-sm focus:outline-none focus:border-[#2d6a4f] bg-[#F7F5F2]" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Guides */}
            {section === 'guides' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 p-6">
                  <h2 className="font-display italic text-2xl text-[#000000] mb-2">Guides & Instructors</h2>
                  <p className="font-sans text-sm text-gray-500 mb-6">Attach FGASA-verified guides to this listing. Their profiles will appear on your listing page and booking flow.</p>

                  {guides.length > 0 && (
                    <div className="mb-6">
                      <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">Attached ({guides.length})</p>
                      <div className="space-y-2">
                        {guides.map((g: any) => (
                          <div key={g.id} className="flex items-center justify-between border border-[#2d6a4f]/30 bg-[#2d6a4f]/5 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] text-sm shrink-0">
                                {g.full_name?.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-sans text-sm font-medium">{g.full_name}</p>
                                <p className="font-sans text-xs text-gray-500">{g.specialties?.join(' · ')}</p>
                              </div>
                            </div>
                            <button onClick={() => toggleGuide(g)} className="font-sans text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-3">All Verified Guides</p>
                  <div className="space-y-3">
                    {ALL_GUIDES.map(guide => {
                      const attached = guides.find((g: any) => g.id === guide.id)
                      return (
                        <div key={guide.id} className={`border p-4 flex items-center justify-between transition-colors ${attached ? 'border-[#2d6a4f]/30 bg-[#F7F5F2]' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#2d6a4f]/10 flex items-center justify-center font-display italic text-[#2d6a4f] shrink-0">
                              {guide.initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-display italic text-lg leading-tight">{guide.full_name}</p>
                                {guide.verification_status === 'verified'
                                  ? <CheckCircle size={13} className="text-[#2d6a4f]" />
                                  : <AlertCircle size={13} className="text-[#C9A96E]" />
                                }
                              </div>
                              <p className="font-sans text-xs text-gray-500">{guide.specialties.join(' · ')}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleGuide(guide)}
                            disabled={guide.verification_status !== 'verified'}
                            className={`px-4 py-1.5 font-sans text-xs transition-colors ${
                              attached
                                ? 'bg-[#2d6a4f] text-white hover:bg-red-500'
                                : guide.verification_status !== 'verified'
                                  ? 'border border-gray-200 text-gray-300 cursor-not-allowed'
                                  : 'border border-[#2d6a4f] text-[#2d6a4f] hover:bg-[#2d6a4f] hover:text-white'
                            }`}
                          >
                            {attached ? 'Attached ✓' : guide.verification_status !== 'verified' ? 'Pending' : 'Attach'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Availability */}
            {section === 'availability' && (
              <div className="bg-white border border-gray-200 p-6">
                <h2 className="font-display italic text-2xl text-[#000000] mb-2">Availability</h2>
                <p className="font-sans text-sm text-gray-500 mb-8">Block dates your property or activity is unavailable. Guests will not be able to book on blocked dates.</p>
                <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-200 mb-6">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="bg-[#F7F5F2] text-center py-2 font-sans text-[10px] tracking-[0.1em] uppercase text-gray-400">{d}</div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => {
                    const day = i - 1
                    const booked = [4, 5, 6, 12, 13, 20].includes(day)
                    const today = day === 10
                    return (
                      <button
                        key={i}
                        className={`bg-white py-3 text-center font-sans text-sm transition-colors hover:bg-[#F7F5F2] ${
                          booked ? 'bg-[#2d6a4f]/10 text-[#2d6a4f] font-medium' : ''
                        } ${today ? 'ring-1 ring-inset ring-[#C9A96E]' : ''} ${day < 1 || day > 30 ? 'text-gray-200' : 'text-gray-700'}`}
                      >
                        {day >= 1 && day <= 30 ? day : ''}
                        {booked && day >= 1 && <div className="w-1 h-1 bg-[#2d6a4f] rounded-full mx-auto mt-0.5" />}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-6 font-sans text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#2d6a4f]/20 inline-block" /> Blocked</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 ring-1 ring-[#C9A96E] inline-block" /> Today</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-white border border-gray-200 inline-block" /> Available</span>
                </div>
              </div>
            )}

            {/* Save footer */}
            <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
              <p className="font-sans text-xs text-gray-400">
                {saved ? '✓ All changes saved' : 'Unsaved changes will be lost on navigation.'}
              </p>
              <button
                onClick={handleSave}
                className={`inline-flex items-center gap-2 px-8 py-3 font-sans text-sm font-medium transition-colors ${
                  saved ? 'bg-[#2d6a4f] text-white' : 'bg-[#2d6a4f] text-white hover:bg-[#235a3f]'
                }`}
              >
                {saved ? <CheckCircle size={15} /> : <Save size={15} />}
                {saved ? 'Saved' : 'Save Changes'}
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
