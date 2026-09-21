import { describe, it, expect } from 'vitest'
import { planUpload, safeExtension, UPLOAD_KINDS } from '../lib/listing-application-uploads'

/**
 * The browser used to build these storage paths itself and write them with the
 * anon key, under policies that checked only the first path segment. These
 * tests cover what the server now decides instead.
 */

const OBJECT_ID = '11111111-2222-3333-4444-555555555555'
const REF = 'LP-AB23CD'

function photo(overrides: Record<string, unknown> = {}) {
  return planUpload({
    kind: 'photo',
    reference: REF,
    fileName: 'lodge.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    objectId: OBJECT_ID,
    ...overrides,
  })
}

function certificate(overrides: Record<string, unknown> = {}) {
  return planUpload({
    kind: 'compliance',
    reference: REF,
    fileName: 'edtea.pdf',
    contentType: 'application/pdf',
    size: 1024,
    objectId: OBJECT_ID,
    ...overrides,
  })
}

describe('nothing the caller sends becomes a path segment', () => {
  it('files a photo under the application, with the server-minted object id', () => {
    const result = photo()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.path).toBe(`listing-applications/${REF}/${OBJECT_ID}.jpg`)
    expect(result.plan.bucket).toBe('media')
  })

  it('files a certificate under the prefix the review queue searches', () => {
    // getDocumentsForApplication() finds an approved application's evidence by
    // this prefix after application_ref is cleared. Changing it would make
    // certificates vanish from the panel of every approved supplier.
    const result = certificate()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.path).toBe(`applications/${REF}/${OBJECT_ID}.pdf`)
    expect(result.plan.bucket).toBe('compliance')
  })

  it.each([
    ['a traversal in the name', '../../../secrets/key.pem'],
    ['a directory in the name', 'a/b/c/lodge.jpg'],
    ['a name that is only dots', '....'],
    ['a name with no extension', 'lodge'],
    ['an absurdly long extension', `lodge.${'z'.repeat(400)}`],
    ['a non-string', 1234],
  ])('survives %s without it reaching the path', (_label, fileName) => {
    const result = photo({ fileName })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const [prefix, reference, object] = result.plan.path.split('/')
    expect(prefix).toBe('listing-applications')
    expect(reference).toBe(REF)
    expect(object.startsWith(`${OBJECT_ID}.`)).toBe(true)
    expect(result.plan.path).not.toContain('..')
    expect(object.split('.')[1].length).toBeLessThanOrEqual(5)
  })

  it.each([
    ['a traversal', '../../other'],
    ['a slash', 'LP-AB/CD2'],
    ['the wrong shape', 'not-a-reference'],
    ['empty', ''],
    ['a non-string', 42],
  ])('refuses %s as the reference rather than sanitising it', (_label, reference) => {
    // Unlike the intake, which re-mints a bad reference so an applicant does
    // not lose a form: here a wrong reference means the upload belongs
    // somewhere else, and guessing would be the bug.
    const result = photo({ reference })
    expect(result).toEqual({ ok: false, error: 'That application reference is not valid.' })
  })

  it('normalises the reference to upper case, as the grant check does', () => {
    const result = photo({ reference: 'lp-ab23cd' })
    expect(result.ok && result.plan.path).toContain(REF)
  })
})

describe('what it refuses', () => {
  it('refuses an unknown kind', () => {
    expect(planUpload({
      kind: 'avatar', reference: REF, fileName: 'x.png', contentType: 'image/png',
      size: 10, objectId: OBJECT_ID,
    })).toEqual({ ok: false, error: 'Unknown upload type.' })
  })

  it.each([
    ['a PDF as a photo', 'application/pdf'],
    ['nothing', ''],
    ['a non-string', 42],
  ])('refuses %s in the photo slot', (_label, contentType) => {
    expect(photo({ contentType }).ok).toBe(false)
  })

  it('lets image/svg+xml past, because the bucket is the lock for that one', () => {
    // Written down rather than left to be discovered: this check is
    // "is it an image", and SVG is. Active content in the media bucket is
    // refused by allowed_mime_types in
    // 20260913_media_bucket_no_active_content.sql, which is where that
    // decision belongs and where it also covers every other writer.
    expect(photo({ contentType: 'image/svg+xml' }).ok).toBe(true)
  })

  it.each([
    ['a video', 'video/mp4'],
    ['a zip', 'application/zip'],
    ['nothing', ''],
  ])('refuses %s in the certificate slot', (_label, contentType) => {
    const result = certificate({ contentType })
    expect(result).toEqual({ ok: false, error: 'That file must be a PDF, JPEG, PNG or WebP.' })
  })

  it('enforces the size caps server-side, where they count', () => {
    expect(photo({ size: UPLOAD_KINDS.photo.maxBytes }).ok).toBe(true)
    expect(photo({ size: UPLOAD_KINDS.photo.maxBytes + 1 }).ok).toBe(false)
    expect(certificate({ size: UPLOAD_KINDS.compliance.maxBytes }).ok).toBe(true)
    expect(certificate({ size: UPLOAD_KINDS.compliance.maxBytes + 1 }).ok).toBe(false)
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['NaN', Number.NaN],
    ['a string', '100'],
  ])('refuses a size of %s', (_label, size) => {
    expect(photo({ size }).ok).toBe(false)
  })
})

describe('only the public bucket gets a public URL', () => {
  it('marks photos public and certificates not', () => {
    // A certificate carries business detail and is read through a short-lived
    // signed URL. It must never acquire a permanent CDN path — the route only
    // computes one when this flag is set.
    const p = photo()
    const c = certificate()
    expect(p.ok && p.plan.publicRead).toBe(true)
    expect(c.ok && c.plan.publicRead).toBe(false)
  })
})

describe('safeExtension', () => {
  it.each([
    ['photo.tar.gz', 'application/octet-stream', 'gz'],
    ['scan.PDF', 'application/pdf', 'pdf'],
    ['no-extension', 'application/pdf', 'pdf'],
    // Stripped to alphanumerics, then clamped to five — "scrip", not "script".
    ['weird.<script>', 'image/png', 'scrip'],
    ['', 'image/webp', 'webp'],
    ['', 'image/jpeg', 'jpg'],
  ])('%j + %s -> %s', (fileName, mime, expected) => {
    expect(safeExtension(fileName, mime)).toBe(expected)
  })

  it('never returns anything that could escape a path segment', () => {
    for (const name of ['a/../b.js', 'x.%2e%2e', 'y.a/b', 'z.a\\b']) {
      const ext = safeExtension(name, 'application/pdf')
      expect(ext).toMatch(/^[a-z0-9]{1,5}$/)
    }
  })
})
