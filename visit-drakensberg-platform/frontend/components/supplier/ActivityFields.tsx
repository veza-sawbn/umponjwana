'use client'
import { useId } from 'react'
import { Clock, Compass, Droplets, Gauge, Landmark, MapPin, Mountain, Sparkles, UserCheck, Users, type LucideIcon } from 'lucide-react'

/**
 * Shared "Activity Details" controls for the supplier add/edit activity forms.
 * Both pages store the same strings, so the option lists live here to keep the
 * two in step.
 */

const ACTIVITY_CATEGORIES: { value: string; icon: LucideIcon }[] = [
  { value: 'Adventure', icon: Compass },
  { value: 'Nature', icon: Mountain },
  { value: 'Water', icon: Droplets },
  { value: 'Cultural', icon: Landmark },
  { value: 'Wellness', icon: Sparkles },
  { value: 'Family', icon: Users },
]

const ACTIVITY_DIFFICULTIES: { value: string; dots: number }[] = [
  { value: 'Easy', dots: 1 },
  { value: 'Moderate', dots: 2 },
  { value: 'Challenging', dots: 3 },
  { value: 'Extreme', dots: 4 },
]

const DURATION_HOURS = Array.from({ length: 13 }, (_, i) => i)
const DURATION_MINUTES = [0, 15, 30, 45]

/** "2h 30m" · "45m" · "" when nothing is set — used for the review step and listings. */
export function formatDuration(hours: number, minutes: number) {
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return parts.join(' ')
}

const LABEL = 'font-sans text-sm font-medium text-black/70'
const INPUT = 'w-full font-sans text-sm border border-black/10 rounded-lg px-3 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
// Sits in a narrow grid column, so it trims the horizontal padding the other
// fields use — otherwise "30m" is clipped by the native select arrow on phones.
const DURATION_SELECT = 'w-full font-sans text-sm border border-black/10 rounded-lg pl-2.5 pr-1 py-2 outline-none focus:border-[#C9A96E]/50 bg-white'
const TILE = 'flex flex-col items-center justify-center gap-1.5 rounded-xl border py-3 px-2 transition-colors'
const TILE_ON = 'bg-[#C9A96E] border-[#C9A96E] text-white'
const TILE_OFF = 'bg-white border-black/10 text-black/60 hover:border-[#C9A96E]/40'

function Label({ icon: Icon, children, required }: { icon: LucideIcon; children: React.ReactNode; required?: boolean }) {
  return (
    <span className={`${LABEL} flex items-center gap-1.5`}>
      <Icon size={14} className="text-black/30" />
      {children}
      {required && <span className="text-[#C9A96E]">*</span>}
    </span>
  )
}

export function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2.5">
      <Label icon={Compass}>Category</Label>
      <div role="group" aria-label="Category" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ACTIVITY_CATEGORIES.map(({ value: option, icon: Icon }) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? '' : option)}
              className={`${TILE} ${active ? TILE_ON : TILE_OFF}`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="font-sans text-xs font-medium">{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Dots({ filled, active }: { filled: number; active: boolean }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < filled ? (active ? 'bg-white' : 'bg-[#C9A96E]') : active ? 'bg-white/40' : 'bg-black/15'
          }`}
        />
      ))}
    </span>
  )
}

export function DifficultyPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2.5">
      <Label icon={Gauge}>Difficulty</Label>
      <div role="group" aria-label="Difficulty" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_DIFFICULTIES.map(({ value: option, dots }) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? '' : option)}
              className={`${TILE} ${active ? TILE_ON : TILE_OFF}`}
            >
              <Dots filled={dots} active={active} />
              <span className="font-sans text-xs font-medium">{option}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RegionSelect({
  value,
  onChange,
  regions,
  required,
}: {
  value: string
  onChange: (v: string) => void
  regions: string[]
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id}>
        <Label icon={MapPin} required={required}>Region</Label>
      </label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={INPUT}>
        <option value="">Select region…</option>
        {regions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    </div>
  )
}

export function DurationPicker({
  hours,
  minutes,
  onChange,
}: {
  hours: number
  minutes: number
  onChange: (next: { hours: number; minutes: number }) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label icon={Clock}>Duration</Label>
      <div className="flex gap-2">
        <select
          aria-label="Duration hours"
          value={hours}
          onChange={e => onChange({ hours: +e.target.value, minutes })}
          className={DURATION_SELECT}
        >
          {DURATION_HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
        </select>
        <select
          aria-label="Duration minutes"
          value={minutes}
          onChange={e => onChange({ hours, minutes: +e.target.value })}
          className={DURATION_SELECT}
        >
          {DURATION_MINUTES.map(m => <option key={m} value={m}>{m}m</option>)}
        </select>
      </div>
    </div>
  )
}

export function MinAgeField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id}>
        <Label icon={UserCheck}>Minimum Age</Label>
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min={0}
          max={120}
          value={value || ''}
          onChange={e => onChange(Math.max(0, +e.target.value || 0))}
          placeholder="No minimum"
          className={`${INPUT} pr-14`}
        />
        {value > 0 && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-sans text-xs text-black/35">
            years
          </span>
        )}
      </div>
    </div>
  )
}
