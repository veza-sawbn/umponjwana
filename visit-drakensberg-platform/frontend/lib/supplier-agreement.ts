import { supabase } from './auth'

// The supplier-side legal surface: the Supplier Agreement (commercial) and
// the Supplier Code of Conduct (conduct), plus the append-only record of who
// accepted which version.
//
// Why versions are constants rather than page content: an acceptance is only
// evidence if it names a specific document. The pages at /supplier-terms and
// /supplier-code-of-conduct render from SUPPLIER_TERMS_SECTIONS and
// CODE_OF_CONDUCT_SECTIONS below, so the version stamped on an acceptance and
// the words the supplier actually read cannot drift apart. Change the words,
// bump the version in the same commit.

export const SUPPLIER_TERMS_VERSION = '2026-09-05'
export const CODE_OF_CONDUCT_VERSION = '2026-09-05'

export type AgreementDocument = 'supplier_terms' | 'code_of_conduct'

export const AGREEMENT_LABEL: Record<AgreementDocument, string> = {
  supplier_terms: 'Supplier Agreement',
  code_of_conduct: 'Supplier Code of Conduct',
}

export const AGREEMENT_PATH: Record<AgreementDocument, string> = {
  supplier_terms: '/supplier-terms',
  code_of_conduct: '/supplier-code-of-conduct',
}

export const AGREEMENT_VERSION: Record<AgreementDocument, string> = {
  supplier_terms: SUPPLIER_TERMS_VERSION,
  code_of_conduct: CODE_OF_CONDUCT_VERSION,
}

export type LegalSection = { heading: string; body: string[]; list?: string[] }

/* ────────────────────────────────────────────────────────────────────────────
 * Supplier Agreement — the commercial relationship.
 * ──────────────────────────────────────────────────────────────────────── */

