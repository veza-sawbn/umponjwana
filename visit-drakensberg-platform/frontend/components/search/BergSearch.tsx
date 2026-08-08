'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/* ------------------------------------------------------------------
   Visit Drakensberg :: AI search hero
   Chips carry swappable tokens that resolve to structured query objects
   your Supabase layer can consume.
------------------------------------------------------------------- */

type TokenOption = { text: string; value: string | number; meta: string }

type TokenDef = {
  field: string
  options: TokenOption[]
}

const TOKENS: Record<string, TokenDef> = {
  difficulty: {
    field: 'difficulty',
    options: [
      { text: 'gentle valley walks', value: 'easy', meta: 'Under 4 hours, little ascent' },
      { text: 'full day summit routes', value: 'strenuous', meta: '8 to 11 hours, chain ladders' },
      { text: 'multi day traverses', value: 'expedition', meta: 'Two nights up, cave or tent' },
    ],
  },
  base: {
    field: 'base_area',
    options: [
      { text: 'Northern Berg', value: 'northern', meta: 'Sentinel, Tugela Falls, Royal Natal' },
      { text: 'Champagne Valley', value: 'champagne', meta: 'Cathkin, Monks Cowl, easy access' },
      { text: 'Cathedral Peak', value: 'cathedral', meta: 'Rhino Peak country, remote ridgelines' },
      { text: 'Southern Berg', value: 'southern', meta: 'Sani Pass, Underberg, Lesotho border' },
    ],
  },
  month: {
    field: 'travel_month',
    options: [
      { text: 'October', value: 10, meta: 'Green flush, afternoon storms' },
      { text: 'January', value: 1, meta: 'Peak summer, high rivers' },
      { text: 'May', value: 5, meta: 'Clear air, best long views' },
      { text: 'July', value: 7, meta: 'Snow on the escarpment, frozen dawns' },
    ],
  },
}

type Chip = { id: string; pre: string; token: string; post: string }

const CHIPS: Chip[] = [
  { id: 'trails', pre: 'Show me', token: 'difficulty', post: 'worth the drive this season' },
  { id: 'trip', pre: 'Plan four days in the', token: 'base', post: 'for two people' },
  { id: 'season', pre: 'What is the Berg like in', token: 'month', post: '?' },
]

const PLACEHOLDERS = [
  'Ask about the drive up from Joburg …',
  'Ask for four days, two people, one summit …',
  'Ask which trails still run in the rain …',
  'Ask what a guided Tugela ascent costs …',
]

type QuoteLine = { label: string; detail: string; cost: number }

const QUOTE: { title: string; lines: QuoteLine[] } = {
  title: 'Four days, Northern Berg, two guests',
  lines: [
    { label: 'Guided ascent of Tugela Falls, 2 guests', detail: 'Chain ladders, full day, permits included', cost: 3900 },
    { label: 'Two nights, Witsieshoek Mountain Lodge', detail: 'Dinner, bed and breakfast, mountain facing', cost: 6480 },
    { label: 'Transfer, Bethlehem to Sentinel car park', detail: 'Return, 4x4, driver guide', cost: 1850 },
  ],
}

type SelectedTokens = Record<string, number>

type StructuredQuery = {
  intent: string
  filters: Record<string, unknown>
  currency: string
  raw: string
}

