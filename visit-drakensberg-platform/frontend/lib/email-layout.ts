// SERVER ONLY — shared presentation for every email we send: the
// transactional set (receipts, invoices, quotes, waivers, password resets,
// staff notifications, departure confirmations, supplier agreements) and the
// promotional set the admin campaign builder composes (newsletters, story
// digests, enquiry follow-ups, listing invitations).
//
// The send routes previously each carried their own copy of the same
// black-header/white-card markup, so brand changes had to be made in several
// places and drifted. They now compose this shell instead.
//
// Email HTML is not web HTML: no external stylesheets that survive every
// client, no flexbox or grid in Outlook, and SVG is stripped outright.
// Everything here is table-based with inline styles, and the logo is a PNG
// raster of public/logo.svg (public/logo-email.png) rather than the SVG the
// site itself uses.
//
// Three rules shape the whole file:
//
//   1. The logo carries its own dark ground. logo-email.png is WHITE artwork
//      on transparency, so it only reads on a dark band — and relying on the
//      cell for that is not enough: clients that force-invert for dark mode
//      (the Gmail app, Outlook.com) repaint a #000000 cell white and leave the
//      image alone, which left a white wordmark on white. logo-email-onink.png
//      is the same artwork composited onto opaque ink, so the contrast lives
//      inside the image and no client can repaint it away. The ink cells also
//      carry a bgcolor attribute beside the CSS background, for clients that
//      drop one but honour the other. Gold text has the same constraint by a
//      different route: #C9A96E is 2.3:1 on white — under the 4.5:1 floor —
//      but 9.3:1 on black, so gold stays on the ink bands and appears on paper
//      only as a rule, never as type. See lib/email-tokens.ts.
//
//   2. The <style> block is a progressive enhancement, not the design. Gmail
//      and Outlook drop or mangle parts of it, so every element carries the
//      inline styles it needs to stand alone; the block only adds the
//      dark-mode, stacking and narrow-screen refinements on clients that
//      honour it. A two-up card row that does not stack still renders as two
//      readable 260px columns inside the 640px card, so nothing here depends
//      on the media query landing. That is also why the dark overrides all
//      carry !important — they are competing with those inline styles.
//
//   3. Transactional and promotional mail are different things and the footer
//      is where that becomes visible. A booking confirmation is owed to the
//      guest regardless of marketing consent and carries the "do not reply"
//      automated-message note; a campaign is promotional, is only ever sent to
//      a marketing-consented audience (see the vd_campaign_dry_run_send()
//      header in supabase/migrations/20260825_email_campaign_foundation.sql)
//      and owes the reader a postal address, a preferences link and a working
//      unsubscribe. Pass footer.variant to pick; transactional is the default
//      so every existing caller is unaffected.
//
// The block vocabulary below (hero band, fact panel, notice, step list,
// checklist, story cards, pull quote, closing band) comes from the Visit
// Drakensberg Email & Blog Template Pack, re-expressed in the platform's own
// tokens: the pack's forest/sandstone palette, Georgia display type and
// 800-weight labels are NOT used — they are a second brand. What was taken is
// the structure, which is the part that was actually missing: lead with an
// image, make the facts scannable, end on one decisive action.

import {
  INK, INK_TEXT, GOLD, SAGE, CREAM, CARD, BORDER, BODY_TEXT, MUTED,
  BAND_TEXT, FOOT_TEXT, FOOT_SEP,
  D_PAGE, D_CARD, D_PANEL, D_BORDER, D_TEXT, D_STRONG, D_MUTED,
  FONT, CONTAINER,
} from './email-tokens'

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

/**
 * Webfont request plus the enhancements the inline styles can't express: the
 * dark palette, the narrow-screen padding, and stacking the multi-column
 * rows. All additive — a client that drops this block still renders the light,
 * side-by-side design correctly.
 */
