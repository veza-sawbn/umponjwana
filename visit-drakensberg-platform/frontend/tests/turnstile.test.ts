import { describe, it, expect } from 'vitest'
import {
  TURNSTILE_HOST,
  TURNSTILE_SCRIPT_URL,
  TURNSTILE_TOKEN_TTL_MS,
  isTurnstileEnabled,
  captchaOptions,
  isTokenStale,
} from '../lib/turnstile'

/**
 * Regression tests for the captcha the platform did not have when it was
 * flooded — 144 listing applications, 109 of them scripted, in September 2026.
 *
 * The widget itself is Cloudflare's and cannot be unit tested here. What CAN
 * be pinned down is the contract every calling form depends on, and each of
 * these asserts a specific way the integration could be broken by a plausible
 * "tidy-up" edit.
 */

describe('captchaOptions — what actually reaches Supabase', () => {
  it('sends the token when there is one', () => {
    expect(captchaOptions('0.abc-token')).toEqual({ captchaToken: '0.abc-token' })
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace', '   '],
  ])('omits the field entirely when the token is %s', (_label, token) => {
    // NOT { captchaToken: undefined }, and NOT { captchaToken: '' }. GoTrue
    // rejects an empty captcha_token outright, so a deployment that has not
    // switched captcha on must send no field at all or every sign-in on it
    // starts failing.
    const options = captchaOptions(token as string | null | undefined)
    expect(options).toEqual({})
    expect('captchaToken' in options).toBe(false)
  })

  it('trims, so a stray newline from a paste does not become a bad token', () => {
    expect(captchaOptions(' 0.abc \n')).toEqual({ captchaToken: '0.abc' })
  })

  it('spreads cleanly into a signUp options object without clobbering data', () => {
    // lib/auth.ts does exactly this. If captchaOptions ever returned a whole
    // options object instead of a fragment, the user metadata would vanish and
    // every new account would land with no full_name and the default role.
    const options = { data: { full_name: 'Thandi', role: 'supplier' }, ...captchaOptions('0.tok') }
    expect(options).toEqual({
      data: { full_name: 'Thandi', role: 'supplier' },
      captchaToken: '0.tok',
    })
  })
})

describe('isTurnstileEnabled — unconfigured must stay a working state', () => {
  it.each(['', '   '])('is false for a missing site key (%j)', key => {
    expect(isTurnstileEnabled(key)).toBe(false)
  })

  it('is true once a site key is present', () => {
    expect(isTurnstileEnabled('0x4AAAAAAE-example')).toBe(true)
  })
})

describe('token lifetime', () => {
  it('treats a token as stale at 300 seconds, the documented TTL', () => {
    expect(TURNSTILE_TOKEN_TTL_MS).toBe(300_000)
    const issued = 1_000_000
    expect(isTokenStale(issued, issued + 299_000)).toBe(false)
    expect(isTokenStale(issued, issued + 300_000)).toBe(true)
  })
})

describe('the widget origin', () => {
  it('is the one host the CSP has to allow', () => {
    expect(TURNSTILE_HOST).toBe('https://challenges.cloudflare.com')
  })

  it('asks for explicit render — the forms it guards are not on screen at load', () => {
    // The list-with-us widget lives on step 5 of 5. An implicit render scans
    // the DOM once on script load and would never find it.
    expect(TURNSTILE_SCRIPT_URL).toContain('render=explicit')
    expect(TURNSTILE_SCRIPT_URL.startsWith(TURNSTILE_HOST)).toBe(true)
  })
})
