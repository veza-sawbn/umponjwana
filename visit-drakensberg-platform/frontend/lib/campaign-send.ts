// SERVER ONLY — renders one campaign email per recipient for a real send
// (app/api/admin/campaigns/[id]/send). Imports lib/email-layout.ts, which
// must never reach a client bundle.
//
// The rendering mirrors components/admin/campaigns/PersonalisedPreview.tsx +
// app/api/admin/campaigns/preview exactly — same merge-tag engine, same shell,
// same marketing footer — so what the admin previewed is what each person
// receives. The only additions a real send needs are the recipient's own
// unsubscribe link.

import { emailShell } from './email-layout'
import { buildMergeValues, renderMergeTags, type MergeContact } from './email-merge-tags'
import type { BrevoMessage } from './brevo'

/** One row of vd_campaign_begin_send(). */
export type CampaignRecipientRow = {
  user_id: string
  email: string
  full_name: string | null
  country: string | null
  city: string | null
  lifecycle_stage: string | null
  interests: string[] | null
  favourite_destinations: string[] | null
  favourite_activities: string[] | null
  trip_count: number | null
  upcoming_travel: string | null
}

export type CampaignTemplateContent = {
  subject: string
  preheader: string
  htmlBody: string
  heroImageUrl: string
  heroImageAlt: string
}

export function rowToMergeContact(r: CampaignRecipientRow): MergeContact {
  return {
    id: r.user_id,
    fullName: r.full_name?.trim() || r.email,
    email: r.email,
    country: r.country,
    city: r.city,
    lifecycleStage: r.lifecycle_stage ?? 'visitor',
    interests: r.interests ?? [],
    favouriteDestinations: r.favourite_destinations ?? [],
    favouriteActivities: r.favourite_activities ?? [],
    tripCount: r.trip_count ?? 0,
    upcomingTravel: r.upcoming_travel,
  }
}

export function unsubscribeUrlFor(origin: string, email: string): string {
  return `${origin}/unsubscribe?email=${encodeURIComponent(email)}`
}

export function renderCampaignEmail(o: {
  origin: string
  template: CampaignTemplateContent
  recipient: CampaignRecipientRow
  campaignFields: Record<string, string>
  postalAddress?: string
}): BrevoMessage {
  const contact = rowToMergeContact(o.recipient)
  const values = buildMergeValues(contact, o.campaignFields)
  const subject = renderMergeTags(o.template.subject, values, { html: false }).trim() || '(No subject)'
  const heroSrc = o.template.heroImageUrl?.trim()

  const html = emailShell({
    origin: o.origin,
    heading: subject,
    preheader: renderMergeTags(o.template.preheader, values, { html: false }),
    bodyHtml: renderMergeTags(o.template.htmlBody, values, { html: true }) || '<p></p>',
    hero: heroSrc
      ? { src: heroSrc, alt: renderMergeTags(o.template.heroImageAlt ?? '', values, { html: false }).trim() }
      : undefined,
    footer: {
      variant: 'marketing',
      unsubscribeUrl: unsubscribeUrlFor(o.origin, contact.email),
      postalAddress: o.postalAddress,
    },
  })

  // buildMergeValues blanks a name that is really an email address, so the
  // display name is only sent when there's a real one.
  return { email: contact.email, name: values.full_name || undefined, subject, html }
}
