"""Shared presentation for every email the backend sends.

This is the Python twin of the frontend's lib/email-layout.ts. The two send
from different services — Next.js route handlers over SMTP, FastAPI over
Resend — but a customer receiving a booking confirmation from one and a
payment receipt from the other must not be able to tell. Keep them in step:
a change to the shell belongs in both files, and the tokens below are copied
from that one rather than re-picked here.

Email HTML is not web HTML: no external stylesheets that survive every
client, no flexbox or grid in Outlook, and SVG is stripped outright.
Everything here is table-based with inline styles, and the logo is a PNG
raster of the site's logo.svg (public/logo-email.png) rather than the SVG the
site itself uses.

Two rules that shape the whole file:

  1. The logo carries its own dark ground. logo-email.png is WHITE artwork on
     transparency, so it only reads on a dark band — and relying on the cell
     for that is not enough: clients that force-invert for dark mode (the
     Gmail app, Outlook.com) repaint a #000000 cell white and leave the image
     alone, which left a white wordmark on white. logo-email-onink.png is the
     same artwork composited onto opaque ink, so the contrast lives inside the
     image and no client can repaint it away. The ink cells also carry a
     bgcolor attribute beside the CSS background, for clients that drop one
     but honour the other. Gold has the same constraint by a different route:
     #C9A96E is 2.3:1 on white against a 4.5:1 floor, but 9.3:1 on black, so
     gold stays on the ink bands and nowhere else.

  2. The <style> block is a progressive enhancement, not the design. Gmail and
     Outlook drop or mangle parts of it, so every element carries the inline
     styles it needs to stand alone; the block only adds the dark-mode,
     stacking and narrow-screen refinements on clients that honour it. A
     two-up card row that does not stack still renders as two readable 260px
     columns inside the 640px card, so nothing here depends on the media query
     landing. That is also why the dark overrides all carry !important — they
     are competing with those inline styles.

  3. Transactional and promotional mail are different things and the footer is
     where that becomes visible. A booking confirmation is owed to the guest
     regardless of marketing consent and carries the "do not reply"
     automated-message note; a campaign is promotional and owes the reader a
     postal address, a preferences link and a working unsubscribe. Pass
     footer_variant="marketing" to pick the second; transactional is the
     default so every existing caller is unaffected.

The block vocabulary below (hero band, fact panel, notice, step list,
checklist, story cards, pull quote, closing band) comes from the Visit
Drakensberg Email & Blog Template Pack, re-expressed in the platform's own
tokens: the pack's forest/sandstone palette, Georgia display type and
800-weight labels are NOT used — they are a second brand. What was taken is
the structure: lead with an image, make the facts scannable, end on one
decisive action.
"""

import re
from string import Template
from typing import TypedDict

# Brand tokens, mirroring the site's palette (globals.css / tailwind.config.ts).
INK = "#000000"          # masthead and footer bands
INK_TEXT = "#14140F"     # headings and figures on paper
GOLD = "#C9A96E"         # accent — ink bands only, see note above
SAGE = "#4A7251"         # brand green
CREAM = "#F7F5F2"        # page ground behind the card
CARD = "#FFFFFF"
BORDER = "#E8E5DF"
BODY_TEXT = "#3B3B36"
MUTED = "#6E6E68"
BAND_TEXT = "#C7C7C1"    # body copy on the ink closing band
FOOT_TEXT = "#8E8E88"    # fine print on ink
FOOT_SEP = "#4A4A44"     # separators between footer links

# Dark-mode counterparts. The ink bands already read correctly on a dark
# device, so only the card and its contents flip.
D_PAGE = "#151813"
D_CARD = "#22271F"
D_PANEL = "#1B201A"      # tinted panels, a step down from the card
D_BORDER = "#363C33"
D_TEXT = "#DDE0DA"
D_STRONG = "#F2F4EF"
D_MUTED = "#A0A89A"

# Montserrat Medium (500) for headings, labels and buttons; Regular (400) for
# body copy. Gmail and most of Outlook block webfonts, so the fallback chain
# matters as much as the request: both land on a neutral grotesque rather than
# dropping to a serif.
FONT = "'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif"

CONTAINER = 640          # widest a bordered card goes before Outlook's reading
                         # pane and Gmail mobile start clipping


def esc(value: object) -> str:
    """Escape text interpolated into email HTML.

    Names, listing titles and message bodies are user-controlled, and a stray
    "<" silently breaks the rest of the message in most clients. Every value
    that reaches a template must come through here — the helpers below escape
    their own arguments, so callers only need this for values they interpolate
    into a body_html string themselves.
    """
    if value is None:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;")
    )


