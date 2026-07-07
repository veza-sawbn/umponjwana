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
