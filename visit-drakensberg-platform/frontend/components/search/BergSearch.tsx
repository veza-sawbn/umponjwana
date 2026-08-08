'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Mic } from 'lucide-react'

/* ------------------------------------------------------------------
   AI-powered search bar for the Visit Drakensberg hero.
   Sits on top of the hero photo; uses the site's existing colour
   palette (gold #C9A96E, DM Serif Display, DM Sans) — no dark
   background of its own.
------------------------------------------------------------------- */

type TokenOption = { text: string; value: string | number; meta: string }
type TokenDef   = { field: string; options: TokenOption[] }
type Chip       = { id: string; pre: string; token: string; post: string }

const TOKENS: Record<string, TokenDef> = {
  difficulty: {
    field: 'difficulty',
    options: [
      { text: 'gentle valley walks',    value: 'easy',       meta: 'Under 4 hours, little ascent' },
      { text: 'full day summit routes', value: 'strenuous',  meta: '8 to 11 hours, chain ladders' },
      { text: 'multi-day traverses',    value: 'expedition', meta: 'Two nights up, cave or tent'   },
    ],
  },
  base: {
    field: 'base_area',
    options: [
      { text: 'Northern Berg',     value: 'northern',  meta: 'Sentinel, Tugela Falls, Royal Natal'     },
      { text: 'Champagne Valley',  value: 'champagne', meta: 'Cathkin, Monks Cowl, easy access'        },
      { text: 'Cathedral Peak',    value: 'cathedral', meta: 'Rhino Peak country, remote ridgelines'   },
      { text: 'Southern Berg',     value: 'southern',  meta: 'Sani Pass, Underberg, Lesotho border'    },
    ],
  },
  month: {
    field: 'travel_month',
    options: [
      { text: 'October', value: 10, meta: 'Green flush, afternoon storms'          },
      { text: 'January', value: 1,  meta: 'Peak summer, high rivers'               },
      { text: 'May',     value: 5,  meta: 'Clear air, best long views'             },
      { text: 'July',    value: 7,  meta: 'Snow on the escarpment, frozen dawns'   },
    ],
  },
}

const CHIPS: Chip[] = [
  { id: 'trails', pre: 'Show me',              token: 'difficulty', post: 'worth the drive this season' },
  { id: 'trip',   pre: 'Plan four days in the', token: 'base',       post: 'for two people'              },
  { id: 'season', pre: 'What is the Berg like in', token: 'month',   post: '?'                           },
]

const PLACEHOLDERS = [
  'Ask about the drive up from Joburg…',
  'Four days, two people, one summit…',
  'Which trails still run in the rain?',
  'What does a guided Tugela ascent cost?',
]

const QUOTE_LINES = [
  { label: 'Guided ascent of Tugela Falls, 2 guests', detail: 'Chain ladders, full day, permits included',         cost: 3900 },
  { label: 'Two nights, Witsieshoek Mountain Lodge',  detail: 'Dinner, bed and breakfast, mountain facing',        cost: 6480 },
  { label: 'Transfer, Bethlehem to Sentinel car park',detail: 'Return, 4x4, driver guide',                        cost: 1850 },
]
const QUOTE_TITLE = 'Four days, Northern Berg, two guests'

