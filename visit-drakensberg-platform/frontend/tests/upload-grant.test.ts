import { describe, it, expect } from 'vitest'
import {
  signUploadGrant,
  verifyUploadGrant,
  grantCookieOptions,
  GRANT_TTL_MS,
  GRANT_COOKIE,
} from '../lib/upload-grant'

/**
 * The grant is what replaced three anonymous write endpoints. If it can be
 * forged, re-scoped or made to outlive its window, all three are open again —
 * so these test the failure modes, not the happy path.
 */

const SECRET = 'service-role-key-stand-in'
const REF = 'LP-AB23CD'
const NOW = 1_800_000_000_000

const opts = { now: NOW, secret: SECRET }

describe('a grant the server minted', () => {
  it('verifies for the reference it was issued for', () => {
    const grant = signUploadGrant(REF, opts)!
    expect(grant).toBeTruthy()
    const verdict = verifyUploadGrant(grant, REF, opts)
    expect(verdict.ok).toBe(true)
    if (!verdict.ok) return
    expect(verdict.payload.reference).toBe(REF)
    expect(verdict.payload.expiresAt).toBe(NOW + GRANT_TTL_MS)
  })

  it('is NOT permission to write to a different application', () => {
    // The whole point of scoping. Without this, one solved captcha is a
    // licence to attach files to anybody's application — including a
    // certificate lodged against someone else's accreditation.
    const grant = signUploadGrant(REF, opts)!
    expect(verifyUploadGrant(grant, 'LP-ZZ99YY', opts)).toEqual({ ok: false, reason: 'wrong_reference' })
  })

  it('expires', () => {
    const grant = signUploadGrant(REF, opts)!
    expect(verifyUploadGrant(grant, REF, { ...opts, now: NOW + GRANT_TTL_MS - 1 }).ok).toBe(true)
    expect(verifyUploadGrant(grant, REF, { ...opts, now: NOW + GRANT_TTL_MS }))
      .toEqual({ ok: false, reason: 'expired' })
  })
})

describe('a grant the server did not mint', () => {
  it('refuses one signed with a different key', () => {
    const forged = signUploadGrant(REF, { ...opts, secret: 'some-other-key' })!
    expect(verifyUploadGrant(forged, REF, opts)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('refuses a payload edited after signing', () => {
    // The obvious attack: mint a grant for your own application, then rewrite
    // the reference to somebody else's and keep the signature.
    const grant = signUploadGrant(REF, opts)!
    const [version, , mac] = grant.split('.')
    const swapped = Buffer.from(JSON.stringify({ reference: 'LP-ZZ99YY', expiresAt: NOW + GRANT_TTL_MS }))
      .toString('base64url')
    expect(verifyUploadGrant(`${version}.${swapped}.${mac}`, 'LP-ZZ99YY', opts))
      .toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('refuses an extended expiry', () => {
    const grant = signUploadGrant(REF, opts)!
    const [version, , mac] = grant.split('.')
    const extended = Buffer.from(JSON.stringify({ reference: REF, expiresAt: NOW + 10 * GRANT_TTL_MS }))
      .toString('base64url')
    expect(verifyUploadGrant(`${version}.${extended}.${mac}`, REF, opts))
      .toEqual({ ok: false, reason: 'bad_signature' })
  })

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['null', null],
  ])('refuses %s', (_label, token) => {
    expect(verifyUploadGrant(token as string | null | undefined, REF, opts))
      .toEqual({ ok: false, reason: 'missing' })
  })

  it.each([
    ['no dots', 'notagrant'],
    ['too few parts', 'v1.abc'],
    ['too many parts', 'v1.a.b.c'],
    ['an unknown version', 'v2.abc.def'],
  ])('refuses a malformed token (%s)', (_label, token) => {
    expect(verifyUploadGrant(token, REF, opts)).toEqual({ ok: false, reason: 'malformed' })
  })

  it('refuses a valid signature over a payload that is not a grant', () => {
    // Signed correctly, but the body decodes to something without the fields.
    // Reached by signing arbitrary JSON with a leaked key is not the threat —
    // the threat is a future caller passing the wrong thing and this returning
    // ok:true with undefined fields.
    const body = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64url')
    const crypto = require('crypto') as typeof import('crypto')
    const key = crypto.createHmac('sha256', SECRET).update('listing-application-upload-grant-v1').digest()
    const mac = crypto.createHmac('sha256', key).update(`v1.${body}`).digest().toString('base64url')
    expect(verifyUploadGrant(`v1.${body}.${mac}`, REF, opts)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('a deployment with no signing key', () => {
  it('cannot mint', () => {
    expect(signUploadGrant(REF, { ...opts, secret: '' })).toBeNull()
  })

  it('refuses everything rather than waving it through', () => {
    // Fail-closed: unlike the captcha's "not configured" case, a missing
    // service-role key means the upload routes could not write anyway.
    const grant = signUploadGrant(REF, opts)!
    expect(verifyUploadGrant(grant, REF, { ...opts, secret: '' })).toEqual({ ok: false, reason: 'no_key' })
  })
})

describe('the cookie', () => {
  it('is httpOnly and same-site — no script ever needs to read it', () => {
    const options = grantCookieOptions(true)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.secure).toBe(true)
    expect(options.maxAge).toBe(GRANT_TTL_MS / 1000)
  })

  it('drops Secure on http, so local development works', () => {
    expect(grantCookieOptions(false).secure).toBe(false)
  })

  it('has a name that does not collide with the auth cookies', () => {
    expect(GRANT_COOKIE).toBe('vd_upload_grant')
    expect(GRANT_COOKIE.startsWith('sb-')).toBe(false)
  })
})
