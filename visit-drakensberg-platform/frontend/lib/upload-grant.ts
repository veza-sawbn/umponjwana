import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Short-lived, server-signed permission to upload against one application.
 *
 * WHY A GRANT AND NOT JUST A CAPTCHA PER UPLOAD
 *   20260807 and 20260905 between them opened three anonymous write endpoints
 *   that the "list with us" wizard needs on steps 2 and 3 — photos into
 *   media/listing-applications/…, certificates into compliance/applications/…,
 *   and a row in vd_compliance_documents. All three were reachable by anyone
 *   holding the anon key, which ships in every page of the site.
 *
 *   A Turnstile token is redeemable once, so "one token per upload" would mean
 *   a fresh challenge for every photo — eight of them, for an applicant who is
 *   simply attaching pictures of their lodge. Instead the applicant solves one
 *   challenge, and the server hands back a signed note saying "this browser
 *   may upload against LP-XXXXXX until <time>". The uploads themselves then
 *   carry the note rather than a captcha.
 *
 * WHAT IT IS AND IS NOT
 *   It is a bearer capability, scoped to one application reference and expiring
 *   in two hours. Someone who steals a grant can attach files to that one
 *   application until it expires — which is roughly what they could do by
 *   solving one captcha themselves, so the grant does not widen the hole it
 *   replaces. It is NOT identity: nothing about it says who the applicant is,
 *   and it must never be treated as authentication for anything that reads.
 *
 * THE KEY
 *   Derived from SUPABASE_SERVICE_ROLE_KEY rather than a new environment
 *   variable. That key is already required for any of this to work (the routes
 *   write with it), it is already server-only, and a separate secret would be
 *   one more thing to set correctly in three environments and one more way for
 *   uploads to break silently in preview. The derivation is domain-separated,
 *   so a grant cannot be replayed as anything else signed with the same key.
 */

/** Two hours: long enough to fill in the form, short enough to be worth little. */
export const GRANT_TTL_MS = 2 * 60 * 60 * 1000

export const GRANT_COOKIE = 'vd_upload_grant'

const VERSION = 'v1'
const DOMAIN = 'listing-application-upload-grant-v1'

function signingKey(secret?: string): Buffer | null {
  const base = (secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!base) return null
  return createHmac('sha256', base).update(DOMAIN).digest()
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export type GrantPayload = {
  /** The application reference this grant is good for. */
  reference: string
  /** Epoch milliseconds. */
  expiresAt: number
}

/**
 * Mint a grant. Returns null when no signing key is available, which the
 * caller must treat as "cannot issue" rather than "no grant needed".
 */
export function signUploadGrant(
  reference: string,
  opts: { now?: number; ttlMs?: number; secret?: string } = {},
): string | null {
  const key = signingKey(opts.secret)
  if (!key) return null

  const payload: GrantPayload = {
    reference,
    expiresAt: (opts.now ?? Date.now()) + (opts.ttlMs ?? GRANT_TTL_MS),
  }
  const body = b64url(JSON.stringify(payload))
  const mac = b64url(createHmac('sha256', key).update(`${VERSION}.${body}`).digest())
  return `${VERSION}.${body}.${mac}`
}

export type GrantVerdict =
  | { ok: true; payload: GrantPayload }
  | { ok: false; reason: 'missing' | 'malformed' | 'bad_signature' | 'expired' | 'wrong_reference' | 'no_key' }

/**
 * Check a grant, and that it is for this application.
 *
 * `reference` is required, not optional: a grant that is valid for *some*
 * application is not permission to write to *this* one, and making the caller
 * pass the reference means that check cannot be forgotten at a call site.
 */
export function verifyUploadGrant(
  token: string | null | undefined,
  reference: string,
  opts: { now?: number; secret?: string } = {},
): GrantVerdict {
  const key = signingKey(opts.secret)
  if (!key) return { ok: false, reason: 'no_key' }
  if (!token) return { ok: false, reason: 'missing' }

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== VERSION) return { ok: false, reason: 'malformed' }
  const [, body, mac] = parts

  const expected = Buffer.from(
    createHmac('sha256', key).update(`${VERSION}.${body}`).digest().toString('base64url'),
  )
  const given = Buffer.from(mac)
  // Length first: timingSafeEqual throws on a mismatch, and a thrown error is
  // its own oracle.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad_signature' }
  }

  let payload: GrantPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (typeof payload?.reference !== 'string' || typeof payload?.expiresAt !== 'number') {
    return { ok: false, reason: 'malformed' }
  }

  // Signature before expiry, expiry before scope: each answer should be the
  // most general thing that is wrong, so a caller logging the reason learns
  // "forged" rather than "expired" about a forgery.
  if ((opts.now ?? Date.now()) >= payload.expiresAt) return { ok: false, reason: 'expired' }
  if (payload.reference !== reference) return { ok: false, reason: 'wrong_reference' }

  return { ok: true, payload }
}

/** The Set-Cookie attributes for a grant. httpOnly: no script ever needs to read it. */
export function grantCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: Math.floor(GRANT_TTL_MS / 1000),
  }
}
