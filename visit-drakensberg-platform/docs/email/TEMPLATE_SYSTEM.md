# Email template system

Every email the platform sends — a password reset, a booking confirmation, a
seasonal newsletter — is composed from one design system with two
implementations that must stay in step:

| File | Sends |
|---|---|
| `frontend/lib/email-layout.ts` | Next.js route handlers, over SMTP (`lib/mailer.ts`) |
| `backend/app/services/email_layout.py` | FastAPI, over Resend |
| `frontend/lib/email-tokens.ts` | The palette and type, imported by the TS side and **copied** by the Python side |

A guest who gets a booking confirmation from one and a payment receipt from the
other must not be able to tell. A change to the shell or to a block belongs in
**both** files, and the two are expected to produce byte-identical HTML for the
same inputs.

## Where this came from

The block vocabulary below was taken from the *Visit Drakensberg Email & Blog
Template Pack* and re-expressed in the platform's own tokens. What was adopted
is the pack's **structure** — lead with an image, make the practical facts
scannable, end on one decisive action. What was deliberately **not** adopted is
its styling: the pack ships a second brand (forest `#123C2D`, sandstone
`#F2EEE5`, Georgia display type, 800-weight labels) that does not match the
site. Its gold-on-white eyebrows are also 2.3:1, under the 4.5:1 floor; here
eyebrows are set in `MUTED` and the gold survives as the rule above them.

The pack's blog templates are a separate concern and were not brought in — they
describe a CMS page, not an email.

## The two footers

This is the distinction most easily got wrong, and the shell makes it explicit:

- **Transactional** (the default). Booking confirmations, receipts, invoices,
  waivers, password resets. Owed to the recipient regardless of marketing
  consent. Carries the "this is an automated message, please do not reply" note
  and no unsubscribe — there is nothing to unsubscribe *from*.
- **Marketing** (`footer: { variant: 'marketing' }`). Everything the admin
  campaign builder composes. `vd_campaign_dry_run_send()` intersects every
  audience with `marketing_consent`, so a campaign is promotional by
  construction and owes its reader a postal address, a preferences link and a
  working unsubscribe (`/unsubscribe`, public and login-free).

`EMAIL_POSTAL_ADDRESS` supplies the address. It is read from the environment
rather than hardcoded so nobody ships a guessed one; when unset the line is
omitted, visibly, in the campaign preview.

## Blocks

Compose a body out of these rather than hand-writing markup — each one escapes
its own arguments, carries the inline styles it needs to survive Outlook, and
tags itself with the class hooks the dark-mode and stacking rules key off.

| Block | Use it for |
|---|---|
| `greeting` / `paragraph` / `leadParagraph` | Opening line, body copy, the 60–90 word intro |
| `bodyHeading(text, eyebrow?)` | A section heading inside the body |
| `sectionLabel` | The smaller uppercase label above a list or table |
| `divider` | A hairline between sections of a digest |
| `detailTable(rows, total?)` | The ledger: what was bought, what is owed |
| `factPanel(rows, title?)` | Where to be, when, who to call — the block a guest screenshots |
| `noticePanel(title, html, tone)` | Permits, route-change caveats, a time-bound availability note |
| `stepList(steps)` | "What happens next" |
| `checklist(items)` | Kit lists, inclusions — two columns, stacking |
| `storyCards(cards)` / `storyRow(story)` | Two-up features; a digest's thumb-and-copy row |
| `pullQuote` / `quoteBlock` | A line lifted from a story; words someone actually wrote to us |
| `itineraryBlock(days)` | Day-by-day trip detail |
| `ctaButton(href, label, variant)` | One primary action. `gold` is for ink grounds only |
| `textLink` | The secondary "Read the full story →" |
| `closingBand` | The ink band above the footer carrying the final action |
| `signature` | Who wrote it and how to reach them (no valediction — the footer has one) |
| `finePrint` | Records notes, cancellation terms |

### Rules that are not stylistic preferences

1. **Gold never appears as type on paper.** `#C9A96E` is 2.3:1 on white and
   9.3:1 on black, so it lives on the ink bands and, on the card, only as a
   rule or keyline where contrast ratios don't apply.
2. **Hero images need alt text.** Outlook blocks images by default and so does
   Gmail for a sender the reader has not written to. For a large share of any
   campaign's audience the alt text *is* the hero. The admin form refuses to
   save a hero without it.