export const SUPPLIER_TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. What this agreement covers',
    body: [
      'This agreement is between Visit Drakensberg ("the platform", "we") and the business listing on it ("you", "the supplier"). It governs your listing, the bookings you receive through us, and what we pay you.',
      'It is separate from the Terms of Use that apply to visitors. Where the two differ in respect of your business, this agreement governs.',
      'Each booking is a contract between the guest and you. We facilitate the booking and the payment; we are not the provider of the stay, activity, tour or transfer.',
    ],
  },
  {
    heading: '2. Accreditation and eligibility',
    body: [
      'To list and to remain listed, you must hold and keep current at least one of the following, and provide us with a legible copy:',
    ],
    list: [
      'A valid tourism operator registration issued by the KwaZulu-Natal Department of Economic Development, Tourism and Environmental Affairs (EDTEA); or',
      'Current membership of a recognised Community Tourism Organisation (CTO) for the area in which you operate.',
    ],
  },
  {
    heading: '2.1 Keeping accreditation current',
    body: [
      'Accreditation is checked at application and on renewal. You must send us a replacement certificate before the one we hold expires. If your accreditation lapses, we may suspend your listings from public view until current evidence is provided. Confirmed bookings taken before a suspension are honoured in the normal way.',
      'You must also hold the licences, permits and insurance that the law requires for your operation, including public liability cover appropriate to the activities you offer, and provide evidence on request.',
      'You must tell us within 7 days if your accreditation, licence or insurance is withdrawn, suspended or not renewed.',
    ],
  },
  {
    heading: '3. Commission and platform fee',
    body: [
      'You select a commission tier when you apply. The rate shown for that tier is the total platform fee, inclusive of booking commission and payment handling — not an additional charge on top of a base rate. The applicable rate is confirmed in writing when your application is approved.',
      'Moving to a higher tier takes effect immediately for new bookings. Moving to a lower tier requires notice and cannot take effect before the end of the 90-day minimum hold on your current tier. No tier change affects bookings already confirmed.',
      'Commission is calculated on the total booking value excluding any separately itemised statutory levy or park entry fee collected on behalf of a third party.',
    ],
  },
  {
    heading: '4. Payment and settlement',
    body: [
      'Guest payments are collected by the platform. We settle to you on the frequency recorded in your supplier terms, net of the platform fee and of any refund properly due to a guest.',
      'You must give us accurate settlement details and tell us promptly if they change. We may withhold a settlement where a booking is under dispute, where a chargeback is pending, or where we are required to do so by law, and will tell you why.',
      'Where you are a VAT vendor you are responsible for accounting for VAT on your supply to the guest. We account for VAT on our platform fee to you.',
    ],
  },
  {
    heading: '5. Listing accuracy',
    body: [
      'Your listing must describe what a guest will actually receive. Photographs must be of your own property, vehicles or activities and must be reasonably current. Do not publish a grading, star rating, award or affiliation you do not hold.',
      'Prices must be complete: every charge a guest must pay to receive what is listed has to appear in the price, other than clearly disclosed statutory levies and park fees.',
      'You must keep availability current. Where we have given you a channel connection or calendar, you must maintain it.',
    ],
  },
  {
    heading: '6. Honouring bookings',
    body: [
      'A confirmed booking must be honoured at the price and on the terms it was confirmed. If you cannot honour it, tell us immediately.',
      'Where you cancel or cannot accommodate a guest, you are responsible for the cost of comparable alternative arrangements, or the guest receives a full refund and we may recover it from your settlement. Repeatedly failing to honour bookings is a material breach.',
      'Your cancellation policy must be stated in the listing. Where it is silent, the platform default in the Terms of Use applies.',
    ],
  },
  {
    heading: '7. Rate parity and off-platform diversion',
    body: [
      'You may set your own prices, and you may sell through any other channel, including your own website, at any price you choose. We do not require rate parity.',
      'What you may not do is take a guest who found you through Visit Drakensberg off the platform in order to avoid the platform fee — for example by cancelling a platform booking and re-taking it directly, or by directing an enquirer to book elsewhere in order to bypass commission. Where that happens we may charge the fee that would have been due.',
    ],
  },
  {
    heading: '8. Guest personal information',
    body: [
      'To fulfil a booking we give you the guest details you need: name, contact details, party size, dates and any special requests. In respect of that information you act as an operator for the platform within the meaning of the Protection of Personal Information Act, 2013 (POPIA).',
      'You may use guest information only to deliver the booking. You may not use it for marketing, add it to a mailing list, sell it, or share it with anyone other than as needed to deliver the booking, unless the guest has separately given you consent for that purpose.',
      'You must keep it secure, retain it only as long as you need it or the law requires, and tell us without delay — and in any event within 72 hours — if it is lost, accessed without authority, or disclosed in error, so that we can meet our own notification obligations.',
    ],
  },
  {
    heading: '9. Reviews',
    body: [
      'Reviews are the guest’s. You may respond to a review; you may not write, commission or incentivise one, offer anything in exchange for a rating, or discourage a guest from leaving an honest review.',
      'We remove reviews that are abusive, off-topic or demonstrably false, on our own assessment or on your reasoned request.',
    ],
  },
  {
    heading: '10. Suspension and termination',
    body: [
      'Either party may end this agreement on 30 days’ written notice. Bookings already confirmed are honoured after notice is given.',
      'We may suspend your listings immediately, without notice, where there is a credible risk to guest safety, where accreditation or required insurance has lapsed, where we reasonably suspect fraud, or where the law requires it. We will tell you the reason and what would resolve it.',
      'Suspension is not a penalty and is not permanent by default: it lifts when the reason for it is resolved. Repeated or unresolved breaches lead to termination.',
    ],
  },
  {
    heading: '11. Liability',
    body: [
      'You are responsible for the service you provide and for the acts and omissions of your staff, guides, drivers and subcontractors. You indemnify us against claims arising from your service, other than to the extent the claim arises from our own act or omission.',
      'To the maximum extent permitted by law, our liability to you is limited to the platform fees you paid us in the three months before the claim arose. Nothing in this agreement limits liability that cannot be excluded under South African law, including under the Consumer Protection Act.',
    ],
  },
  {
    heading: '12. Changes to this agreement',
    body: [
      'We may change this agreement. Where a change materially affects your commercial position, we will give you at least 30 days’ notice before it takes effect, and you may end the agreement within that period without penalty. Every version is recorded with the date on which you accepted it.',
    ],
  },
  {
    heading: '13. Governing law and disputes',
    body: [
      'This agreement is governed by the law of the Republic of South Africa. Before pursuing formal proceedings, both parties will attempt in good faith to resolve a dispute directly — raise it with us at hello@visitdrakensberg.com or through our concern channel.',
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────────
 * Supplier Code of Conduct — how a listed business is expected to behave.
 * ──────────────────────────────────────────────────────────────────────── */

export const CODE_OF_CONDUCT_SECTIONS: LegalSection[] = [
  {
    heading: 'Why this exists',
    body: [
      'Visit Drakensberg sends visitors to businesses we have not personally watched work. A guest who is let down, a worker who is exploited, or a mountain that is damaged is our problem as much as it is the operator’s. This Code sets the minimum we expect of every business listed with us.',
      'It applies to you, to everyone you employ, and to the guides, drivers and subcontractors you send to guests on your behalf. It sits alongside the Supplier Agreement, and both must be accepted before you can list.',
    ],
  },
  {
    heading: '1. Operate lawfully and honestly',
    body: [
      'Hold the registrations, licences, permits and insurance your operation requires, and keep them current. Where you operate in a protected area, hold the concessions and permits that area requires and observe its conditions.',
      'Keep accurate records of the bookings you take through us. Do not misreport, under-declare or conceal bookings in order to reduce commission.',
      'Describe what you offer truthfully in every channel — the listing, your responses to enquiries, and what you say to a guest on arrival.',
    ],
  },
  {
    heading: '2. No bribery, no kickbacks',
    body: [
      'Do not offer, give, request or accept anything of value in order to obtain a listing, improve your placement in search or curation, influence a review, or obtain any other advantage on the platform.',
      'This applies to our staff without exception. No Visit Drakensberg employee, and no operations employee who manages a supplier account on our behalf, may accept cash, free stays, discounted services, or gifts beyond ordinary hospitality of nominal value from a supplier. If one asks you for something, report it — see "Raising a concern" below.',
      'Tell us if you, a family member or a business partner has an interest in a Visit Drakensberg employee’s business, or an employee has an interest in yours, so it can be recorded and managed.',
    ],
  },
  {
    heading: '3. Guest safety',
    body: [
      'Guest safety is not a document exercise. For every activity you run:',
    ],
    list: [
      'Brief guests honestly on difficulty, fitness required, weather exposure and what to bring, before they commit — not on the morning.',
      'Maintain equipment, vehicles and premises, and take them out of service when they are not safe.',
      'Carry appropriate first aid capability and a working means of calling for help, and know the evacuation route for the terrain you work in.',
      'Have a stated plan for weather deterioration in the Berg, and use it. Turning a group back is never a commercial decision.',
      'Do not exceed the group sizes, ratios or vehicle capacities you have told us about.',
    ],
  },
  {
    heading: '3.1 Reporting incidents',
    body: [
      'Report to us any incident involving a guest booked through the platform that results in injury requiring medical attention, a search or rescue callout, a fatality, or a near miss of that severity. Report it as soon as the immediate situation allows, and in any event within 24 hours.',
      'Reporting an incident in good faith does not by itself put your listing at risk. Concealing one does.',
    ],
  },
  {
    heading: '4. Treat guests fairly',
    body: [
      'Do not refuse service, offer worse terms, or treat a guest differently because of race, gender, sex, pregnancy, marital status, ethnic or social origin, colour, sexual orientation, age, disability, religion, conscience, belief, culture, language or birth.',
      'Make reasonable accommodation for guests with disabilities, and describe your accessibility honestly so a guest can decide for themselves.',
      'Handle complaints promptly and in good faith. A guest who complains to you is not to be threatened, pressured to withdraw a review, or told the platform cannot help them.',
    ],
  },
  {
    heading: '5. Treat workers decently',
    body: [
      'Everyone who works for you — permanent, seasonal, casual or contracted — is entitled to be treated with dignity. No threats, bullying, violence, or harassment of any kind, including sexual harassment.',
      'Employ nobody under 15, nobody below the age of completing compulsory schooling, and nobody below the minimum age the law sets for the work. Anyone aged 15 to 18 may not do hazardous work, work that interferes with their schooling, or work that harms their health or development.',
      'Work must be freely chosen. No forced or bonded labour, no retention of identity documents, no debt tied to employment, and no penalty for leaving.',
      'Pay at least the legal minimum for the work, on time, with legally required benefits. Deductions from wages as a disciplinary measure are not permitted.',
      'Keep working hours within what the law allows. Overtime must be voluntary and paid at the proper rate.',
      'Give every worker written terms of employment they have agreed to, in a language they understand.',
      'Provide a safe and hygienic workplace. Guides, porters and drivers carry the same right to safe conditions as your guests.',
      'Workers are free to join a trade union, or not to, without intimidation or disadvantage.',
    ],
  },
  {
    heading: '6. Respect the communities you operate in',
    body: [
      'Much of the Drakensberg is community land, and much of what draws visitors here belongs to the people who live here. Obtain permission before taking groups onto communal land, honour access agreements and community levies, and pay them.',
      'Rock art is irreplaceable and legally protected. Never touch, wet, chalk, trace or otherwise mark a painting, and never permit a guest to. Do not disclose the location of unpublished sites.',
      'Employ and buy locally where you can, and pay local guides and porters properly for the work rather than treating them as an incidental cost.',
      'Photograph people only with their consent, especially children, and do not present a community as a spectacle.',
    ],
  },
  {
    heading: '7. Look after the mountain',
    body: [
      'The Maloti-Drakensberg Park is a World Heritage Site and much of the range is protected. Operate as though your access depends on its condition, because it does.',
    ],
    list: [
      'Carry out everything you carry in, including your guests’ waste.',
      'Stay on established paths and tracks. No off-trail driving.',
      'Observe fire restrictions absolutely. Open fires outside designated places are prohibited.',
      'Do not disturb, feed or bait wildlife, and do not remove plants, including for medicinal use, without the permit that requires.',
      'Use existing ablution facilities where they exist, and bury waste properly where they do not.',
      'Manage water and effluent at your premises so that what leaves your property does not degrade what is downstream.',
    ],
  },
  {
    heading: '8. Protect the information you are given',
    body: [
      'Guest information is given to you to deliver a booking and for nothing else. Do not market to platform guests without their own consent, do not sell or share their details, and do not keep them longer than you need.',
      'Keep it secure in practice, not only in policy: limit who can see it, do not leave booking sheets where anyone can read them, and do not send guest details over channels you would not want read.',
      'If guest information is lost, exposed or accessed without authority, tell us within 72 hours so we can meet our obligations under POPIA.',
    ],
  },
  {
    heading: '9. Raising a concern',
    body: [
      'If you see something that breaches this Code — by another supplier, by one of our staff, by an operations employee managing an account, or within your own business — report it. You can do so anonymously.',
      'Use the concern form at /report-a-concern, or email hello@visitdrakensberg.com. Anonymous reports are read and acted on; they are simply harder to follow up, so leave contact details if you are willing.',
      'We do not retaliate against anyone who raises a concern in good faith, and we do not permit a supplier to retaliate against a worker or guest who does. Retaliation is itself a breach of this Code. A report that turns out to be mistaken, but was made honestly, carries no consequence.',
      'We expect you to give your own workers a way to raise concerns. If you do not have one, tell them they can use ours.',
    ],
  },
  {
    heading: '10. What happens when this Code is breached',
    body: [
      'We would rather fix a problem than remove a business. Most breaches are handled by telling you what is wrong and agreeing how it will be put right, on a stated timeline.',
      'Where that does not work, or where the breach is serious, the steps available to us are: a formal warning; removal of promotional placement; suspension of your listings from public view; and termination of the Supplier Agreement.',
      'Some things skip the ladder. A credible risk to guest safety, child labour or forced labour, concealing a serious incident, deliberate misrepresentation of what you offer, and retaliation against someone who raised a concern all lead to immediate suspension while we investigate.',
      'Where we suspend or terminate, we tell you why and what would resolve it, and you may put your side to us before a final decision wherever the safety of others allows that.',
    ],
  },
]

/* ────────────────────────────────────────────────────────────────────────────
 * Acceptance record
 * ──────────────────────────────────────────────────────────────────────── */

export type AgreementAcceptance = {
  id: string
  supplierId: string | null
  applicationRef: string | null
  document: AgreementDocument
  version: string
  acceptedName: string
  acceptedEmail: string
  acceptedRole: string
  acceptedTerms: Record<string, unknown>
  acceptedAt: string
}

export type RecordAcceptanceInput = {
  document: AgreementDocument
  name: string
  email: string
  role?: string
  /** Commercial terms as displayed at the moment of acceptance. */
  terms?: Record<string, unknown>
  applicationRef?: string
  supplierId?: string
}

function newAcceptanceId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `agr-${crypto.randomUUID()}`
    : `agr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Append one acceptance. Never updates: a correction is a newer row.
 *
 * Deliberately does not throw on a missing table. An acceptance that cannot
 * be written must not stop somebody applying — the application is the thing
 * with commercial value, and losing it to a migration that has not been run
 * yet would be the worse failure. The caller logs and continues; the missing
 * record shows up in the review queue as "no acceptance on file".
 */
export async function recordAcceptance(input: RecordAcceptanceInput): Promise<boolean> {
  const row = {
    id: newAcceptanceId(),
    supplier_id: input.supplierId ?? null,
    application_ref: input.applicationRef ?? null,
    document: input.document,
    version: AGREEMENT_VERSION[input.document],
    accepted_name: input.name ?? '',
    accepted_email: input.email ?? '',
    accepted_role: input.role ?? '',
    accepted_terms: input.terms ?? {},
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
  }
  const { error } = await supabase.from('vd_supplier_agreements').insert(row)
  if (error) {
    console.error('[supplier-agreement] acceptance not recorded:', error.message)
    return false
  }
  return true
}

/** Record acceptance of both supplier documents in one step. */
export async function recordBothAcceptances(
  input: Omit<RecordAcceptanceInput, 'document'>,
): Promise<boolean> {
  const results = await Promise.all([
    recordAcceptance({ ...input, document: 'supplier_terms' }),
    recordAcceptance({ ...input, document: 'code_of_conduct' }),
  ])
  return results.every(Boolean)
}

function acceptanceFromRow(r: Record<string, unknown>): AgreementAcceptance {
  return {
    id: String(r.id ?? ''),
    supplierId: (r.supplier_id as string | null) ?? null,
    applicationRef: (r.application_ref as string | null) ?? null,
    document: (r.document as AgreementDocument) ?? 'supplier_terms',
    version: String(r.version ?? ''),
    acceptedName: String(r.accepted_name ?? ''),
    acceptedEmail: String(r.accepted_email ?? ''),
    acceptedRole: String(r.accepted_role ?? ''),
    acceptedTerms: (r.accepted_terms as Record<string, unknown>) ?? {},
    acceptedAt: String(r.accepted_at ?? ''),
  }
}

/** Verification office: what this applicant accepted, and when. */
export async function getApplicationAcceptances(applicationRef: string): Promise<AgreementAcceptance[]> {
  const { data } = await supabase
    .from('vd_supplier_agreements')
    .select('*')
    .eq('application_ref', applicationRef)
    .order('accepted_at', { ascending: true })
  return (data ?? []).map(r => acceptanceFromRow(r as Record<string, unknown>))
}

/** Acceptances held against a supplier account. */
export async function getSupplierAcceptances(supplierId: string): Promise<AgreementAcceptance[]> {
  const { data } = await supabase
    .from('vd_supplier_agreements')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('accepted_at', { ascending: true })
  return (data ?? []).map(r => acceptanceFromRow(r as Record<string, unknown>))
}
