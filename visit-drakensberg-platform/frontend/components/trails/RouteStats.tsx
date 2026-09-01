'use client'
import type { Trail } from '@/lib/trails'

const colors = { easy: '#4A7251', moderate: '#C9A96E', difficult: '#E6762E', extreme: '#C0392B' }
const fmtKm = (v?: number) => typeof v === 'number' ? `${v.toFixed(1)} km` : '—'
const fmtM = (v?: number) => typeof v === 'number' ? `${Math.round(v)} m` : '—'
const fmtH = (v?: number) => typeof v === 'number' ? `${Math.floor(v)}h ${Math.round((v % 1) * 60)}m` : '—'

/**
 * GPX-derived stats + slope distribution — the analytics half of the old
 * "Interactive Route Planner" (TrailPlanner), split out once the elevation/
 * route visualisation itself moved to RouteProfileChart (which now owns the
 * interactive scrubber). The slope-distribution bar is intentionally the
 * one place slope still gets a colour band — it's a distribution legend,
 * not the height profile, which stays a single trail-green throughout.
 */
export default function RouteStats({ trail }: { trail: Trail }) {
  const analysis = trail.analytics
  if (!analysis) return null
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Distance', fmtKm(analysis.statistics.totalDistanceKm)],
          ['Highest', fmtM(analysis.statistics.maximumElevationM)],
          ['Gain', fmtM(analysis.statistics.totalAscentM)],
          ['Duration', fmtH(analysis.statistics.estimatedHikingTimeHours)],
          ['Avg slope', `${analysis.statistics.averageSlopePct.toFixed(1)}%`],
          ['Max slope', `${analysis.statistics.maximumSlopePct.toFixed(0)}%`],
          ['Difficulty', trail.manual_grade || analysis.automaticGrade],
          ['Crux rating', analysis.cruxes[0]?.severity || 'None'],
        ].map(([l, v]) => (
          <div key={l} className="bg-white border border-gray-200 p-4">
            <p className="font-sans text-[10px] uppercase tracking-wide text-gray-400">{l}</p>
            <p className="font-display italic text-xl text-forest">{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 p-4">
        <h3 className="font-display italic text-xl mb-3">Slope distribution</h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-gray-100 mb-3">
          {analysis.slopeDistribution.map(b => (
            <div key={b.label} style={{ width: `${b.percent}%`, backgroundColor: colors[b.band] }} title={`${b.label}: ${b.percent.toFixed(0)}%`} />
          ))}
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {analysis.slopeDistribution.map(b => (
            <div key={b.label} className="text-xs">
              <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: colors[b.band] }} />
              {b.label} · {b.percent.toFixed(0)}%
            </div>
          ))}
        </div>
      </div>

      <details className="bg-white border border-gray-200 p-4">
        <summary className="cursor-pointer font-display italic text-xl">Advanced route statistics</summary>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 font-sans text-sm">
          {Object.entries({
            'Longest climb': fmtKm(analysis.statistics.longestClimbKm),
            'Longest descent': fmtKm(analysis.statistics.longestDescentKm),
            'Steepest climb': `${analysis.statistics.steepestClimbPct.toFixed(0)}%`,
            'Steepest descent': `${analysis.statistics.steepestDescentPct.toFixed(0)}%`,
            'Average altitude': fmtM(analysis.statistics.averageElevationM),
            'Running pace': `${analysis.statistics.runningPaceMinPerKm.toFixed(0)} min/km`,
            'Climb angle': `${analysis.statistics.averageClimbAngleDeg.toFixed(1)}°`,
            'Total descent': fmtM(analysis.statistics.totalDescentM),
          }).map(([l, v]) => (
            <div key={l}>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{l}</p>
              <p>{v}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
