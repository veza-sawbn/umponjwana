import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSiteOrigin, isTrustedHost, configuredOrigin } from '@/lib/origin'

/**
 * Regression tests for C3 — password-reset / waiver / invite link poisoning.
 *
 * getSiteOrigin's return value is the host in emails that carry a credential
 * (a recovery token_hash, a waiver signing token, an invite link). If a
 * request header can choose it, sending one header is account takeover.
 */

const ORIGINAL_ENV = { ...process.env }

function request(headers: Record<string, string>, url = 'https://internal.local/api/x') {
  return new Request(url, { headers })
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://visitdrakensberg.com'
  delete process.env.TRUSTED_SITE_HOSTS
  delete process.env.VERCEL_URL
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('getSiteOrigin — forwarded host is not trusted by default', () => {
  it('ignores an attacker-supplied x-forwarded-host', () => {
    const origin = getSiteOrigin(request({ 'x-forwarded-host': 'attacker.example' }))
    expect(origin).toBe('https://visitdrakensberg.com')
    expect(origin).not.toContain('attacker.example')
  })

  it('ignores a host that merely suffixes the real one', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'visitdrakensberg.com.attacker.example' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('ignores a host that merely prefixes the real one', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'notvisitdrakensberg.com' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('takes only the first entry of a comma-separated header, and still validates it', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'attacker.example, visitdrakensberg.com' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('does not let a forwarded host smuggle a path or credentials', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'visitdrakensberg.com@attacker.example' })))
      .toBe('https://visitdrakensberg.com')
  })
})

describe('getSiteOrigin — the real host still works', () => {
  it('honours the configured host when forwarded', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'visitdrakensberg.com' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('is case-insensitive about the host, and normalises it', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'VisitDrakensberg.COM' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('honours a host listed in TRUSTED_SITE_HOSTS', () => {
    process.env.TRUSTED_SITE_HOSTS = 'staging.visitdrakensberg.com, www.visitdrakensberg.com'
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'staging.visitdrakensberg.com' })))
      .toBe('https://staging.visitdrakensberg.com')
  })

  it('honours a vercel preview host when the project deploys to vercel', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://umponjwana.vercel.app'
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'umponjwana-git-branch.vercel.app' })))
      .toBe('https://umponjwana-git-branch.vercel.app')
  })

  it('does NOT honour a vercel preview host when the project has no vercel host configured', () => {
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'anyone.vercel.app' })))
      .toBe('https://visitdrakensberg.com')
  })

  it('respects a forwarded http proto for a trusted host', () => {
    process.env.TRUSTED_SITE_HOSTS = 'localhost'
    expect(getSiteOrigin(request({ 'x-forwarded-host': 'localhost:3000', 'x-forwarded-proto': 'http' })))
      .toBe('http://localhost:3000')
  })

  it('coerces a bogus forwarded proto to https rather than pasting it into an href', () => {
    expect(getSiteOrigin(request({
      'x-forwarded-host': 'visitdrakensberg.com',
      'x-forwarded-proto': 'javascript',
    }))).toBe('https://visitdrakensberg.com')
  })
})

describe('configuredOrigin', () => {
  it('adds a missing scheme and strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'umponjwana.vercel.app/'
    expect(configuredOrigin()).toBe('https://umponjwana.vercel.app')
  })

  it('falls back to the request origin when nothing is configured', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(configuredOrigin(request({}, 'https://fallback.local/api/x'))).toBe('https://fallback.local')
  })
})

describe('isTrustedHost', () => {
  const allowed = ['visitdrakensberg.com', 'localhost']

  it.each([
    'attacker.example',
    'visitdrakensberg.com.attacker.example',
    'xvisitdrakensberg.com',
    'evilvercel.app',
    'project.vercel.app.attacker.example',
    '',
    '   ',
  ])('rejects %j', host => {
    expect(isTrustedHost(host, allowed)).toBe(false)
  })

  it.each([
    'visitdrakensberg.com',
    'VISITDRAKENSBERG.COM',
    'visitdrakensberg.com:443',
    'localhost',
  ])('accepts %j', host => {
    expect(isTrustedHost(host, allowed)).toBe(true)
  })
})
