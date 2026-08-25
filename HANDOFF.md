# Visit Drakensberg — Platform Handoff

**Branch:** `claude/wizardly-mayer-leonph`  
**Repo:** `veza-sawbn/umponjwana`  
**Stack:** Next.js 14 App Router · Supabase · Tailwind  
**Date:** 2026-06-26

---

## Architecture

### Data storage
All data lives in a single Supabase table `site_content` as JSON blobs keyed by name:

| Key | Contents |
|-----|----------|
| `properties` | Supplier-listed accommodations |
| `rooms` | Rooms per property |
| `activities` | Supplier-listed activities |
| `tours` | Guided tour products |
| `departures` | Scheduled tour dates |
| `bookings` | Confirmed guest bookings |
| `message_threads` | Visitor ↔ supplier conversations |

All lib files follow the same pattern: private `getAll()` / `saveAll()`, plus named exports for CRUD.  
**Critical:** Always use `.maybeSingle()`, never `.single()` — `.single()` throws 406 on missing rows.

### Auth
- `lib/auth.ts` exports `supabase` client
- Supplier identity = `supabase.auth.getUser()` → `user.id`  
- Supplier name/company = `useSupplier()` from `lib/supplier-context.tsx`
- Visitor identity = `supabase.auth.getUser()` in each page

### Design tokens
| Token | Value | Usage |
|-------|-------|-------|
| Gold | `#C9A96E` | CTAs, accents, highlights |
| Forest | `#2d6a4f` | Primary text-on-white, buttons |
| Mist | `#F7F5F2` | Page backgrounds |
| Black | `#000000` | Headings |
| Supplier UI | `rounded-xl` borders | Supplier dashboard cards |
| Public UI | Sharp (no radius) borders | Visitor-facing pages |

Typography: `font-display italic` for headings · `font-sans` for body

---

## What's fully wired (Supabase-persisted)

### Supplier dashboard (`/supplier/*`)
| Section | List | New | Edit |
|---------|------|-----|------|
| Properties | ✅ real data | ✅ 5-step wizard | ✅ pre-filled 5-step wizard |
| Rooms | ✅ real data | ✅ 5-step wizard (images/features/inclusions) | ✅ pre-filled |
| Tours | ✅ real data | ✅ | ✅ real data |
| Departures | ✅ real data | ✅ | n/a (inline edit on list) |
| Activities | ✅ real data | ✅ | ✅ real data |
| Bookings | ✅ filtered by supplierId | — | — |
| Messages | ✅ real data, 5s polling | — | — |

### Public visitor pages
| Page | Status |
|------|--------|
| `/stays` | Merges hardcoded showcase + live Supabase properties; price = min room basePrice |
| `/stays/[id]` | Hardcoded IDs (s1-s3) use static data; real `prop-*` IDs fetch from Supabase |
| `/hikes/[id]` | Loads live departures from Supabase, maps to TourDate format |
| `/activities/[id]` | Hardcoded showcase (a1, a2); departures from `lib/tour-dates.ts` |
| `/account/itinerary` | Full trip detail, polling messaging for every addon + stay property |
| `/checkout/*` | Booking creation, payment summary, success page |
| `/trip` | Booking cart with smart suggestions |

---

## Key recent fixes (this session)

