# Visit Drakensberg — Production Readiness Report

**Date:** 2026-07-04 (updated after hardening sprint)
**Branch:** `claude/drakensberg-production-audit-5pipb7`
**Scope:** Full-platform audit and remediation — every page, workflow, lib and API in `visit-drakensberg-platform/frontend`, plus schema, middleware and deployment config.

**Overall Production Readiness Score: 62 / 100** (was 38)

Payment processing (deliberately deferred — see C1) is now the single remaining launch blocker. The other three critical findings from the first audit pass — the world-readable data layer, the role-escalation path, and the disconnected admin panel — have been remediated in this branch, alongside the booking-management, search and recommendation gaps.

> **⚠️ DEPLOYMENT REQUIREMENT**
> This branch pairs with a database migration:
> `frontend/supabase/migrations/20260704_secure_data_layer.sql`
> Run it in the Supabase SQL editor **before** deploying the frontend. It creates the secure tables (`vd_entities`, `vd_bookings`, `vd_message_threads`, `vd_notifications`, `vd_newsletter_subscribers`), installs RLS policies and helper functions, copies existing blob data across, grandfathers existing suppliers as approved, and locks `site_content` down to admin-written CMS content. Deploying the frontend without the migration (or vice-versa) breaks reads/writes.

---

## 1. Remediated in this branch

### Round 1 — audit fixes
| Area | Fix |
|------|-----|
| SEO | Server root layout with full Metadata API (was a client component that disabled metadata site-wide), per-section metadata for 12 public routes, `robots.ts`, `sitemap.ts`, favicon, TravelAgency JSON-LD. 86 pages now prerender statically. |
| Error states | Branded `not-found` / `error` / `global-error` pages (none existed). |
| Broken journeys | Created the missing `/auth/reset-password` page (reset emails previously linked to a 404). Replaced the hardcoded demo `/dashboard` ("Welcome back, Sarah") with a redirect to the real `/account`; login/registration now land there. |
| Dead links | Created `/about`, `/privacy`, `/terms`; fixed all story links (previously 404); removed dead `/dining` and `/account/reviews` links; unknown article slugs now 404. |
| UI correctness | Removed the duplicated fixed `<Navbar />` rendered on 15 public pages on top of the layout's navbar. |
| Checkout | Blocks empty carts, surfaces failures via toast, validates card expiry/CVV. |
| A11y/Perf | aria-labels on icon controls, labelled inputs, `aria-live` counters; lazy loading on below-fold images. |

