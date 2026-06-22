'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Bell, MessageSquare, CalendarOff, Tag, LayoutDashboard, List, X, Check } from 'lucide-react'
import Footer from '@/components/layout/Footer'

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled'

interface Booking {
  id: string; guest: string; listing: string; checkIn: string; checkOut: string; guests: number; total: number; status: BookingStatus
}

interface Discount {
  id: string; code: string; type: 'percent' | 'flat'; value: number; listing: string; validUntil: string; uses: number
}

interface Message {
  id: string; guest: string; listing: string; preview: string; date: string; read: boolean
}

interface Notification {
  id: string; text: string; date: string; read: boolean; type: 'booking' | 'message' | 'review'
}

interface BlockedDate {
  id: string; listing: string; from: string; to: string; reason: string
}

/* ─── Mock data ──────────────────────────────────────────────────────────────── */
const BOOKINGS: Booking[] = [
  { id: 'BK001', guest: 'Sarah van der Merwe', listing: 'Cathedral Peak Mountain Lodge', checkIn: '2025-07-15', checkOut: '2025-07-18', guests: 2, total: 8214, status: 'confirmed' },
  { id: 'BK002', guest: 'James Fourie', listing: 'Cathedral Peak Mountain Lodge', checkIn: '2025-06-22', checkOut: '2025-06-25', guests: 4, total: 12320, status: 'completed' },
  { id: 'BK003', guest: 'Priya Naidoo', listing: 'Berg Valley Guesthouse', checkIn: '2025-07-10', checkOut: '2025-07-12', guests: 2, total: 2940, status: 'pending' },
  { id: 'BK004', guest: 'Lindiwe Dlamini', listing: 'Cathedral Peak Mountain Lodge', checkIn: '2025-08-01', checkOut: '2025-08-04', guests: 6, total: 18500, status: 'confirmed' },
]

const INIT_DISCOUNTS: Discount[] = [
  { id: 'd1', code: 'BERG15', type: 'percent', value: 15, listing: 'Cathedral Peak Mountain Lodge', validUntil: '2025-09-30', uses: 12 },
  { id: 'd2', code: 'WINTER200', type: 'flat', value: 200, listing: 'Berg Valley Guesthouse', validUntil: '2025-08-31', uses: 5 },
]

const INIT_MESSAGES: Message[] = [
  { id: 'm1', guest: 'Sarah van der Merwe', listing: 'Cathedral Peak Mountain Lodge', preview: 'Hi, do you have braai facilities for our group of 6?', date: '2025-06-18', read: false },
  { id: 'm2', guest: 'Tom Kruger', listing: 'Berg Valley Guesthouse', preview: 'Is the guesthouse dog-friendly? We have a small labrador.', date: '2025-06-17', read: false },
  { id: 'm3', guest: 'Amira Hassan', listing: 'Cathedral Peak Mountain Lodge', preview: 'Can we arrange early check-in at 10am? Our trail starts at noon.', date: '2025-06-16', read: true },
]

const INIT_NOTIFICATIONS: Notification[] = [
  { id: 'n1', text: 'New booking from Sarah van der Merwe for Cathedral Peak Mountain Lodge', date: '2025-06-18', read: false, type: 'booking' },
  { id: 'n2', text: 'New message from Tom Kruger regarding Berg Valley Guesthouse', date: '2025-06-17', read: false, type: 'message' },
  { id: 'n3', text: 'James Fourie left a 5-star review on Cathedral Peak Mountain Lodge', date: '2025-06-16', read: true, type: 'review' },
  { id: 'n4', text: 'Booking BK003 from Priya Naidoo is awaiting your confirmation', date: '2025-06-15', read: true, type: 'booking' },
]

const INIT_BLOCKED: BlockedDate[] = [
  { id: 'bl1', listing: 'Cathedral Peak Mountain Lodge', from: '2025-09-14', to: '2025-09-21', reason: 'Maintenance' },
]

const LISTINGS = ['Cathedral Peak Mountain Lodge', 'Berg Valley Guesthouse']