# Webfont request plus the two enhancements the inline styles can't express:
# the dark palette, and the narrow-screen padding. Both are additive — a client
# that drops this block still renders the light design correctly.
_STYLE = Template("""<style>
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
      .page { background:$d_page !important; }
      .card { background:$d_card !important; border-color:$d_border !important; }
      .body-cell { background:$d_card !important; color:$d_text !important; }
      .body-cell p, .body-cell li, .body-cell td { color:$d_text !important; }
      .greet, .val, .h2, .body-cell strong { color:$d_strong !important; }
      .lbl, .fine, .cap { color:$d_muted !important; }
      .rule { border-color:$d_border !important; }
      .day { border-color:$d_border !important; background:$d_card !important; }
      /* The hero's own ground, which shows through whenever the image is
         blocked — cream would be a glaring bar on a dark device. */
      .hero, .hero img { background:$d_panel !important; }
      .panel { background:$d_panel !important; }
      .panel p, .panel td, .panel li { color:$d_text !important; }
      .quote { border-color:$gold !important; }
      .ghost { border-color:$d_border !important; }
    }
  </style>""")


def _style_block() -> str:
    return _STYLE.substitute(
        d_page=D_PAGE, d_card=D_CARD, d_panel=D_PANEL, d_border=D_BORDER,
        d_text=D_TEXT, d_strong=D_STRONG, d_muted=D_MUTED, gold=GOLD,
    )


def _marketing_fine(
    origin: str,
    unsubscribe_url: str | None,
    preferences_url: str | None,
    postal_address: str | None,
) -> str:
    """The promotional footer's fine print.

    Says why the reader is getting this, where we are, and how to stop — all
    three, because a campaign that only carries the transactional "do not
    reply" line is the kind of mail that gets a domain blocklisted, quite apart
    from what POPIA asks of it. The unsubscribe link defaults to the site's
    public opt-out page, which works without a login.
    """
    unsubscribe = unsubscribe_url or f"{origin}/unsubscribe"
    manage = (
        f'<a href="{esc(preferences_url)}" style="color:#ffffff;">Manage preferences</a>'
        f'<span style="color:{FOOT_SEP};padding:0 6px;">&middot;</span>'
        if preferences_url else ""
    )
    address = f"{esc(postal_address)} &middot; " if postal_address else ""
    return (
        "You are receiving this because you asked to hear from Visit Drakensberg.\n"
        "        Trip messages for bookings you have already made are sent separately "
        "and are not affected by this preference.<br/><br/>\n"
        f'        Visit Drakensberg &middot; {address}<a href="{origin}" style="color:{FOOT_TEXT};">visitdrakensberg.com</a><br/>\n'
        f'        {manage}<a href="{esc(unsubscribe)}" style="color:#ffffff;">Unsubscribe</a>'
        f'<span style="color:{FOOT_SEP};padding:0 6px;">&middot;</span>&copy; {_year()} Visit Drakensberg'
    )


def _year() -> int:
    from datetime import date
    return date.today().year


def _footer_block(
    origin: str,
    *,
    variant: str = "transactional",
    unsubscribe_url: str | None = None,
    preferences_url: str | None = None,
    postal_address: str | None = None,
) -> str:
    links = (
        ("Packages", "/packages"),
        ("Hikes", "/hikes"),
        ("Stays", "/stays"),
        ("Experiences", "/experiences"),
    )
    separator = f'<span style="color:{FOOT_SEP};padding:0 9px;">&middot;</span>'
    nav = separator.join(
        f'<a href="{origin}{path}" style="color:#ffffff;font-family:{FONT};'
        f'font-weight:500;font-size:11.5px;letter-spacing:.04em;">{label}</a>'
        for label, path in links
    )

    if variant == "marketing":
        fine = _marketing_fine(origin, unsubscribe_url, preferences_url, postal_address)
    else:
        fine = (
            f'Visit Drakensberg &middot; <a href="{origin}" style="color:{FOOT_TEXT};">visitdrakensberg.com</a><br/>\n'
            "        This is an automated message. Please do not reply directly to this email."
        )

    return f"""
  <tr>
    <td class="pad" bgcolor="{INK}" style="background:{INK};padding:28px 44px;">
      <p style="margin:0 0 2px;font-family:{FONT};font-weight:400;font-size:12px;color:#ffffff;">Warm regards,</p>
      <p style="margin:0 0 20px;font-family:{FONT};font-weight:500;font-size:12px;color:{GOLD};">The Visit Drakensberg Team</p>
      <p style="margin:0 0 18px;">{nav}</p>
      <p style="margin:0;font-family:{FONT};font-weight:400;font-size:11px;line-height:1.7;color:{FOOT_TEXT};">
        {fine}
      </p>
    </td>
  </tr>"""


