'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Peak {
  name: string
  elevation: number
  horizontalPosition: number
  description: string
  difficulty: 'accessible' | 'moderate' | 'expert'
}

interface PanoramaViewerProps {
  spotName?: string
  latitude?: number
  longitude?: number
}

/* ─── Peak data ──────────────────────────────────────────────────────────── */
const PEAKS: Peak[] = [
  {
    name: 'Cathkin Peak',
    elevation: 3149,
    horizontalPosition: 8,
    description: 'A dramatic rock spire rising above the Central Berg, first climbed in 1912.',
    difficulty: 'expert',
  },
  {
    name: 'Champagne Castle',
    elevation: 3377,
    horizontalPosition: 16,
    description: 'The second highest peak in South Africa, offering sweeping views into Lesotho.',
    difficulty: 'expert',
  },
  {
    name: "Dragon's Back",
    elevation: 3017,
    horizontalPosition: 23,
    description: 'A serrated ridge resembling a dragon\'s spine, accessible via the Little Berg.',
    difficulty: 'moderate',
  },
  {
    name: "Monks Cowl",
    elevation: 3234,
    horizontalPosition: 30,
    description: 'Named for its distinctive hooded profile, one of the most photographed peaks.',
    difficulty: 'expert',
  },
  {
    name: 'Sterkhorn',
    elevation: 3084,
    horizontalPosition: 38,
    description: 'Afrikaans for "Strong Horn" — a challenging technical summit in the Central Berg.',
    difficulty: 'expert',
  },
  {
    name: 'Ndedema Dome',
    elevation: 3085,
    horizontalPosition: 45,
    description: 'Overlooks the Ndedema Gorge, home to the largest concentration of San rock art.',
    difficulty: 'moderate',
  },
  {
    name: 'The Sentinel',
    elevation: 3165,
    horizontalPosition: 53,
    description: 'Guards the entrance to the Royal Natal amphitheatre — chain ladders required.',
    difficulty: 'moderate',
  },
  {
    name: 'Eastern Buttress',
    elevation: 3047,
    horizontalPosition: 60,
    description: 'A massive wall forming the eastern wall of the iconic Amphitheatre.',
    difficulty: 'expert',
  },
  {
    name: 'Inner Tower',
    elevation: 2986,
    horizontalPosition: 67,
    description: 'A free-standing tower between Eastern Buttress and Outer Tower, requiring ropes.',
    difficulty: 'expert',
  },
  {
    name: 'Outer Tower',
    elevation: 3005,
    horizontalPosition: 74,
    description: 'The outermost of the Amphitheatre towers, visible from Royal Natal campsite.',
    difficulty: 'expert',
  },
  {
    name: 'Cleft Peak',
    elevation: 3281,
    horizontalPosition: 82,
    description: 'Named for the prominent cleft splitting its summit, dominating the Garden Castle area.',
    difficulty: 'expert',
  },
  {
    name: 'Rockeries Tower',
    elevation: 2853,
    horizontalPosition: 90,
    description: 'An accessible summit with wildflower-carpeted approaches in spring.',
    difficulty: 'accessible',
  },
]

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function difficultyColor(d: Peak['difficulty']): string {
  if (d === 'accessible') return '#4ade80'
  if (d === 'moderate') return '#facc15'
  return '#f87171'
}

function bearingLabel(offset: number): string {
  const degrees = Math.round(offset * 3.6)
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(degrees / 45) % 8
  const d = dirs[idx]
  return `${d} ${degrees}°`
}

/* ─── Mountain SVG silhouette ────────────────────────────────────────────── */
function MountainSilhouette() {
  return (
    <svg
      viewBox="0 0 1200 280"
      preserveAspectRatio="none"
      className="absolute bottom-0 left-0 w-full"
      style={{ height: '44%' }}
    >
      <defs>
        <linearGradient id="mountainGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1C2B1E" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#0d1a0f" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Rear range — lighter */}
      <path
        d="M0,280 L0,190 Q60,160 100,170 L150,145 Q190,125 230,140 L280,110 Q330,85 370,100 L420,75 Q460,55 500,70 L540,50 Q580,30 620,45 L660,25 Q700,8 740,20 L780,40 Q820,55 860,38 L900,20 Q940,5 980,18 L1020,35 Q1060,50 1100,30 L1150,15 L1200,25 L1200,280 Z"
        fill="#1a2e1c"
        opacity="0.5"
      />
      {/* Main range — dark */}
      <path
        d="M0,280 L0,220 Q40,210 80,215 L120,195 Q150,180 180,190 L210,165 Q240,148 270,160 L300,140 Q330,118 360,130 L395,108 Q425,88 455,102 L490,78 Q520,58 550,72 L580,52 Q610,36 640,48 L668,30 Q695,14 722,28 L748,46 Q770,60 800,42 L832,22 Q860,8 888,20 L916,38 Q940,52 968,35 L998,16 Q1025,2 1055,14 L1085,32 Q1110,46 1140,28 L1170,10 L1200,18 L1200,280 Z"
        fill="url(#mountainGrad)"
      />
    </svg>
  )
}

