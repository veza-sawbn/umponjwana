import { getPublishedPackages } from './packages'

// SERVER ONLY — shared presentation for every transactional email we send
// (receipts, invoices, quotes, in-app notification mirrors).
//
// The four send routes previously each carried their own copy of the same
// black-header/white-card markup, so brand changes had to be made in four
// places and drifted. They now compose this shell instead.
//
// Email HTML is not web HTML: no external stylesheets, no <style> blocks that
// survive Gmail, no flexbox or grid in Outlook, and SVG is stripped outright.
// Everything here is table-based with inline styles, and the logo is a PNG
// raster of public/logo.svg (public/logo-email.png) rather than the SVG the
// site itself uses.

// Brand tokens, mirroring the site's palette (see globals.css / Tailwind use).
const INK = '#000000'
const GOLD = '#C9A96E'
const GREEN = '#2d6a4f'
const CREAM = '#F7F5F2'
const BORDER = '#e5e5e5'
const BODY_TEXT = '#444444'
const MUTED = '#8a8a8a'
const SERIF = 'Georgia,\'Times New Roman\',serif'
const SANS = 'Arial,Helvetica,sans-serif'

/**
 * Escapes text interpolated into email HTML. Customer names, trip names and
 * notification bodies are user-controlled, and a stray "<" silently breaks
 * the rest of the message in most clients.
 */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type FeaturedExperience = {
  title: string
  region: string
  image: string
  priceFrom: number
  nights: number
  url: string
}

function money(amount: number, currency = 'ZAR'): string {
  const symbol = currency === 'ZAR' ? 'R ' : `${currency} `
  const value = Number.isFinite(amount) ? amount : 0
  // Period-decimal accounting form — see formatMoney in lib/allocation.ts.
  const body = `${symbol}${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
  return value < 0 ? `(${body})` : body
}

/**
 * Published packages to promote in the email footer, newest featured first.
 * Never throws — a promo block is not worth failing a receipt over, so any
 * lookup problem simply yields no block.
 */
export async function getFeaturedExperiences(origin: string, limit = 3): Promise<FeaturedExperience[]> {
  try {
    const published = await getPublishedPackages()
    const ranked = [...published].sort((a, b) => Number(b.featured) - Number(a.featured))
    return ranked
      .filter(p => p.image && p.title)
      .slice(0, limit)
      .map(p => ({
        title: p.title,
        region: p.region,
        // Package images are usually absolute (CDN/Unsplash); tolerate a
        // site-relative path too, since email clients can't resolve those.
        image: /^https?:\/\//i.test(p.image) ? p.image : `${origin}${p.image.startsWith('/') ? '' : '/'}${p.image}`,
        priceFrom: Number(p.pricePerPerson) || 0,
        nights: Number(p.durationNights) || 0,
        url: `${origin}/packages/${p.id}`,
      }))
  } catch {
    return []
  }
}

function featuredBlock(items: FeaturedExperience[]): string {
  if (items.length === 0) return ''

  const rows = items.map(x => `
    <tr>
      <td style="padding:0 0 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="96" valign="top" style="padding-right:14px;">
              <a href="${esc(x.url)}" style="text-decoration:none;">
                <!-- height:auto rather than a fixed box: object-fit is ignored in
                     Outlook, which would stretch the thumbnail instead of cropping. -->
                <img src="${esc(x.image)}" width="96" alt="${esc(x.title)}"
                     style="display:block;width:96px;height:auto;border:0;" />
              </a>
            </td>
            <td valign="top">
              <a href="${esc(x.url)}" style="text-decoration:none;color:${INK};font-family:${SERIF};font-size:15px;font-style:italic;">${esc(x.title)}</a>
              <p style="margin:3px 0 0;font-family:${SANS};font-size:11px;color:${MUTED};">
                ${esc(x.region)}${x.nights > 0 ? ` &middot; ${x.nights} night${x.nights === 1 ? '' : 's'}` : ''}
              </p>
              ${x.priceFrom > 0 ? `<p style="margin:4px 0 0;font-family:${SANS};font-size:12px;color:${GREEN};">from ${money(x.priceFrom)} per person</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`).join('')

  return `
  <div style="background:#ffffff;border:1px solid ${BORDER};border-top:none;padding:24px 32px 10px;">
    <p style="margin:0 0 16px;font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};">Featured experiences</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
  </div>`
}

