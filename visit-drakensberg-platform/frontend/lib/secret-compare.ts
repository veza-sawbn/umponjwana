import { timingSafeEqual, createHash } from 'crypto'

/**
 * Compare a caller-supplied secret against the expected one in constant time.
 *
 * WHY (audit finding L2)
 *   Every shared-secret check in the app used `!==` or `===`:
 *   /api/admin/recover-admin against ADMIN_RECOVERY_SECRET, the cron routes
 *   against CRON_SECRET, /api/receipts/send against the service-role key.
 *   String comparison in V8 short-circuits at the first differing byte, so the
 *   time it takes leaks how much of the prefix was right. Over enough samples
 *   that recovers the secret byte by byte — and none of those endpoints was
 *   rate limited either (H1), so there was no shortage of samples.
 *
 * HOW
 *   Both sides are hashed to a fixed 32 bytes before comparison. That is what
 *   makes this safe for inputs of differing length: timingSafeEqual throws on a
 *   length mismatch, and branching on length to avoid the throw would leak the
 *   secret's length. Hashing first removes the question.
 */
export function secretsMatch(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false

  const a = createHash('sha256').update(provided, 'utf8').digest()
  const b = createHash('sha256').update(expected, 'utf8').digest()
  return timingSafeEqual(a, b)
}

/** Pull a bearer token out of an Authorization header. */
export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

/**
 * Constant-time check of a request's bearer token against an expected secret.
 * Returns false when either side is missing, so an unset env var never
 * accidentally authorises a caller who also sent nothing.
 */
export function bearerMatches(req: Request, expected: string | null | undefined): boolean {
  return secretsMatch(bearerToken(req), expected)
}
