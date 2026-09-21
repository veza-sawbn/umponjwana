/**
 * Server-side intake for public "list with us" applications.
 *
 * WHY THIS IS A SEPARATE, DEPENDENCY-FREE MODULE
 *   It runs inside POST /api/listing-applications, which is the only thing
 *   standing between an anonymous request and a row in the database now that
 *   the table no longer accepts anonymous inserts. Keeping it free of the
 *   Supabase client means it can be tested directly, in the same node
 *   environment as the rest of tests/, rather than only through a route.
 *
 * WHAT IT DEFENDS AGAINST
 *   The form used to insert straight into PostgREST with the anon key, which
 *   meant the *client* chose the primary key, the status, the timestamp and
 *   the entire `value` blob. The only server-side check was the RLS clause
 *   `status = 'new'`. So a caller could pick any id it liked (overwriting
 *   nothing, but colliding deliberately), backdate an application, or post a
 *   fifty-megabyte JSON document into a jsonb column.
 *
 *   Everything the platform relies on is now decided here, not by the caller:
 *   the id, the status, the timestamp, and a hard ceiling on size.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   It does not rebuild the application field by field. The shape is large,
 *   it has grown twice already (the multi-type reconstruction, then
 *   compliance), and an allow-list that has to be edited every time the form
 *   gains a question is an allow-list that will one day silently drop an
 *   applicant's answers — the exact failure normalizeListingApplication()
 *   exists to clean up after. So the blob is accepted as submitted, with the
 *   security-relevant fields overridden and the size bounded. The contents are
 *   never executed, never rendered as HTML (the review queue escapes), and
 *   never readable by anyone but an admin.
 */

/** Refuse a body larger than this outright. A real application is a few KB. */
export const INTAKE_MAX_BYTES = 256 * 1024

/** Longest address RFC 5321 permits. */
const MAX_EMAIL_LENGTH = 254

/** Mirrored columns are indexed and shown in the review queue; keep them sane. */
const MAX_MIRROR_LENGTH = 200

/**
 * LP- plus six characters from the unambiguous alphabet below. The applicant's
 * accreditation certificates are already uploaded under this reference by the
 * time the application is submitted, so a reference the client minted is
 * accepted — but only in exactly this shape, because it becomes a storage path
 * segment (compliance/applications/<reference>/…).
 */
export const REFERENCE_PATTERN = /^LP-[A-HJ-NP-Z2-9]{6}$/

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I/O/0/1

/**
 * Short, sayable handle for the applicant to quote when they follow up.
 *
 * Lives here rather than in lib/listing-applications.ts so the server can mint
 * one without importing the browser Supabase client; that module re-exports it
 * for the form, which needs the reference up front to upload documents against.
 */
export function newApplicationReference(): string {
  let tail = ''
  for (let i = 0; i < 6; i++) {
    tail += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)]
  }
  return `LP-${tail}`
}

export type IntakeRow = {
  id: string
  reference: string
  status: 'new'
  property_name: string
  contact_email: string
  region: string
  value: Record<string, unknown>
}

export type IntakeResult =
  | { ok: true; row: IntakeRow }
  | { ok: false; error: string }

export type IntakeOptions = {
  /** Server-minted. Injected so tests are deterministic. */
  id: string
  /** ISO timestamp, server clock. */
  now: string
  /** Injected so tests are deterministic. */
  mintReference?: () => string
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Turn a request body into the row to insert, or say why it cannot be one.
 *
 * `rawBytes` is the byte length of the body as received — checked here rather
 * than by the route so the limit and its reason stay in one place.
 */
export function buildIntakeRow(
  body: unknown,
  opts: IntakeOptions,
  rawBytes?: number,
): IntakeResult {
  if (rawBytes !== undefined && rawBytes > INTAKE_MAX_BYTES) {
    return { ok: false, error: 'That application is too large to submit.' }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' }
  }

  const application = (body as { application?: unknown }).application
  if (!application || typeof application !== 'object' || Array.isArray(application)) {
    return { ok: false, error: 'Invalid request body' }
  }

  const draft = application as Record<string, unknown>

  const contactEmail = str(draft.contactEmail, MAX_EMAIL_LENGTH).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: 'A valid contact email address is required.' }
  }

  const businessName = str(draft.businessName, MAX_MIRROR_LENGTH)
  const tradingName = str(draft.tradingName, MAX_MIRROR_LENGTH)
  if (!businessName && !tradingName) {
    return { ok: false, error: 'A business or trading name is required.' }
  }

  // Keep the client's reference when it is one we could have minted, because
  // compliance documents are already filed under it. Anything else — absent,
  // malformed, or a path traversal dressed up as a reference — gets a fresh
  // one rather than a rejection: the applicant should not lose a completed
  // form over it, and the worst case is certificates that have to be re-asked
  // for rather than a poisoned storage path.
  const claimed = str(draft.reference, 32).toUpperCase()
  const reference = REFERENCE_PATTERN.test(claimed)
    ? claimed
    : (opts.mintReference ?? newApplicationReference)()

  const stay = (draft.stay ?? {}) as Record<string, unknown>
  const propertyName = str(stay.propertyName, MAX_MIRROR_LENGTH) || tradingName || businessName

  // The blob as submitted, minus the four fields the server owns. supplierId
  // is stripped too: it is written by the approval route when an application
  // becomes a real supplier account, and a caller that could set it on the way
  // in would be pointing a fresh application at an existing supplier.
  const { id: _id, status: _status, createdAt: _createdAt, supplierId: _supplierId, ...rest } = draft

  return {
    ok: true,
    row: {
      id: opts.id,
      reference,
      status: 'new',
      property_name: propertyName,
      contact_email: contactEmail,
      region: str(draft.region, MAX_MIRROR_LENGTH),
      value: {
        ...rest,
        contactEmail,
        reference,
        id: opts.id,
        status: 'new',
        createdAt: opts.now,
      },
    },
  }
}
