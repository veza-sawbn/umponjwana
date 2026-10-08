import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FormattedText, { parseBlocks } from '@/components/ui/FormattedText'

const html = (text: string) => renderToStaticMarkup(createElement(FormattedText, { text }))

describe('FormattedText', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(parseBlocks('One\ntwo\n\nThree')).toEqual([
      { kind: 'p', lines: ['One', 'two'] },
      { kind: 'p', lines: ['Three'] },
    ])
    expect(html('One\ntwo')).toContain('One<br/>two')
  })

  it('recognises headings and lists', () => {
    expect(parseBlocks('## Route\n### Kit\n- boots\n- poles\n1. first\n2. second')).toEqual([
      { kind: 'h2', text: 'Route' },
      { kind: 'h3', text: 'Kit' },
      { kind: 'ul', items: ['boots', 'poles'] },
      { kind: 'ol', items: ['first', 'second'] },
    ])
  })

  it('renders bold, italic and highlight', () => {
    const out = html('**Distance** 10 km, *steady*, ==bring water==')
    expect(out).toContain('<strong')
    expect(out).toContain('>Distance</strong>')
    expect(out).toContain('<em>steady</em>')
    expect(out).toContain('<mark')
  })

  it('never renders typed markup as HTML', () => {
    const out = html('<img src=x onerror=alert(1)> **<b>hi</b>**')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })

  it('leaves plain text with stray markers readable', () => {
    expect(html('Distance 10-10.5 km | 5 * 2 hours')).toContain('5 * 2 hours')
  })
})
