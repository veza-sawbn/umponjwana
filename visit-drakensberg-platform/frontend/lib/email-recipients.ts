import { supabase } from './auth'
import { fetchAllRows, getCustomerDirectory } from './customers-admin'
import { getDirectoryContacts } from './directory-contacts'
import { isSendable, type ConsentState, type RecipientKind } from './email-consent'

/* ────────────────────────────────────────────────────────────────────────────
 * Recipients for a manually-addressed send.
 *
 * Two lists feed the picker and they are not the same kind of thing:
 *
 *   customer — a natural person in `profiles` / the CRM. Consumer marketing,
 *              so opt-IN: we send only where consent was actually given.
 *   contact  — a business in vd_directory_contacts, approached about listing
 *              on the platform. B2B outreach, so opt-OUT: we send unless the
 *              address has explicitly withdrawn.
 *
 * That asymmetry is the whole reason this module exists rather than the send
 * screen reading the two tables directly. The rule is stated once, in
 * isSendable(), and the send route applies the same rule server-side against
 * vd_consent_state() — what this module computes is advisory, for the UI. The
 * server decides, because a client-side consent read is a display, not a gate.
 *
 * Read-only client-side aggregation over live tables, the same pattern as
 * lib/customers-admin.ts and lib/analytics-admin.ts.
 * ──────────────────────────────────────────────────────────────────────────── */

// Re-exported so the picker and its component import one module, while the
// rule itself stays in a file with no dependencies — see email-consent.ts.
export { isSendable } from './email-consent'
export type { ConsentState, RecipientKind } from './email-consent'

export type Recipient = {
  /** Unique per selectable row. A contact with three addresses is three rows. */
  key: string
  kind: RecipientKind
  /** profiles.id or vd_directory_contacts.id. Not a foreign key downstream. */
  id: string
  email: string
  name: string
  /** Second line in the picker — lifecycle stage, or region and category. */
  detail: string
  consent: ConsentState
  /** What the send route will do with this row, under the rule for its kind. */
  sendable: boolean
}

/** Deliberately loose — enough to drop an obviously broken address before it reaches SMTP. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Latest marketing consent per address.
 *
 * vd_customer_consents is an append-only log — one row per assertion — so the
 * current state is the most recent row for an address, not any row. Read in
 * created_at order and let later rows overwrite earlier ones.
 *
 * Read directly rather than through vd_consent_state() because that function
 * answers for one address at a time, and the picker shows hundreds. The send
 * route calls the function properly, per recipient, on a list capped at 50.
 */
async function getConsentStates(): Promise<Map<string, ConsentState>> {
  const rows = await fetchAllRows<{ email: string; granted: boolean; created_at: string }>(
    (from, to) => supabase
      .from('vd_customer_consents')
      .select('email, granted, created_at')
      .eq('consent_type', 'marketing_email')
      .order('created_at', { ascending: true })
      .range(from, to),
    'consents',
  )
  const state = new Map<string, ConsentState>()
  for (const r of rows) {
    if (!r.email) continue
    state.set(r.email.trim().toLowerCase(), r.granted ? 'granted' : 'withdrawn')
  }
  return state
}

function decorate(kind: RecipientKind, consent: ConsentState) {
  return { consent, sendable: isSendable(kind, consent) }
}

/**
 * Every address the admin can pick from, both lists merged and sorted by name.
 *
 * Addresses are de-duplicated across and within the lists: a directory contact
 * listing the same address twice, or a customer who also appears as an
 * establishment's contact person, must not receive the same email twice from
 * one send. The first occurrence wins, and customers are loaded first so a
 * person's own record beats a business listing that happens to carry their
 * address.
 */
export async function getRecipients(): Promise<{ recipients: Recipient[]; error: string | null }> {
  try {
    const [customers, contacts, consent] = await Promise.all([
      getCustomerDirectory(),
      getDirectoryContacts(),
      getConsentStates(),
    ])

    const seen = new Set<string>()
    const out: Recipient[] = []

    const push = (r: Omit<Recipient, 'consent' | 'sendable' | 'key'>) => {
      const email = r.email.trim().toLowerCase()
      if (!EMAIL_RE.test(email) || seen.has(email)) return
      seen.add(email)
      out.push({
        ...r,
        email,
        key: `${r.kind}:${r.id}:${email}`,
        ...decorate(r.kind, consent.get(email) ?? 'unknown'),
      })
    }

    for (const c of customers) {
      push({
        kind: 'customer',
        id: c.id,
        email: c.email ?? '',
        name: c.fullName || c.email || 'Unnamed',
        detail: [c.lifecycleStage, c.country].filter(Boolean).join(' · '),
      })
    }

    for (const c of contacts) {
      // `email` is the primary and `emails` the full set; a contact with three
      // addresses is three pickable rows, because which one you write to is a
      // judgement (reservations vs. the owner) the sender has to make.
      for (const address of [c.email, ...c.emails]) {
        if (!address) continue
        push({
          kind: 'contact',
          id: c.id,
          email: address,
          name: c.contactPerson ? `${c.contactPerson} — ${c.establishment}` : c.establishment,
          detail: [c.regions[0], c.categories[0], c.outreachStatus.replace(/_/g, ' ')].filter(Boolean).join(' · '),
        })
      }
    }

    out.sort((a, b) => a.name.localeCompare(b.name))
    return { recipients: out, error: null }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Could not load recipients'
    console.error('[email-recipients] load failed:', e)
    return { recipients: [], error }
  }
}
