// SERVER ONLY — shared presentation for every transactional email we send
// (receipts, invoices, quotes, waivers, password resets, staff notifications,
// departure confirmations, supplier agreements).
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
// Two rules that shape the whole file:
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
//      but 9.3:1 on black, so gold stays on the ink bands and nowhere else.
//
//   2. The <style> block is a progressive enhancement, not the design. Gmail
//      and Outlook drop or mangle parts of it, so every element carries the
//      inline styles it needs to stand alone; the block only adds the
//      dark-mode and narrow-screen refinements on clients that honour it.
//      That is also why the dark overrides all carry !important — they are
//      competing with those inline styles.

// Brand tokens, mirroring the site's palette (globals.css / tailwind.config.ts).
const INK = '#000000'          // masthead and footer bands
const INK_TEXT = '#14140F'     // headings and figures on paper
const GOLD = '#C9A96E'         // accent — ink bands only, see note above
const SAGE = '#4A7251'         // brand green (was #2d6a4f here, off-token)
const CREAM = '#F7F5F2'        // page ground behind the card
const CARD = '#FFFFFF'
const BORDER = '#E8E5DF'
const BODY_TEXT = '#3B3B36'
const MUTED = '#6E6E68'
const FOOT_TEXT = '#8E8E88'    // fine print on ink
const FOOT_SEP = '#4A4A44'     // separators between footer links

// Dark-mode counterparts. The ink bands already read correctly on a dark
// device, so only the card and its contents flip.
const D_PAGE = '#151813'
const D_CARD = '#22271F'
const D_BORDER = '#363C33'
const D_TEXT = '#DDE0DA'
const D_STRONG = '#F2F4EF'
const D_MUTED = '#A0A89A'

// Montserrat Medium (500) for headings, labels and buttons; Regular (400) for
// body copy. Gmail and most of Outlook block webfonts, so the fallback chain
// matters as much as the request: both land on a neutral grotesque rather than
// dropping to a serif.
const FONT = "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif"

const CONTAINER = 640          // widest a bordered card goes before Outlook's
                               // reading pane and Gmail mobile start clipping

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
 * Webfont request plus the two enhancements the inline styles can't express:
 * the dark palette, and the narrow-screen padding. Both are additive — a
 * client that drops this block still renders the light design correctly.
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
    }

    @media (prefers-color-scheme: dark) {
      .page { background:${D_PAGE} !important; }
      .card { background:${D_CARD} !important; border-color:${D_BORDER} !important; }
      .body-cell { background:${D_CARD} !important; color:${D_TEXT} !important; }
      .body-cell p, .body-cell li, .body-cell td { color:${D_TEXT} !important; }
      .greet, .val, .body-cell strong { color:${D_STRONG} !important; }
      .lbl, .fine { color:${D_MUTED} !important; }
      .rule { border-color:${D_BORDER} !important; }
      .day { border-color:${D_BORDER} !important; background:${D_CARD} !important; }
    }
  </style>`
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
}

/** Wraps content in the branded shell shared by every transactional email. */
export function emailShell(o: EmailShell): string {
  const preheader = o.preheader ?? o.heading

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
              <img src="${o.origin}/logo-email-onink.png" width="188" alt="Visit Drakensberg"
                   style="display:block;width:188px;height:auto;border:0;" />
              <div style="width:34px;height:1px;background:${GOLD};margin:22px 0 14px;font-size:0;line-height:0;">&nbsp;</div>
              ${o.eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${GOLD};">${esc(o.eyebrow)}</p>` : ''}
              <h1 class="h1" style="margin:0;font-family:${FONT};font-weight:500;font-size:23px;line-height:1.4;letter-spacing:-.01em;color:#ffffff;">${esc(o.heading)}</h1>
            </td>
          </tr>

          <tr>
            <td class="pad body-cell" style="background:${CARD};padding:32px 44px 38px;font-family:${FONT};font-weight:400;font-size:14px;line-height:1.75;color:${BODY_TEXT};">
              ${o.bodyHtml}
            </td>
          </tr>

          ${footerBlock(o.origin)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function footerBlock(origin: string): string {
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

  return `
  <tr>
    <td class="pad" bgcolor="${INK}" style="background:${INK};padding:28px 44px;">
      <p style="margin:0 0 2px;font-family:${FONT};font-weight:400;font-size:12px;color:#ffffff;">Warm regards,</p>
      <p style="margin:0 0 20px;font-family:${FONT};font-weight:500;font-size:12px;color:${GOLD};">The Visit Drakensberg Team</p>
      <p style="margin:0 0 18px;">${nav}</p>
      <p style="margin:0;font-family:${FONT};font-weight:400;font-size:11px;line-height:1.7;color:${FOOT_TEXT};">
        Visit Drakensberg &middot; <a href="${origin}" style="color:${FOOT_TEXT};">visitdrakensberg.com</a><br/>
        This is an automated message — please do not reply directly to this email.
      </p>
    </td>
  </tr>`
}

/**
 * Primary call-to-action button.
 *
 * The padding sits on the <td> rather than the <a> because Outlook's Word
 * engine ignores padding on an inline-block anchor, which collapses the
 * button to a tight box of text.
 */
export function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
    <tr>
      <td style="background:${SAGE};border-radius:3px;padding:14px 28px;">
        <a href="${esc(href)}" style="display:inline-block;font-family:${FONT};font-weight:500;font-size:12.5px;letter-spacing:.06em;color:#ffffff;">${esc(label)}</a>
      </td>
    </tr>
  </table>`
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
 * Small uppercase heading for a section inside the body — "Day-by-day
 * itinerary" and the like. Set in ink rather than gold: gold is legible on the
 * masthead but not on the card behind this.
 */
export function sectionLabel(label: string): string {
  return `<p class="lbl" style="margin:28px 0 8px;font-family:${FONT};font-weight:500;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:${MUTED};">${esc(label)}</p>`
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
