'use client'
import { useMemo, useState } from 'react'
import type { Trail } from '@/lib/trails'

const colors = { easy: '#4A7251', moderate: '#C9A96E', difficult: '#E6762E', extreme: '#C0392B' }
const fmtKm = (v?: number) => typeof v === 'number' ? `${v.toFixed(1)} km` : '—'
const fmtM = (v?: number) => typeof v === 'number' ? `${Math.round(v)} m` : '—'
const fmtH = (v?: number) => typeof v === 'number' ? `${Math.floor(v)}h ${Math.round((v % 1) * 60)}m` : '—'

export default function TrailPlanner({ trail }: { trail: Trail }) {
  const analysis = trail.analytics
  const [selected, setSelected] = useState(0)
  const profile = useMemo(() => {
    if (!analysis?.points.length) return ''
    const w = 900, h = 260, pad = 18
    const maxD = analysis.statistics.totalDistanceKm || 1
    const minE = analysis.statistics.minimumElevationM
    const maxE = analysis.statistics.maximumElevationM
    return analysis.points.map((p, i) => `${i ? 'L' : 'M'} ${pad + (p.distanceKm / maxD) * (w - pad * 2)} ${h - pad - ((p.ele - minE) / (maxE - minE || 1)) * (h - pad * 2)}`).join(' ')
  }, [analysis])
  if (!analysis) return null
  const p = analysis.points[selected] || analysis.points[0]
  const nearestCrux = analysis.cruxes.reduce((best, c) => Math.abs(c.distanceKm - p.distanceKm) < Math.abs(best.distanceKm - p.distanceKm) ? c : best, analysis.cruxes[0] || { distanceKm: 0, description: 'None detected' })
  const remaining = analysis.statistics.totalDistanceKm - p.distanceKm
  const ascentRemaining = analysis.sections.filter(s => s.startIndex >= selected && s.elevationChangeM > 0).reduce((a, s) => a + s.elevationChangeM, 0)
  const section = analysis.sections[Math.max(0, selected - 1)]
  return (
    <section className="space-y-6">
      <div>
        <p className="font-sans text-[10px] tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Interactive route planner</p>
        <h2 className="font-display italic text-2xl text-black mb-2">GPX Intelligence</h2>
        <p className="font-sans text-sm text-gray-600">Click or drag across the profile to synchronise route position, elevation, remaining distance, crux proximity and effort analytics.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Distance', fmtKm(analysis.statistics.totalDistanceKm)], ['Highest', fmtM(analysis.statistics.maximumElevationM)], ['Gain', fmtM(analysis.statistics.totalAscentM)], ['Duration', fmtH(analysis.statistics.estimatedHikingTimeHours)], ['Avg slope', `${analysis.statistics.averageSlopePct.toFixed(1)}%`], ['Max slope', `${analysis.statistics.maximumSlopePct.toFixed(0)}%`], ['Difficulty', trail.manual_grade || analysis.automaticGrade], ['Crux rating', analysis.cruxes[0]?.severity || 'None']].map(([l, v]) => <div key={l} className="bg-white border border-gray-200 p-4"><p className="font-sans text-[10px] uppercase tracking-wide text-gray-400">{l}</p><p className="font-display italic text-xl text-forest">{v}</p></div>)}
      </div>
      <div className="bg-white border border-gray-200 p-4">
        <div className="relative overflow-hidden rounded bg-[#F7F5F2]">
          <svg viewBox="0 0 900 260" className="h-72 w-full touch-pan-x" preserveAspectRatio="none" onMouseMove={(e)=>{const r=e.currentTarget.getBoundingClientRect(); setSelected(Math.max(0, Math.min(analysis.points.length-1, Math.round(((e.clientX-r.left)/r.width)*(analysis.points.length-1)))))}} onClick={(e)=>{const r=e.currentTarget.getBoundingClientRect(); setSelected(Math.max(0, Math.min(analysis.points.length-1, Math.round(((e.clientX-r.left)/r.width)*(analysis.points.length-1)))))}}>
            <path d={`${profile} L 882 250 L 18 250 Z`} fill="#2d6a4f18" />
            {analysis.sections.map((s, i) => { const a=analysis.points[s.startIndex], b=analysis.points[s.endIndex]; const maxD=analysis.statistics.totalDistanceKm||1, minE=analysis.statistics.minimumElevationM, maxE=analysis.statistics.maximumElevationM; const x1=18+(a.distanceKm/maxD)*864, x2=18+(b.distanceKm/maxD)*864, y1=242-((a.ele-minE)/(maxE-minE||1))*224, y2=242-((b.ele-minE)/(maxE-minE||1))*224; return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors[s.band]} strokeWidth="4" strokeLinecap="round" /> })}
            {analysis.cruxes.map(c => <circle key={c.id} cx={18+(c.distanceKm/(analysis.statistics.totalDistanceKm||1))*864} cy={242-((c.elevationM-analysis.statistics.minimumElevationM)/(analysis.statistics.elevationRangeM||1))*224} r="6" fill="#C0392B" />)}
            <line x1={18+(p.distanceKm/(analysis.statistics.totalDistanceKm||1))*864} x2={18+(p.distanceKm/(analysis.statistics.totalDistanceKm||1))*864} y1="10" y2="250" stroke="#111" strokeDasharray="4 4" />
          </svg>
        </div>
        <div className="mt-4 grid md:grid-cols-5 gap-3 font-sans text-sm">
          {[['Selected', fmtKm(p.distanceKm)], ['Elevation', fmtM(p.ele)], ['Gradient', section ? `${section.gradientPct.toFixed(1)}%` : '—'], ['Time left', fmtH((remaining/(analysis.statistics.totalDistanceKm||1))*analysis.statistics.estimatedHikingTimeHours)], ['Nearest crux', nearestCrux.description]].map(([l,v])=><div key={l}><p className="text-[10px] uppercase tracking-wide text-gray-400">{l}</p><p className="text-forest">{v}</p></div>)}
        </div>
      </div>
      <div className="bg-white border border-gray-200 p-4">
        <h3 className="font-display italic text-xl mb-3">Slope distribution</h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-gray-100 mb-3">{analysis.slopeDistribution.map(b=><div key={b.label} style={{width:`${b.percent}%`,backgroundColor:colors[b.band]}} title={`${b.label}: ${b.percent.toFixed(0)}%`} />)}</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">{analysis.slopeDistribution.map(b=><div key={b.label} className="text-xs"><span className="inline-block h-2 w-2 rounded-full mr-1" style={{backgroundColor:colors[b.band]}} />{b.label} · {b.percent.toFixed(0)}%</div>)}</div>
      </div>
      <details className="bg-white border border-gray-200 p-4"><summary className="cursor-pointer font-display italic text-xl">Advanced route statistics</summary><div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 font-sans text-sm">{Object.entries({ 'Longest climb': fmtKm(analysis.statistics.longestClimbKm), 'Longest descent': fmtKm(analysis.statistics.longestDescentKm), 'Steepest climb': `${analysis.statistics.steepestClimbPct.toFixed(0)}%`, 'Steepest descent': `${analysis.statistics.steepestDescentPct.toFixed(0)}%`, 'Average altitude': fmtM(analysis.statistics.averageElevationM), 'Running pace': `${analysis.statistics.runningPaceMinPerKm.toFixed(0)} min/km`, 'Climb angle': `${analysis.statistics.averageClimbAngleDeg.toFixed(1)}°`, 'Ascent remaining': fmtM(ascentRemaining) }).map(([l,v])=><div key={l}><p className="text-[10px] uppercase tracking-wide text-gray-400">{l}</p><p>{v}</p></div>)}</div></details>
    </section>
  )
}
