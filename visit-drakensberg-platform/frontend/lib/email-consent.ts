// The consent rule for marketing email, and nothing else.
//
// Split out of lib/email-recipients.ts — which pulls in lib/auth.ts's browser
// Supabase client — so the send route (app/api/admin/campaigns/send) can apply
// exactly this rule without dragging a client-component singleton into its
// server bundle. That trap has bitten this codebase before; see the note at
// the top of app/api/departure-guests/send-confirmation/route.ts.
//
// Nothing here imports anything. Keep it that way.

export type RecipientKind = 'customer' | 'contact'

/** Mirrors the vd_consent_state() SQL function's three-way answer. */
export type ConsentState = 'granted' | 'withdrawn' | 'unknown'

/**
 * Whether we may send marketing email to an address, given what kind of
 * recipient it belongs to and what the consent log says.
 *
 * The asymmetry is deliberate and is the reason this is a named function
 * rather than an inline condition in two places:
 *
 *   customer — a natural person receiving consumer marketing. Opt-IN: silence
 *              is not consent, so 'unknown' does not send.
 *   contact  — a business being approached about listing on the platform. B2B
 *              outreach is opt-OUT: 'unknown' means the approach has not been
 *              refused, and only an explicit withdrawal stops it.
 *
 * A change here changes who the platform will email. It belongs in this one
 * function and nowhere else.
 */
export function isSendable(kind: RecipientKind, consent: ConsentState): boolean {
  return kind === 'customer' ? consent === 'granted' : consent !== 'withdrawn'
}

/** Narrows whatever vd_consent_state() returned to the three states we handle. */
export function toConsentState(raw: unknown): ConsentState {
  return raw === 'granted' || raw === 'withdrawn' ? raw : 'unknown'
}