### Round 2 — hardening sprint (this update)
| Finding | Remediation |
|---------|-------------|
| **C2 — PII world-readable/writable** | Operational data moved out of the open `site_content` JSON blobs into per-row tables with RLS: catalog rows in `vd_entities` (public read of live rows; owner/admin write, approved suppliers only), bookings in `vd_bookings` (visible only to the booking owner, the involved suppliers via a denormalised `supplier_ids` array, and admins), messages in `vd_message_threads` (participants only), notifications and newsletter tables. `site_content` is now public-read / **admin-only write** CMS storage. All domain libs (`properties`, `rooms`, `activities`, `tours`, `departures`, `bookings`, `messages`, `supplier-entities`) were rewritten against the new store with unchanged public signatures, so all ~50 consuming pages work as before. Concurrent-write clobbering (whole-array read-modify-write) is eliminated for row-scoped writes. |
| **C3 — role escalation & no approval gate** | Roles/approval now enforced at the data layer: `is_admin()` / `is_active_supplier()` SECURITY DEFINER helpers back every policy; users can no longer change `role`/`is_approved` on their own profile (column-level grants); supplier approval flips only through the admin-only `admin_set_supplier_approval()` function. New suppliers register unapproved (existing ones are grandfathered) and cannot publish listings until approved — the supplier dashboard shows the pending banner it already had, but the gate is now real. The signup trigger is cast-safe (the register form's old `'guest'` role value would have aborted signup under the schema's enum cast; the form now sends `'visitor'`). The public-site editor (`?edit=1`) is gated to admins. |
| **C4 — admin panel managed the wrong backend** | Admin overview, suppliers, bookings and listings now read/write the live Supabase data: real stats (users, suppliers, listings, bookings, booked revenue), pending-supplier approval with in-app notification to the supplier, real booking list with admin cancellation, and a live listings table (publish/unpublish/delete any supplier listing). The legacy Render-backed `lib/api.ts` remains only behind the analytics shell. |
| **Availability enforcement** | Departure seats are reserved through an atomic, capacity-checked `vd_book_seats()` RPC **before** the booking is saved; a full departure aborts checkout with a clear message and rolls back any partially reserved seats. Cancellations release seats via `vd_release_seats()`. |
| **Booking management** | Suppliers can cancel bookings from their dashboard (guest notified); visitors can cancel upcoming bookings from `/account` (suppliers notified); admin can cancel with both notified. |
| **Notifications** | In-app notification system (`vd_notifications` + bell with unread badge in the supplier dashboard and account area). Emitted on: new booking → suppliers; cancellation → counterpart; new message → recipient; supplier approval → supplier. |
| **Search** | Free-text search added to the hero SearchBar and the search page, with typo-tolerant fuzzy matching (edit-distance scaled to word length, prefix and partial matches) across stays, hikes, activities, events and restaurants, combined with the region/date/guest filters. |
| **Recommendations** | New context-aware engine (`lib/recommendations.ts`): live activities, future tour departures with seat availability, and stays are scored against the visitor's region, travel dates, party size, cart contents and booking history — each recommendation displays its reason. Wired into the trip planner (replacing a hardcoded static list) and `/account/recommendations` (replacing fake "recently viewed" and canned picks). |
| Misc | Live activities render their photos on `/activities` (cards previously showed empty squares); booking references are longer and collision-checked against a unique constraint; ids use UUIDs instead of `Date.now()`; `.env.example` documents required configuration. |

---

## 2. CRITICAL — remaining launch blocker

### C1. Checkout collects card data but processes no payment *(deferred by decision)*
Unchanged from the first report, per instruction. The checkout still renders raw card fields, charges nothing, and marks bookings `confirmed`. Stripe SDKs are installed but unused. Before real users pay:
- Integrate Stripe Elements/Checkout (or Paystack/PayFast/Yoco for ZAR).
- Verify payment server-side (webhook) before confirming a booking — and recompute the amount server-side rather than trusting the cart total from `localStorage`.
- Add payment-failed → retry and refund-on-cancellation flows (cancellation currently promises a refund the platform cannot yet execute).
- Remove the raw PAN/CVV inputs — never let card data touch your own forms.

## 3. HIGH priority (open)

0. **Rotate the Google Maps API key.** A real browser key was committed in `frontend/.env.example` (removed in this branch, but it remains in git history). Rotate it in Google Cloud Console and restrict the replacement by HTTP referrer.
1. **Run the migration + verify in production.** The RLS model is only as real as the SQL that's been applied. After running the migration, smoke-test: anon read of `vd_bookings` returns zero rows; a supplier sees only their bookings; an unapproved supplier's listing insert is rejected.
2. **Email notifications.** In-app notifications now exist, but bookings/cancellations should also email guests and suppliers (Resend/Postmark + Supabase Edge Function or a small server action).
3. **Room/date-level availability.** Departure seats are enforced; room inventory across overlapping stay dates still is not (needs per-room calendars — the `/supplier/availability` UI is still a non-persistent shell).
4. **Remaining supplier shell modules:** experiences, packages, events, discounts, availability, staff, guides, media, analytics remain UI-only (drivers/vehicles/routes/reviews persist via the generic entity store). The *Experience* supplier type still has no persistent product. Wire each to `supplier-entities` (the pattern drivers/vehicles/routes already use) or hide the modules until built.
5. **Rate limiting / abuse controls** on client-triggered writes (bookings, messages, notifications inserts, newsletter) — needs an edge/server layer; RLS bounds *who* can write but not *how often*. The notifications insert policy in particular allows any authenticated user to notify any other.
6. **Legacy `/listings/[id]` + admin analytics** still depend on the Render backend; adopt-or-retire decision outstanding.

