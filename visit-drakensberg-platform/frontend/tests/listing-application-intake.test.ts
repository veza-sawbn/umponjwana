import { describe, it, expect } from 'vitest'
import {
  buildIntakeRow,
  newApplicationReference,
  INTAKE_MAX_BYTES,
  REFERENCE_PATTERN,
} from '../lib/listing-application-intake'

/**
 * Regression tests for the server-side intake that replaced the anonymous
 * PostgREST insert on the "list with us" form.
 *
 * Every one of these is something the *client* used to decide and now cannot.
 */

const OPTS = { id: 'lapp-fixed', now: '2026-09-21T10:00:00.000Z', mintReference: () => 'LP-MINTED' }

function application(overrides: Record<string, unknown> = {}) {
  return {
    contactEmail: 'owner@example.com',
    businessName: 'Cathkin Lodge',
    tradingName: 'Cathkin Lodge',
    region: 'Central Berg',
    stay: { propertyName: 'Cathkin Lodge' },
    ...overrides,
  }
}

describe('the server owns the fields the client used to pick', () => {
  it('overrides a client-supplied id with its own', () => {
    const built = buildIntakeRow({ application: application({ id: 'lapp-attacker-chosen' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.id).toBe('lapp-fixed')
    expect(built.row.value.id).toBe('lapp-fixed')
  })

  it('forces status to new however the caller asks', () => {
    // The old RLS check was `status = 'new'` and nothing else, so this was the
    // single server-side rule the whole endpoint had.
    const built = buildIntakeRow({ application: application({ status: 'approved' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.status).toBe('new')
    expect(built.row.value.status).toBe('new')
  })

  it('stamps its own createdAt, so an application cannot be backdated', () => {
    const built = buildIntakeRow({ application: application({ createdAt: '2020-01-01T00:00:00Z' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.value.createdAt).toBe(OPTS.now)
  })

  it('strips supplierId — the approval route writes that, not the applicant', () => {
    // Set on the way in, it would point a brand-new application at an existing
    // supplier account.
    const built = buildIntakeRow({ application: application({ supplierId: 'sup-someone-else' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.value).not.toHaveProperty('supplierId')
  })
})

describe('the reference becomes a storage path segment', () => {
  it('keeps a well-formed reference, because certificates are already filed under it', () => {
    const built = buildIntakeRow({ application: application({ reference: 'LP-AB23CD' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.reference).toBe('LP-AB23CD')
  })

  it.each([
    ['a traversal', '../../../etc/passwd'],
    ['a slash', 'LP-AB/CD2'],
    ['the wrong prefix', 'XX-AB23CD'],
    ['too short', 'LP-AB2'],
    ['ambiguous characters the alphabet excludes', 'LP-ABI0O1'],
    ['empty', ''],
    ['not a string', 42],
  ])('mints a fresh one rather than trusting %s', (_label, reference) => {
    const built = buildIntakeRow({ application: application({ reference }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    // Minted, not rejected: the applicant should not lose a completed form,
    // and the worst case is certificates that have to be re-requested.
    expect(built.row.reference).toBe('LP-MINTED')
  })

  it('mints references that match the pattern it validates against', () => {
    for (let i = 0; i < 200; i++) {
      expect(newApplicationReference()).toMatch(REFERENCE_PATTERN)
    }
  })

  it('never mints the ambiguous characters — these get read out over the phone', () => {
    const minted = Array.from({ length: 200 }, newApplicationReference).join('')
    for (const c of ['I', 'O', '0', '1']) expect(minted.slice(3)).not.toContain(c)
  })
})

describe('what it refuses outright', () => {
  it('refuses a body over the size cap', () => {
    const built = buildIntakeRow({ application: application() }, OPTS, INTAKE_MAX_BYTES + 1)
    expect(built).toEqual({ ok: false, error: 'That application is too large to submit.' })
  })

  it('accepts a body exactly at the cap', () => {
    expect(buildIntakeRow({ application: application() }, OPTS, INTAKE_MAX_BYTES).ok).toBe(true)
  })

  it.each([
    ['no address', undefined],
    ['a non-address', 'not-an-email'],
    ['an empty string', ''],
    ['a non-string', { nested: true }],
  ])('refuses %s as the contact email', (_label, contactEmail) => {
    const built = buildIntakeRow({ application: application({ contactEmail }) }, OPTS)
    expect(built.ok).toBe(false)
  })

  it('refuses an application with no business or trading name', () => {
    const built = buildIntakeRow(
      { application: application({ businessName: '', tradingName: '', stay: {} }) },
      OPTS,
    )
    expect(built).toEqual({ ok: false, error: 'A business or trading name is required.' })
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a bare string', 'hello'],
    ['an object with no application', { captchaToken: 'x' }],
    ['an application that is an array', { application: [] }],
  ])('refuses %s as a body', (_label, body) => {
    expect(buildIntakeRow(body, OPTS).ok).toBe(false)
  })
})

describe('normalisation', () => {
  it('lower-cases and trims the contact email in both column and blob', () => {
    const built = buildIntakeRow({ application: application({ contactEmail: '  Owner@Example.COM ' }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.contact_email).toBe('owner@example.com')
    expect(built.row.value.contactEmail).toBe('owner@example.com')
  })

  it('mirrors the property name, falling back to the trading name', () => {
    const stay = buildIntakeRow({ application: application({ stay: { propertyName: 'Ridge House' } }) }, OPTS)
    expect(stay.ok && stay.row.property_name).toBe('Ridge House')

    // A shuttle operator has no property name; the review queue still needs
    // something to show in the list.
    const shuttle = buildIntakeRow(
      { application: application({ stay: {}, tradingName: 'Berg Transfers' }) },
      OPTS,
    )
    expect(shuttle.ok && shuttle.row.property_name).toBe('Berg Transfers')
  })

  it('clamps the mirrored columns, which are indexed and shown in the queue', () => {
    const long = 'x'.repeat(5_000)
    const built = buildIntakeRow({ application: application({ region: long }) }, OPTS)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.region.length).toBe(200)
  })

  it('keeps the rest of the submitted blob intact', () => {
    // Deliberately NOT an allow-list: the form has grown twice already, and a
    // field list that has to be edited for every new question is one that will
    // eventually drop an applicant's answers silently.
    const built = buildIntakeRow(
      {
        application: application({
          supplierTypes: ['Accommodation', 'Activity'],
          compliance: { accreditationKind: 'TGCSA', accreditationNumber: 'T-123' },
          activities: [{ name: 'Guided summit hike' }],
          commissionTier: 'standard',
        }),
      },
      OPTS,
    )
    expect(built.ok).toBe(true)
    if (!built.ok) return
    expect(built.row.value.supplierTypes).toEqual(['Accommodation', 'Activity'])
    expect(built.row.value.compliance).toEqual({ accreditationKind: 'TGCSA', accreditationNumber: 'T-123' })
    expect(built.row.value.activities).toEqual([{ name: 'Guided summit hike' }])
    expect(built.row.value.commissionTier).toBe('standard')
  })
})
