// SERVER ONLY — the campaign builder's starting points.
//
// These are the four promotional templates from the Visit Drakensberg Email &
// Blog Template Pack, rebuilt out of lib/email-layout.ts's blocks so they
// inherit the platform's palette, type and dark-mode handling instead of
// carrying a second brand's forest/sandstone/Georgia styling. The pack's other
// two templates are transactional — a booking confirmation and a pre-trip
// readiness note — and deliberately do NOT live here: campaigns are
// promotional by construction (vd_campaign_dry_run_send() intersects every
// audience with marketing_consent), so a booking confirmation composed as a
// campaign would be sent to the wrong people or to nobody. Their structure went
// into the transactional send path instead — see
// app/api/departure-guests/send-confirmation.
//
// Why these are generated here rather than stored as literal HTML in a client
// module: the admin edits the result as HTML in a textarea, so the body has to
// become a plain string at some point — but it should become one from the
// block helpers, once, at the moment the admin asks for it. A second hand-kept
// copy of the same markup is the exact drift this whole file set exists to
// prevent. The route that serves these is app/api/admin/campaigns/starters.
//
// There is no merge-tag engine. Nothing substitutes {{first_name}} or any
// other token on the way out — the only "send" that exists today is a dry run
// (see supabase/migrations/20260825_email_campaign_foundation.sql). So the copy
// below is finished, sendable prose, and the handful of decisions left to the
// editor are marked in square brackets, which are visible in the live preview
// and impossible to mistake for something the system will fill in.

import {
  bodyHeading, checklist, closingBand, ctaButton, divider, factPanel,
  leadParagraph, noticePanel, paragraph, pullQuote, signature, storyCards,
  storyRow, textLink,
} from './email-layout'

/** Obviously-wrong on purpose: a broken image in the live preview is a to-do the editor can see. */
const PLACEHOLDER_IMAGE = 'https://replace-me.invalid/your-image.jpg'

export type EmailStarter = {
  id: string
  name: string
  /** One line explaining when to reach for this one. */
  description: string
  subject: string
  preheader: string
  /** Suggested alt text for the hero, so the field is never left empty. */
  heroAlt: string
  /** Built lazily so the site origin can be woven into the links. */
  build: (origin: string) => string
}