function footerBlock(origin: string): string {
  return `
  <div style="background:${INK};padding:22px 32px;">
    <p style="margin:0 0 4px;font-family:${SERIF};font-size:13px;color:#ffffff;">Warm regards,</p>
    <p style="margin:0 0 14px;font-family:${SERIF};font-size:13px;color:${GOLD};">The Visit Drakensberg Team</p>
    <p style="margin:0 0 12px;font-family:${SANS};font-size:11px;">
      <a href="${origin}/packages" style="color:#ffffff;text-decoration:none;">Packages</a>
      <span style="color:#555;">&nbsp;&middot;&nbsp;</span>
      <a href="${origin}/hikes" style="color:#ffffff;text-decoration:none;">Hikes</a>
      <span style="color:#555;">&nbsp;&middot;&nbsp;</span>
      <a href="${origin}/stays" style="color:#ffffff;text-decoration:none;">Stays</a>
      <span style="color:#555;">&nbsp;&middot;&nbsp;</span>
      <a href="${origin}/experiences" style="color:#ffffff;text-decoration:none;">Experiences</a>
    </p>
    <p style="margin:0;font-family:${SANS};font-size:10px;color:#777777;line-height:1.7;">
      Visit Drakensberg &middot; <a href="${origin}" style="color:#777777;">visitdrakensberg.com</a><br/>
      This is an automated message — please do not reply directly to this email.
    </p>
  </div>`
}

export type EmailShell = {
  origin: string
  /** Inbox preview line. Falls back to the heading when omitted. */
  preheader?: string
  /** Small gold uppercase line above the heading. */
  eyebrow?: string
  heading: string
  /** Main content. Already-built HTML — escape any user values with esc(). */
  bodyHtml: string
  featured?: FeaturedExperience[]
}

/** Wraps content in the branded shell shared by every transactional email. */
export function emailShell(o: EmailShell): string {
  const preheader = o.preheader ?? o.heading
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(o.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <!-- Inbox preview text, hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;">
          <tr><td>

            <div style="background:${INK};padding:30px 32px;">
              <img src="${o.origin}/logo-email.png" width="210" alt="Visit Drakensberg"
                   style="display:block;width:210px;height:auto;border:0;" />
              ${o.eyebrow ? `<p style="margin:16px 0 0;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};">${esc(o.eyebrow)}</p>` : ''}
              <h1 style="margin:${o.eyebrow ? '6px' : '16px'} 0 0;font-family:${SERIF};font-style:italic;font-weight:normal;font-size:26px;line-height:1.25;color:#ffffff;">${esc(o.heading)}</h1>
            </div>

            <div style="background:#ffffff;border:1px solid ${BORDER};border-top:none;padding:28px 32px;font-family:${SERIF};font-size:14px;color:${BODY_TEXT};">
              ${o.bodyHtml}
            </div>

            ${featuredBlock(o.featured ?? [])}
            ${footerBlock(o.origin)}

          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Primary call-to-action button. */
export function ctaButton(href: string, label: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${esc(href)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;padding:13px 26px;font-family:${SANS};font-size:13px;">${esc(label)}</a>
  </p>`
}

/** Label/value table used for invoice, receipt and quote summaries. */
export function detailTable(rows: [string, string][]): string {
  const body = rows.map(([k, v]) =>
    `<tr>
      <td style="padding:7px 0;font-family:${SANS};font-size:12px;color:${MUTED};">${esc(k)}</td>
      <td style="padding:7px 0;text-align:right;font-family:${SANS};font-size:12px;color:${INK};">${esc(v)}</td>
    </tr>`).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin:4px 0 0;">${body}</table>`
}