3. **The `<style>` block is progressive enhancement.** Every element carries
   the inline styles it needs to stand alone. Nothing depends on the media
   query landing — a two-up row that does not stack still renders as two
   readable 260px columns inside the 640px card.
4. **Escape everything user-controlled** with `esc()`. The blocks escape their
   own arguments; `noticePanel` and `paragraph` take HTML, so escape values
   before interpolating them there.
5. **One primary CTA.** Secondary destinations are `textLink`s.

## Campaign starters

`frontend/lib/email-starters.ts` holds eleven starting points, built from the
blocks above and served to the admin form by
`app/api/admin/campaigns/starters`. They are generated server-side on request
rather than stored as literal HTML in a client module, so there is never a
second copy of the markup to drift.

Each carries an `audience` tag, because the two recipient lists are not
interchangeable — customer copy addresses a traveller as "you" about their own
trip, contact copy addresses a business about listing with us:

| Audience | Starters |
|---|---|
| `customers` | Seasonal newsletter · Story digest · Enquiry follow-up · Region spotlight · What to book now · Event announcement · Win-back |
| `contacts` | Listing invitation · Outreach first approach · Outreach follow-up · Partner update |

The tag sorts the picker; it never restricts it.

**There is no merge-tag engine.** Nothing substitutes `{{first_name}}` on the
way out; the only send that exists today is a dry run. The starters therefore
carry finished prose with the editorial decisions marked in square brackets,
which are visible in the live preview and cannot be mistaken for something the
system will fill in.

The pack's two transactional templates are not starters, because a campaign's
audience is marketing-consented by construction and a booking confirmation
composed as a campaign would reach the wrong people. Their structure went into
the real send path instead — `app/api/departure-guests/send-confirmation`,
which now leads on the trail photograph, puts the meeting point and guide in a
`factPanel`, spells out what happens next, and carries the trail's own kit list,
permit requirement and a conditions caveat. Every one of those fields is read
from data the platform already holds; nothing about permits, weather or safety
is invented, and nothing is promised on the operator's behalf.

## Changing the design system

1. Change `email-layout.ts`, then make the identical change in
   `email_layout.py`. Render the same inputs through both and diff.
2. Render before/after through the existing transactional callers and check the
   diff is limited to what you intended — twelve routes compose this shell.
3. Check dark mode (`prefers-color-scheme: dark`) and a narrow viewport.
4. If you added a colour, add it to `email-tokens.ts` and check its contrast on
   the ground it will actually sit on.


## Sending

There are two send paths, and the difference between them is the whole reason
either is safe.

### Segment campaigns — dry run

`vd_campaign_dry_run_send()` resolves the real consented audience, records the
count and the outcome, and **delivers nothing**. Pointing the business SMTP
mailbox at an entire segment is what the 20260825 migration header rules out:
no bounce or complaint webhooks, no provider-side suppression list, and real
reputation risk at volume. That stays true and that path stays a dry run until
an ESP is wired in.

### Hand-picked recipients — real delivery

`app/api/admin/campaigns/send`, driven by `/admin/campaigns/send`, actually
sends. The objection above is about *bulk*, not about volume in the abstract:
fifty individually addressed messages, each recipient chosen by a human, is
ordinary business correspondence. What keeps it that way:

- **A hard cap of 50 per send**, enforced in the route, not just the UI.
- **One message per recipient**, each with its own unsubscribe link. Never a
  shared BCC — a shared unsubscribe link cannot identify who clicked it, and a
  BCC list is one misconfiguration away from disclosing the whole list.
- **A per-recipient consent check at send time**, against `vd_consent_state()`.
  What the picker shows is advisory; the server decides.
- **Every attempt logged** to `vd_email_sends` — successes, skips and failures
  alike, through the service role, against a table with a read policy for
  admins and no write policy at all.

### The consent rule

`frontend/lib/email-consent.ts` states it once, and both the picker and the
send route import exactly that function:

| Recipient kind | `granted` | `withdrawn` | `unknown` |
|---|---|---|---|
| `customer` — a person, consumer marketing, **opt-in** | send | skip | **skip** |
| `contact` — a business, B2B outreach, **opt-out** | send | skip | **send** |

Silence is not consent from a person; from a business that has not refused an
approach, it is not a refusal either. `vd_is_subscribed()` cannot express this —
it coalesces a missing record to `false` — which is why `vd_consent_state()`
exists and returns three states rather than two.

The module has no imports and must keep none: the send route needs the rule,
and `lib/email-recipients.ts` pulls in the browser Supabase client, which must
never reach a route handler's server bundle.