def _hero_band(src: str | None, alt: str | None, caption: str | None) -> str:
    """Full-bleed image directly under the masthead, or nothing.

    `alt` is not optional in spirit: images are blocked by default in Outlook
    and in Gmail for unknown senders, so the alt text IS the hero for a
    meaningful share of the audience. The fallback ground is cream rather than
    a dark placeholder so a blocked image reads as quiet paper with dark alt
    text on it.
    """
    if not src:
        return ""
    caption_row = (
        f"""
          <tr>
            <td class="pad" style="background:{CARD};padding:10px 44px 0;">
              <p class="cap" style="margin:0;font-family:{FONT};font-weight:400;font-size:11px;line-height:1.6;color:{MUTED};">{esc(caption)}</p>
            </td>
          </tr>"""
        if caption else ""
    )
    return f"""
          <tr>
            <td class="hero" style="font-size:0;line-height:0;background:{CREAM};">
              <img src="{esc(src)}" width="{CONTAINER}" alt="{esc(alt)}"
                   style="display:block;width:100%;max-width:{CONTAINER}px;height:auto;border:0;background:{CREAM};" />
            </td>
          </tr>{caption_row}
"""


def email_shell(
    *,
    origin: str,
    heading: str,
    body_html: str,
    preheader: str | None = None,
    eyebrow: str | None = None,
    hero_image_url: str | None = None,
    hero_image_alt: str | None = None,
    hero_caption: str | None = None,
    view_online_url: str | None = None,
    footer_variant: str = "transactional",
    unsubscribe_url: str | None = None,
    preferences_url: str | None = None,
    postal_address: str | None = None,
) -> str:
    """Wrap content in the branded shell shared by every email we send.

    `body_html` is already-built HTML — escape any user values with esc()
    before interpolating them. Everything else is plain text and is escaped
    here.

    `footer_variant` is "transactional" by default, which is what every
    existing caller wants and renders exactly what it rendered before these
    options existed. Pass "marketing" — with a postal address — only for
    promotional mail; see rule 3 in the module docstring.
    """
    preview = preheader if preheader is not None else heading

    # Only swap the masthead to a two-column table when there is a second
    # column to hold — an unconditional table would change the markup every
    # existing transactional email renders today for no gain.
    logo = (
        f'<img src="{origin}/logo-email-onink.png" width="188" alt="Visit Drakensberg"\n'
        f'                   style="display:block;width:188px;height:auto;border:0;" />'
    )
    masthead = (
        f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="left" valign="middle">{logo}</td>
          <td align="right" valign="middle" style="font-family:{FONT};font-weight:400;font-size:11px;">
            <a href="{esc(view_online_url)}" style="color:{FOOT_TEXT};">View in browser</a>
          </td>
        </tr>
      </table>"""
        if view_online_url else logo
    )

    eyebrow_html = (
        f'<p style="margin:0 0 10px;font-family:{FONT};font-weight:500;font-size:10px;'
        f'letter-spacing:.2em;text-transform:uppercase;color:{GOLD};">{esc(eyebrow)}</p>'
        if eyebrow else ""
    )

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!-- Declaring both schemes is what stops Apple Mail and the Gmail app from
     inverting the card on their own terms; the palette below is ours. -->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>{esc(heading)}</title>
<!-- Webfont, requested two ways because clients disagree about which they
     honour, and hidden from Outlook's Word engine, which renders a stray
     block of the stylesheet URL as text if it sees the link. Gmail ignores
     both and falls back down the stack in FONT. -->
<!--[if !mso]><!-->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500&display=swap" />
<!--<![endif]-->
{_style_block()}
</head>
<body class="page" style="margin:0;padding:0;background:{CREAM};">
  <!-- Inbox preview text, hidden in the body itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{esc(preview)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="page" style="background:{CREAM};">
    <tr>
      <td align="center" class="frame" style="padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="{CONTAINER}" class="card"
               style="width:{CONTAINER}px;max-width:100%;background:{CARD};border:1px solid {BORDER};border-radius:4px;overflow:hidden;">

          <tr>
            <td class="pad" bgcolor="{INK}" style="background:{INK};padding:34px 44px 32px;">
              {masthead}
              <div style="width:34px;height:1px;background:{GOLD};margin:22px 0 14px;font-size:0;line-height:0;">&nbsp;</div>
              {eyebrow_html}
              <h1 class="h1" style="margin:0;font-family:{FONT};font-weight:500;font-size:23px;line-height:1.4;letter-spacing:-.01em;color:#ffffff;">{esc(heading)}</h1>
            </td>
          </tr>
{_hero_band(hero_image_url, hero_image_alt, hero_caption)}
          <tr>
            <td class="pad body-cell" style="background:{CARD};padding:32px 44px 38px;font-family:{FONT};font-weight:400;font-size:14px;line-height:1.75;color:{BODY_TEXT};">
              {body_html}
            </td>
          </tr>

          {_footer_block(origin, variant=footer_variant, unsubscribe_url=unsubscribe_url, preferences_url=preferences_url, postal_address=postal_address)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def greeting(name: str | None) -> str:
    """Opening line. Falls back the way the frontend's templates do."""
    return (
        f'<p class="greet" style="margin:0 0 18px;font-family:{FONT};font-weight:500;'
        f'font-size:14.5px;color:{INK_TEXT};">Hi {esc(name or "there")},</p>'
    )


def paragraph(html: str, *, last: bool = False) -> str:
    """A body paragraph. `html` may carry inline markup, so escape values first."""
    return f'<p style="margin:0 0 {"0" if last else "16px"};">{html}</p>'


def cta_button(href: str, label: str, variant: str = "primary") -> str:
    """Call-to-action button.

    The padding sits on the <td> rather than the <a> because Outlook's Word
    engine ignores padding on an inline-block anchor, which collapses the
    button to a tight box of text.

    "primary" (sage on paper) is the default and the only one most mail needs —
    one primary CTA per email is worth keeping. "gold" is for the ink closing
    band, where gold finally has the ground to earn its contrast. "ghost" is an
    outlined secondary for the rare email with two genuine destinations.
    """
    if variant == "gold":
        skin = f"background:{GOLD};border-radius:3px;padding:14px 28px;"
        ink = INK_TEXT
    elif variant == "ghost":
        skin = f"border:1px solid {BORDER};border-radius:3px;padding:13px 27px;"
        ink = INK_TEXT
    else:
        skin = f"background:{SAGE};border-radius:3px;padding:14px 28px;"
        ink = "#ffffff"
    cls = ' class="ghost"' if variant == "ghost" else ""

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
    <tr>
      <td{cls} style="{skin}">
        <a href="{esc(href)}" style="display:inline-block;font-family:{FONT};font-weight:500;font-size:12.5px;letter-spacing:.06em;color:{ink};">{esc(label)}</a>
      </td>
    </tr>
  </table>"""


def detail_table(
    rows: list[tuple[str, str]],
    total: tuple[str, str] | None = None,
) -> str:
    """Label/value summary table.

    Pass the headline figure as `total` to have it set larger below the rule —
    the price of a booking, the balance on an invoice.
    """
    body = "".join(
        f"""<tr>
      <td class="lbl rule" style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:{FONT};font-weight:400;font-size:11px;letter-spacing:.03em;color:{MUTED};">{esc(key)}</td>
      <td class="val rule" align="right" style="padding:10px 0;border-bottom:1px solid {BORDER};font-family:{FONT};font-weight:500;font-size:12px;color:{INK_TEXT};">{esc(value)}</td>
    </tr>"""
        for key, value in rows
    )

    total_row = (
        f"""<tr>
        <td class="lbl" style="padding:15px 0 0;font-family:{FONT};font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:{MUTED};">{esc(total[0])}</td>
        <td class="val" align="right" style="padding:15px 0 0;font-family:{FONT};font-weight:500;font-size:17px;color:{INK_TEXT};">{esc(total[1])}</td>
      </tr>"""
        if total else ""
    )

    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"\n'
        f'    class="rule" style="border-top:1px solid {BORDER};margin:4px 0 0;">{body}{total_row}</table>'
    )


def section_label(label: str) -> str:
    """Small uppercase heading for a section inside the body.

    Set in ink rather than gold: gold is legible on the masthead but not on the
    card behind this.
    """
    return (
        f'<p class="lbl" style="margin:28px 0 8px;font-family:{FONT};font-weight:500;'
        f'font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:{MUTED};">{esc(label)}</p>'
    )


def quote_block(text: str) -> str:
    """Someone else's words, quoted back to the reader — an enquiry or a reply.

    pre-wrap rather than <br/> substitution so the sender's own line breaks
    survive without opening a second path for markup to reach the client.
    """
    return (
        f'<div class="quote" style="margin:4px 0 8px;padding:2px 0 2px 16px;border-left:2px solid {GOLD};">'
        f'<p style="margin:0;font-family:{FONT};font-weight:400;font-size:14px;line-height:1.7;'
        f'color:{BODY_TEXT};white-space:pre-wrap;">{esc(text)}</p></div>'
    )


def fine_print(html: str) -> str:
    """Trailing note — records, expiry, "ignore this if it wasn't you"."""
    return (
        f'<p class="fine" style="margin:24px 0 0;font-family:{FONT};font-weight:400;'
        f'font-size:11px;line-height:1.7;color:{MUTED};">{html}</p>'
    )


def lead_paragraph(html: str) -> str:
    """The 60–90 word opening under a headline.

    One size up from body copy, so the eye lands on it before the detail below.
    """
    return (
        f'<p style="margin:0 0 22px;font-family:{FONT};font-weight:400;font-size:16px;'
        f'line-height:1.7;color:{BODY_TEXT};">{html}</p>'
    )


def body_heading(text: str, eyebrow: str | None = None) -> str:
    """An in-body section heading, optionally with an eyebrow above it.

    The eyebrow is MUTED (5.2:1 on paper) rather than gold (2.3:1); the gold
    survives as the short rule above it, where contrast ratios don't apply.
    """
    eyebrow_html = (
        f'<div style="width:26px;height:1px;background:{GOLD};margin:34px 0 12px;font-size:0;line-height:0;">&nbsp;</div>\n'
        f'    <p class="lbl" style="margin:0 0 8px;font-family:{FONT};font-weight:500;font-size:10px;'
        f'letter-spacing:.18em;text-transform:uppercase;color:{MUTED};">{esc(eyebrow)}</p>'
        if eyebrow else ""
    )
    return (
        f'{eyebrow_html}\n'
        f'    <h2 class="h2" style="margin:{"0" if eyebrow else "32px"} 0 12px;font-family:{FONT};font-weight:500;'
        f'font-size:19px;line-height:1.35;letter-spacing:-.01em;color:{INK_TEXT};">{esc(text)}</h2>'
    )


def divider() -> str:
    """A hairline between sections, for digests and newsletters."""
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0;">\n'
        f'    <tr><td class="rule" style="border-top:1px solid {BORDER};font-size:0;line-height:0;">&nbsp;</td></tr>\n'
        f'  </table>'
    )


def text_link(href: str, label: str) -> str:
    """Inline "Read the full story →" link — the secondary action on a card or row."""
    return (
        f'<a href="{esc(href)}" style="font-family:{FONT};font-weight:500;font-size:12.5px;'
        f'letter-spacing:.02em;color:{SAGE};">{esc(label)} &rarr;</a>'
    )


def fact_panel(rows: list[tuple[str, str]], title: str | None = None) -> str:
    """The "where to be, when, and who to call" panel.

    detail_table is a ledger and reads like one; this is the block a guest
    screenshots at 5am in a car park, so it is a tinted panel with a gold rule
    across the top and label/value stacked large enough to read at arm's length.
    """
    body = "".join(
        f"""<tr>
      <td class="lbl" style="padding:0 0 3px;font-family:{FONT};font-weight:400;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:{MUTED};">{esc(key)}</td>
    </tr>
    <tr>
      <td class="val" style="padding:0 0 14px;font-family:{FONT};font-weight:500;font-size:14px;line-height:1.5;color:{INK_TEXT};">{esc(value)}</td>
    </tr>"""
        for key, value in rows
    )
    title_html = (
        f'<p class="val" style="margin:0 0 16px;font-family:{FONT};font-weight:500;font-size:15px;color:{INK_TEXT};">{esc(title)}</p>'
        if title else ""
    )

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="panel"
    style="margin:20px 0 0;background:{CREAM};border-top:3px solid {GOLD};">
    <tr>
      <td style="padding:22px 24px 8px;">
        {title_html}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">{body}</table>
      </td>
    </tr>
  </table>"""


def notice_panel(title: str, html: str, tone: str = "info") -> str:
    """A panel that interrupts: permit conditions, a route-change caveat, a
    truthfully time-bound availability note.

    "caution" is gold-ruled and "info" sage-ruled rather than sitting on an
    amber ground — a fourth background colour would be a new brand colour, and
    the accent rule already carries the distinction. Never use this to
    manufacture urgency; if the note is about availability, it must state when
    it was checked.
    """
    accent = GOLD if tone == "caution" else SAGE
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="panel"
    style="margin:24px 0 0;background:{CREAM};border-left:3px solid {accent};">
    <tr>
      <td style="padding:18px 20px;">
        <p class="val" style="margin:0 0 5px;font-family:{FONT};font-weight:500;font-size:12.5px;color:{INK_TEXT};">{esc(title)}</p>
        <p style="margin:0;font-family:{FONT};font-weight:400;font-size:13px;line-height:1.7;color:{BODY_TEXT};">{html}</p>
      </td>
    </tr>
  </table>"""


def step_list(steps: list[str]) -> str:
    """"What happens next" — the numbered sequence after a confirmation.

    A table rather than an <ol> because Outlook's Word engine indents and
    bullets list items unpredictably, and because the number wants to be a
    quiet figure rather than a browser marker.
    """
    rows = "".join(
        f"""<tr>
      <td valign="top" width="30" style="padding:0 0 14px;font-family:{FONT};font-weight:500;font-size:12px;line-height:1.7;color:{MUTED};">{i + 1}.</td>
      <td valign="top" style="padding:0 0 14px;font-family:{FONT};font-weight:400;font-size:13.5px;line-height:1.7;color:{BODY_TEXT};">{esc(step)}</td>
    </tr>"""
        for i, step in enumerate(steps)
    )
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
        f'style="margin:14px 0 0;">{rows}</table>'
    )


def checklist(items: list[str]) -> str:
    """Two-column packing/essentials checklist.

    The tick is a text character, not an image: images are blocked, and a list
    that loses its markers is a list that loses its meaning. Stacks to one
    column on narrow screens.
    """
    half = -(-len(items) // 2)

    def column(group: list[str]) -> str:
        return "".join(
            f'<p style="margin:0 0 8px;font-family:{FONT};font-weight:400;font-size:13px;line-height:1.6;color:{BODY_TEXT};">\n'
            f'      <span style="color:{SAGE};">&#10003;</span>&nbsp; {esc(item)}</p>'
            for item in group
        )

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:14px 0 0;">
    <tr>
      <td class="col col-first" width="48%" valign="top" style="padding-right:14px;">{column(items[:half])}</td>
      <td class="col" width="52%" valign="top">{column(items[half:])}</td>
    </tr>
  </table>"""


def pull_quote(text: str, attribution: str | None = None) -> str:
    """Editorial pull quote — a line lifted out of a story, set larger.

    Distinct from quote_block, which reproduces what a person actually wrote.
    """
    attribution_html = (
        f'<p class="lbl" style="margin:10px 0 0;font-family:{FONT};font-weight:500;font-size:10.5px;'
        f'letter-spacing:.14em;text-transform:uppercase;color:{MUTED};">{esc(attribution)}</p>'
        if attribution else ""
    )
    return (
        f'<div class="quote" style="margin:26px 0;padding:4px 0 4px 20px;border-left:2px solid {GOLD};">\n'
        f'    <p class="val" style="margin:0;font-family:{FONT};font-weight:400;font-size:17px;line-height:1.55;'
        f'letter-spacing:-.01em;color:{INK_TEXT};">{esc(text)}</p>\n'
        f'    {attribution_html}\n  </div>'
    )


def signature(
    name: str,
    title: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> str:
    """Named contact block for mail a person actually sent — an advisor, an
    account manager.

    Deliberately carries no "Warm regards" of its own: the ink footer below it
    already signs off from the team, and two valedictions in a row read like the
    email was assembled rather than written.
    """
    parts = [
        f'<a href="mailto:{esc(email)}" style="color:{SAGE};">{esc(email)}</a>' if email else "",
        esc(phone) if phone else "",
    ]
    contact = f'<span style="color:{BORDER};padding:0 7px;">&middot;</span>'.join(p for p in parts if p)
    title_html = (
        f'<p class="lbl" style="margin:2px 0 0;font-family:{FONT};font-weight:400;font-size:12px;color:{MUTED};">{esc(title)} &middot; Visit Drakensberg</p>'
        if title else ""
    )
    contact_html = (
        f'<p style="margin:8px 0 0;font-family:{FONT};font-weight:400;font-size:12.5px;color:{MUTED};">{contact}</p>'
        if contact else ""
    )

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="rule" style="margin:32px 0 0;border-top:1px solid {BORDER};">
    <tr>
      <td style="padding:18px 0 0;">
        <p class="val" style="margin:0;font-family:{FONT};font-weight:500;font-size:14px;color:{INK_TEXT};">{esc(name)}</p>
        {title_html}
        {contact_html}
      </td>
    </tr>
  </table>"""


def closing_band(heading: str, href: str, label: str, body: str | None = None) -> str:
    """Ink band above the footer carrying the one decisive action.

    The negative-margin trick that would make it truly edge-to-edge is not
    survivable across Outlook, so it is inset by the body padding instead and
    still reads as a distinct band.
    """
    body_html = (
        f'<p style="margin:0 0 6px;font-family:{FONT};font-weight:400;font-size:13px;line-height:1.65;color:{BAND_TEXT};">{esc(body)}</p>'
        if body else ""
    )
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="{INK}"
    style="margin:36px 0 0;background:{INK};border-radius:3px;">
    <tr>
      <td align="center" style="padding:34px 28px;">
        <p style="margin:0 0 10px;font-family:{FONT};font-weight:500;font-size:18px;line-height:1.4;letter-spacing:-.01em;color:#ffffff;">{esc(heading)}</p>
        {body_html}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:18px auto 0;">
          <tr>
            <td bgcolor="{GOLD}" style="background:{GOLD};border-radius:3px;padding:14px 28px;">
              <a href="{esc(href)}" style="display:inline-block;font-family:{FONT};font-weight:500;font-size:12.5px;letter-spacing:.06em;color:{INK_TEXT};">{esc(label)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>"""


class EmailStoryCard(TypedDict, total=False):
    """Mirrors EmailStoryCard in the frontend's lib/email-layout.ts."""
    href: str
    title: str
    image_src: str
    image_alt: str
    category: str
    summary: str
    link_label: str


def _story_cell(card: EmailStoryCard, first: bool, full: bool) -> str:
    image = (
        f'<img src="{esc(card.get("image_src"))}" width="260" alt="{esc(card.get("image_alt", ""))}"\n'
        f'             style="display:block;width:100%;height:auto;border:0;background:{CREAM};" />'
        if card.get("image_src") else ""
    )
    category = (
        f'<p class="lbl" style="margin:{"16px" if card.get("image_src") else "0"} 0 6px;font-family:{FONT};'
        f'font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:{MUTED};">{esc(card.get("category"))}</p>'
        if card.get("category") else ""
    )
    title_margin = "0" if (card.get("category") or not card.get("image_src")) else "16px"
    summary = (
        f'<p style="margin:0 0 11px;font-family:{FONT};font-weight:400;font-size:13px;line-height:1.6;color:{BODY_TEXT};">{esc(card.get("summary"))}</p>'
        if card.get("summary") else ""
    )
    cls = " col-first" if first and not full else ""
    padding = "padding-right:14px;" if first and not full else ""

    return f"""
    <td class="col{cls}" width="{"100%" if full else "48%"}" valign="top" style="{padding}">
      {image}
      {category}
      <p class="val" style="margin:{title_margin} 0 7px;font-family:{FONT};font-weight:500;font-size:15.5px;line-height:1.35;color:{INK_TEXT};">{esc(card.get("title"))}</p>
      {summary}
      {text_link(card.get("href", ""), card.get("link_label") or "Explore")}
    </td>"""


def story_cards(cards: list[EmailStoryCard]) -> str:
    """Two-up feature cards — "here are two things worth your weekend".

    One card renders full width rather than leaving a hole; more than two wrap
    into further rows of two.
    """
    if not cards:
        return ""

    rows = []
    for i in range(0, len(cards), 2):
        pair = cards[i:i + 2]
        full = len(pair) == 1
        second = (
            ""
            if full else
            f'<td class="col-gap" width="4%" style="font-size:0;line-height:0;">&nbsp;</td>{_story_cell(pair[1], False, False)}'
        )
        spacer = (
            '<tr><td colspan="3" style="font-size:0;line-height:0;height:28px;">&nbsp;</td></tr>'
            if i + 2 < len(cards) else ""
        )
        rows.append(f"""<tr>
      {_story_cell(pair[0], True, full)}
      {second}
    </tr>{spacer}""")

    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
        f'style="margin:20px 0 0;">{"".join(rows)}</table>'
    )


def story_row(story: EmailStoryCard) -> str:
    """Digest row — thumbnail left, copy right.

    The second and third stories in an issue, where a full card each would make
    the email a scroll.
    """
    thumb = (
        f"""<td class="col thumb" width="36%" valign="top" style="padding-right:18px;">
        <img src="{esc(story.get("image_src"))}" width="190" alt="{esc(story.get("image_alt", ""))}"
             style="display:block;width:100%;height:auto;border:0;background:{CREAM};" />
      </td>"""
        if story.get("image_src") else ""
    )
    category = (
        f'<p class="lbl" style="margin:0 0 6px;font-family:{FONT};font-weight:500;font-size:10px;'
        f'letter-spacing:.14em;text-transform:uppercase;color:{MUTED};">{esc(story.get("category"))}</p>'
        if story.get("category") else ""
    )
    summary = (
        f'<p style="margin:0 0 11px;font-family:{FONT};font-weight:400;font-size:13px;line-height:1.6;color:{BODY_TEXT};">{esc(story.get("summary"))}</p>'
        if story.get("summary") else ""
    )

    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0 0;">
    <tr>
      {thumb}
      <td class="col" valign="top">
        {category}
        <p class="val" style="margin:0 0 7px;font-family:{FONT};font-weight:500;font-size:15.5px;line-height:1.35;color:{INK_TEXT};">{esc(story.get("title"))}</p>
        {summary}
        {text_link(story.get("href", ""), story.get("link_label") or "Read the story")}
      </td>
    </tr>
  </table>"""


class EmailItineraryDay(TypedDict, total=False):
    """Mirrors EmailItineraryDay in the frontend's lib/email-layout.ts."""
    day_number: int
    date_label: str
    label: str
    description: str
    accommodation: str
    transport: str
    meals: str
    distance: str
    elevation: str


def _email_paragraphs(text: str) -> str:
    """Split freeform itinerary notes into paragraphs on line breaks.

    Mirrors the web itinerary accordion so a day's write-up reads as distinct,
    well-spaced paragraphs rather than one dense block — email clients ignore
    <details>/JS toggles too inconsistently to rely on for the accordion
    interaction itself, so this block stays fully expanded and leans on title
    composition and paragraph spacing to carry readability instead.
    """
    return "".join(
        f'<p style="margin:0 0 8px;font-family:{FONT};font-weight:400;font-size:13px;'
        f'color:{BODY_TEXT};line-height:1.7;">{esc(part)}</p>'
        for part in (p.strip() for p in re.split(r"\n+", text))
        if part
    )


def itinerary_block(days: list[EmailItineraryDay]) -> str:
    """Day-by-day itinerary cards."""
    if not days:
        return ""

    rows = []
    for day in days:
        meta = " &middot; ".join(v for v in (day.get("distance"), day.get("elevation")) if v)
        facts = [
            f'Overnight: {day["accommodation"]}' if day.get("accommodation") else "",
            f'Transport: {day["transport"]}' if day.get("transport") else "",
            f'Meals: {day["meals"]}' if day.get("meals") else "",
        ]
        facts = [f for f in facts if f]
        label_html = (
            f'<p class="val" style="margin:0 0 4px;font-family:{FONT};font-weight:500;font-size:13.5px;color:{INK_TEXT};">{esc(day.get("label"))}</p>'
            if day.get("label") else ""
        )
        meta_html = (
            f'<p class="lbl" style="margin:0 0 10px;font-family:{FONT};font-weight:400;font-size:11.5px;color:{MUTED};">{meta}</p>'
            if meta else ""
        )
        facts_html = (
            f'<div class="rule" style="margin-top:10px;padding-top:10px;border-top:1px solid {BORDER};">\n'
            + " " * 16
            + "".join(
                f'<p class="lbl" style="margin:2px 0 0;font-family:{FONT};font-weight:400;font-size:11.5px;color:{MUTED};">{esc(f)}</p>'
                for f in facts
            )
            + "\n              </div>"
            if facts else ""
        )

        rows.append(f"""
    <tr>
      <td style="padding:0 0 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="day" style="border:1px solid {BORDER};border-radius:3px;background:{CARD};">
          <tr>
            <td style="padding:16px 18px;">
              <p class="lbl" style="margin:0 0 4px;font-family:{FONT};font-weight:500;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:{MUTED};">Day {day.get("day_number")} &middot; {esc(day.get("date_label"))}</p>
              {label_html}
              {meta_html}
              {_email_paragraphs(day["description"]) if day.get("description") else ""}
              {facts_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>""")

    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" '
        f'style="margin:8px 0 0;">{"".join(rows)}</table>'
    )
