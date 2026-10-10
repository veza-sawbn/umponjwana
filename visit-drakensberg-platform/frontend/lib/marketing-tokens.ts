import { createHmac, timingSafeEqual, randomBytes, createHash } from 'crypto'

// SERVER ONLY.
//
// Two kinds of token, deliberately different:
//
//  * Unsubscribe tokens are STATELESS and signed: base64url(email) + "." +
//    HMAC-SHA256(secret, "unsub:" + email). They are bound to one address, so
//    a link in your own inbox cannot be turned into an opt-out for somebody
//    else's — which is exactly what the old `?email=` link allowed. They do
//    not expire: an unsubscribe link in a two-year-old email must still work,
//    and honouring it is the safe direction to fail in.
//
//  * Opt-in confirmation tokens are RANDOM and stored (hashed) in
//    vd_marketing_optins, because they grant something and so must expire
//    and be single-use.

const b64url = (buf: Buffer) => buf.toString('base64url')

function sign(secret: string, purpose: string, email: string): string {
  return b64url(createHmac('sha256', secret).update(`${purpose}:${email}`).digest())
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidEmail(raw: string): boolean {
  const e = raw.trim()
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export function signUnsubscribeToken(secret: string, email: string): string {
  const e = normaliseEmail(email)
  return `${b64url(Buffer.from(e, 'utf8'))}.${sign(secret, 'unsub', e)}`
}

/** Returns the address the token was issued for, or null if it is not genuine. */
export function verifyUnsubscribeToken(secret: string, token: string | null | undefined): string | null {
  if (!secret || !token) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  let email: string
  try {
    email = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8')
  } catch {
    return null
  }
  if (!isValidEmail(email) || email !== normaliseEmail(email)) return null
  const expected = Buffer.from(sign(secret, 'unsub', email))
  const given = Buffer.from(token.slice(dot + 1))
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  return email
}

export function newOptInToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashOptInToken(token) }
}

export function hashOptInToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