## 4. MEDIUM priority (open)

1. **Destination depth**: no per-town destination pages (hero/attractions/dining/events/itineraries per region); restaurants and events in search remain hardcoded showcase content.
2. **Images**: still remote Unsplash `<img>` (no `next/image`, no dimensions → CLS); supplier photo "upload" is URL-paste (Supabase Storage exists and is already used by admin media — extend it to supplier wizards).
3. **Client-side rendering of data pages** (crawlers see empty shells despite metadata; N+1 room-price fetches on `/stays` and `/search`). Move reads into Server Components with the server Supabase client; `lib/redis.ts` remains unused.
4. **Messaging** polls every 5s; switch to Supabase Realtime for threads and notifications.
5. **Session-expiry UX**: expired sessions mostly render empty states instead of a "please sign in again" prompt (checkout now handles it).
6. **Accessibility**: focus trapping in mobile menu/dropdowns, `prefers-reduced-motion` support, contrast of small gold-on-white text.
7. **Showcase/live data interleaving** (stays s1–s3, hikes, events, restaurants) — flag or migrate showcase content so "real" vs "demo" is unambiguous.

## 5. LOW priority

- Per-listing `generateMetadata` + BreadcrumbList/Product structured data once detail pages render server-side.
- Newsletter double-opt-in and an admin subscriber view (data now lands in `vd_newsletter_subscribers`).
- Cart can't hold the same activity twice for different dates (`addAddon` dedupes by id).
- Real social profile URLs in the footer.
- Skip-to-content link.

## 6. Technical debt

1. Two backends: FastAPI/Render still deployed but now only backing the admin analytics shell — retire it or finish it.
2. No tests/CI/lint gate; no error monitoring (Sentry) or structured logging.
3. Unused dependencies: stripe (pending C1), react-query (provider mounted, unused), swiper, leaflet (minimal usage), `lib/redis.ts`.
4. `lib/api.ts` surface mostly dead after the admin rewire.
5. Old `supabase/schema.sql` describes normalised tables the app doesn't use — reconcile it with the migration file to avoid confusion.

## 7. Analytics (§14)

Still **no analytics instrumentation** — pageviews, search, booking funnel, supplier signups are untracked. Recommend Plausible/GA4 + a small `track()` helper at the six key events, and Vercel Speed Insights. (Admin "analytics" remains a shell.)

## 8. Suggested launch sequence

1. **Now:** run the migration; smoke-test RLS; deploy this branch.
2. **Sprint 1:** payment integration (C1) with server-side amount verification; booking/cancellation emails.
3. **Sprint 2:** room-level availability, remaining supplier modules (or hide), analytics instrumentation, Supabase Realtime for messaging/notifications.
4. **Sprint 3:** destination pages, server-rendered data pages with `next/image`, retire the Render backend.

### Scoring breakdown (0–100)

| Dimension | Before | Now | Notes |
|---|---|---|---|
| Visitor discovery UX | 70 | 78 | Text search w/ typo tolerance, live activity photos, real recommendations |
| Booking & payment | 15 | 40 | Seat enforcement, cancellations, notifications — still no real payment |
| Supplier experience | 45 | 60 | Real approval gate, booking management, notifications; shells remain |
| Admin | 10 | 55 | Core workflows on live data; analytics/blog/SEO still shells |
| Security & privacy | 20 | 70 | RLS everywhere, role hardening, admin-only CMS writes; no rate limiting |
| Performance | 55 | 58 | Row-level queries replace blob fetches; still client-rendered |
| SEO | 60 | 62 | Unchanged this round; content still client-rendered |
| Accessibility | 50 | 55 | Incremental improvements |
| Observability & analytics | 5 | 5 | Unchanged — nothing instrumented |
| **Overall** | **38** | **62** | Payment (C1) is the remaining blocker |
