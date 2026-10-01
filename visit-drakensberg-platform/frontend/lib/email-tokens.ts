// Brand tokens for email, mirroring the site's palette (globals.css /
// tailwind.config.ts). Split out of lib/email-layout.ts — which is SERVER
// ONLY — because the admin campaign builder is a client component and its
// starter templates (lib/email-starter-templates.ts) need the same hex
// values. Two copies of the palette is exactly how a brand drifts, so this
// module holds the one copy and both sides import it.
//
// Nothing here touches the filesystem, `process`, or any Node API, so it is
// safe on either side of the client boundary. Keep it that way: helpers that
// build HTML belong in email-layout.ts, not here.
//
// The Python twin (backend/app/services/email_layout.py) copies these values
// rather than importing them — a change to any token belongs in both files.

export const INK = '#000000'          // masthead, closing band and footer
export const INK_TEXT = '#14140F'     // headings and figures on paper
export const GOLD = '#C9A96E'         // accent — ink grounds only, see note below
export const SAGE = '#4A7251'         // brand green — primary buttons, links on paper
export const CREAM = '#F7F5F2'        // page ground behind the card, and panel fills
export const CARD = '#FFFFFF'
export const BORDER = '#E8E5DF'
export const BODY_TEXT = '#3B3B36'
export const MUTED = '#6E6E68'
export const BAND_TEXT = '#C7C7C1'    // body copy on the ink closing band
export const FOOT_TEXT = '#8E8E88'    // fine print on ink
export const FOOT_SEP = '#4A4A44'     // separators between footer links

// Why gold never appears as text on paper: #C9A96E is 2.3:1 on white — under
// the 4.5:1 floor — but 9.3:1 on black. So gold carries the accent on the ink
// bands, and on the white card it appears only as a rule or a keyline, where
// contrast ratios don't apply. Section eyebrows on paper are set in MUTED
// (5.2:1) instead. SAGE on white is 5.6:1 and carries links and buttons.

// Dark-mode counterparts. The ink bands already read correctly on a dark
// device, so only the card and its contents flip.
export const D_PAGE = '#151813'
export const D_CARD = '#22271F'
export const D_PANEL = '#1B201A'      // tinted panels, a step down from the card
export const D_BORDER = '#363C33'
export const D_TEXT = '#DDE0DA'
export const D_STRONG = '#F2F4EF'
export const D_MUTED = '#A0A89A'

// Montserrat Medium (500) for headings, labels and buttons; Regular (400) for
// body copy. Gmail and most of Outlook block webfonts, so the fallback chain
// matters as much as the request: both land on a neutral grotesque rather than
// dropping to a serif. Note there is no 700 here — see the `strong` rule in
// email-layout.ts's style block.
export const FONT = "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif"

export const CONTAINER = 640          // widest a bordered card goes before Outlook's
                                      // reading pane and Gmail mobile start clipping