### Booking data isolation
`BookingAddon` now carries `supplierId`. It's set when a visitor books a real supplier departure (via `UpcomingDepartures`) or activity. The supplier bookings page filters by `addon.supplierId === user.id` and `stay.id ∈ supplier's properties` — no more cross-supplier leakage.

### Property region
`lib/properties.ts` exports `PROPERTY_REGIONS` (12 Drakensberg regions). Properties use `region: string` instead of the old `nearestTown`. New and edit property forms use a dropdown. The stays listing and supplier properties list display the region.

### `/stays` price
Previously showed "Contact for rates" for all supplier-listed stays. Now fetches rooms per active property on load and uses the minimum `basePrice` as the displayed price.

### `/stays/[id]` mobile rooms
Desktop: rooms shown inline as always. Mobile: "View Rooms (N)" button toggles room list visibility and shows the room picker in the booking sidebar.

### Property edit page
`/supplier/properties/[id]/edit` — same 5-step wizard as new property, pre-populated from `getPropertyById(id)`, saves via `updateProperty(id, ...)`.

### Messaging fixes
1. **Thread persistence** — lookup now matches by `bookingId + addonTitle` only (previously required `supplierId` to match exactly, which caused duplicate threads and lost history). On match, backfills `supplierId` if it was missing.
2. **Live updates** — both visitor itinerary (when panel is open) and supplier inbox poll every 5 seconds. No manual refresh required.
3. **Stay messaging** — accommodation section now has "Message Property" button with full thread UI. Uses `property.supplierId` fetched from Supabase.
4. **Activity messaging** — `resolvedSupplierId` now includes `addon.supplierId`, so activity supplier threads route correctly.

---

## Still mock / not wired

These supplier dashboard sections exist as UI shells but use local state or `MOCK` arrays — none persist to Supabase:

| Section | State |
|---------|-------|
| `/supplier/reviews` | MOCK array, read-only display |
| `/supplier/experiences` | MOCK array |
| `/supplier/packages` | UI shell, no persistence |
| `/supplier/events` | UI shell, no persistence |
| `/supplier/discounts` | Local state only |
| `/supplier/availability` | Local state only |
| `/supplier/staff` | Local state only |
| `/supplier/guides` | Local state only |
| `/supplier/drivers` | MOCK array |
| `/supplier/vehicles` | MOCK array |
| `/supplier/routes` | MOCK array |
| `/supplier/shuttle` | UI shell |
| `/supplier/estimator` | Functional calculator, no persistence |
| `/admin/*` | Entire admin panel is UI-only shells |

### Public pages not yet wired
- `/activities` listing — shows hardcoded activities (a1, a2); live Supabase activities not surfaced here yet
- Photo upload — the photos step in all supplier wizards accepts URL strings only; no Supabase Storage upload
- Booking status updates — suppliers cannot mark bookings confirmed/cancelled from their dashboard
- Availability calendar — no real blocking or seat-count enforcement at booking time

---

## Known architectural limitation

All Supabase data is stored as a single JSON blob per key in `site_content`. Every write reads the full array, modifies it, and saves it back. This means:
- **Race condition risk** on concurrent writes (two tabs sending messages simultaneously can overwrite each other)
- **No row-level security** — any authenticated user can read all keys
- Long-term: migrate to proper normalised tables with RLS policies

---

## Lib file reference

```
lib/
  auth.ts             — supabase client
  booking-context.tsx — BookingAddon, BookingStay, BookingState (cart)
  bookings.ts         — SavedBooking CRUD (key: bookings)
  properties.ts       — Property CRUD + PROPERTY_REGIONS (key: properties)
  rooms.ts            — Room CRUD (key: rooms)
  activities.ts       — Activity CRUD (key: activities)
  tours.ts            — Tour CRUD (key: tours)
  departures.ts       — Departure CRUD (key: departures)
  messages.ts         — MessageThread CRUD + polling helpers (key: message_threads)
  tour-dates.ts       — Hardcoded TourDate[] for showcase hike/activity pages
  trails.ts           — Trail data (stored in site_content key: trails)
  supplier-context.tsx — useSupplier() hook (company name, type)
  supplier-config.ts  — Supplier type detection
```

---

## Important patterns

### Adding a new Supabase-persisted entity
Follow the pattern in `lib/properties.ts`:
1. Define a `type Foo = { id: string; ... }`
2. Private `getAll()` and `saveAll(items)` using `maybeSingle()`
3. Export `getFoos()`, `getFooById(id)`, `addFoo(...)`, `updateFoo(id, patch)`, `deleteFoo(id)`
4. Key format: lowercase plural, e.g. `'foo_items'`

### Supplier filtering
Always filter by `user.id` (from `supabase.auth.getUser()`), never by display name. The auth user ID is the canonical supplier identifier.

### `useSearchParams()` requires `<Suspense>`
Any page using `useSearchParams()` must be wrapped in `<Suspense>` or Next.js will throw during build.

---

# UPDATE — 2026-07-04 production-hardening branch

**Branch:** `claude/drakensberg-production-audit-5pipb7`

The architecture description above is now partially obsolete:

## New data layer (replaces the site_content blobs)
Operational data no longer lives in `site_content` JSON blobs. Run
`frontend/supabase/migrations/20260704_secure_data_layer.sql` before deploying.

| Table | Contents | Access (RLS) |
|-------|----------|--------------|
| `vd_entities` | properties, rooms, activities, tours, departures, supplier_* entities — one row per item (`kind` column) | public read of live rows; owner/admin write; inserts require an **approved** supplier |
| `vd_bookings` | bookings (customer PII) | owner, involved suppliers (`supplier_ids uuid[]`), admin |
| `vd_message_threads` | conversations | participants only |
| `vd_notifications` | in-app notifications | recipient only (any authed user can insert) |
| `vd_newsletter_subscribers` | emails | insert-only public; admin read |
| `site_content` | CMS content only (hero, footer, regions, trails, admin_media…) | public read, **admin-only write** |

Lib files kept their exported signatures — pages did not change. New libs:
`lib/entities.ts` (core store), `lib/notifications.ts`, `lib/recommendations.ts`, `lib/fuzzy.ts`.

Departure seats are booked via the atomic `vd_book_seats()` RPC (checked
capacity, rollback on failure) and released via `vd_release_seats()`.

## Roles & approval
- `profiles.role` / `is_approved` cannot be self-edited (column grants); approval
  flips only via `admin_set_supplier_approval()` (admin-only SECURITY DEFINER).
- New suppliers register unapproved and cannot publish until approved
  (existing suppliers were grandfathered by the migration).
- Middleware prefers `app_metadata.role`; real enforcement is RLS.

## Admin
Overview / Suppliers / Bookings / Listings now operate on live Supabase data
(`lib/admin-supabase.ts`). The Render FastAPI backend only backs the analytics
shell — retire or finish it.

## Still open (see PRODUCTION_READINESS_REPORT.md)
- **Payment is not integrated** (deliberately deferred) — checkout still fakes it.
- Email notifications, room-level availability, remaining supplier shell
  modules (experiences/packages/events/discounts/availability/staff/guides/
  media/analytics), rate limiting, analytics instrumentation.

## UPDATE 2 — per-supplier booking orders (2026-07-05)

Run `frontend/supabase/migrations/20260705_booking_orders.sql` after the first
migration. Key change: **suppliers no longer see the visitor's whole booking.**

- `vd_bookings` = the visitor's single itinerary (visitor + admin only now).
- `vd_booking_orders` = one row per (booking × supplier), created at checkout
  by `lib/booking-orders.ts`. Contains only that supplier's items + the guest
  details needed to deliver the service. `/supplier/bookings` reads orders.
- Supplier cancellation cancels *their order only*; visitor cancellation
  cancels the booking and all its orders.

Also in this round: auth uses hard navigation + `prefetch={false}` on
role-gated links (fixes dead Dashboard button / login not redirecting);
middleware falls back to `profiles.role` when auth metadata has no role;
availability / discounts / guides / staff / packages / events supplier
modules persist via `supplier-entities` (no more mock data returning);
checkout enforces supplier availability blocks on stays.

## UPDATE 3 — marketplace extensions (2026-07-07)

**Branch:** `claude/drakensberg-marketplace-extensions-kct62a`
Run `frontend/supabase/migrations/20260707_marketplace.sql` (adds
`vd_trip_requests` + widens the vd_entities public-read status list to
include `verified` and `published`). Existing pages/navigation unchanged —
everything below extends the platform.

### Trekking experiences (marketplace view of tours × departures)
- `lib/experiences.ts` composes `TrekkingExperience` from a supplier Tour +
  Departure (both already store the Trail ID). Experience id = departure id.
- `/hikes/[id]` gained an **Upcoming Trekking Experiences** section
  (`components/experiences/TrailExperiences.tsx`) with View Experience /
  Compare buttons, plus a **Book on Custom Dates** CTA. Trail content is
  untouched and remains primary.
- `/experiences/[id]` — dedicated commercial booking page per departure.
- `/experiences/compare?trail=&ids=` — comparison, only between departures
  sharing the same Trail ID.
- `Tour` type gained optional marketplace fields (leadGuide,
  accommodationStyle, mealsIncluded, transport/equipmentIncluded,
  guideExperienceYears, rating, featured).

### Custom-date booking journey (never instant)
- `lib/custom-trips.ts` on `vd_trip_requests`. Status workflow: draft →
  pending_guide → pending_operator → quote_ready → awaiting_payment →
  confirmed | cancelled | rejected.
- `/experiences/request?trail=&guide=` — 3-step form: details → matched
  guides/operators (by trail, region, certifications, blocked-date
  availability) → submit.
- `/account/requests` — customer tracking, quote acceptance, simulated
  payment (real payment still deferred platform-wide).
- `/supplier/requests` — operator approves guide availability (validated
  against blocked dates + overlapping requests), then operational approval +
  quote with optional alternative dates/guide/pricing/itinerary, or decline.

### Supplier directory (`/guides`)
- Now operator-first: Tour Operator → Guide Team → Guide Profile.
- `lib/operators.ts`: `operator_profile` entities (id `opr-<auth uuid>`) +
  existing `supplier_guides`, merged with showcase fallbacks.
- `/guides/operators/[id]` supplier profile; `/guides/[id]` now serves live
  guides too and links back to the operator; **Book this Guide** enters the
  custom-date journey with the guide preselected.
- `/supplier/company` — operators edit/publish their public profile.
- Supplier guide registration form gained public-profile fields
  (qualifications, years, highest summit, expeditions, portrait, bio).

### Admin marketplace
- `/admin/packages` — Package Builder: create/edit/duplicate/archive/
  publish/hide/feature/schedule; components carry supplier, cost/sell price,
  margin, commission %, availability, booking/cancellation rules, notes.
  Packages are admin-owned `package` entities (`lib/packages.ts`); status
  column mirrors `published` → `active` for public read.
- `/packages` merges live published packages ahead of the showcase set;
  `/packages/[id]` books a live package in one step: master booking in
  `vd_bookings` + per-supplier fulfilment orders in `vd_booking_orders`
  (each supplier sees only their components, at cost price) —
  `lib/package-bookings.ts`.
- `/admin/marketplace` — operations dashboard tabs: operators, guides,
  experiences, scheduled departures, custom trip requests, commissions;
  revenue/margin analytics strip.

## UPDATE 4 — Multi-Supplier Order Management & Financial System (2026-07-16)

**Branch:** `claude/drakensberg-order-management-l1zldp`
Run `frontend/supabase/migrations/20260716_order_management.sql` after the
previous migrations. It backfills Master Orders for all existing bookings
(idempotent — skips bookings that already have an order).

### Architecture
Unified Order Management System between bookings and financial transactions:

```
Customer → Trip → Master Order (vd_orders) → Order Line Items (vd_order_lines)
→ Supplier Allocation → Invoice (vd_invoices) → Payments (vd_order_payments)
→ Supplier Settlements (vd_settlements) → Receipts (vd_receipts)
→ Financial Reporting (vd_ledger_entries)
```

- The Master Order belongs to Visit Drakensberg — suppliers have **no**
  access to `vd_orders`; RLS grants them only their own `vd_order_lines`.
- Customers get ONE invoice per order (customer-safe line snapshot, no
  payout data). Internal notes live in staff-only `vd_order_notes`.
- Double-entry ledger: every order/payment/settlement RPC writes balanced
  journals against the editable chart of accounts `vd_ledger_accounts`
  (external_ref column ready for accounting integrations).
- Nothing hardcoded: VAT / default commission / service-fee rates in
  `vd_finance_settings`; per-supplier overrides in `vd_supplier_terms`.
- Staff roles: `profiles.staff_role` (finance | operations) + helpers
  `is_finance()` / `is_ops()`; assigned via `admin_set_staff_role()`.
- Every financial action is appended to `vd_audit_log`.
- Multi-destination/currency-ready (`destination`, `currency` columns).

### RPCs (SECURITY DEFINER — the only write paths)
`vd_create_order` (order+lines+invoice+opening journal+optional payment;
allocation computed server-side), `vd_record_order_payment` (deposit /
installment / partial / offline / refund / credit / gift_card / voucher —
maintains balances, issues receipt, balanced journal),
`vd_cancel_order` (reversal journal + refund liability),
`vd_update_line_allocation` (admin edits commission/fees; adjustment journal),
`vd_set_line_fulfilment` (supplier's only write), and the settlement
lifecycle: `vd_create_settlement` / `vd_approve_settlement` /
`vd_pay_settlement` / `vd_reverse_settlement`.

### Lib files
`lib/orders.ts` (Master Order + lines; `createOrderForBooking` runs in
`addBooking` after the vd_booking_orders fan-out), `lib/allocation.ts`
(preview math + `formatMoney`), `lib/invoices.ts`, `lib/order-payments.ts`,
`lib/ledger.ts` (trial balance), `lib/settlements.ts` (engine + virtual
supplier statements via `buildStatements`). `lib/package-bookings.ts` now
also creates a Master Order: suppliers allocated at cost (commission 0),
platform margin as a platform-owned "packaging & coordination" line, and the
customer invoice shows a single package line at sell price.

### UI
- `/admin/orders` — order console: statuses, line items with editable
  allocations, record payments/refunds, invoice, ledger, internal notes.
- `/admin/finance` — revenue / cash / receivables / supplier liabilities /
  platform & commission revenue / refund exposure / monthly sales / supplier
  & destination performance / CLV / trial balance.
- `/admin/settlements` — unsettled supplier balances → create (weekly /
  monthly / manual / partial / bulk / scheduled) → approve → pay (payout
  ref) → reverse.
- `/admin/operations` — arrivals, departures, transfers, activities,
  outstanding permits, unconfirmed supplier services, outstanding payments.
- `/supplier/earnings` (in SHARED_NAV) — own lines only: net earnings,
  commission, settlement status, fulfilment updates, monthly virtual
  statements, settlement history.
- `/account/orders` — customer orders, single invoice, payments, receipts.

### Notes / still open
- Events already flow through the trip cart as `event` addons → they become
  order lines automatically; a dedicated QR-ticket step is not built yet.
- Checkout still fakes card capture (unchanged, deliberate).
- Master-order creation is fired from the client after booking save
  (best-effort try/catch); a failed call logs to console — consider a
  server-side trigger or retry queue later.
- Equipment/permit/levy categories are supported end-to-end financially but
  have no dedicated public product pages yet.

### UPDATE 4b — Guest invoicing, receipt emails, printable documents (2026-07-18)

Run `frontend/supabase/migrations/20260718_guest_orders.sql` after the
order-management migration.

- **Guest invoices** — `/admin/invoices` New Invoice now has a
  "Guest / manual details" mode (name, email, phone) for walk-in/phone
  customers with no account. `user_id` is nullable across the financial
  tables; guest orders are staff-managed only (`vd_create_order` accepts
  `p_order.guest = true`, admin-only; ownership checks in the payment and
  cancel RPCs now use IS DISTINCT FROM so NULL user_id cannot bypass them).
- **Receipt emails** — every recorded payment/refund fires
  `POST /api/receipts/send` (from `recordOrderPayment` and from
  `createOrder` when an initial payment is attached). The route runs under
  the caller's session (RLS applies), composes a branded receipt email and
  sends it via Resend when `RESEND_API_KEY` is set (`RECEIPTS_FROM_EMAIL`
  overrides the sender; `NEXT_PUBLIC_SITE_URL` sets the invoice link
  origin). Without a key it degrades gracefully; an in-app notification
  with the receipt link is always created for account holders.
- **Printable documents** — `/invoices/[id]` (branded tax invoice) and
  `/itinerary/[id]/print` (trip summary, accommodation, day-by-day
  schedule, transfers, payment summary, emergency numbers). All former
  whole-page `window.print()` buttons (account itinerary ×2, checkout
  success, account orders, admin order console) now open these documents;
  print CSS isolates the document itself.

### UPDATE 4c — Itinerary messaging for every supplier type (2026-07-18)

No new migration. Guests can now message every supplier involved in their
trip from the itinerary view, not just tour/activity operators:

- `components/messaging/SupplierMessageBlock.tsx` — reusable button +
  inline thread (5s polling while open) on `vd_message_threads`, keyed by
  booking × service title.
- Accommodation: "Message Property" in the Property Contact card — routes
  to the property owner's supplier account (looked up via
  `getPropertyById`); showcase stays (no supplier) route to the platform.
- Shuttle: "Message Shuttle Desk" — platform-addressed thread (shuttles
  are platform-arranged and carry no supplier account).
- Experiences: supplier resolution fixed to prefer `addon.supplierId`
  (the supplier actually booked), falling back to departure/tour; the
  Message Operator button no longer disappears when only a name is known.
- `/admin/messages` (new admin nav item) — console for ALL threads with a
  "Visit Drakensberg inbox" filter: platform-addressed threads (shuttle
  desk, showcase stays) can ONLY be answered here; replies send as
  "Visit Drakensberg" and notify the guest in-app. Supplier-owned threads
  remain answerable from /supplier/messages as before (RLS unchanged).

## UPDATE 5 — Transport Supplier Marketplace & Google-only shuttles (2026-07-18)

**Branch:** `claude/supplier-marketplace-booking-1z27tv`
Run `frontend/supabase/migrations/20260718_transport_marketplace.sql` (adds
`vd_transport_requests` with customer/offered-supplier/admin RLS).

### Shuttles are Google-API-only now
- `/shuttles` added to the main nav. The page (and `/checkout/shuttle`) was
  rebuilt on `GoogleAddressField` autocomplete + the Distance Matrix: any
  pickup → any destination, live km/duration, distance-based fare estimate.
- ALL hardcoded shuttle provider logic is gone: `SHUTTLE_LOCATIONS`,
  `SHUTTLE_ROUTES`, `SHUTTLE_OPTIONS_BY_REGION` and the mock fallback
  recommendations were deleted. `lib/shuttle-service.ts` now only quotes from
  live Google results (`estimateTransferPrice`, `buildShuttleOption`,
  `useShuttleRecommendations`); addons without location data get no
  recommendation instead of a mock one. `ShuttleOption` gained pickup/
  destination lat/lng so coordinates survive into checkout.

### Supplier marketplace (`lib/transport.ts`)
- Transport companies register at `/supplier/transport` (Shuttle-supplier nav)
  as `transport_company` entities: category **gateway | regional | local**
  (`SUPPLIER_CATEGORIES`), Google-picked home base, service areas
  (`TRANSPORT_AREAS` — cities/regions/valleys with centroid+radius), operating
  radius, R/km + minimum fare, rolling stats (reliability, response time,
  rating), and an `openJobs` board used for load/follow-on scoring.
- Category gates eligibility per trip class (`classifyTrip` +
  `eligibleCategories`): gateway trips → gateway (regional as backup);
  regional → regional first; local (≤25 km / in-valley) → local first.

### Automatic fleet lifecycle — no manual calendars
- Vehicles carry `fleetStatus`: available → reserved (accept) → on_trip
  (start) → available again at the **drop-off location** (complete). Drivers
  carry `dutyStatus` (assigned/freed automatically). Maintenance toggle and
  manual date blocks live on `/supplier/vehicles`; entity `status` stays
  `active` so the scorer can read fleets. Vehicle new/edit pages persist real
  data incl. a Google-picked current location (edit page was a mock before).

### Dispatch engine (`lib/transport-dispatch.ts`)
- Every checkout with a shuttle fires `createTransportRequestForBooking`
  (hooked in `addBooking`) → a scored `vd_transport_requests` row. Factors:
  region coverage, category fit, vehicle capacity/suitability, home-base
  distance, current vehicle location, vehicle+driver availability, same-day
  load, reliability, response time, rating, price vs median, plus a
  follow-on bonus (≤15) when an open job ends near the pickup that day.
- Top 3 eligible suppliers are offered simultaneously (notified, ranked);
  `/supplier/jobs` is the acceptance workflow (accept w/ vehicle → assign
  driver → start → complete; decline cascades to the next-ranked supplier).
  Declined-by-all → `unassigned` for admin attention.

### Admin dispatch console + optimiser
- `/admin/transport` (admin nav → Transport): request queues with full
  per-supplier score breakdowns, **Auto-assign top supplier**, re-run
  dispatch, cancel; registered-company directory with live fleet counts.
- `lib/transport-optimizer.ts` background service (runs on an interval while
  the console is open): clusters upcoming journeys by destination area/date,
  detects follow-on matches (supplier already travelling within 60 km of a
  pending pickup) and persists rank boosts + notifications; learns region-
  pair demand corridors from completed-trip history into the
  `transport_insights` entity.

### Notes / still open
- `/supplier/routes` pages still exist but left the Shuttle nav (fixed routes
  are superseded by dispatch); `/supplier/estimator` unchanged.
- Customer-side rating capture for transport partners not built (stats
  fields ready, neutral 4.0 prior).
- Shuttle money still flows through the existing booking/master-order path;
  transport requests reference the booking but carry no separate settlement.

## UPDATE 6 — Customer Intelligence Foundation, Phase 1 (2026-08-20)

**Branch:** `claude/drakensberg-customer-intelligence-dlw5rg`
Run `frontend/supabase/migrations/20260824_customer_intelligence_foundation.sql`
after `20260823_blog_author_fields.sql`. Purely additive.

This is Phase 1 ("Data Foundation") of the multi-phase Customer Intelligence,
CRM & Marketing Automation system described in the handoff brief. **Read
`docs/customer-intelligence/ARCHITECTURE_AUDIT.md` first** — it audits the
existing schema/booking/auth/email/analytics systems (the platform already
had a mature order/ledger system and zero behavioural analytics — confirmed
by `PRODUCTION_READINESS_REPORT.md` §7) and records exactly what's reused vs.
newly built, and what Phases 2–7 still need.

### New (all additive, RLS-enabled, write-only-via-SECURITY-DEFINER-function)
- `vd_sessions` / `vd_analytics_events` — first-party session + the single
  behavioural event stream (`trackEvent()`, §21 of the brief). Named
  `vd_analytics_events` rather than a bare "events" table — the codebase
  already uses "Event" for ticketed calendar events (`lib/events.ts`).
- `vd_customer_profiles` — 1:1 CRM extension of `profiles` (country, tags,
  interests, favourites, acquisition source, `lifecycle_stage`: visitor →
  prospect → customer → upcoming_traveller → traveller →
  returning_customer → advocate). Seeded for every existing account; the
  signup trigger seeds new ones.
- `vd_customer_consents` — append-only consent log + `vd_set_consent()` /
  `vd_is_subscribed()`. Source of truth for `marketing_consent`; transactional
  mail (receipts/invoices/quotes/waivers) is untouched and never checks it.
- `vd_customer_segments` / `vd_customer_segment_members` — 8 of the brief's
  §9 segments (Prospects, First-time, Returning, Upcoming/Recent Travellers,
  High-value, International, Dormant), computed by `vd_recompute_segments()`
  straight from existing `vd_orders` data — real membership from the moment
  the migration runs. Recomputed daily via `/api/cron/recompute-segments`
  (new `vercel.json` entry, mirrors `expire-pending-bookings`).
- `vd_touch_session()` / `vd_track_event()` — the public write API.

### Frontend
`lib/analytics.ts` (client `trackEvent()`/`trackPageView()`, anon/session id
management) + `components/analytics/AnalyticsProvider.tsx` (mounted in
`AppShell`, fires `page_view` on every route change, excludes
`/admin`, `/supplier`, `/operations`). Newsletter signup and registration now
record real consent (`vd_set_consent`) alongside their existing behaviour;
registration gained an unchecked-by-default marketing-consent checkbox;
login/registration fire `login`/`account_created`. New public `/unsubscribe`
page (no login required).

### Deliberately not in this branch
Full event instrumentation across the ~90 route pages (`trail_view`,
`booking_started`, `favourite_added`, etc.), analytics/funnel dashboards, the
CRM timeline/segmentation UI, Wix migration tooling, email campaign tables,
and the automation workflow engine — see the architecture doc's §3 "Next
steps" for the intended order (matches the brief's own §23 phasing).

## UPDATE 7 — Journey notifications + "next step" console, Phase 1 (2026-08-23)

**Branch:** `claude/invoice-orders-notifications-alerts-gcs1k7`
Run `frontend/supabase/migrations/20260828_journey_notifications.sql` after
`20260827_supplier_contacts_import.sql`. Purely additive triggers — no
existing RPC body was edited.

Investigated four staff-reported gaps; root cause for all four was the same
shape: `vd_create_order`, `vd_accept_quote`, `vd_record_order_payment` and
`vd_waiver_submit` never write to `vd_notifications`, and the admin invoice
UI (`/admin/invoices`) only ever calls `lib/orders.ts` — never
`lib/booking-orders.ts` or `lib/notifications.ts`, which is how a normal
checkout booking tells its supplier anything. `notify()` and the manual
`vd_notifications` inserts in `app/api/receipts/send` and the iKhokha
webhook were the *only* things ever writing a notification row; nothing on
the SQL side did.

- **Orders from an invoice not reaching the supplier.** An admin-created
  invoice (walk-in/phone booking, or a quote a customer accepted) allocates
  `vd_order_lines.supplier_id` correctly, but never inserted a
  `vd_booking_orders` row (no `bookingId` exists for these) and never
  notified anyone — the supplier's only path to seeing the work was
  stumbling onto `/supplier/earnings` unprompted. Added
  `vd_notify_supplier_new_order_line` (trigger on `vd_order_lines`,
  one notification per order+supplier, skipped for checkout-originated
  orders which already notify via `lib/bookings.ts` / the iKhokha webhook).
  **Still true:** these orders still don't appear on `/supplier/bookings`
  (that page reads `vd_booking_orders`, which is booking-id only) — the
  supplier now gets told and can act from `/supplier/earnings`, but merging
  that view with `/supplier/bookings` is follow-up work, not done here.
- **Payment/journey milestones were silent.** Added: quote acceptance now
  notifies the operator immediately (`lib/custom-trips.ts`, custom-trip
  quotes) and the staff member who sent it (`vd_notify_quote_status` trigger,
  business quotes via `/admin/quotes`); an online (iKhokha) payment now
  notifies finance/admin staff (`vd_notify_finance_online_payment` trigger —
  manual EFT/cash payments don't, since the staff member recording one
  already knows); a **declined** online payment now notifies both the
  customer and finance staff (previously silent beyond a `?payment=failed`
  redirect param that disappears on the next page load) —
  `app/api/payments/ikhokha/webhook/route.ts`.
- **Suppliers not told when a waiver is signed.** `vd_notify_waiver_signed`
  trigger on `vd_waiver_submissions` notifies the request's supplier.
- **"Next step" philosophy in the admin console.** New `lib/next-step.ts`:
  a pure function over data already loaded (`getOrderNextStep`,
  `getQuoteNextStep`) that turns an order/quote's several independent status
  columns into the one question staff actually asked for — what do I do
  about this, now (`Collect payment` / `Confirm with supplier` / `Follow up
  for balance` / `On track`…, urgency-coloured, escalating to `urgent` inside
  3 days of travel). Wired into `/admin/orders` (list badge in both the
  mobile card and desktop table, plus a banner at the top of the order
  detail panel) and `/admin/quotes` (list badge, both layouts). Phase 1 only
  — custom-trip requests (`/supplier/requests`, `/admin/marketplace`) are the
  natural next caller, same shape, not wired yet.

`Notification['type']` (`lib/notifications.ts`) gained `'payment'` — rows
with that type already existed (`app/api/receipts/send`, the iKhokha
webhook), the type just didn't say so.

## UPDATE 8 — Activity adult/child rates & timeslots (2026-08-25)

**Branch:** `claude/activity-rates-timeslots-4y0fnb`
Run `frontend/supabase/migrations/20260829_activity_timeslots.sql`. Purely
additive — two new RPCs, no schema/table changes (activities are a single
evergreen `vd_entities` row, so per-slot booked counts nest inside that same
row's JSON value rather than a new table).

- `Activity` (`lib/activities.ts`) gained `childPrice`/`childMaxAge` (a
  child rate only applies once a supplier sets an age cutoff — activities
  created before this existed have neither, so everyone still pays
  `pricePerPerson`) and `timeslots: ActivityTimeslot[]` (recurring `{ time,
  capacity, days }`, days 0=Sun..6=Sat, empty/legacy = every day). Absent
  timeslots = legacy behaviour, visitors just pick a date.
- Timeslot capacity is atomic and server-checked, mirroring
  `vd_book_seats()`/`vd_release_seats()` for tour departures:
  `vd_book_activity_slot()` / `vd_release_activity_slot()` read/lock the
  activity row, validate capacity from `value.timeslots` server-side (never
  a client-supplied number), and increment/decrement
  `value.slotBookings["<date>:<timeslotId>"]`. Wrapped by
  `bookActivityTimeslot()`/`releaseActivityTimeslot()` in `lib/activities.ts`.
- **Supplier forms** (`/supplier/activities/new`, `/edit`) — new Child Age
  Cutoff + Child Price fields alongside the existing adult price, and a
  `TimeslotEditor` (`components/activities/TimeslotEditor.tsx`, shared by
  both forms) for adding/removing recurring times with per-slot capacity and
  day-of-week toggles.
- **`BookingAddon`** (`lib/booking-context.tsx`) gained optional `adults`,
  `children`, `activityId`, `timeslotId`, `timeslotTime`. `price_per_person`
  is kept as the *blended* average (`total / guests`) so every existing
  `price_per_person × guests` total calculation across the cart/checkout/
  order pipeline (trip, checkout, orders, itinerary, success page) stays
  correct with no changes to that math. New `describeAddonParty()` helper
  renders "2 adults, 1 child" (falls back to the plain guest count for
  every other addon) — used in `/trip`, `BookingBar`, and `/checkout`'s
  add-on summary.
- **`/activities/[id]`** — when the activity has a child rate, the sidebar
  swaps the single "Group Size" selector for separate Adults/Children
  inputs; when it has timeslots, a Timeslot select appears once a date is
  picked (filtered to that date's weekday, showing live remaining seats,
  best-effort — same staleness tradeoff `UpcomingDepartures` already accepts
  for tour seats) and is required before adding to the cart.
- **Checkout** (`app/checkout/page.tsx`) now reserves activity timeslots
  the same way it reserves departure seats: atomic, before the booking is
  persisted, with rollback (of both departures *and* timeslots already
  taken) if any reservation fails. Cancellation releases those seats from
  both sides — the visitor's own cancel (`app/account/page.tsx`) and the
  supplier's own order cancel (`app/supplier/bookings/page.tsx`), the
  latter via new `activityId`/`timeslotId` fields on `OrderItem`
  (`lib/booking-orders.ts`), carried through from the addon at checkout.

### Still open
- No public listing/filter surfaced for "runs at set times" vs. "any date"
  — `/activities` still shows a flat price; timeslot/age-rate details only
  appear on `/activities/[id]`.
- Remaining-seat counts shown while picking a timeslot are best-effort
  (read once with the page load), same tradeoff already accepted for tour
  departures — the atomic RPC at checkout is the actual source of truth.
