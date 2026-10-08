import { Fragment, type ReactNode } from 'react'

// Lightweight formatting for operator-written itinerary text. Operators type
// plain text with a few markers (the editor's toolbar inserts them):
//
//   ## Heading            ### Smaller heading
//   **bold**   *italic*   ==highlighted==
//   - bullet item         1. numbered item
//   a blank line starts a new paragraph; a single line break is kept.
//
// Rendered as React elements, never as HTML, so nothing an operator types
// can inject markup into the guest's page. Plain text with no markers renders
// as before, just with its paragraphs and line breaks kept.

type Block =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'p'; lines: string[] }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/

export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => { if (para.length) blocks.push({ kind: 'p', lines: para }); para = [] }
  const flushList = () => { if (list) blocks.push(list); list = null }

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { flushPara(); flushList(); continue }

    const heading = /^\s*(#{2,3})\s+(.*)$/.exec(line) ?? /^\s*(#)\s+(.*)$/.exec(line)
    if (heading) {
      flushPara(); flushList()
      blocks.push(heading[1].length >= 3 ? { kind: 'h3', text: heading[2] } : { kind: 'h2', text: heading[2] })
      continue
    }
    const bullet = BULLET.exec(line)
    const numbered = bullet ? null : NUMBERED.exec(line)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      flushPara()
      if (list && list.kind !== kind) flushList()
      list = list ?? { kind, items: [] }
      list.items.push((bullet ?? numbered)![1])
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara(); flushList()
  return blocks
}

// **bold**, *italic* / _italic_, ==highlight==. Unclosed markers stay literal.
const INLINE = /(\*\*([^*]+?)\*\*|==([^=]+?)==|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_)/g

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index))
    const key = `${keyPrefix}-${i++}`
    if (m[2] != null) out.push(<strong key={key} className="font-semibold text-gray-900">{inline(m[2], key)}</strong>)
    else if (m[3] != null) out.push(<mark key={key} className="bg-[#C9A96E]/35 text-gray-900 px-0.5">{inline(m[3], key)}</mark>)
    else out.push(<em key={key}>{m[4] ?? m[5]}</em>)
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export default function FormattedText({ text, className = '', size = 'sm' }: {
  text: string
  className?: string
  /** 'sm' for the guest's itinerary, 'xs' for compact panels and print. */
  size?: 'sm' | 'xs'
}) {
  const body = size === 'sm' ? 'text-sm' : 'text-xs'
  return (
    <div className={`font-sans ${body} leading-relaxed space-y-2.5 ${className}`}>
      {parseBlocks(text).map((b, bi) => {
        const k = `b${bi}`
        if (b.kind === 'h2') return <p key={k} className={`font-display italic ${size === 'sm' ? 'text-lg' : 'text-base'} text-[#2d6a4f] pt-1`}>{inline(b.text, k)}</p>
        if (b.kind === 'h3') return <p key={k} className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#8B6914] pt-1">{inline(b.text, k)}</p>
        if (b.kind !== 'p') {
          const List = b.kind
          return (
            <List key={k} className={`${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1 marker:text-[#2d6a4f]`}>
              {b.items.map((item, ii) => <li key={ii}>{inline(item, `${k}-${ii}`)}</li>)}
            </List>
          )
        }
        return (
          <p key={k}>
            {b.lines.map((line, li) => (
              <Fragment key={li}>{li > 0 && <br />}{inline(line, `${k}-${li}`)}</Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

