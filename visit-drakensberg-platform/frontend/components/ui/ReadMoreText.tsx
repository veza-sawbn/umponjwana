'use client'
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// How many paragraphs stay visible before the "Read more" toggle.
const PREVIEW_PARAGRAPHS = 2
// A wall-of-text paragraph longer than this reads as unreadable on its own —
// split it into sentence-grouped chunks so "two paragraphs" is a meaningful
// preview instead of the entire write-up landing in one block.
const MAX_CHARS_BEFORE_SPLIT = 320
const SENTENCES_PER_SYNTHETIC_PARAGRAPH = 3

function splitIntoParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean)
  if (paragraphs.length === 0) return []
  // Already has real paragraph breaks and none of them is a giant blob.
  if (paragraphs.length > 1 && paragraphs.every(p => p.length <= MAX_CHARS_BEFORE_SPLIT * 2)) {
    return paragraphs
  }

  return paragraphs.flatMap(p => {
    if (p.length <= MAX_CHARS_BEFORE_SPLIT) return [p]
    const sentences = p.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [p]
    const chunks: string[] = []
    for (let i = 0; i < sentences.length; i += SENTENCES_PER_SYNTHETIC_PARAGRAPH) {
      chunks.push(sentences.slice(i, i + SENTENCES_PER_SYNTHETIC_PARAGRAPH).join('').trim())
    }
    return chunks.filter(Boolean)
  })
}

/**
 * Renders freeform description text as short paragraphs, previewing the
 * first two and hiding the rest behind a "Read more" toggle — long
 * unbroken write-ups otherwise render as one dense, unreadable block.
 */
export default function ReadMoreText({
  text,
  className = 'font-sans text-gray-700 leading-relaxed',
}: {
  text: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const paragraphs = useMemo(() => splitIntoParagraphs(text ?? ''), [text])

  if (paragraphs.length === 0) return null

  const preview = paragraphs.slice(0, PREVIEW_PARAGRAPHS)
  const rest = paragraphs.slice(PREVIEW_PARAGRAPHS)
  const hasMore = rest.length > 0

  return (
    <div>
      <div className={`space-y-3 ${className}`}>
        {preview.map((p, i) => <p key={i}>{p}</p>)}
        {expanded && rest.map((p, i) => <p key={`more-${i}`}>{p}</p>)}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 font-sans text-sm font-medium text-forest hover:text-sage transition-colors"
        >
          {expanded ? 'Read less' : 'Read more'}
          <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