export default function BergSearch() {
  const router = useRouter()
  const [selected, setSelected] = useState<SelectedTokens>({ difficulty: 0, base: 0, month: 0 })
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [phIndex, setPhIndex] = useState(0)
  const [focused, setFocused] = useState(false)
  const [stage, setStage] = useState<'idle' | 'thinking' | 'quote'>('idle')
  const [showJson, setShowJson] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* rotating placeholder, pauses the moment someone engages */
  useEffect(() => {
    if (focused || query) return
    const t = setInterval(() => setPhIndex((i) => (i + 1) % PLACEHOLDERS.length), 4200)
    return () => clearInterval(t)
  }, [focused, query])

  /* dismiss token menus on outside click and on Escape */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  function chipText(chip: Chip): string {
    const t = TOKENS[chip.token].options[selected[chip.token]].text
    return `${chip.pre} ${t} ${chip.post}`.replace(' ?', '?')
  }

  function structured(): StructuredQuery {
    const chip = CHIPS.find((c) => c.id === activeChip)
    const filters: Record<string, unknown> = {}
    if (chip) {
      const tk = TOKENS[chip.token]
      filters[tk.field] = tk.options[selected[chip.token]].value
    }
    return {
      intent: chip ? (chip.id === 'trip' ? 'build_quote' : 'discover') : 'freeform',
      filters: { region: 'drakensberg', ...filters },
      currency: 'ZAR',
      raw: query || (chip ? chipText(chip) : ''),
    }
  }

  function run(chip: Chip | null) {
    if (chip) {
      setActiveChip(chip.id)
      setQuery(chipText(chip))
    } else if (query.trim()) {
      // freeform — navigate to search page
      const params = new URLSearchParams()
      params.set('q', query.trim())
      params.set('region', 'drakensberg')
      router.push(`/search?${params.toString()}`)
      return
    }
    setStage('thinking')
    setTimeout(() => setStage('quote'), 900)
  }

  const total = QUOTE.lines.reduce((s, l) => s + l.cost, 0)
  const rand = (n: number) => 'R' + n.toLocaleString('en-ZA')

  return (
    <div className="berg" ref={rootRef}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Jost:wght@300;400;500;600&family=JetBrains+Mono:wght@400&display=swap');

        .berg {
          --basalt-900:#0B0E10; --basalt-800:#141A1D; --basalt-700:#1E262A;
          --mist:#8FA0A6; --bone:#F1EDE5;
          --amber:#E39B2E; --gold:#D9B65F; --ember:#FF7A2F;
          position:relative; min-height:100vh; overflow:hidden;
          background:var(--basalt-900); color:var(--bone);
          font-family:'Jost',system-ui,sans-serif;
          padding:0 20px 80px;
        }
        .berg *{box-sizing:border-box}

        /* ---- ridgeline backdrop ---- */
        .berg-sky{position:absolute;inset:0;background:
          radial-gradient(120% 70% at 50% 84%, rgba(227,155,46,.20) 0%, rgba(227,155,46,0) 58%),
          linear-gradient(180deg,#080A0C 0%,#0F1417 46%,#1A2226 100%);}
        .berg-ridge{position:absolute;left:0;right:0;bottom:0;width:100%;display:block}
        .berg-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;
          background-image:radial-gradient(rgba(255,255,255,.9) .5px, transparent .5px);
          background-size:3px 3px;pointer-events:none}

        .berg-wrap{position:relative;max-width:820px;margin:0 auto;padding-top:96px;text-align:center}

        .berg-eyebrow{font-size:11px;letter-spacing:.34em;text-transform:uppercase;
          color:var(--gold);font-weight:500;margin-bottom:22px}
        .berg-eyebrow span{opacity:.45;margin:0 9px}

        .berg h1{font-family:'Cormorant Garamond',serif;font-weight:300;
          font-size:clamp(44px,7.4vw,74px);line-height:1.02;letter-spacing:-.015em;
          margin:0 0 10px}
        .berg h1 em{font-style:italic;color:var(--gold)}
        .berg-sub{color:var(--mist);font-size:15px;font-weight:300;max-width:430px;
          margin:0 auto 34px;line-height:1.6}

        /* ---- the bar ---- */
        .berg-bar{display:flex;align-items:center;gap:14px;
          background:rgba(10,13,15,.72);backdrop-filter:blur(14px);
          border:1px solid rgba(217,182,95,.28);border-radius:999px;
          padding:9px 9px 9px 10px;transition:border-color .25s,box-shadow .25s}
        .berg-bar.berg-on{border-color:rgba(227,155,46,.65);box-shadow:0 0 0 4px rgba(227,155,46,.09),0 18px 44px rgba(0,0,0,.5)}
        .berg-mark{width:40px;height:40px;border-radius:50%;flex:0 0 40px;
          display:grid;place-items:center;
          background:radial-gradient(circle at 32% 28%,var(--amber),#A85E15);
          box-shadow:0 0 20px rgba(227,155,46,.42)}
        .berg-bar input{flex:1;background:none;border:0;outline:none;color:var(--bone);
          font-family:'Jost',sans-serif;font-size:16px;font-weight:300;min-width:0}
        .berg-bar input::placeholder{color:#77858B}
        .berg-ph{animation:berg-fade .5s ease}
        @keyframes berg-fade{from{opacity:0}to{opacity:1}}
        .berg-go{flex:0 0 40px;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;
          background:var(--amber);color:#0B0E10;display:grid;place-items:center;
          transition:transform .2s,background .2s}
        .berg-go:hover{background:var(--gold);transform:translateX(2px)}
        .berg-mic{flex:0 0 auto;background:none;border:0;color:#7E8C92;cursor:pointer;padding:6px;
          border-radius:50%;transition:color .2s}
        .berg-mic:hover{color:var(--gold)}

        /* ---- chips ---- */
        .berg-chips{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:20px}
        .berg-chip{display:inline-flex;align-items:center;gap:6px;
          background:rgba(20,26,29,.86);backdrop-filter:blur(8px);
          border:1px solid rgba(143,160,166,.2);border-radius:999px;
          padding:9px 16px;font-size:13.5px;font-weight:300;color:#C9D1D4;
          cursor:pointer;transition:border-color .2s,color .2s,background .2s}
        .berg-chip:hover{border-color:rgba(227,155,46,.5);color:var(--bone);background:rgba(30,38,42,.9)}
        .berg-tok{position:relative;display:inline-flex;align-items:center;gap:4px;
          color:var(--gold);font-weight:500;border-bottom:1px dashed rgba(217,182,95,.5);
          padding-bottom:1px}
        .berg-tok:hover{color:var(--amber)}

        .berg-menu{position:absolute;top:calc(100% + 10px);left:50%;transform:translateX(-50%);
          z-index:40;width:255px;text-align:left;
          background:#111719;border:1px solid rgba(217,182,95,.24);border-radius:12px;
          padding:5px;box-shadow:0 22px 50px rgba(0,0,0,.62);animation:berg-pop .16s ease}
        @keyframes berg-pop{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translate(-50%,0)}}
        .berg-opt{display:block;width:100%;text-align:left;background:none;border:0;cursor:pointer;
          padding:9px 11px;border-radius:8px;color:#D6DCDE;font-family:'Jost',sans-serif;
          font-size:13.5px;font-weight:400;transition:background .15s}
        .berg-opt:hover{background:rgba(227,155,46,.11)}
        .berg-opt.berg-sel{background:rgba(227,155,46,.15);color:var(--gold)}
        .berg-opt small{display:block;color:#78868C;font-size:11.5px;margin-top:2px;font-weight:300}

        /* ---- structured query readout ---- */
        .berg-peek{margin-top:26px;text-align:left;max-width:560px;margin-left:auto;margin-right:auto}
        .berg-peek-btn{background:none;border:0;cursor:pointer;color:#6F7D83;font-size:11px;
          letter-spacing:.2em;text-transform:uppercase;font-family:'Jost',sans-serif;
          display:flex;align-items:center;gap:7px;margin:0 auto;transition:color .2s}
        .berg-peek-btn:hover{color:var(--gold)}
        .berg-json{margin-top:12px;background:#0A0D0F;border:1px solid rgba(143,160,166,.15);
          border-radius:10px;padding:15px 17px;font-family:'JetBrains Mono',monospace;
          font-size:11.5px;line-height:1.75;color:#8FA0A6;white-space:pre;overflow-x:auto}

        /* ---- quote card ---- */
        .berg-card{max-width:560px;margin:34px auto 0;text-align:left;
          background:linear-gradient(180deg,rgba(20,26,29,.95),rgba(11,14,16,.95));
          border:1px solid rgba(217,182,95,.3);border-radius:16px;overflow:hidden;
          box-shadow:0 26px 60px rgba(0,0,0,.55);animation:berg-rise .45s cubic-bezier(.2,.7,.3,1)}
        @keyframes berg-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .berg-card-top{padding:20px 22px 16px;border-bottom:1px solid rgba(143,160,166,.14)}
        .berg-tag{font-size:10px;letter-spacing:.26em;text-transform:uppercase;color:var(--amber);font-weight:500}
        .berg-card-top h3{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:25px;
          margin:8px 0 0;color:var(--bone)}
        .berg-line{display:flex;justify-content:space-between;gap:18px;padding:14px 22px;
          border-bottom:1px solid rgba(143,160,166,.09)}
        .berg-line p{margin:0;font-size:14px;font-weight:400;color:#DDE3E5}
        .berg-line small{color:#7A888E;font-size:12px;font-weight:300}
        .berg-line b{font-weight:500;font-size:14px;color:var(--bone);white-space:nowrap}
        .berg-sum{display:flex;justify-content:space-between;align-items:baseline;padding:17px 22px;
          background:rgba(227,155,46,.06)}
        .berg-sum span{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--mist)}
        .berg-sum strong{font-family:'Cormorant Garamond',serif;font-size:30px;font-weight:500;color:var(--gold)}
        .berg-acts{display:flex;gap:10px;padding:16px 22px 20px}
        .berg-primary{flex:1;background:var(--amber);color:#0B0E10;border:0;border-radius:8px;
          padding:12px;font-family:'Jost',sans-serif;font-size:14px;font-weight:500;cursor:pointer;
          transition:background .2s}
        .berg-primary:hover{background:var(--gold)}
        .berg-ghost{background:none;border:1px solid rgba(143,160,166,.3);color:#C2CACD;border-radius:8px;
          padding:12px 18px;font-family:'Jost',sans-serif;font-size:14px;cursor:pointer;
          transition:border-color .2s}
        .berg-ghost:hover{border-color:var(--gold);color:var(--gold)}
        .berg-fine{padding:0 22px 18px;color:#6E7C82;font-size:11.5px;font-weight:300}

        .berg-think{max-width:560px;margin:34px auto 0;display:flex;align-items:center;gap:12px;
          color:var(--mist);font-size:14px;font-weight:300;justify-content:center}
        .berg-dot{width:6px;height:6px;border-radius:50%;background:var(--amber);animation:berg-pulse 1.1s infinite}
        .berg-dot:nth-child(2){animation-delay:.18s} .berg-dot:nth-child(3){animation-delay:.36s}
        @keyframes berg-pulse{0%,100%{opacity:.25}50%{opacity:1}}

        .berg button:focus-visible,.berg input:focus-visible{outline:2px solid var(--amber);outline-offset:3px}
        @media (prefers-reduced-motion:reduce){.berg *{animation:none!important;transition:none!important}}
        @media (max-width:600px){
          .berg-wrap{padding-top:72px}
          .berg-chips{flex-direction:column;align-items:stretch}
          .berg-chip{justify-content:center}
          .berg-acts{flex-direction:column}
        }
      `}</style>

      <div className="berg-sky" />
      <svg className="berg-ridge" viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,300 L0,206 L96,166 L188,196 L282,132 L360,178 L452,120 L540,164 L640,96 L742,152 L836,118 L940,168 L1042,138 L1130,180 L1200,152 L1200,300 Z" fill="#131A1D" />
        <path d="M0,300 L0,246 L112,222 L214,250 L318,206 L424,242 L534,198 L648,238 L760,208 L878,246 L990,216 L1104,248 L1200,222 L1200,300 Z" fill="#0B0E10" />
      </svg>
      <div className="berg-grain" />

      <div className="berg-wrap">
        <div className="berg-eyebrow">
          uThukela District<span>/</span>KwaZulu-Natal<span>/</span>3&nbsp;482&nbsp;m
        </div>
        <h1>Tell us how far <em>up</em> you want to go.</h1>
        <p className="berg-sub">
          Describe the trip in your own words. We answer with real routes, real
          availability and a price in rands.
        </p>

        {/* ---- search bar ---- */}
        <div className={`berg-bar${focused ? ' berg-on' : ''}`}>
          <div className="berg-mark" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="#0B0E10">
              <path d="M12 2.6l2.3 6.1 6.1 2.3-6.1 2.3L12 19.4l-2.3-6.1-6.1-2.3 6.1-2.3z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveChip(null); setStage('idle') }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && query.trim() && run(null)}
            placeholder={PLACEHOLDERS[phIndex]}
            aria-label="Ask about the Drakensberg"
            className="berg-ph"
            key={phIndex + (query ? 'q' : '')}
          />
          <button className="berg-mic" aria-label="Ask out loud">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          <button className="berg-go" onClick={() => run(null)} aria-label="Search">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ---- chips ---- */}
        <div className="berg-chips">
          {CHIPS.map((chip) => {
            const tk = TOKENS[chip.token]
            const cur = tk.options[selected[chip.token]]
            return (
              <div
                key={chip.id}
                className="berg-chip"
                role="button"
                tabIndex={0}
                onClick={() => run(chip)}
                onKeyDown={(e) => e.key === 'Enter' && run(chip)}
              >
                <span>{chip.pre}</span>
                <span
                  className="berg-tok"
                  role="button"
                  tabIndex={0}
                  aria-expanded={open === chip.id}
                  onClick={(e) => { e.stopPropagation(); setOpen(open === chip.id ? null : chip.id) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.stopPropagation(); setOpen(open === chip.id ? null : chip.id) }
                  }}
                >
                  {cur.text}
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 4.5L6 8.5L10 4.5" />
                  </svg>
                  {open === chip.id && (
                    <div className="berg-menu" onClick={(e) => e.stopPropagation()}>
                      {tk.options.map((o, i) => (
                        <button
                          key={String(o.value)}
                          className={`berg-opt${i === selected[chip.token] ? ' berg-sel' : ''}`}
                          onClick={() => {
                            setSelected({ ...selected, [chip.token]: i })
                            setOpen(null)
                            setActiveChip(chip.id)
                            setStage('idle')
                          }}
                        >
                          {o.text}
                          <small>{o.meta}</small>
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

        {/* ---- structured query debug panel ---- */}
        <div className="berg-peek">
          <button
            className="berg-peek-btn"
            onClick={() => setShowJson(!showJson)}
          >
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
              style={{ transform: showJson ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
            What the chip actually sends
          </button>
          {showJson && (
            <div className="berg-json">
              {JSON.stringify(structured(), null, 2)
                .split('\n')
                .map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>

        {/* ---- thinking indicator ---- */}
        {stage === 'thinking' && (
          <div className="berg-think">
            <span className="berg-dot" />
            <span className="berg-dot" />
            <span className="berg-dot" />
            Checking guide diaries and lodge availability
          </div>
        )}

        {/* ---- quote card ---- */}
        {stage === 'quote' && (
          <div className="berg-card">
            <div className="berg-card-top">
              <div className="berg-tag">Draft quote</div>
              <h3>{QUOTE.title}</h3>
            </div>
            {QUOTE.lines.map((l) => (
              <div className="berg-line" key={l.label}>
                <div>
                  <p>{l.label}</p>
                  <small>{l.detail}</small>
                </div>
                <b>{rand(l.cost)}</b>
              </div>
            ))}
            <div className="berg-sum">
              <span>Total for two</span>
              <strong>{rand(total)}</strong>
            </div>
            <div className="berg-acts">
              <button className="berg-primary">Send me this quote</button>
              <button
                className="berg-ghost"
                onClick={() => setStage('idle')}
              >
                Change something
              </button>
            </div>
            <p className="berg-fine">
              Prices held for 48 hours. A guide reviews every quote before it reaches your inbox.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
