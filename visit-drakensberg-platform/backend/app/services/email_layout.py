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

  1. logo-email.png is WHITE artwork on a transparent background, so it is
     invisible on anything light. It may only ever be placed on the ink bands
     (the masthead and the footer). The same measurement rules out brand gold
     on the card: #C9A96E is 2.3:1 on white against a 4.5:1 floor, but 9.3:1
     on black, so gold appears on the ink bands and nowhere else.

  2. The <style> block is a progressive enhancement, not the design. Gmail and
     Outlook drop or mangle parts of it, so every element carries the inline
     styles it needs to stand alone; the block only adds the dark-mode and
     narrow-screen refinements on clients that honour it. That is also why the
     dark overrides all carry !important — they are competing with those
     inline styles.
"""

from string import Template

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
FOOT_TEXT = "#8E8E88"    # fine print on ink
FOOT_SEP = "#4A4A44"     # separators between footer links

# Dark-mode counterparts. The ink bands already read correctly on a dark
# device, so only the card and its contents flip.
D_PAGE = "#0F1210"
D_CARD = "#1A1D1A"
D_BORDER = "#2C312C"
D_TEXT = "#D9DCD6"
D_STRONG = "#F2F4EF"
D_MUTED = "#9AA096"

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
      .h1 { font-size:24px !important; }
      .frame { padding:14px 0 !important; }
    }

    @media (prefers-color-scheme: dark) {
      .page { background:$d_page !important; }
      .card { background:$d_card !important; border-color:$d_border !important; }
      .body-cell { background:$d_card !important; color:$d_text !important; }
      .body-cell p, .body-cell li, .body-cell td { color:$d_text !important; }
      .greet, .val, .body-cell strong { color:$d_strong !important; }
      .lbl, .fine { color:$d_muted !important; }
      .rule { border-color:$d_border !important; }
      .quote { border-color:$gold !important; }
    }
  </style>""")


def _style_block() -> str:
    return _STYLE.substitute(
        d_page=D_PAGE, d_card=D_CARD, d_border=D_BORDER,
        d_text=D_TEXT, d_strong=D_STRONG, d_muted=D_MUTED, gold=GOLD,
    )


def _footer_block(origin: str) -> str:
    links = (
        ("Packages", "/packages"),
        ("Hikes", "/hikes"),
        ("Stays", "/stays"),
        ("Experiences", "/experiences"),
    )
    separator = f'<span style="color:{FOOT_SEP};padding:0 9px;">&middot;</span>'
    nav = separator.join(
        f'<a href="{origin}{path}" style="color:#ffffff;font-family:{FONT};'
        f'font-weight:500;font-size:12px;letter-spacing:.04em;">{label}</a>'
        for label, path in links
    )

    return f"""
  <tr>
    <td class="pad" style="background:{INK};padding:30px 40px;">
      <p style="margin:0 0 2px;font-family:{FONT};font-weight:400;font-size:13px;color:#ffffff;">Warm regards,</p>
      <p style="margin:0 0 20px;font-family:{FONT};font-weight:500;font-size:13px;color:{GOLD};">The Visit Drakensberg Team</p>
      <p style="margin:0 0 18px;">{nav}</p>
      <p style="margin:0;font-family:{FONT};font-weight:400;font-size:11.5px;line-height:1.7;color:{FOOT_TEXT};">
        Visit Drakensberg &middot; <a href="{origin}" style="color:{FOOT_TEXT};">visitdrakensberg.com</a><br/>
        This is an automated message — please do not reply directly to this email.
      </p>
    </td>
  </tr>"""