const STATUS_STYLE: Record<BookingStatus, string> = {
  confirmed: 'text-sage',
  pending: 'text-gold',
  completed: 'text-forest/40',
  cancelled: 'text-red-400',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'listings', label: 'Listings', icon: List },
  { id: 'discounts', label: 'Discounts', icon: Tag },
  { id: 'availability', label: 'Availability', icon: CalendarOff },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function SupplierDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')

  /* Discounts state */
  const [discounts, setDiscounts] = useState<Discount[]>(INIT_DISCOUNTS)
  const [discountForm, setDiscountForm] = useState({ code: '', type: 'percent' as 'percent' | 'flat', value: '', listing: LISTINGS[0], validUntil: '' })
  const [showDiscountForm, setShowDiscountForm] = useState(false)

  /* Availability state */
  const [blocked, setBlocked] = useState<BlockedDate[]>(INIT_BLOCKED)
  const [blockForm, setBlockForm] = useState({ listing: LISTINGS[0], from: '', to: '', reason: '' })
  const [showBlockForm, setShowBlockForm] = useState(false)

  /* Messages state */
  const [messages, setMessages] = useState<Message[]>(INIT_MESSAGES)
  const [activeMsg, setActiveMsg] = useState<Message | null>(null)
  const [reply, setReply] = useState('')

  /* Notifications state */
  const [notifications, setNotifications] = useState<Notification[]>(INIT_NOTIFICATIONS)

  const unreadNotifs = notifications.filter((n) => !n.read).length
  const unreadMsgs = messages.filter((m) => !m.read).length

  const addDiscount = () => {
    if (!discountForm.code || !discountForm.value) return
    const nd: Discount = {
      id: `d${Date.now()}`, code: discountForm.code.toUpperCase(), type: discountForm.type,
      value: Number(discountForm.value), listing: discountForm.listing, validUntil: discountForm.validUntil, uses: 0,
    }
    setDiscounts((prev) => [nd, ...prev])
    setDiscountForm({ code: '', type: 'percent', value: '', listing: LISTINGS[0], validUntil: '' })
    setShowDiscountForm(false)
  }

  const deleteDiscount = (id: string) => setDiscounts((prev) => prev.filter((d) => d.id !== id))

  const addBlock = () => {
    if (!blockForm.from || !blockForm.to) return
    const nb: BlockedDate = { id: `bl${Date.now()}`, ...blockForm }
    setBlocked((prev) => [nb, ...prev])
    setBlockForm({ listing: LISTINGS[0], from: '', to: '', reason: '' })
    setShowBlockForm(false)
  }

  const deleteBlock = (id: string) => setBlocked((prev) => prev.filter((b) => b.id !== id))

  const markMsgRead = (id: string) => setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m))
  const markAllNotifsRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  const confirmBooking = (id: string) => { /* API call placeholder */ alert(`Booking ${id} confirmed`) }

  return (
    <main className="bg-mist min-h-screen pt-16">
      {/* Header */}
      <section className="bg-forest text-white py-12 px-6 lg:px-12">
        <div className="max-w-[1440px] mx-auto flex items-end justify-between">
          <div>
            <p className="font-sans text-xs tracking-[0.2em] uppercase text-white/30 mb-2">Supplier portal</p>
            <h1 className="font-display text-4xl text-white">My Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            {unreadNotifs > 0 && (
              <div className="flex items-center gap-2 font-sans text-xs text-white/60 bg-white/10 px-3 py-2">
                <Bell className="w-3.5 h-3.5" />
                {unreadNotifs} new
              </div>
            )}
            <Link href="/supplier/listings/new"
              className="font-sans text-sm bg-gold text-forest px-4 py-2.5 hover:bg-brown-600 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Listing
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-6 lg:px-12 py-8">
        {/* Tab nav */}
        <div className="flex overflow-x-auto border-b border-black/10 mb-8 gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const badge = tab.id === 'messages' ? unreadMsgs : tab.id === 'notifications' ? unreadNotifs : 0
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 font-sans text-sm px-4 py-3 border-b-2 -mb-px whitespace-nowrap transition-colors relative ${activeTab === tab.id ? 'border-forest text-forest' : 'border-transparent text-forest/40 hover:text-forest'}`}>
                <Icon className="w-4 h-4" />
                {tab.label}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-gold text-forest text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: 'Total earnings', value: 'R44,914' },
                { label: 'Active listings', value: '2' },
                { label: 'Bookings this month', value: '4' },
                { label: 'Avg rating', value: '4.8 ★' },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-black/8 p-6">
                  <p className="font-sans text-[10px] tracking-[0.18em] uppercase text-forest/35 mb-2">{s.label}</p>
                  <p className="font-display text-3xl text-forest">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Recent bookings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-forest">Recent bookings</h2>
                <button onClick={() => setActiveTab('listings')} className="font-sans text-xs text-forest/40 hover:text-forest transition-colors">
                  All listings →
                </button>
              </div>
              <div className="bg-white border border-black/8 divide-y divide-black/6">
                {BOOKINGS.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-sans text-xs font-medium text-forest">{b.guest}</span>
                        <span className="text-forest/20">·</span>
                        <span className="font-sans text-xs text-forest/50 truncate">{b.listing}</span>
                      </div>
                      <p className="font-sans text-xs text-forest/35 mt-0.5">{fmt(b.checkIn)} — {fmt(b.checkOut)} · {b.guests} guests</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-sans text-sm font-medium text-forest">R{b.total.toLocaleString()}</p>
                      <p className={`font-sans text-[10px] uppercase tracking-wide mt-0.5 ${STATUS_STYLE[b.status]}`}>{b.status}</p>
                    </div>
                    {b.status === 'pending' && (
                      <button onClick={() => confirmBooking(b.id)}
                        className="font-sans text-xs bg-forest text-white px-3 py-1.5 hover:bg-sage transition-colors shrink-0">
                        Confirm
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Listings ── */}
        {activeTab === 'listings' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-forest">My listings</h2>
              <Link href="/supplier/listings/new"
                className="font-sans text-sm bg-forest text-white px-4 py-2 hover:bg-sage transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add listing
              </Link>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {LISTINGS.map((l) => (
                <div key={l} className="bg-white border border-black/8 p-6 flex items-start gap-4">
                  <div className="w-20 h-16 overflow-hidden shrink-0">
                    <img src={l === 'Cathedral Peak Mountain Lodge'
                      ? 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=80'
                      : 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=300&q=80'}
                      alt={l} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display text-lg text-forest">{l}</h3>
                    <p className="font-sans text-xs text-forest/40 mt-0.5">Active · 4 bookings</p>
                    <div className="flex gap-3 mt-3">
                      <Link href={`/supplier/listings`}
                        className="font-sans text-xs text-forest border border-black/15 px-3 py-1.5 hover:border-forest transition-colors">
                        Edit
                      </Link>
                      <button onClick={() => { setActiveTab('availability'); }}
                        className="font-sans text-xs text-forest border border-black/15 px-3 py-1.5 hover:border-forest transition-colors">
                        Availability
                      </button>
                      <button onClick={() => { setActiveTab('discounts'); }}
                        className="font-sans text-xs text-forest border border-black/15 px-3 py-1.5 hover:border-forest transition-colors">
                        Discounts
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Discounts ── */}
        {activeTab === 'discounts' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl text-forest">Discount codes</h2>
                <p className="font-sans text-xs text-forest/40 mt-1">Offer percentage or fixed discounts on your listings</p>
              </div>
              <button onClick={() => setShowDiscountForm(true)}
                className="font-sans text-sm bg-forest text-white px-4 py-2 hover:bg-sage transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create discount
              </button>
            </div>

            {/* Create form */}
            {showDiscountForm && (
              <div className="bg-white border border-black/8 p-6 mb-6">
                <h3 className="font-display text-xl text-forest mb-5">New discount</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Code</label>
                    <input value={discountForm.code} onChange={(e) => setDiscountForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SUMMER20" className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest" />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Type</label>
                    <select value={discountForm.type} onChange={(e) => setDiscountForm((f) => ({ ...f, type: e.target.value as 'percent' | 'flat' }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest">
                      <option value="percent">Percentage (%)</option>
                      <option value="flat">Fixed amount (R)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">
                      Value {discountForm.type === 'percent' ? '(%)' : '(R)'}
                    </label>
                    <input type="number" value={discountForm.value} onChange={(e) => setDiscountForm((f) => ({ ...f, value: e.target.value }))}
                      placeholder={discountForm.type === 'percent' ? '20' : '500'}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest" />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Listing</label>
                    <select value={discountForm.listing} onChange={(e) => setDiscountForm((f) => ({ ...f, listing: e.target.value }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest">
                      <option value="">All listings</option>
                      {LISTINGS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Valid until</label>
                    <input type="date" value={discountForm.validUntil} onChange={(e) => setDiscountForm((f) => ({ ...f, validUntil: e.target.value }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest" />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={addDiscount} className="font-sans text-sm bg-forest text-white px-5 py-2.5 hover:bg-sage transition-colors">
                    Save discount
                  </button>
                  <button onClick={() => setShowDiscountForm(false)} className="font-sans text-sm border border-black/15 text-forest px-5 py-2.5 hover:border-forest transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Discount list */}
            <div className="bg-white border border-black/8 divide-y divide-black/6">
              {discounts.length === 0 && (
                <p className="font-sans text-sm text-forest/40 px-5 py-8 text-center">No discounts yet. Create one above.</p>
              )}
              {discounts.map((d) => (
                <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="shrink-0 bg-gold/10 px-3 py-1.5">
                    <span className="font-sans text-sm font-bold text-forest tracking-wider">{d.code}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-forest">
                      {d.type === 'percent' ? `${d.value}% off` : `R${d.value} off`}
                      {d.listing && <span className="text-forest/40"> · {d.listing}</span>}
                    </p>
                    <p className="font-sans text-xs text-forest/35 mt-0.5">Valid until {fmt(d.validUntil)} · {d.uses} uses</p>
                  </div>
                  <button onClick={() => deleteDiscount(d.id)} className="p-2 text-forest/25 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Availability ── */}
        {activeTab === 'availability' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-2xl text-forest">Availability control</h2>
                <p className="font-sans text-xs text-forest/40 mt-1">Block date ranges to prevent bookings during unavailable periods</p>
              </div>
              <button onClick={() => setShowBlockForm(true)}
                className="font-sans text-sm bg-forest text-white px-4 py-2 hover:bg-sage transition-colors flex items-center gap-2">
                <CalendarOff className="w-4 h-4" /> Block dates
              </button>
            </div>

            {showBlockForm && (
              <div className="bg-white border border-black/8 p-6 mb-6">
                <h3 className="font-display text-xl text-forest mb-5">Block a date range</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Listing</label>
                    <select value={blockForm.listing} onChange={(e) => setBlockForm((f) => ({ ...f, listing: e.target.value }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest">
                      {LISTINGS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">From</label>
                    <input type="date" value={blockForm.from} onChange={(e) => setBlockForm((f) => ({ ...f, from: e.target.value }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest" />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">To</label>
                    <input type="date" value={blockForm.to} onChange={(e) => setBlockForm((f) => ({ ...f, to: e.target.value }))}
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest focus:outline-none focus:border-forest" />
                  </div>
                  <div>
                    <label className="font-sans text-[10px] tracking-[0.15em] uppercase text-forest/40 block mb-2">Reason</label>
                    <input value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                      placeholder="e.g. Maintenance"
                      className="w-full border border-black/15 px-3 py-2.5 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest" />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={addBlock} className="font-sans text-sm bg-forest text-white px-5 py-2.5 hover:bg-sage transition-colors">
                    Block dates
                  </button>
                  <button onClick={() => setShowBlockForm(false)} className="font-sans text-sm border border-black/15 text-forest px-5 py-2.5 hover:border-forest transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-black/8 divide-y divide-black/6">
              {blocked.length === 0 && (
                <p className="font-sans text-sm text-forest/40 px-5 py-8 text-center">No dates blocked. All listings are available.</p>
              )}
              {blocked.map((b) => (
                <div key={b.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-forest">{b.listing}</p>
                    <p className="font-sans text-xs text-forest/40 mt-0.5">
                      {fmt(b.from)} — {fmt(b.to)}
                      {b.reason && <span className="text-forest/25"> · {b.reason}</span>}
                    </p>
                  </div>
                  <button onClick={() => deleteBlock(b.id)} className="p-2 text-forest/25 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        {activeTab === 'messages' && (
          <div className="grid lg:grid-cols-5 gap-6 h-[500px]">
            {/* Inbox list */}
            <div className="lg:col-span-2 bg-white border border-black/8 overflow-y-auto">
              <div className="px-4 py-3 border-b border-black/6">
                <p className="font-sans text-xs tracking-[0.15em] uppercase text-forest/40">Inbox</p>
              </div>
              {messages.map((m) => (
                <button key={m.id}
                  onClick={() => { setActiveMsg(m); markMsgRead(m.id) }}
                  className={`w-full text-left px-4 py-4 border-b border-black/6 hover:bg-mist transition-colors ${activeMsg?.id === m.id ? 'bg-mist' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!m.read && <span className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />}
                    <div className={!m.read ? '' : 'pl-3.5'}>
                      <p className={`font-sans text-sm ${!m.read ? 'font-semibold text-forest' : 'text-forest/70'}`}>{m.guest}</p>
                      <p className="font-sans text-xs text-forest/40 mt-0.5 truncate">{m.preview}</p>
                      <p className="font-sans text-[10px] text-forest/25 mt-1">{fmt(m.date)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Message thread */}
            <div className="lg:col-span-3 bg-white border border-black/8 flex flex-col">
              {activeMsg ? (
                <>
                  <div className="px-5 py-4 border-b border-black/6">
                    <p className="font-sans text-sm font-medium text-forest">{activeMsg.guest}</p>
                    <p className="font-sans text-xs text-forest/40">{activeMsg.listing}</p>
                  </div>
                  <div className="flex-1 p-5 overflow-y-auto">
                    {/* Guest message */}
                    <div className="flex justify-start mb-4">
                      <div className="bg-mist px-4 py-3 max-w-xs">
                        <p className="font-sans text-sm text-forest">{activeMsg.preview}</p>
                        <p className="font-sans text-[10px] text-forest/30 mt-1">{fmt(activeMsg.date)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-black/6">
                    <div className="flex gap-2">
                      <input value={reply} onChange={(e) => setReply(e.target.value)}
                        placeholder="Type your reply…"
                        className="flex-1 border border-black/15 px-3 py-2.5 font-sans text-sm text-forest placeholder:text-forest/25 focus:outline-none focus:border-forest" />
                      <button
                        onClick={() => { setReply(''); alert('Reply sent (email notification queued)') }}
                        disabled={!reply.trim()}
                        className="font-sans text-sm bg-forest text-white px-4 py-2 hover:bg-sage transition-colors disabled:opacity-40">
                        Send
                      </button>
                    </div>
                    <p className="font-sans text-[10px] text-forest/25 mt-2">Guest will receive an email notification</p>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="font-sans text-sm text-forest/30">Select a message to read</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === 'notifications' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-forest">Notifications</h2>
              {unreadNotifs > 0 && (
                <button onClick={markAllNotifsRead} className="font-sans text-xs text-forest/40 hover:text-forest transition-colors flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Mark all as read
                </button>
              )}
            </div>
            <div className="bg-white border border-black/8 divide-y divide-black/6">
              {notifications.map((n) => (
                <div key={n.id}
                  onClick={() => setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))}
                  className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-mist transition-colors ${!n.read ? 'bg-gold/5' : ''}`}>
                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${!n.read ? 'bg-gold' : 'bg-transparent'}`} />
                  <div className="flex-1">
                    <p className={`font-sans text-sm ${!n.read ? 'text-forest font-medium' : 'text-forest/60'}`}>{n.text}</p>
                    <p className="font-sans text-[10px] text-forest/30 mt-1">{fmt(n.date)}</p>
                  </div>
                  <span className={`font-sans text-[10px] uppercase tracking-wide px-2 py-0.5 shrink-0 ${
                    n.type === 'booking' ? 'text-sage' : n.type === 'message' ? 'text-gold' : 'text-forest/40'
                  }`}>
                    {n.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  )
}
