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
  bodyHeading, checklist, closingBand, ctaButton, divider, factPanel, greeting,
  leadParagraph, noticePanel, paragraph, pullQuote, signature, stepList,
  storyCards, storyRow, textLink,
} from './email-layout'

/** Obviously-wrong on purpose: a broken image in the live preview is a to-do the editor can see. */
const PLACEHOLDER_IMAGE = 'https://replace-me.invalid/your-image.jpg'

/**
 * Which recipient list a starter is written for. There are two, and they are
 * not interchangeable: `customers` copy addresses a traveller as "you" about
 * their own trip, `contacts` copy addresses a business about listing with us.
 * The send screen uses this to sort the list, never to restrict it — an admin
 * who genuinely wants to send a newsletter to an operator can.
 */
export type EmailStarterAudience = 'customers' | 'contacts'

export type EmailStarter = {
  id: string
  name: string
  audience: EmailStarterAudience
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
    audience: 'customers',
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
    audience: 'customers',
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
    audience: 'customers',
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
    audience: 'contacts',
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
  {
    id: 'region-spotlight',
    name: 'Region spotlight',
    audience: 'customers',
    description: 'One region or town in depth — where it is, what it is for, and what to book while you are there.',
    subject: '[Region]: what it is actually like, and when to go',
    preheader: 'Where to sleep, what to walk, and the month that suits it best.',
    heroAlt: '[Describe the hero photograph: the landmark or valley that identifies this region]',
    build: origin => [
      leadParagraph(`[60–90 words placing the region. What is it near, how long is the drive, and what does it
        do better than anywhere else in the range? Write for someone who has heard the name and nothing more.]`),
      factPanel([
        ['Drive from Johannesburg', '[0h00]'],
        ['Drive from Durban', '[0h00]'],
        ['Best months', '[Months, and why]'],
        ['Suits', '[Families / experienced walkers / a first visit]'],
      ], 'At a glance'),
      bodyHeading('[What the walking is like]', 'On foot'),
      paragraph(`[Be specific about grade and exposure. Say what a fit beginner can do here and what they
        cannot. Never describe a route as safe — state the hazard and the competence it asks for.]`),
      bodyHeading('Where to stay', 'Beds'),
      storyCards([
        {
          href: `${origin}/stays`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Style of stay]',
          title: '[Property name]',
          summary: '[Who it suits and what it is near.]',
          linkLabel: 'See the stay',
        },
        {
          href: `${origin}/stays`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Style of stay]',
          title: '[Property name]',
          summary: '[Who it suits and what it is near.]',
          linkLabel: 'See the stay',
        },
      ]),
      noticePanel(
        'Access and permits',
        `[Road condition, gate times, reserve entry fees and permit requirements, with the date checked.
         Say plainly if a road needs clearance or closes after rain.]`,
        'caution',
      ),
      closingBand({
        heading: 'Put [region] into a real itinerary.',
        body: 'Beds, walks and transfers, planned together rather than one at a time.',
        href: `${origin}/packages`,
        label: 'Start planning',
      }),
    ].join('\n'),
  },

  {
    id: 'book-now-season',
    name: 'What to book now',
    audience: 'customers',
    description: 'Pre-high-season nudge: the things that genuinely sell out, with honest lead times.',
    subject: 'What is worth booking before [season]',
    preheader: 'The handful of things that actually run out, and how far ahead.',
    heroAlt: '[Describe the hero photograph: the season this email is about]',
    build: origin => [
      leadParagraph(`[60–80 words. Say what changes in the coming season and why some things need booking
        ahead. Be concrete about the reason — limited permits, one operator, a single hut — rather than
        implying scarcity in general.]`),
      bodyHeading('Book ahead', 'Lead times'),
      stepList([
        '[Thing to book] — [how far ahead, and why that is the real constraint].',
        '[Thing to book] — [how far ahead, and why].',
        '[Thing to book] — [how far ahead, and why].',
      ]),
      bodyHeading('Still open', 'No rush'),
      paragraph(`[Say what does NOT need booking ahead. An email that claims everything is urgent teaches
        the reader to ignore the next one.]`),
      noticePanel(
        'Availability',
        `[Checked on [date]. Availability changes and is confirmed at booking.] State the date you checked.
         Do not add a countdown, a "only N left" line, or any deadline that is not real.`,
      ),
      ctaButton(`${origin}/packages`, 'See what is available'),
      closingBand({
        heading: 'One trip, booked once.',
        body: 'Accommodation, guided days and transfers in a single itinerary.',
        href: `${origin}/packages`,
        label: 'Plan the trip',
      }),
    ].join('\n'),
  },

  {
    id: 'event-announcement',
    name: 'Event announcement',
    audience: 'customers',
    description: 'A dated event: what it is, when, where, what it costs, and how to build a weekend around it.',
    subject: '[Event name], [date] — [the reason to care]',
    preheader: 'Dates, tickets and somewhere to sleep within reach of it.',
    heroAlt: '[Describe the hero photograph of the event or its setting]',
    build: origin => [
      leadParagraph(`[50–80 words on what the event is and who it is for. Lead with the experience, not the
        logistics — those are in the panel below.]`),
      factPanel([
        ['When', '[Day, date, time]'],
        ['Where', '[Venue and town]'],
        ['Tickets', '[Price and where from]'],
        ['Getting there', '[Drive time and parking, or transfer options]'],
      ], 'The details'),
      bodyHeading('Make a weekend of it', 'Nearby'),
      storyRow({
        href: `${origin}/stays`,
        imageSrc: PLACEHOLDER_IMAGE,
        imageAlt: '[Describe this photograph]',
        category: '[Stay]',
        title: '[Property within easy reach]',
        summary: '[Distance from the venue and who it suits.]',
        linkLabel: 'See the stay',
      }),
      noticePanel(
        'Before you commit',
        '[Weather contingency, refund policy, age restrictions, accessibility — whatever a buyer would be annoyed to discover afterwards.]',
        'caution',
      ),
      ctaButton(`${origin}/events`, 'See the event'),
    ].join('\n'),
  },

  {
    id: 're-engagement',
    name: 'Win-back',
    audience: 'customers',
    description: 'For someone who travelled with us once and has gone quiet. One reason to come back, no guilt.',
    subject: 'The berg has changed since [year]',
    preheader: 'What is new, and one thing worth coming back for.',
    heroAlt: '[Describe the hero photograph: somewhere they have not been]',
    build: origin => [
      greeting('[First name]'),
      leadParagraph(`It has been a while since your last trip with us. Rather than a catch-up, here is the one
        thing that has genuinely changed and might be worth the drive again.`),
      bodyHeading('[What is new]', 'Since you were here'),
      paragraph(`[A real change: a route reopened, a new reserve partnership, a road resurfaced, an operator
        added. If nothing has changed, do not send this email.]`),
      pullQuote(
        '[An observation from the ground that earns its place — a ranger, a guide, a guest.]',
        '[Attribution]',
      ),
      bodyHeading('Where you have not been', 'A suggestion'),
      storyCards([
        {
          href: `${origin}/hikes`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Walk]',
          title: '[Route name]',
          summary: '[Why this one, given where they have already been.]',
          linkLabel: 'See the route',
        },
        {
          href: `${origin}/stays`,
          imageSrc: PLACEHOLDER_IMAGE,
          imageAlt: '[Describe this photograph]',
          category: '[Stay]',
          title: '[Property name]',
          summary: '[Why this one.]',
          linkLabel: 'See the stay',
        },
      ]),
      ctaButton(`${origin}/packages`, 'See what is running'),
      paragraph(`If the Drakensberg is not on your list at the moment, the unsubscribe link below stops these
        without any hard feelings — trip emails for anything you have booked are separate and keep coming.`),
    ].join('\n'),
  },

  {
    id: 'outreach-first-touch',
    name: 'Outreach — first approach',
    audience: 'contacts',
    description: 'A short cold approach to an establishment that has not heard from us yet. Reads like a person wrote it.',
    subject: 'Listing [business name] on Visit Drakensberg',
    preheader: 'A short note about getting your business in front of people already planning the trip.',
    heroAlt: '[Describe the photograph — their region, or their own property if we have permission]',
    build: origin => [
      paragraph('Hello [contact first name],'),
      leadParagraph(`I am writing from Visit Drakensberg, a destination platform that helps travellers put a
        whole trip together — somewhere to sleep, a way to get there, and the guided walks and culture in
        between. [One specific, true sentence about why you are writing to THEM: where you found them, what
        they do well, which gap they fill in a region.]`),
      paragraph(`Would it be worth a short conversation about listing [business name]? I can send the full
        terms first if you would rather read before we talk.`),
      bodyHeading('What a listing looks like', 'In short'),
      checklist([
        'Your own page with photographs and rates',
        'Found inside regions, routes and itineraries',
        'Enquiries and bookings routed to you',
        'No listing fee — commission on what we sell',
      ]),
      ctaButton(`${origin}/list-with-us`, 'See how listing works'),
      signature({
        name: '[Your name]',
        title: '[Your role]',
        email: '[you@visitdrakensberg.com]',
        phone: '[+27 00 000 0000]',
      }),
    ].join('\n'),
  },

  {
    id: 'outreach-follow-up',
    name: 'Outreach — follow-up',
    audience: 'contacts',
    description: 'A second note after no reply. One new piece of information, and an easy way to say no.',
    subject: 'Following up: listing [business name]',
    preheader: 'One more note, then I will leave it with you.',
    heroAlt: '[Describe the photograph, or leave the hero empty for a plainer follow-up]',
    build: origin => [
      paragraph('Hello [contact first name],'),
      leadParagraph(`I wrote a couple of weeks ago about listing [business name] on Visit Drakensberg. I know
        an inbox is an inbox, so this is my last note on it unless you would like to pick it up.`),
      bodyHeading('[The one new thing]', 'Since I wrote'),
      paragraph(`[Give them something they did not have last time: a region page that has gone live, a
        partner near them who has joined, a season's enquiry numbers for their category. A follow-up that
        only repeats the first email is noise.]`),
      noticePanel(
        'If the answer is no',
        `Reply with a single word and I will take [business name] off our outreach list. If it is a
         "not now", tell me roughly when and I will come back then instead.`,
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

  {
    id: 'partner-update',
    name: 'Partner update',
    audience: 'contacts',
    description: 'An operational note to businesses already listed: a change, a deadline, something they must action.',
    subject: '[What changed] — what it means for your listing',
    preheader: 'A short operational update about your Visit Drakensberg listing.',
    heroAlt: '[Usually leave the hero empty — this is an operational note, not a campaign]',
    build: origin => [
      paragraph('Hello [contact first name],'),
      leadParagraph(`[Say what has changed in the first sentence. A partner reading this wants the fact, not
        a preamble — the reasoning can follow.]`),
      bodyHeading('What you need to do', 'Action'),
      stepList([
        '[The specific action, and where in the supplier dashboard to do it.]',
        '[Any second action.]',
        '[Who to contact if something does not work.]',
      ]),
      factPanel([
        ['Takes effect', '[Date]'],
        ['Deadline for you', '[Date, or "nothing required"]'],
        ['Affects', '[Which listings or which categories]'],
      ], 'Dates'),
      paragraph(`[If this changes commercial terms, say so here explicitly and link the full terms. Never
        let a rate or commission change arrive as a surprise in a footnote.]`),
      ctaButton(`${origin}/supplier`, 'Open your dashboard'),
      signature({
        name: '[Your name]',
        title: '[Your role]',
        email: '[you@visitdrakensberg.com]',
        phone: '[+27 00 000 0000]',
      }),
    ].join('\n'),
  },
]