export default function BergSearch() {
  const router  = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [selected, setSelected] = useState<Record<string, number>>({ difficulty: 0, base: 0, month: 0 })
  const [open,     setOpen]     = useState<string | null>(null)
  const [query,    setQuery]    = useState('')
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [phIndex,  setPhIndex]  = useState(0)
  const [focused,  setFocused]  = useState(false)
  const [stage,    setStage]    = useState<'idle' | 'thinking' | 'quote'>('idle')

  /* rotate placeholder text; pause when user is typing */
  useEffect(() => {
    if (focused || query) return
    const t = setInterval(() => setPhIndex(i => (i + 1) % PLACEHOLDERS.length), 4000)
    return () => clearInterval(t)
  }, [focused, query])

  /* close any open token menu on outside click or Escape */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown',   onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [])

  function chipText(chip: Chip) {
    const t = TOKENS[chip.token].options[selected[chip.token]].text
    return `${chip.pre} ${t} ${chip.post}`.replace(' ?', '?')
  }

  function run(chip: Chip | null) {
    if (chip) {
      setActiveChip(chip.id)
      setQuery(chipText(chip))
      setStage('thinking')
      setTimeout(() => setStage('quote'), 900)
    } else if (query.trim()) {
      const p = new URLSearchParams({ q: query.trim(), region: 'drakensberg' })
      router.push(`/search?${p.toString()}`)
    }
  }

  const rand   = (n: number) => 'R ' + n.toLocaleString('en-ZA')
  const total  = QUOTE_LINES.reduce((s, l) => s + l.cost, 0)

  return (
    <div ref={rootRef} className="w-full">

      {/* ── pill search bar ── */}
      <div className={`
        flex items-center gap-3
        bg-black/40 backdrop-blur-lg
        border rounded-full
        px-4 py-2.5
        transition-all duration-300
        ${focused
          ? 'border-gold shadow-[0_0_0_3px_rgba(201,169,110,0.22),0_16px_48px_rgba(0,0,0,0.55)]'
          : 'border-white/20 shadow-[0_8px_36px_rgba(0,0,0,0.5)]'}
      `}>
        {/* star mark */}
        <span
          className="flex-none w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 35% 30%, #C9A96E, #8a6630)' }}
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a0a0a">
            <path d="M12 2.6l2.3 6.1 6.1 2.3-6.1 2.3L12 19.4l-2.3-6.1-6.1-2.3 6.1-2.3z" />
          </svg>
        </span>

        {/* text input */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveChip(null); setStage('idle') }}
          onFocus={() => setFocused(true)}
          onBlur={() =>  setFocused(false)}
          onKeyDown={e => e.key === 'Enter' && run(null)}
          placeholder={PLACEHOLDERS[phIndex]}
          aria-label="Ask about the Drakensberg"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none font-sans text-[15px] text-white placeholder:text-white/50 caret-gold"
        />

        {/* mic */}
        <button
          type="button"
          aria-label="Voice search"
          className="flex-none text-white/40 hover:text-gold transition-colors p-1"
        >
          <Mic size={16} />
        </button>

        {/* arrow CTA */}
        <button
          type="button"
          onClick={() => run(null)}
          aria-label="Search"
          className="flex-none w-9 h-9 rounded-full flex items-center justify-center bg-gold hover:bg-[#b8935a] transition-colors"
        >
          <ArrowRight size={16} className="text-white" strokeWidth={2.2} />
        </button>
      </div>

      {/* ── suggestion chips ── */}
      <div className="flex flex-wrap gap-2 mt-3">
        {CHIPS.map(chip => {
          const tk  = TOKENS[chip.token]
          const cur = tk.options[selected[chip.token]]
          return (
            <div
              key={chip.id}
              role="button"
              tabIndex={0}
              onClick={() => run(chip)}
              onKeyDown={e => e.key === 'Enter' && run(chip)}
              className="
                inline-flex items-center gap-1.5
                bg-black/35 backdrop-blur-md
                border border-white/20 rounded-full
                px-3.5 py-2
                font-sans text-[12.5px] font-light text-white/85
                cursor-pointer select-none
                hover:border-gold/55 hover:text-white hover:bg-black/50
                transition-all duration-200
              "
            >
              <span>{chip.pre}</span>

              {/* swappable token */}
              <span
                role="button"
                tabIndex={0}
                aria-expanded={open === chip.id}
                onClick={e => { e.stopPropagation(); setOpen(open === chip.id ? null : chip.id) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setOpen(open === chip.id ? null : chip.id) } }}
                className="relative inline-flex items-center gap-1 font-medium text-gold border-b border-dashed border-gold/50 pb-px hover:text-[#d4b57a] cursor-pointer"
              >
                {cur.text}
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 4.5L6 8.5L10 4.5" />
                </svg>

                {/* token dropdown */}
                {open === chip.id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="
                      absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2
                      z-50 w-60 text-left
                      bg-[#0f1412] border border-white/10 rounded-xl
                      p-1.5 shadow-[0_20px_48px_rgba(0,0,0,0.7)]
                    "
                    style={{ animation: 'bs-pop .15s ease' }}
                  >
                    {tk.options.map((opt, i) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        className={`
                          block w-full text-left px-3 py-2.5 rounded-lg
                          font-sans text-[13px] transition-colors duration-150
                          ${i === selected[chip.token]
                            ? 'bg-gold/15 text-gold'
                            : 'text-white/75 hover:bg-white/6 hover:text-white'}
                        `}
                        onClick={() => {
                          setSelected(s => ({ ...s, [chip.token]: i }))
                          setOpen(null)
                          setActiveChip(chip.id)
                          setStage('idle')
                        }}
                      >
                        {opt.text}
                        <span className="block text-[11px] text-white/35 mt-0.5 font-light">
                          {opt.meta}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </span>

              <span>{chip.post}</span>
            </div>
          )
        })}
      </div>

      {/* ── thinking dots ── */}
      {stage === 'thinking' && (
        <div className="flex items-center gap-2.5 mt-5 text-white/60 font-sans text-sm font-light">
          <span className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gold"
                style={{ animation: `bs-pulse 1.1s ${i * 0.18}s infinite` }}
              />
            ))}
          </span>
          Checking guide diaries and lodge availability…
        </div>
      )}

      {/* ── quote card ── */}
      {stage === 'quote' && (
        <div
          className="
            mt-5 rounded-2xl overflow-hidden
            border border-white/15
            bg-black/55 backdrop-blur-md
            shadow-[0_20px_56px_rgba(0,0,0,0.6)]
          "
          style={{ animation: 'bs-rise .4s cubic-bezier(.2,.7,.3,1)' }}
        >
          {/* card header */}
          <div className="px-5 py-4 border-b border-white/8">
            <p className="font-sans text-[10px] tracking-[0.26em] uppercase text-gold font-medium mb-1">
              Draft quote
            </p>
            <h3 className="font-display text-xl text-white leading-snug">{QUOTE_TITLE}</h3>
          </div>

          {/* line items */}
          {QUOTE_LINES.map(l => (
            <div key={l.label} className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-white/6 last:border-0">
              <div>
                <p className="font-sans text-sm text-white/90">{l.label}</p>
                <p className="font-sans text-[11.5px] text-white/40 mt-0.5 font-light">{l.detail}</p>
              </div>
              <span className="font-sans text-sm font-medium text-white whitespace-nowrap">{rand(l.cost)}</span>
            </div>
          ))}

          {/* total */}
          <div className="flex items-baseline justify-between px-5 py-3.5 bg-gold/8">
            <span className="font-sans text-[11px] tracking-[0.15em] uppercase text-white/50">Total for two</span>
            <span className="font-display text-2xl text-gold">{rand(total)}</span>
          </div>

          {/* actions */}
          <div className="flex gap-2.5 px-5 py-4">
            <button
              type="button"
              className="flex-1 bg-gold hover:bg-[#b8935a] text-white font-sans text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              Send me this quote
            </button>
            <button
              type="button"
              onClick={() => setStage('idle')}
              className="border border-white/20 hover:border-gold/50 text-white/70 hover:text-white font-sans text-sm py-2.5 px-4 rounded-lg transition-colors"
            >
              Change something
            </button>
          </div>

          <p className="px-5 pb-4 font-sans text-[11px] text-white/30 font-light">
            Prices held for 48 hours. A guide reviews every quote before it reaches your inbox.
          </p>
        </div>
      )}

      {/* keyframe animations — scoped to this component */}
      <style>{`
        @keyframes bs-pop  { from { opacity:0; transform:translate(-50%,-6px) } to { opacity:1; transform:translate(-50%,0) } }
        @keyframes bs-rise { from { opacity:0; transform:translateY(12px) }    to { opacity:1; transform:none }              }
        @keyframes bs-pulse{ 0%,100%{opacity:.2} 50%{opacity:1} }
      `}</style>
    </div>
  )
}
