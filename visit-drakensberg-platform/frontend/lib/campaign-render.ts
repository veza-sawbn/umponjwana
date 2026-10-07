// SERVER ONLY (pulls in lib/email-layout.ts).
//
// Renders ONE campaign email for ONE recipient: merge tags filled from that
// person's record, the branded marketing shell, a signed unsubscribe link in
// the footer, and the RFC 8058 one-click List-Unsubscribe headers that Gmail
// and Yahoo require of bulk senders. The admin preview, the test send and the
// real send all go through here, so what an admin approves is what is sent.

import { emailShell } from './email-layout'
import {
  buildMergeValues, renderMergeTags, type MergeContact,
} from './email-merge-tags'
import { signUnsubscribeToken } from './marketing-tokens'

export type RenderTemplate = {
  subject: string
  preheader: string
  htmlBody: string
  heroImageUrl: string
  heroImageAlt: string
}

export type RenderedCampaignEmail = {
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|li|table)>/gi, '\n')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, '').trim()
      return l && l !== href ? `${l} (${href})` : href
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, '·').replace(/&copy;/g, '©')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function renderCampaignEmail(i: {
  template: RenderTemplate
  /** The campaign's own {{offer}}-style fields. */
  campaignFields: Record<string, string>
  /** null renders the sample values (test sends / previews). */
  contact: MergeContact | null
  /** Address the message goes to — the unsubscribe token is bound to it. */
  toEmail: string
  origin: string
  tokenSecret: string
  postalAddress: string
  subjectPrefix?: string
}): RenderedCampaignEmail {
  const values = buildMergeValues(i.contact, i.campaignFields)
  // A merge value is customer-controlled text; a stray CR/LF in a subject is a
  // header-injection vector, so the subject is flattened to one line.
  const subject = (i.subjectPrefix ?? '') + renderMergeTags(i.template.subject, values, { html: false }).replace(/[\r\n]+/g, ' ').trim()
  const preheader = renderMergeTags(i.template.preheader, values, { html: false })
  const bodyHtml = renderMergeTags(i.template.htmlBody, values, { html: true })
  const heroAlt = renderMergeTags(i.template.heroImageAlt, values, { html: false })

  const token = signUnsubscribeToken(i.tokenSecret, i.toEmail)
  const pageUrl = `${i.origin}/unsubscribe?t=${encodeURIComponent(token)}`
  const oneClickUrl = `${i.origin}/api/unsubscribe?t=${encodeURIComponent(token)}`

  const hero = i.template.heroImageUrl.trim()
  const html = emailShell({
    origin: i.origin,
    heading: subject || '(No subject)',
    preheader,
    bodyHtml: bodyHtml || '<p>(Empty)</p>',
    hero: hero ? { src: hero, alt: heroAlt } : undefined,
    footer: { variant: 'marketing', unsubscribeUrl: pageUrl, postalAddress: i.postalAddress },
  })

  return {
    subject,
    html,
    text: `${htmlToText(html)}\n\nUnsubscribe: ${pageUrl}`,
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
