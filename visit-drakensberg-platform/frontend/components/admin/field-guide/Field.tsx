'use client'

import type { ReactNode } from 'react'

// Small form primitives in the admin console's existing idiom (uppercase
// micro-label, mist-filled input, forest focus ring) so this module does not
// invent a second look for a text box. Every control is a real labelled
// input, so the whole editor is reachable from the keyboard.

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-sans text-[10px] tracking-[0.12em] uppercase text-gray-400 mb-1.5"
    >
      {children}
      {hint && <span className="ml-1.5 normal-case tracking-normal text-gray-300">— {hint}</span>}
    </label>
  )
}

const INPUT =
  'w-full border border-gray-200 px-3 py-2.5 font-sans text-sm text-gray-800 bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]'

export function TextField({
  label, value, onChange, placeholder, hint, id, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  id?: string
  type?: string
}) {
  const fieldId = id ?? `fg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <Label htmlFor={fieldId} hint={hint}>{label}</Label>
      <input id={fieldId} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT} />
    </div>
  )
}

export function TextArea({
  label, value, onChange, rows = 3, placeholder, hint, id,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  hint?: string
  id?: string
}) {
  const fieldId = id ?? `fg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <Label htmlFor={fieldId} hint={hint}>{label}</Label>
      <textarea
        id={fieldId}
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT} resize-none leading-[1.6]`}
      />
    </div>
  )
}

/** Number input paired with a range slider. The slider is for feel; the box
 *  is for the exact value an editor wants to type, and the pair stays in sync. */
export function NumberField({
  label, value, onChange, min, max, step = 1, suffix, hint, id, slider = true,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  suffix?: string
  hint?: string
  id?: string
  slider?: boolean
}) {
  const fieldId = id ?? `fg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const commit = (raw: string) => {
    const n = Number(raw)
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)))
  }
  return (
    <div>
      <Label htmlFor={fieldId} hint={hint}>{label}</Label>
      <div className="flex items-center gap-2">
        {slider && (
          <input
            type="range"
            aria-label={`${label} slider`}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => commit(e.target.value)}
            className="flex-1 accent-[#2d6a4f] h-1"
          />
        )}
        <div className="flex items-center gap-1 shrink-0">
          <input
            id={fieldId}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => commit(e.target.value)}
            className="w-20 border border-gray-200 px-2 py-1.5 font-sans text-xs text-gray-800 bg-[#F7F5F2] focus:outline-none focus:border-[#2d6a4f]"
          />
          {suffix && <span className="font-sans text-[10px] text-gray-400">{suffix}</span>}
        </div>
      </div>
    </div>
  )
}

export function SelectField<T extends string>({
  label, value, onChange, options, id,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  id?: string
}) {
  const fieldId = id ?? `fg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div>
      <Label htmlFor={fieldId}>{label}</Label>
      <select id={fieldId} value={value} onChange={e => onChange(e.target.value as T)} className={INPUT}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function CheckField({
  label, checked, onChange, hint, id,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
  id?: string
}) {
  const fieldId = id ?? `fg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 accent-[#2d6a4f] w-3.5 h-3.5"
      />
      <label htmlFor={fieldId} className="font-sans text-xs text-gray-600 leading-snug">
        {label}
        {hint && <span className="block text-gray-400 mt-0.5">{hint}</span>}
      </label>
    </div>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase text-gray-400">{children}</h3>
      {action}
    </div>
  )
}
