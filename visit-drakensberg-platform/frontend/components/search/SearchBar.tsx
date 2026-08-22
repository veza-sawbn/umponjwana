'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Mic } from 'lucide-react'
import { useBooking } from '@/lib/booking-context'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'

/* ------------------------------------------------------------------
   Discovery search bar — sits inside the home hero photo.
   Keeps the same export name (SearchBar) and useBooking integration
   so page.tsx and any other consumers need no changes at all.
------------------------------------------------------------------- */

const PLACEHOLDERS = [
  'Where do you want to explore?',
  'Search hikes, stays, guides…',
  'Tugela Falls, Sani Pass, Cathedral Peak…',
  'Find your Drakensberg adventure…',
]

export default function SearchBar() {
  const router    = useRouter()
  const { setSearch } = useBooking()
  const inputRef  = useRef<HTMLInputElement>(null)

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(false)
  const [phIndex, setPhIndex] = useState(0)

  /* rotate placeholder while the bar is idle */
  useEffect(() => {
    if (focused || query) return
    const t = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(t)
  }, [focused, query])

  function handleSearch() {
    const term = query.trim()
    if (!term) return
    setSearch('', '', '', 2)
    const params = new URLSearchParams({ q: term, region: 'drakensberg' })
    router.push(`/search?${params.toString()}`)
    trackEvent(AnalyticsEvent.SEARCH_PERFORMED, { query: term, source: 'hero' })
  }

  return (
    <div className="w-full">
      <div className={[
        'flex items-center gap-3',
        'bg-black/40 backdrop-blur-lg',
        'border rounded-full',
        'px-4 py-2.5',
        'transition-all duration-300',
        focused
          ? 'border-gold shadow-[0_0_0_3px_rgba(201,169,110,0.22),0_16px_48px_rgba(0,0,0,0.55)]'
          : 'border-white/20 shadow-[0_8px_36px_rgba(0,0,0,0.5)]',
      ].join(' ')}>

        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() =>  setFocused(false)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={PLACEHOLDERS[phIndex]}
          aria-label="Search the Drakensberg"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none font-sans text-[15px] font-light text-white placeholder:text-white/50 caret-gold"
        />

        <button
          type="button"
          aria-label="Voice search"
          className="flex-none text-white/38 hover:text-gold transition-colors p-1"
        >
          <Mic size={16} />
        </button>

        <button
          type="button"
          onClick={handleSearch}
          aria-label="Search"
          className="flex-none w-9 h-9 rounded-full flex items-center justify-center bg-gold hover:bg-[#b8935a] transition-colors"
        >
          <ArrowRight size={16} className="text-white" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