def email_shell(
    *,
    origin: str,
    heading: str,
    body_html: str,
    preheader: str | None = None,
    eyebrow: str | None = None,
) -> str:
    """Wrap content in the branded shell shared by every email we send.

    `body_html` is already-built HTML — escape any user values with esc()
    before interpolating them. `heading`, `preheader` and `eyebrow` are plain
    text and are escaped here.
    """
    preview = preheader if preheader is not None else heading

    eyebrow_html = (
        f'<p style="margin:0 0 10px;font-family:{FONT};font-weight:500;font-size:11px;'
        f'letter-spacing:.22em;text-transform:uppercase;color:{GOLD};">{esc(eyebrow)}</p>'
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
            <td class="pad" style="background:{INK};padding:38px 40px 34px;">
              <img src="{origin}/logo-email.png" width="196" alt="Visit Drakensberg"
                   style="display:block;width:196px;height:auto;border:0;" />
              <div style="width:34px;height:1px;background:{GOLD};margin:26px 0 16px;font-size:0;line-height:0;">&nbsp;</div>
              {eyebrow_html}
              <h1 class="h1" style="margin:0;font-family:{FONT};font-weight:500;font-size:28px;line-height:1.28;letter-spacing:-.01em;color:#ffffff;">{esc(heading)}</h1>
            </td>
          </tr>

          <tr>
            <td class="pad body-cell" style="background:{CARD};padding:36px 40px 40px;font-family:{FONT};font-weight:400;font-size:15px;line-height:1.75;color:{BODY_TEXT};">
              {body_html}
            </td>
          </tr>

          {_footer_block(origin)}

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
        f'font-size:16px;color:{INK_TEXT};">Hi {esc(name or "there")},</p>'
    )


def paragraph(html: str, *, last: bool = False) -> str:
    """A body paragraph. `html` may carry inline markup, so escape values first."""
    return f'<p style="margin:0 0 {"0" if last else "16px"};">{html}</p>'


def cta_button(href: str, label: str) -> str:
    """Primary call-to-action button.

    The padding sits on the <td> rather than the <a> because Outlook's Word
    engine ignores padding on an inline-block anchor, which collapses the
    button to a tight box of text.
    """
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
    <tr>
      <td style="background:{SAGE};border-radius:3px;padding:15px 32px;">
        <a href="{esc(href)}" style="display:inline-block;font-family:{FONT};font-weight:500;font-size:13.5px;letter-spacing:.06em;color:#ffffff;">{esc(label)}</a>
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
      <td class="lbl rule" style="padding:11px 0;border-bottom:1px solid {BORDER};font-family:{FONT};font-weight:400;font-size:12px;letter-spacing:.03em;color:{MUTED};">{esc(key)}</td>
      <td class="val rule" align="right" style="padding:11px 0;border-bottom:1px solid {BORDER};font-family:{FONT};font-weight:500;font-size:13px;color:{INK_TEXT};">{esc(value)}</td>
    </tr>"""
        for key, value in rows
    )

    total_row = (
        f"""<tr>
        <td class="lbl" style="padding:16px 0 0;font-family:{FONT};font-weight:500;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:{MUTED};">{esc(total[0])}</td>
        <td class="val" align="right" style="padding:16px 0 0;font-family:{FONT};font-weight:500;font-size:20px;color:{INK_TEXT};">{esc(total[1])}</td>
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
        f'<p class="lbl" style="margin:30px 0 8px;font-family:{FONT};font-weight:500;'
        f'font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:{MUTED};">{esc(label)}</p>'
    )


def quote_block(text: str) -> str:
    """Someone else's words, quoted back to the reader — an enquiry or a reply.

    pre-wrap rather than <br/> substitution so the sender's own line breaks
    survive without opening a second path for markup to reach the client.
    """
    return (
        f'<div class="quote" style="margin:4px 0 8px;padding:2px 0 2px 16px;border-left:2px solid {GOLD};">'
        f'<p style="margin:0;font-family:{FONT};font-weight:400;font-size:15px;line-height:1.7;'
        f'color:{BODY_TEXT};white-space:pre-wrap;">{esc(text)}</p></div>'
    )


def fine_print(html: str) -> str:
    """Trailing note — records, expiry, "ignore this if it wasn't you"."""
    return (
        f'<p class="fine" style="margin:24px 0 0;font-family:{FONT};font-weight:400;'
        f'font-size:11.5px;line-height:1.7;color:{MUTED};">{html}</p>'
    )
