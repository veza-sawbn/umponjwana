'use client'

import { useRef, useState } from 'react'
import { Bold, Italic, Highlighter, Heading2, Heading3, List, ListOrdered, Pilcrow } from 'lucide-react'
import FormattedText from './FormattedText'

// A textarea with a small formatting toolbar and a preview, for text shown
// with <FormattedText>. The buttons only insert the plain-text markers
// FormattedText understands, so what is stored stays readable as-is.

type Wrap = { kind: 'wrap'; before: string; after: string; placeholder: string }
type Prefix = { kind: 'prefix'; prefix: (i: number) => string }
type Insert = { kind: 'insert'; text: string }

const ACTIONS: Array<{ label: string; icon: typeof Bold; action: Wrap | Prefix | Insert }> = [
  { label: 'Bold', icon: Bold, action: { kind: 'wrap', before: '**', after: '**', placeholder: 'bold text' } },
  { label: 'Italic', icon: Italic, action: { kind: 'wrap', before: '*', after: '*', placeholder: 'italic text' } },
  { label: 'Highlight', icon: Highlighter, action: { kind: 'wrap', before: '==', after: '==', placeholder: 'highlighted text' } },
  { label: 'Heading', icon: Heading2, action: { kind: 'prefix', prefix: () => '## ' } },
  { label: 'Subheading', icon: Heading3, action: { kind: 'prefix', prefix: () => '### ' } },
  { label: 'Bullet list', icon: List, action: { kind: 'prefix', prefix: () => '- ' } },
  { label: 'Numbered list', icon: ListOrdered, action: { kind: 'prefix', prefix: i => `${i + 1}. ` } },
  { label: 'New paragraph', icon: Pilcrow, action: { kind: 'insert', text: '\n\n' } },
]

export default function FormattedTextArea({
  value, onChange, placeholder, rows = 5, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  ariaLabel?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  function apply(action: Wrap | Prefix | Insert) {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    let next = value
    let selStart = start
    let selEnd = end

    if (action.kind === 'wrap') {
      const chosen = value.slice(start, end) || action.placeholder
      next = value.slice(0, start) + action.before + chosen + action.after + value.slice(end)
      selStart = start + action.before.length
      selEnd = selStart + chosen.length
    } else if (action.kind === 'insert') {
      next = value.slice(0, start) + action.text + value.slice(end)
      selStart = selEnd = start + action.text.length
    } else {
      // Prefix every line the selection touches, replacing an existing
      // heading/list marker rather than stacking a second one.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEndIdx = value.indexOf('\n', end)
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
      const lines = value.slice(lineStart, lineEnd).split('\n')
      const replaced = lines
        .map((l, i) => action.prefix(i) + l.replace(/^\s*(#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/, ''))
        .join('\n')
      next = value.slice(0, lineStart) + replaced + value.slice(lineEnd)
      selStart = lineStart
      selEnd = lineStart + replaced.length
    }

    onChange(next)
    setPreview(false)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(selStart, selEnd)
    })
  }

  return (
    <div className="border border-black/10 bg-white focus-within:border-[#C9A96E]/50">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-black/6 px-1.5 py-1 bg-[#FAFAF9]">
        {ACTIONS.map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onMouseDown={e => e.preventDefault()}
            onClick={() => apply(action)}
            className="p-1.5 text-black/50 hover:text-black/80 hover:bg-black/5"
          >
            <Icon size={14} />
          </button>
        ))}
        <div className="ml-auto flex font-sans text-[11px]">
          <button type="button" onClick={() => setPreview(false)} className={`px-2 py-1 ${!preview ? 'text-[#2d6a4f] font-medium' : 'text-black/40 hover:text-black/70'}`}>Write</button>
          <button type="button" onClick={() => setPreview(true)} className={`px-2 py-1 ${preview ? 'text-[#2d6a4f] font-medium' : 'text-black/40 hover:text-black/70'}`}>Preview</button>
        </div>
      </div>
      {preview ? (
        <div className="px-3 py-2.5 min-h-[6rem] text-gray-700">
          {value.trim()
            ? <FormattedText text={value} />
            : <p className="font-sans text-xs text-black/30">Nothing to preview yet.</p>}
        </div>
      ) : (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full font-sans text-sm px-3 py-2 outline-none resize-y bg-white block"
        />
      )}
    </div>
  )
}
