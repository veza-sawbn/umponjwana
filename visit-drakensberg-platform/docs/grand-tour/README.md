# Grand Tour Drakensberg & ticketing

Where the pieces live, for the next person (or session) looking for them.

## The Grand Tour page — `/grand-tour`

- `app/grand-tour/page.tsx`: server shell, rendered on every request with no caching (`force-dynamic` + `fetchCache = 'force-no-store'`). With `revalidate` alone, Next 14.2 kept serving Supabase reads from its Data Cache and a newly published day tour never appeared.
- `components/grand-tour/GrandTourExperience.tsx`: the scroll itinerary. Hero, the stages north to south, highlights that fade in, a route rail that fills as you scroll (desktop) or a stage bar (mobile), the day tours under each stage, and what was hand-picked for it. Includes a "pick up from my hotel" filter. Nothing is added automatically: a stage with no day tour and no features is just its story.
- **Content is edited by admins at `/admin/grand-tour` → Page content**: hero, introduction, every stage (name, tagline, area, region link, intro, image, travel time) and its highlights, and the closing "how booking works" band. Stored as one row in `site_content` (key `grand_tour_page`, admin-only write) via `lib/grand-tour-content.ts`; `lib/grand-tour.ts` holds the original text, used until something is saved. Ids survive edits, so renaming a highlight never detaches the day tours that visit it.

## Admin: `/admin/grand-tour`

Three tabs, for admins (no ops assignment needed): **Page content** (above), **Day tours** (create day tours for any approved operator, list activities on the Grand Tour, publish; the same `components/grand-tour-admin/DayToursManager.tsx` the ops panel uses) and **Featured on stages**.

## Who runs it: VD Operations

The Grand Tour is run by Visit Drakensberg, not by each supplier. Suppliers list and price their activities and add timeslots (the departures) as usual; **VD Operations** puts them on the Grand Tour and boards the guests. Both tools live in the operations panel and appear for an ops employee holding the permission on at least one supplier:

| Tool | Route | Who | What it does |
|---|---|---|---|
| Grand Tour → **Day tours** | `/operations/grand-tour` | Manage Inventory on the operator | **New day tour**: creates a bookable activity under its operator in one form (price, child rate, departures with seat capacity, highlights, hotel pickups, photos, inclusions, publish). Or put an operator's existing activity on the Grand Tour, edit its listing, publish/unpublish. Flags anything stopping a tour from being bookable. |
| Grand Tour → **Featured on stages** | `/operations/grand-tour` | Any ops employee | Pick live activities and experiences, upcoming events and guided tours from the catalogue for each stage, order them, and add a one-line note. Shown on `/grand-tour` as "Also at {stage}". |
| Boarding & Check-in | `/operations/boarding` | Manage Bookings | Pick the departure, scan tickets or type codes, and work the passenger list grouped by hotel pickup. |

The Grand Tour tool shows in the ops sidebar for every ops employee (`openToAllOps` in `lib/ops-permissions.ts`); the day-tour tab explains when an assignment is missing.

Stage features live in `vd_grand_tour_features` (`supabase/migrations/20261009_grand_tour_features.sql`, client `lib/grand-tour-features.ts`). A feature only points at a catalogue row, so names, prices and photos stay current, and anything that goes to draft, passes (events) or is deleted drops off the page by itself. Anyone can read the table; only staff and VD Operations employees can change it.

The listing is stored as `Activity.grandTour` (`lib/activities.ts`); the editor is `components/activities/GrandTourEditor.tsx`, and the scanner is `components/boarding/BoardingConsole.tsx`.

**Enforced in the database, not just hidden** (`supabase/migrations/20261008_grand_tour_ops_only.sql`):
- A trigger on `vd_entities` keeps an activity's `grandTour` unchanged unless the writer is staff, an ops employee with Manage Inventory on that supplier, the service role, or a direct database session. A supplier saving their activity form never clears it, and can't set one.
- `vd_redeem_ticket` boards a Grand Tour ticket only for staff or an ops employee with Manage Bookings on its supplier. Suppliers keep `/supplier/check-in` for their own event tickets and ordinary activity tickets.

## Each day tour's own page — `/grand-tour/[slug]`

- `app/grand-tour/[slug]/page.tsx` + `components/grand-tour/DayTourDetail.tsx`: hero, the day as a route (hotel pickups with times → the Grand Tour highlights it visits → back to the hotel), inclusions, and the booking panel. Indexed and bookable only when the activity is active, listed on the Grand Tour and has timeslots; otherwise it shows a "preview" notice with booking disabled.
- `components/grand-tour/DayTourBooking.tsx`: departure chips, hotel pickup, adults/children, **Book now** (adds the seats and goes straight to `/checkout`) and **Add to trip**.

## How a guest books

`/grand-tour/[slug]` (or `/activities/[id]`, which offers the same pickup choice): pick a date, departure and hotel pickup (pre-filled when arriving from `/grand-tour`), then book. Checkout holds the seats (`vd_hold_inventory`, kind `activity_slot`) like any timeslotted activity. The order line's `value` carries `activityId / slotDate / timeslotId / pickupPointId`.

## Tickets

One ticketing system covers both event tickets and day-tour seats: table `vd_tickets`.

| Piece | File |
|---|---|
| Schema, event issuance | `supabase/migrations/20261008_event_ticketing.sql` |
| Day-tour seats, auth hardening, wrong-day check | `supabase/migrations/20261008_grand_tour_boarding.sql` |
| Grand Tour is VD-Operations-only | `supabase/migrations/20261008_grand_tour_ops_only.sql` |
| Client wrapper | `lib/tickets.ts` |
| Minting on payment | `app/api/payments/ikhokha/webhook/route.ts` (one ticket per paid seat, idempotent per order line) |
| Guest wallet (QR, tap to enlarge) | `app/account/tickets/page.tsx` |
| Boarding (VD Operations) | `app/operations/boarding/page.tsx` → `components/boarding/BoardingConsole.tsx` |
| Supplier event-ticket scanner | `app/supplier/check-in/page.tsx` |
| Receipt email link | `lib/receipts-server.ts` ("View your tickets") |

Scanning (`vd_redeem_ticket`) only boards a day-tour ticket on its own departure date (South African time). The scanner also warns when a ticket belongs to a different departure than the one selected, with a "Board anyway" override for the operator. Cancelling a booking voids its unredeemed tickets (`vd_release_tickets`). Day-tour seats come back through the booking's inventory holds; event capacity comes back directly.

The event-ticketing work was originally built on `claude/supplier-types-capabilities-gt915o` (commit `2e1ffc0`) and merged here.
