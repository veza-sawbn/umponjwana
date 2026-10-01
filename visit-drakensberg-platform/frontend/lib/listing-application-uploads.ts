import { REFERENCE_PATTERN } from './listing-application-intake'

/**
 * What an applicant is allowed to upload, and where it lands.
 *
 * WHY THE SERVER BUILDS THE PATH
 *   The browser used to choose it. `uploadApplicationPhoto` built
 *   `listing-applications/<timestamp>-<random>.<ext>` from the file name, and
 *   `uploadComplianceDocument` built `applications/<reference>/<id>.<ext>` —
 *   both client-side, both then written with the anon key under a storage
 *   policy that only checked the first path segment. A caller that skipped the
 *   form could put anything it liked anywhere under those prefixes, including
 *   a name chosen to collide with, or sort ahead of, a real applicant's.
 *
 *   Now the browser says what kind of thing it is uploading and how big it is,
 *   and the server decides the path. Nothing the caller sends becomes a path
 *   segment except the extension, which is reduced to a short alphanumeric
 *   token, and the reference, which must match REFERENCE_PATTERN exactly.
 *
 * Dependency-free on purpose: it runs inside the upload routes and is tested
 * directly, in the same node environment as the rest of tests/.
 */

export type UploadKind = 'photo' | 'compliance'

type KindSpec = {
  bucket: string
  maxBytes: number
  /** Empty means "any image/*", which is what the photo control already accepts. */
  mimeAllowList: readonly string[]
  allowAnyImage: boolean
  /** Is the object readable by anyone with the URL once written? */
  publicRead: boolean
}

/**
 * Mirrors the limits the client already enforced (PHOTO_MAX_BYTES,
 * COMPLIANCE_MAX_BYTES and its MIME list) — but here they are the ones that
 * count, because a client-side limit is a hint and a server-side one is a
 * rule. The bucket's own allowed_mime_types and size cap from 20260719 still
 * apply underneath both.
 */
export const UPLOAD_KINDS: Record<UploadKind, KindSpec> = {
  photo: {
    bucket: 'media',
    maxBytes: 8 * 1024 * 1024,
    mimeAllowList: [],
    allowAnyImage: true,
    publicRead: true,
  },
  compliance: {
    bucket: 'compliance',
    maxBytes: 15 * 1024 * 1024,
    mimeAllowList: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    allowAnyImage: false,
    publicRead: false,
  },
}

export function isUploadKind(value: unknown): value is UploadKind {
  return value === 'photo' || value === 'compliance'
}

/**
 * Reduce a file name to an extension safe to put in a path.
 *
 * Only the last segment, only lowercase alphanumerics, at most five
 * characters. "photo.tar.gz" becomes "gz"; "../../etc/passwd" has no dot in
 * its last segment and so becomes the fallback; a name that is all dots or
 * punctuation becomes the fallback too.
 */
export function safeExtension(fileName: unknown, contentType: string, fallback = 'bin'): string {
  const name = typeof fileName === 'string' ? fileName : ''
  const tail = name.split('/').pop() ?? ''
  const dotted = tail.includes('.') ? tail.split('.').pop() ?? '' : ''
  const cleaned = dotted.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
  if (cleaned) return cleaned

  if (contentType === 'application/pdf') return 'pdf'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  if (contentType === 'image/jpeg') return 'jpg'
  return fallback
}

export type UploadPlanRequest = {
  kind: unknown
  reference: unknown
  fileName: unknown
  contentType: unknown
  size: unknown
  /** Injected so tests are deterministic; a uuid in production. */
  objectId: string
}

export type UploadPlan = {
  kind: UploadKind
  bucket: string
  /** The path the server will sign. Nothing caller-supplied survives into it. */
  path: string
  contentType: string
  publicRead: boolean
}

export type UploadPlanResult =
  | { ok: true; plan: UploadPlan }
  | { ok: false; error: string }

/**
 * Decide whether this upload is allowed, and where it goes.
 *
 * The reference is validated here as well as by the grant check in the route:
 * the grant proves the caller solved a captcha for *some* application and the
 * route proves it is *this* one, but neither says the string is safe to put in
 * a path — that is this function's job, and it is the last place before a
 * storage key is built.
 */
export function planUpload(req: UploadPlanRequest): UploadPlanResult {
  if (!isUploadKind(req.kind)) {
    return { ok: false, error: 'Unknown upload type.' }
  }
  const spec = UPLOAD_KINDS[req.kind]

  const reference = typeof req.reference === 'string' ? req.reference.trim().toUpperCase() : ''
  if (!REFERENCE_PATTERN.test(reference)) {
    return { ok: false, error: 'That application reference is not valid.' }
  }

  const size = typeof req.size === 'number' && Number.isFinite(req.size) ? req.size : -1
  if (size <= 0) {
    return { ok: false, error: 'That file is empty.' }
  }
  if (size > spec.maxBytes) {
    return { ok: false, error: `That file is larger than ${Math.round(spec.maxBytes / 1024 / 1024)} MB.` }
  }

  const contentType = typeof req.contentType === 'string' ? req.contentType.trim().toLowerCase() : ''
  const mimeOk = spec.allowAnyImage
    ? contentType.startsWith('image/')
    : spec.mimeAllowList.includes(contentType)
  if (!mimeOk) {
    return {
      ok: false,
      error: req.kind === 'photo'
        ? 'That file is not an image.'
        : 'That file must be a PDF, JPEG, PNG or WebP.',
    }
  }

  const ext = safeExtension(req.fileName, contentType, req.kind === 'photo' ? 'jpg' : 'pdf')

  // Both prefixes are the ones the existing storage policies and readers
  // already expect: the review queue finds an application's certificates by
  // the applications/<reference>/ prefix (see getDocumentsForApplication),
  // and it is what preserves provenance after approval clears application_ref.
  const path = req.kind === 'photo'
    ? `listing-applications/${reference}/${req.objectId}.${ext}`
    : `applications/${reference}/${req.objectId}.${ext}`

  return { ok: true, plan: { kind: req.kind, bucket: spec.bucket, path, contentType, publicRead: spec.publicRead } }
}