/* ─── Component ──────────────────────────────────────────────────────────── */
export default function PanoramaViewer({
  spotName = 'Amphitheatre Viewpoint',
  latitude = -28.7522,
  longitude = 28.9714,
}: PanoramaViewerProps) {
  const [panoramaOffset, setPanoramaOffset] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [activePeak, setActivePeak] = useState<Peak | null>(null)
  const [showInstruction, setShowInstruction] = useState(true)
  const [scrubDragging, setScrubDragging] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartOffset = useRef(50)

  /* Fade instruction overlay after 3 s */
  useEffect(() => {
    const t = setTimeout(() => setShowInstruction(false), 3500)
    return () => clearTimeout(t)
  }, [])

  /* ── Drag helpers ── */
  const startDrag = useCallback((clientX: number) => {
    setIsDragging(true)
    dragStartX.current = clientX
    dragStartOffset.current = panoramaOffset
  }, [panoramaOffset])

  const moveDrag = useCallback((clientX: number) => {
    if (!isDragging) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const dx = clientX - dragStartX.current
    const pct = (dx / rect.width) * 100
    setPanoramaOffset(Math.max(0, Math.min(100, dragStartOffset.current - pct * 0.6)))
  }, [isDragging])

  const stopDrag = useCallback(() => setIsDragging(false), [])

  /* Mouse */
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); startDrag(e.clientX) }
  const handleMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX)
  const handleMouseUp = () => stopDrag()

  /* Touch */
  const handleTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientX)
  const handleTouchMove = (e: React.TouchEvent) => { e.preventDefault(); moveDrag(e.touches[0].clientX) }
  const handleTouchEnd = () => stopDrag()

  /* Scrubber drag */
  const handleScrubMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScrubDragging(true)
    dragStartX.current = e.clientX
    dragStartOffset.current = panoramaOffset
  }
  useEffect(() => {
    if (!scrubDragging) return
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = e.clientX - dragStartX.current
      const pct = (dx / rect.width) * 100
      setPanoramaOffset(Math.max(0, Math.min(100, dragStartOffset.current + pct)))
    }
    const onUp = () => setScrubDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [scrubDragging])

  /* ── Visible peaks ── */
  const visiblePeaks = PEAKS.filter((p) => {
    const x = (p.horizontalPosition - panoramaOffset) * 8 + 50
    return x >= 5 && x <= 95
  })

  /* ── Sky gradient colours ── */
  const skyHue = Math.round(200 + panoramaOffset * 0.4)
  const skyStyle = {
    background: `radial-gradient(ellipse at 50% 60%, hsl(${skyHue},40%,28%) 0%, hsl(${skyHue + 10},25%,14%) 55%, #0a0f0b 100%)`,
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden select-none"
      style={{
        aspectRatio: '21 / 9',
        cursor: isDragging ? 'grabbing' : 'grab',
        ...skyStyle,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Stars / noise overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.05\'/%3E%3C/svg%3E")',
          backgroundSize: '200px 200px',
          opacity: 0.06,
          mixBlendMode: 'screen',
        }}
      />

      {/* Horizon haze */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          bottom: '44%',
          height: '80px',
          background: 'linear-gradient(to top, rgba(201,169,110,0.06), transparent)',
        }}
      />

      {/* Mountain silhouette */}
      <MountainSilhouette />

      {/* ── Peak markers ── */}
      {visiblePeaks.map((peak) => {
        const x = (peak.horizontalPosition - panoramaOffset) * 8 + 50
        const isActive = activePeak?.name === peak.name
        return (
          <div
            key={peak.name}
            className="absolute bottom-0 pointer-events-auto"
            style={{ left: `${x}%`, transform: 'translateX(-50%)', bottom: '42%' }}
          >
            {/* Dotted line */}
            <div
              className="mx-auto mb-1"
              style={{
                width: '1px',
                height: '30px',
                borderLeft: '1px dashed rgba(201,169,110,0.5)',
              }}
            />
            {/* Label card */}
            <div
              className="relative"
              onMouseEnter={() => setActivePeak(peak)}
              onMouseLeave={() => !isActive && setActivePeak(null)}
              onClick={() => setActivePeak(isActive ? null : peak)}
            >
              <div
                className="rounded-lg px-2.5 py-1.5 cursor-pointer transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(28,43,30,0.95)' : 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                  borderLeft: `2px solid ${difficultyColor(peak.difficulty)}`,
                  minWidth: isActive ? '180px' : '90px',
                  maxWidth: '220px',
                  boxShadow: isActive ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
                }}
              >
                {isActive ? (
                  <>
                    <p className="font-sans text-white font-semibold text-xs leading-tight">{peak.name}</p>
                    <p className="font-sans text-gold text-xs mt-0.5">{peak.elevation.toLocaleString()} m a.s.l.</p>
                    <p className="font-sans text-white/60 text-xs mt-1.5 leading-snug">{peak.description}</p>
                    <span
                      className="inline-block mt-2 px-2 py-0.5 rounded-full font-sans text-[10px] font-medium"
                      style={{ background: difficultyColor(peak.difficulty) + '22', color: difficultyColor(peak.difficulty) }}
                    >
                      {peak.difficulty.charAt(0).toUpperCase() + peak.difficulty.slice(1)}
                    </span>
                  </>
                ) : (
                  <>
                    <p className="font-sans text-white/90 font-medium text-[10px] leading-tight whitespace-nowrap">{peak.name}</p>
                    <p className="font-sans text-gold text-[9px] mt-0.5">{peak.elevation} m</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── HUD overlays ── */}
      {/* Top left: spot name */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div
          className="px-3 py-1.5 rounded-lg font-sans text-xs text-white/80 font-medium"
          style={{ background: 'rgba(28,43,30,0.7)', backdropFilter: 'blur(8px)' }}
        >
          {spotName}
        </div>
      </div>

      {/* Top right: elevation */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <div
          className="px-3 py-1.5 rounded-lg font-sans text-xs text-white/80 font-medium"
          style={{ background: 'rgba(28,43,30,0.7)', backdropFilter: 'blur(8px)' }}
        >
          1,890 m a.s.l.
        </div>
      </div>

      {/* Bottom left: bearing */}
      <div className="absolute left-4 pointer-events-none" style={{ bottom: '60px' }}>
        <div
          className="px-3 py-1.5 rounded-lg font-sans text-xs text-gold font-semibold tracking-wider"
          style={{ background: 'rgba(28,43,30,0.7)', backdropFilter: 'blur(8px)' }}
        >
          ◎ {bearingLabel(panoramaOffset)}
        </div>
      </div>

      {/* Bottom right: PeakVisor badge */}
      <div className="absolute right-4 pointer-events-auto" style={{ bottom: '60px' }}>
        <a
          href="https://peakvisor.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-1.5 rounded-lg font-sans text-[10px] text-white/40 hover:text-white/70 transition-colors"
          style={{ background: 'rgba(28,43,30,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          Powered by PeakVisor
        </a>
      </div>

      {/* ── Scrubber bar ── */}
      <div
        className="absolute left-0 right-0 pointer-events-auto"
        style={{ bottom: '16px', padding: '0 16px' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct = ((e.clientX - rect.left) / rect.width) * 100
          setPanoramaOffset(Math.max(0, Math.min(100, pct)))
        }}
      >
        <div
          className="relative h-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${panoramaOffset}%`, background: 'linear-gradient(to right, rgba(201,169,110,0.4), #C9A96E)' }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-gold shadow-gold cursor-grab active:cursor-grabbing"
            style={{ left: `${panoramaOffset}%`, transform: 'translate(-50%, -50%)', background: '#1C2B1E' }}
            onMouseDown={handleScrubMouseDown}
          />
        </div>
      </div>

      {/* ── Instruction overlay ── */}
      {showInstruction && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            animation: 'fade-out 0.5s ease-in 3s forwards',
            background: 'rgba(28,43,30,0.2)',
          }}
        >
          <div
            className="px-6 py-3 rounded-full font-sans text-sm text-white font-medium"
            style={{ background: 'rgba(28,43,30,0.75)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,169,110,0.3)' }}
          >
            ← Drag to explore the horizon →
          </div>
        </div>
      )}
    </div>
  )
}