function styleBlock(): string {
  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500&display=swap');

    body { margin:0; padding:0; width:100%; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    /* Montserrat ships 400 and 500 only, so bold copy resolves to Medium
       rather than a synthesised 700 that doesn't match the headings. */
    strong, b { font-weight:500; }

    @media (max-width:620px) {
      .pad { padding-left:22px !important; padding-right:22px !important; }
      .h1 { font-size:20px !important; }
      .frame { padding:14px 0 !important; }
      /* Two-up story cards, checklist columns and the digest thumb/copy row
         all stack rather than squeezing to ~130px of text on a phone. */
      .col { display:block !important; width:100% !important; max-width:100% !important; }
      .col-gap { display:none !important; width:0 !important; }
      .col-first { padding-bottom:28px !important; }
      .thumb { padding-bottom:16px !important; }
    }

    @media (prefers-color-scheme: dark) {
      .page { background:${D_PAGE} !important; }
      .card { background:${D_CARD} !important; border-color:${D_BORDER} !important; }
      .body-cell { background:${D_CARD} !important; color:${D_TEXT} !important; }
      .body-cell p, .body-cell li, .body-cell td { color:${D_TEXT} !important; }
      .greet, .val, .h2, .body-cell strong { color:${D_STRONG} !important; }
      .lbl, .fine, .cap { color:${D_MUTED} !important; }
      .rule { border-color:${D_BORDER} !important; }
      .day { border-color:${D_BORDER} !important; background:${D_CARD} !important; }
      /* The hero's own ground, which shows through whenever the image is
         blocked — cream would be a glaring bar on a dark device. */
      .hero, .hero img { background:${D_PANEL} !important; }
      .panel { background:${D_PANEL} !important; }
      .panel p, .panel td, .panel li { color:${D_TEXT} !important; }
      .quote { border-color:${GOLD} !important; }
      .ghost { border-color:${D_BORDER} !important; }
    }
  </style>`
}

/**
 * Full-bleed image directly under the masthead. The pack's strongest idea and
 * the one the transactional shell had no room for: a destination email that
 * opens on type alone reads like a receipt.
 *
 * `alt` is required rather than optional — images are blocked by default in
 * Outlook and in Gmail for unknown senders, so the alt text IS the hero for a
 * meaningful share of the audience, and an empty one leaves them a blank
 * band. The fallback ground is cream rather than a dark placeholder so a
 * blocked image reads as quiet paper with dark alt text on it.
 */
export type EmailHero = { src: string; alt: string; caption?: string }

/** Footer mode — see rule 3 in the file header. */
export type EmailFooter = {
  variant?: 'transactional' | 'marketing'
  /** Defaults to the site's public opt-out page. Marketing only. */
  unsubscribeUrl?: string
  /** Optional "manage what you receive" destination. Marketing only. */
  preferencesUrl?: string
  /**
   * Physical postal address. POPIA and CAN-SPAM both expect one on
   * promotional mail; it is deliberately not hardcoded here so nobody ships a
   * guessed address — the campaign routes pass EMAIL_POSTAL_ADDRESS.
   */
  postalAddress?: string
}

export type EmailShell = {
  origin: string
  /** Inbox preview line. Falls back to the heading when omitted. */
  preheader?: string
  /** Small gold uppercase line above the heading, on the ink masthead. */
  eyebrow?: string
  heading: string
  /** Main content. Already-built HTML — escape any user values with esc(). */
  bodyHtml: string
  /** Optional image band between the masthead and the body. */
  hero?: EmailHero
  /** Adds a "View in browser" link to the masthead. Campaigns, mostly. */
  viewOnlineUrl?: string
  /** Footer mode and its compliance links. Transactional by default. */
  footer?: EmailFooter
}

/** Wraps content in the branded shell shared by every email we send. */
export function emailShell(o: EmailShell): string {
  const preheader = o.preheader ?? o.heading

  // Only swap the masthead to a two-column table when there's a second column
  // to hold — an unconditional table would change the markup every existing
  // transactional email renders today for no gain.
  const logo = `<img src="${o.origin}/logo-email-onink.png" width="188" alt="Visit Drakensberg"
                   style="display:block;width:188px;height:auto;border:0;" />`
  const masthead = o.viewOnlineUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="left" valign="middle">${logo}</td>
          <td align="right" valign="middle" style="font-family:${FONT};font-weight:400;font-size:11px;">
            <a href="${esc(o.viewOnlineUrl)}" style="color:${FOOT_TEXT};">View in browser</a>
          </td>
        </tr>
      </table>`
    : logo

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!-- Declaring both schemes is what stops Apple Mail and the Gmail app from
     inverting the card on their own terms; the palette below is ours. -->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${esc(o.heading)}</title>
<!-- Webfont, requested two ways because clients disagree about which they
     honour, and hidden from Outlook's Word engine, which renders a stray
     block of the stylesheet URL as text if it sees the link. Gmail ignores
     both and falls back down the stack in FONT. -->
<!--[if !mso]><!-->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500&display=swap" />
<!--<![endif]-->
${styleBlock()}
</head>
<body class="page" style="margin:0;padding:0;background:${CREAM};">
  <!-- Inbox preview text, hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="page" style="background:${CREAM};">
    <tr>
      <td align="center" class="frame" style="padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTAINER}" class="card"
               style="width:${CONTAINER}px;max-width:100%;background:${CARD};border:1px solid ${BORDER};border-radius:4px;overflow:hidden;">

          <tr>
            <td class="pad" bgcolor="${INK}" style="background:${INK};padding:34px 44px 32px;">
              ${masthead}
              <div style="width:34px;height:1px;background:${GOLD};margin:22px 0 14px;font-size:0;line-height:0;">&nbsp;</div>
              ${o.eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};">${esc(o.eyebrow)}</p>` : ''}
              <h1 class="h1" style="margin:0;font-family:${FONT};font-weight:500;font-size:23px;line-height:1.4;letter-spacing:-.01em;color:#ffffff;">${esc(o.heading)}</h1>
            </td>
          </tr>
${heroBand(o.hero)}
          <tr>
            <td class="pad body-cell" style="background:${CARD};padding:32px 44px 38px;font-family:${FONT};font-weight:400;font-size:14px;line-height:1.75;color:${BODY_TEXT};">
              ${o.bodyHtml}
            </td>
          </tr>

          ${footerBlock(o.origin, o.footer)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** The hero row, or nothing. Kept out of emailShell for readability only. */
function heroBand(hero: EmailHero | undefined): string {
  if (!hero?.src) return ''
  const caption = hero.caption
    ? `
          <tr>
            <td class="pad" style="background:${CARD};padding:10px 44px 0;">
              <p class="cap" style="margin:0;font-family:${FONT};font-weight:400;font-size:11px;line-height:1.6;color:${MUTED};">${esc(hero.caption)}</p>
            </td>
          </tr>`
    : ''
  return `
          <tr>
            <td class="hero" style="font-size:0;line-height:0;background:${CREAM};">
              <img src="${esc(hero.src)}" width="${CONTAINER}" alt="${esc(hero.alt)}"
                   style="display:block;width:100%;max-width:${CONTAINER}px;height:auto;border:0;background:${CREAM};" />
            </td>
          </tr>${caption}
`
}

function footerBlock(origin: string, footer?: EmailFooter): string {
  const links = [
    ['Packages', '/packages'],
    ['Hikes', '/hikes'],
    ['Stays', '/stays'],
    ['Experiences', '/experiences'],
  ] as const

  const nav = links
    .map(([label, path]) =>
      `<a href="${origin}${path}" style="color:#ffffff;font-family:${FONT};font-weight:500;font-size:11.5px;letter-spacing:.04em;">${label}</a>`)
    .join(`<span style="color:${FOOT_SEP};padding:0 9px;">&middot;</span>`)

  const fine = footer?.variant === 'marketing'
    ? marketingFine(origin, footer)
    : `Visit Drakensberg &middot; <a href="${origin}" style="color:${FOOT_TEXT};">visitdrakensberg.com</a><br/>
        This is an automated message. Please do not reply directly to this email.`

  return `
  <tr>
    <td class="pad" bgcolor="${INK}" style="background:${INK};padding:28px 44px;">
      <p style="margin:0 0 2px;font-family:${FONT};font-weight:400;font-size:12px;color:#ffffff;">Warm regards,</p>
      <p style="margin:0 0 20px;font-family:${FONT};font-weight:500;font-size:12px;color:${GOLD};">The Visit Drakensberg Team</p>
      <p style="margin:0 0 18px;">${nav}</p>
      <p style="margin:0;font-family:${FONT};font-weight:400;font-size:11px;line-height:1.7;color:${FOOT_TEXT};">
        ${fine}
      </p>
    </td>
  </tr>`
}

/**
 * The promotional footer. Says why the reader is getting this, where we are,
 * and how to stop — all three, because a campaign that only carries the
 * transactional "do not reply" line is the kind of mail that gets a domain
 * blocklisted, quite apart from what POPIA asks of it.
 *
 * The unsubscribe link defaults to the site's public opt-out page, which
 * works without a login and without the ?email= hint (app/unsubscribe).
 */
function marketingFine(origin: string, footer: EmailFooter): string {
  const unsubscribe = footer.unsubscribeUrl || `${origin}/unsubscribe`
  // Joined tight, with no whitespace between the anchors and the separators:
  // a newline inside a run of inline elements renders as a space, which would
  // put the middots adrift from the links and — more to the point — diverge
  // from the Python twin's byte-for-byte output.
  const sep = `<span style="color:${FOOT_SEP};padding:0 6px;">&middot;</span>`
  const manage = footer.preferencesUrl
    ? `<a href="${esc(footer.preferencesUrl)}" style="color:#ffffff;">Manage preferences</a>${sep}`
    : ''
  const address = footer.postalAddress
    ? `${esc(footer.postalAddress)} &middot; `
    : ''
  return `You are receiving this because you asked to hear from Visit Drakensberg.
        Trip messages for bookings you have already made are sent separately and are not affected by this preference.<br/><br/>
        Visit Drakensberg &middot; ${address}<a href="${origin}" style="color:${FOOT_TEXT};">visitdrakensberg.com</a><br/>
        ${manage}<a href="${esc(unsubscribe)}" style="color:#ffffff;">Unsubscribe</a>${sep}&copy; ${new Date().getFullYear()} Visit Drakensberg`
}

/* ────────────────────────────────────────────────────────────────────────────
 * Body blocks. Every one of them is a pure string builder: it escapes its own
 * arguments, carries the inline styles it needs to stand alone, and tags
 * itself with the class hooks the style block's dark and narrow rules key off.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Opening line. */
export function greeting(name?: string | null): string {
  return `<p class="greet" style="margin:0 0 18px;font-family:${FONT};font-weight:500;font-size:14.5px;color:${INK_TEXT};">Hi ${esc(name || 'there')},</p>`
}

/** A body paragraph. `html` may carry inline markup, so escape values first. */
export function paragraph(html: string, opts?: { last?: boolean }): string {
  return `<p style="margin:0 0 ${opts?.last ? '0' : '16px'};">${html}</p>`
}

/**
 * The 60–90 word opening the pack puts under every headline: one size up from
 * body copy, so the eye lands on it before the detail below.
 */
export function leadParagraph(html: string): string {
  return `<p style="margin:0 0 22px;font-family:${FONT};font-weight:400;font-size:16px;line-height:1.7;color:${BODY_TEXT};">${html}</p>`
}

/**
 * An in-body section heading, optionally with an eyebrow above it. The pack
 * sets the eyebrow in gold on white, which is 2.3:1 — that is the one thing
 * from it that is not imported. Here the eyebrow is MUTED (5.2:1) and the gold
 * survives as the short rule above it, where contrast doesn't apply.
 */
export function bodyHeading(text: string, eyebrow?: string): string {
  return `${eyebrow ? `<div style="width:26px;height:1px;background:${GOLD};margin:34px 0 12px;font-size:0;line-height:0;">&nbsp;</div>
    <p class="lbl" style="margin:0 0 8px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};">${esc(eyebrow)}</p>` : ''}
    <h2 class="h2" style="margin:${eyebrow ? '0' : '32px'} 0 12px;font-family:${FONT};font-weight:500;font-size:19px;line-height:1.35;letter-spacing:-.01em;color:${INK_TEXT};">${esc(text)}</h2>`
}

/** A hairline between sections, for digests and newsletters. */
export function divider(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0;">
    <tr><td class="rule" style="border-top:1px solid ${BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`
}

type CtaVariant = 'primary' | 'gold' | 'ghost'

/**
 * Call-to-action button.
 *
 * The padding sits on the <td> rather than the <a> because Outlook's Word
 * engine ignores padding on an inline-block anchor, which collapses the
 * button to a tight box of text.
 *
 * `primary` (sage on paper) is the default and the only one most mail needs —
 * the pack's one-primary-CTA-per-email rule is worth keeping. `gold` is for
 * the ink closing band, where gold finally has the ground to earn its
 * contrast. `ghost` is an outlined secondary for the rare email that genuinely
 * has two destinations.
 */
export function ctaButton(href: string, label: string, variant: CtaVariant = 'primary'): string {
  const skin = variant === 'gold'
    ? `background:${GOLD};border-radius:3px;padding:14px 28px;`
    : variant === 'ghost'
      ? `border:1px solid ${BORDER};border-radius:3px;padding:13px 27px;`
      : `background:${SAGE};border-radius:3px;padding:14px 28px;`
  const ink = variant === 'gold' ? INK_TEXT : variant === 'ghost' ? INK_TEXT : '#ffffff'
  const cls = variant === 'ghost' ? ' class="ghost"' : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
    <tr>
      <td${cls} style="${skin}">
        <a href="${esc(href)}" style="display:inline-block;font-family:${FONT};font-weight:500;font-size:12.5px;letter-spacing:.06em;color:${ink};">${esc(label)}</a>
      </td>
    </tr>
  </table>`
}

/** Inline "Read the full story →" link — the secondary action on a card or row. */
export function textLink(href: string, label: string): string {
  return `<a href="${esc(href)}" style="font-family:${FONT};font-weight:500;font-size:12.5px;letter-spacing:.02em;color:${SAGE};">${esc(label)} &rarr;</a>`
}

/**
 * Label/value table used for invoice, receipt, quote and waiver summaries.
 * Pass the headline figure as `total` to have it set larger below the rule —
 * the balance due on an invoice or receipt, the total on a quote.
 */
export function detailTable(rows: [string, string][], total?: [string, string]): string {
  const body = rows.map(([k, v]) =>
    `<tr>
      <td class="lbl rule" style="padding:10px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-weight:400;font-size:11px;letter-spacing:.03em;color:${MUTED};">${esc(k)}</td>
      <td class="val rule" align="right" style="padding:10px 0;border-bottom:1px solid ${BORDER};font-family:${FONT};font-weight:500;font-size:12px;color:${INK_TEXT};">${esc(v)}</td>
    </tr>`).join('')

  const totalRow = total
    ? `<tr>
        <td class="lbl" style="padding:15px 0 0;font-family:${FONT};font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">${esc(total[0])}</td>
        <td class="val" align="right" style="padding:15px 0 0;font-family:${FONT};font-weight:500;font-size:17px;color:${INK_TEXT};">${esc(total[1])}</td>
      </tr>`
    : ''

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    class="rule" style="border-top:1px solid ${BORDER};margin:4px 0 0;">${body}${totalRow}</table>`
}

/**
 * The "where to be, when, and who to call" panel — meeting point, guide,
 * finish time. detailTable is a ledger and reads like one; this is the block a
 * guest screenshots at 5am in a car park, so it is a tinted panel with a gold
 * rule across the top and label/value stacked large enough to read at arm's
 * length.
 */
export function factPanel(rows: [string, string][], title?: string): string {
  const body = rows.map(([k, v]) =>
    `<tr>
      <td class="lbl" style="padding:0 0 3px;font-family:${FONT};font-weight:400;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">${esc(k)}</td>
    </tr>
    <tr>
      <td class="val" style="padding:0 0 14px;font-family:${FONT};font-weight:500;font-size:14px;line-height:1.5;color:${INK_TEXT};">${esc(v)}</td>
    </tr>`).join('')

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="panel"
    style="margin:20px 0 0;background:${CREAM};border-top:3px solid ${GOLD};">
    <tr>
      <td style="padding:22px 24px 8px;">
        ${title ? `<p class="val" style="margin:0 0 16px;font-family:${FONT};font-weight:500;font-size:15px;color:${INK_TEXT};">${esc(title)}</p>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${body}</table>
      </td>
    </tr>
  </table>`
}

/**
 * A panel that interrupts: permit conditions, a route-change caveat, a
 * truthfully time-bound availability note.
 *
 * `caution` is gold-ruled and `info` sage-ruled, rather than the amber ground
 * the pack uses — a fourth background colour would be a new brand colour, and
 * the accent rule already carries the distinction. Never use this to
 * manufacture urgency; if the note is about availability, it must state when
 * it was checked.
 */
export function noticePanel(title: string, html: string, tone: 'info' | 'caution' = 'info'): string {
  const accent = tone === 'caution' ? GOLD : SAGE
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="panel"
    style="margin:24px 0 0;background:${CREAM};border-left:3px solid ${accent};">
    <tr>
      <td style="padding:18px 20px;">
        <p class="val" style="margin:0 0 5px;font-family:${FONT};font-weight:500;font-size:12.5px;color:${INK_TEXT};">${esc(title)}</p>
        <p style="margin:0;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.7;color:${BODY_TEXT};">${html}</p>
      </td>
    </tr>
  </table>`
}

/**
 * "What happens next" — the numbered sequence the pack puts after every
 * confirmation. Built as a table rather than an <ol> because Outlook's Word
 * engine indents and bullets list items unpredictably, and because the number
 * wants to be a gold-ruled figure rather than a browser marker.
 */
export function stepList(steps: string[]): string {
  const rows = steps.map((s, i) =>
    `<tr>
      <td valign="top" width="30" style="padding:0 0 14px;font-family:${FONT};font-weight:500;font-size:12px;line-height:1.7;color:${MUTED};">${i + 1}.</td>
      <td valign="top" style="padding:0 0 14px;font-family:${FONT};font-weight:400;font-size:13.5px;line-height:1.7;color:${BODY_TEXT};">${esc(s)}</td>
    </tr>`).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">${rows}</table>`
}

/**
 * Two-column packing/essentials checklist. The tick is a text character, not
 * an image: images are blocked, and a list that loses its markers is a list
 * that loses its meaning. Stacks to one column on narrow screens.
 */
export function checklist(items: string[]): string {
  const half = Math.ceil(items.length / 2)
  const column = (group: string[]) => group.map(i =>
    `<p style="margin:0 0 8px;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.6;color:${BODY_TEXT};">
      <span style="color:${SAGE};">&#10003;</span>&nbsp; ${esc(i)}</p>`).join('')

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">
    <tr>
      <td class="col col-first" width="48%" valign="top" style="padding-right:14px;">${column(items.slice(0, half))}</td>
      <td class="col" width="52%" valign="top">${column(items.slice(half))}</td>
    </tr>
  </table>`
}

export type EmailStoryCard = {
  href: string
  title: string
  /** Required — see EmailHero on why alt text is not optional here. */
  imageAlt?: string
  imageSrc?: string
  category?: string
  summary?: string
  /** Defaults to "Explore". */
  linkLabel?: string
}

/**
 * Two-up feature cards — the newsletter's "here are two things worth your
 * weekend" row. Pass one card and it renders full width rather than leaving a
 * hole; pass more than two and they wrap into further rows of two.
 */
export function storyCards(cards: EmailStoryCard[]): string {
  if (cards.length === 0) return ''

  const cell = (c: EmailStoryCard, first: boolean, full: boolean) => `
    <td class="col${first && !full ? ' col-first' : ''}" width="${full ? '100%' : '48%'}" valign="top" style="${first && !full ? 'padding-right:14px;' : ''}">
      ${c.imageSrc ? `<img src="${esc(c.imageSrc)}" width="260" alt="${esc(c.imageAlt ?? '')}"
             style="display:block;width:100%;height:auto;border:0;background:${CREAM};" />` : ''}
      ${c.category ? `<p class="lbl" style="margin:${c.imageSrc ? '16px' : '0'} 0 6px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">${esc(c.category)}</p>` : ''}
      <p class="val" style="margin:${c.category || !c.imageSrc ? '0' : '16px'} 0 7px;font-family:${FONT};font-weight:500;font-size:15.5px;line-height:1.35;color:${INK_TEXT};">${esc(c.title)}</p>
      ${c.summary ? `<p style="margin:0 0 11px;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.6;color:${BODY_TEXT};">${esc(c.summary)}</p>` : ''}
      ${textLink(c.href, c.linkLabel ?? 'Explore')}
    </td>`

  const rows: string[] = []
  for (let i = 0; i < cards.length; i += 2) {
    const pair = cards.slice(i, i + 2)
    const full = pair.length === 1
    rows.push(`<tr>
      ${cell(pair[0], true, full)}
      ${full ? '' : `<td class="col-gap" width="4%" style="font-size:0;line-height:0;">&nbsp;</td>${cell(pair[1], false, false)}`}
    </tr>${i + 2 < cards.length ? `<tr><td colspan="3" style="font-size:0;line-height:0;height:28px;">&nbsp;</td></tr>` : ''}`)
  }

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;">${rows.join('')}</table>`
}

/**
 * Digest row — thumbnail left, copy right. The second and third stories in an
 * issue, where a full card each would make the email a scroll.
 */
export function storyRow(story: EmailStoryCard): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;">
    <tr>
      ${story.imageSrc ? `<td class="col thumb" width="36%" valign="top" style="padding-right:18px;">
        <img src="${esc(story.imageSrc)}" width="190" alt="${esc(story.imageAlt ?? '')}"
             style="display:block;width:100%;height:auto;border:0;background:${CREAM};" />
      </td>` : ''}
      <td class="col" valign="top">
        ${story.category ? `<p class="lbl" style="margin:0 0 6px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">${esc(story.category)}</p>` : ''}
        <p class="val" style="margin:0 0 7px;font-family:${FONT};font-weight:500;font-size:15.5px;line-height:1.35;color:${INK_TEXT};">${esc(story.title)}</p>
        ${story.summary ? `<p style="margin:0 0 11px;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.6;color:${BODY_TEXT};">${esc(story.summary)}</p>` : ''}
        ${textLink(story.href, story.linkLabel ?? 'Read the story')}
      </td>
    </tr>
  </table>`
}

/**
 * Someone else's words, quoted back to the reader — an enquiry or a reply.
 *
 * pre-wrap rather than <br/> substitution so the sender's own line breaks
 * survive without opening a second path for markup to reach the client.
 */
export function quoteBlock(text: string): string {
  return `<div class="quote" style="margin:4px 0 8px;padding:2px 0 2px 16px;border-left:2px solid ${GOLD};">
    <p style="margin:0;font-family:${FONT};font-weight:400;font-size:14px;line-height:1.7;color:${BODY_TEXT};white-space:pre-wrap;">${esc(text)}</p></div>`
}

/**
 * Editorial pull quote — a line lifted out of a story, set larger. Distinct
 * from quoteBlock, which reproduces what a person actually wrote to us.
 */
export function pullQuote(text: string, attribution?: string): string {
  return `<div class="quote" style="margin:26px 0;padding:4px 0 4px 20px;border-left:2px solid ${GOLD};">
    <p class="val" style="margin:0;font-family:${FONT};font-weight:400;font-size:17px;line-height:1.55;letter-spacing:-.01em;color:${INK_TEXT};">${esc(text)}</p>
    ${attribution ? `<p class="lbl" style="margin:10px 0 0;font-family:${FONT};font-weight:500;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">${esc(attribution)}</p>` : ''}
  </div>`
}

/**
 * Small uppercase heading for a section inside the body — "Day-by-day
 * itinerary" and the like. Set in ink rather than gold: gold is legible on the
 * masthead but not on the card behind this.
 */
export function sectionLabel(label: string): string {
  return `<p class="lbl" style="margin:28px 0 8px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>`
}

/**
 * Named contact block for mail a person actually sent — an advisor, an account
 * manager. Deliberately carries no "Warm regards" of its own: the ink footer
 * below it already signs off from the team, and two valedictions in a row read
 * like the email was assembled rather than written. This block answers who
 * wrote it and how to reach them.
 */
export function signature(p: { name: string; title?: string; email?: string; phone?: string }): string {
  const contact = [
    p.email ? `<a href="mailto:${esc(p.email)}" style="color:${SAGE};">${esc(p.email)}</a>` : '',
    p.phone ? esc(p.phone) : '',
  ].filter(Boolean).join(`<span style="color:${BORDER};padding:0 7px;">&middot;</span>`)

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="rule" style="margin:32px 0 0;border-top:1px solid ${BORDER};">
    <tr>
      <td style="padding:18px 0 0;">
        <p class="val" style="margin:0;font-family:${FONT};font-weight:500;font-size:14px;color:${INK_TEXT};">${esc(p.name)}</p>
        ${p.title ? `<p class="lbl" style="margin:2px 0 0;font-family:${FONT};font-weight:400;font-size:12px;color:${MUTED};">${esc(p.title)} &middot; Visit Drakensberg</p>` : ''}
        ${contact ? `<p style="margin:8px 0 0;font-family:${FONT};font-weight:400;font-size:12.5px;color:${MUTED};">${contact}</p>` : ''}
      </td>
    </tr>
  </table>`
}

/**
 * Full-bleed ink band above the footer carrying the one decisive action — the
 * pack's closing move, and the reason gold buttons exist in ctaButton.
 *
 * Returned as a self-contained table so it can sit inside the body cell; the
 * negative-margin trick that would make it truly edge-to-edge is not
 * survivable across Outlook, so it is inset by the body padding instead and
 * still reads as a distinct band.
 */
export function closingBand(o: { heading: string; body?: string; href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${INK}"
    style="margin:36px 0 0;background:${INK};border-radius:3px;">
    <tr>
      <td align="center" style="padding:34px 28px;">
        <p style="margin:0 0 10px;font-family:${FONT};font-weight:500;font-size:18px;line-height:1.4;letter-spacing:-.01em;color:#ffffff;">${esc(o.heading)}</p>
        ${o.body ? `<p style="margin:0 0 6px;font-family:${FONT};font-weight:400;font-size:13px;line-height:1.65;color:${BAND_TEXT};">${esc(o.body)}</p>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0;">
          <tr>
            <td bgcolor="${GOLD}" style="background:${GOLD};border-radius:3px;padding:14px 28px;">
              <a href="${esc(o.href)}" style="display:inline-block;font-family:${FONT};font-weight:500;font-size:12.5px;letter-spacing:.06em;color:${INK_TEXT};">${esc(o.label)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

/**
 * Trailing fine print — records notes, terms pointers. Kept above the 4.5:1
 * contrast floor rather than the near-invisible grey these notes used to use.
 */
export function finePrint(html: string): string {
  return `<p class="fine" style="margin:24px 0 0;font-family:${FONT};font-weight:400;font-size:11px;line-height:1.7;color:${MUTED};">${html}</p>`
}

export type EmailItineraryDay = {
  dayNumber: number
  dateLabel: string
  label?: string
  description?: string
  accommodation?: string
  transport?: string
  meals?: string
  distance?: string
  elevation?: string
}

/**
 * Splits freeform itinerary notes into paragraphs on blank/single line
 * breaks, mirroring the web itinerary accordion (app/experiences/[id]) so a
 * day's write-up reads as distinct, well-spaced paragraphs rather than one
 * dense block — email clients ignore <details>/JS toggles too inconsistently
 * to rely on for the accordion interaction itself, so this block stays fully
 * expanded and leans on the same title composition and paragraph spacing to
 * carry readability instead.
 */
function emailParagraphs(text: string): string {
  return text.split(/\n+/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="margin:0 0 8px;font-family:${FONT};font-weight:400;font-size:13px;color:${BODY_TEXT};line-height:1.7;">${esc(p)}</p>`)
    .join('')
}

/** Day-by-day itinerary cards — used by the departure-guest confirmation email (app/api/departure-guests/send-confirmation). */
export function itineraryBlock(days: EmailItineraryDay[]): string {
  if (days.length === 0) return ''
  const rows = days.map(d => {
    const meta = [d.distance, d.elevation].filter(Boolean).join(' &middot; ')
    const facts = [
      d.accommodation ? `Overnight: ${d.accommodation}` : '',
      d.transport ? `Transport: ${d.transport}` : '',
      d.meals ? `Meals: ${d.meals}` : '',
    ].filter(Boolean)
    return `
    <tr>
      <td style="padding:0 0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="day" style="border:1px solid ${BORDER};border-radius:3px;background:${CARD};">
          <tr>
            <td style="padding:16px 18px;">
              <p class="lbl" style="margin:0 0 4px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">Day ${d.dayNumber} &middot; ${esc(d.dateLabel)}</p>
              ${d.label ? `<p class="val" style="margin:0 0 4px;font-family:${FONT};font-weight:500;font-size:13.5px;color:${INK_TEXT};">${esc(d.label)}</p>` : ''}
              ${meta ? `<p class="lbl" style="margin:0 0 10px;font-family:${FONT};font-weight:400;font-size:11.5px;color:${MUTED};">${meta}</p>` : ''}
              ${d.description ? emailParagraphs(d.description) : ''}
              ${facts.length > 0 ? `<div class="rule" style="margin-top:10px;padding-top:10px;border-top:1px solid ${BORDER};">
                ${facts.map(f => `<p class="lbl" style="margin:2px 0 0;font-family:${FONT};font-weight:400;font-size:11.5px;color:${MUTED};">${esc(f)}</p>`).join('')}
              </div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`
  }).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 0;">${rows}</table>`
}