export const EMAIL_STARTERS: EmailStarter[] = [
  {
    id: 'seasonal-newsletter',
    name: 'Seasonal newsletter',
    description: 'Monthly issue: one season, one story, two things to book, one piece of practical advice.',
    subject: 'The berg in [month]: what is worth the drive',
    preheader: 'One story, two places to stay or walk, and what the weather is actually doing.',
    heroAlt: '[Describe the hero photograph: the place, the season, the light]',
    build: origin => [
      leadParagraph(`[Open with 60–90 words connecting the season to what follows. Say what has changed
        in the mountains since the last issue — the grass, the water, the crowds, the light — and let
        that lead into the story and the two recommendations below. Do not start with "We are excited
        to announce".]`),
      ctaButton(`${origin}/packages`, 'Plan a trip this season'),
      bodyHeading('[Story headline — a claim, not a label]', 'Featured story'),
      paragraph(`[45–70 words. Say what the story is about AND why it matters to someone planning a
        trip. A summary that only teases costs you the click from the reader who would have come.]`),
      textLink(`${origin}/stories`, 'Read the full story'),
      divider(),
      bodyHeading('Two to plan around', 'This month'),
      storyCards([
        {
          href: `${origin}/stays`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Stay]',
          title: '[Name of the property or area]',
          summary: '[Why this one, this month. One concrete detail beats three adjectives.]',
          linkLabel: 'See the stay',
        },
        {
          href: `${origin}/hikes`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Walk]',
          title: '[Name of the route]',
          summary: '[Distance, the shape of the day, and what the conditions are like right now.]',
          linkLabel: 'See the route',
        },
      ]),
      bodyHeading('[What to know before you book]', 'Plan well'),
      paragraph(`[Weather, road access, permits, water, booking lead times. Whatever is genuinely
        useful this month — and nothing that is not.]`),
      noticePanel(
        'Conditions change',
        `[State when this was last checked, and say plainly that mountain weather and road access can
         change without notice. Give the source for anything a reader might act on.]`,
        'caution',
      ),
      closingBand({
        heading: 'The mountains are only the beginning.',
        body: 'Stays, guided walks and ground transport, planned as one trip.',
        href: origin,
        label: 'Explore Visit Drakensberg',
      }),
    ].join('\n'),
  },

  {
    id: 'story-digest',
    name: 'Story digest',
    description: 'Editorial issue: a lead story and two shorter ones, sending readers to the blog.',
    subject: '[Field notes: the line that makes someone open this]',
    preheader: 'Three new ways to understand the range you are about to walk into.',
    heroAlt: '[Describe the lead photograph]',
    build: origin => [
      leadParagraph(`[55–80 words tying this issue's three stories together. There should be a reason
        they are in the same email — say what it is.]`),
      bodyHeading('[Lead story headline]', '[Category] · [n] min read'),
      paragraph('[Summarise the subject and the stake. What does the reader come away knowing?]'),
      pullQuote(
        '[A line lifted from the story itself — one that carries information, not just atmosphere.]',
        '[Attribution, if the line is someone else\'s]',
      ),
      textLink(`${origin}/stories`, 'Read the story'),
      divider(),
      storyRow({
        href: `${origin}/stories`,
        imageSrc: PLACEHOLDER_IMAGE,
        imageAlt: '[Describe this photograph]',
        category: '[Category]',
        title: '[Second story headline]',
        summary: '[One or two sentences. Subject first, then why it is worth the read.]',
      }),
      divider(),
      storyRow({
        href: `${origin}/stories`,
        imageSrc: PLACEHOLDER_IMAGE,
        imageAlt: '[Describe this photograph]',
        category: '[Category]',
        title: '[Third story headline]',
        summary: '[One or two sentences.]',
      }),
      closingBand({
        heading: 'Read the landscape. Then go and see it.',
        body: 'Turn what you have just read into a route, a bed and a date.',
        href: `${origin}/packages`,
        label: 'Start planning',
      }),
    ].join('\n'),
  },

  {
    id: 'enquiry-follow-up',
    name: 'Enquiry follow-up',
    description: 'Sent 7–10 days after an enquiry that has not converted. One recommendation, honestly framed.',
    subject: 'Still thinking about [the place or trip they asked about]?',
    preheader: 'A practical next step for the trip you asked us about.',
    heroAlt: '[Describe the photograph — ideally of the place they enquired about]',
    build: origin => [
      paragraph('Hello [first name],'),
      leadParagraph(`I wanted to check whether you need anything else to make a decision. Based on what
        you asked for — [dates or month] for [number] guests — this is still the closest fit we have.`),
      bodyHeading('[Name of the recommended trip or stay]', 'Recommended for you'),
      factPanel([
        ['What it is', '[One line: the route, the nights, the shape of it]'],
        ['When', '[Dates or departure]'],
        ['From', '[R0 000 per person sharing]'],
      ]),
      paragraph(`[Two or three sentences saying why this one, for them specifically: their dates, group
        size, transport, and the difficulty or comfort level they asked about. If it is a compromise on
        something they wanted, say which thing.]`),
      bodyHeading('What is included'),
      checklist([
        '[Inclusion]', '[Inclusion]', '[Inclusion]', '[Inclusion]',
      ]),
      paragraph('<strong>Not included:</strong> [list the exclusions plainly — this is where trust is won or lost].'),
      noticePanel(
        'Availability',
        `[Availability was checked on [date] and remains subject to confirmation.] Say only what is
         true, with the date you checked. Never invent a countdown.`,
      ),
      ctaButton(`${origin}/packages`, 'Continue planning'),
      paragraph(`Or just reply with the one thing you would change — dates, budget, difficulty,
        transport or where you sleep — and I will rework it.`),
      signature({
        name: '[Your name]',
        title: '[Your role]',
        email: '[you@visitdrakensberg.com]',
        phone: '[+27 00 000 0000]',
      }),
    ].join('\n'),
  },

  {
    id: 'list-with-us',
    name: 'Listing invitation',
    description: 'Invites an establishment, guide or transport operator to list on the platform.',
    subject: 'An invitation to list [business name] on Visit Drakensberg',
    preheader: 'Put your business in front of travellers already planning the trip.',
    heroAlt: '[Describe the photograph — the region, or the business itself]',
    build: origin => [
      paragraph('Hello [contact first name],'),
      leadParagraph(`Visit Drakensberg helps travellers put a whole trip together in one place:
        somewhere to sleep, a way to get there, and the guided walks, culture and nature in between.
        We would like [business name] to be part of it.`),
      bodyHeading('Why it works differently', 'The proposition'),
      paragraph('<strong>Destination-first discovery.</strong> Guests find you inside a region, a route or a finished itinerary — not in an undifferentiated list of search results.'),
      paragraph('<strong>Visibility that is earned.</strong> Placement follows listing quality, live availability, how fast you respond and your commission tier. It is never commission alone.'),
      paragraph('<strong>Bookings that support each other.</strong> A bed, a transfer and a guided day sold together are worth more to you than any one of them sold alone.'),
      bodyHeading('What onboarding needs from you', 'Practical'),
      checklist([
        'Business and contact details',
        'A description and exact location',
        'High-resolution photographs',
        'Rates or rate plans',
        'Cancellation and child policies',
        'Facilities or inclusions',
        'How availability is managed',
        'Banking and compliance details',
      ]),
      noticePanel(
        'Commercial terms',
        `[Insert the approved tier summary: minimum commission, payment-processing or handling fees,
         how cancellations are treated, and whether listed prices must match your direct public rates.]`,
      ),
      ctaButton(`${origin}/list-with-us`, 'Review listing options'),
      signature({
        name: '[Your name]',
        title: '[Your role]',
        email: '[you@visitdrakensberg.com]',
        phone: '[+27 00 000 0000]',
      }),
    ].join('\n'),
  },
]
