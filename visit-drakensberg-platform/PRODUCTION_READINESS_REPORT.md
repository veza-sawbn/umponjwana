# Visit Drakensberg — Production Readiness Report

**Date:** 2026-07-04
**Branch:** `claude/drakensberg-production-audit-5pipb7`
**Scope:** Full-platform audit — every page, workflow, lib and API in `visit-drakensberg-platform/frontend`, plus schema, middleware and deployment config.

**Overall Production Readiness Score: 38 / 100**

The platform has an excellent visual identity, a coherent visitor discovery experience, and a genuinely working supplier → listing → visitor → booking loop for accommodation, tours and activities. It is **not yet safe to launch to real paying users**, primarily because (1) the checkout collects card details but processes no payment, (2) the data layer gives every browser read/write access to all customer PII, and (3) roughly half of the supplier dashboard and the entire admin panel are non-persistent UI shells. These are fixable in a focused hardening sprint; the fixes shipped with this audit close the SEO, error-state, dead-link and broken-journey gaps.

---

## 1. Fixed in this audit (already committed)

| Area | Fix |
|------|-----|
| SEO | Root layout converted from a client component (which disabled the Metadata API for the entire site) to a server component with title template, description, Open Graph, Twitter cards, canonical URLs, `metadataBase` and TravelAgency JSON-LD. Per-section metadata added for the 12 main public routes. `robots.ts`, `sitemap.ts` and a favicon added (none existed). |
| Error states | Added branded `not-found.tsx`, `error.tsx`, `global-error.tsx` (none existed — users saw the unstyled Next.js defaults). |
| Broken journey — password reset | Reset emails linked to `/auth/reset-password`, which **did not exist**. Page created with token validation, expiry handling and success state. |
| Broken journey — post-login | Visitors were redirected after login/registration to `/dashboard`, a **hardcoded demo page** ("Welcome back, Sarah", fake bookings). Now redirects to the real `/account` area; demo pages removed. |
| Dead links | `/about`, `/privacy`, `/terms` (footer + checkout T&C links) created. All homepage/journal story links 404ed — now point at real `/mydrakensberg/*` articles and `/stories` redirects there. Dead `/dining` and `/account/reviews` links removed. Unknown article slugs now 404 instead of silently rendering the wrong article. |
| Duplicate DOM | Root layout renders the navbar globally, but 15 public pages rendered a second identical fixed `<Navbar />` on top of it (double event listeners, duplicate landmarks for screen readers). Removed. |
| Checkout | Empty carts could be "paid" (R0 booking); failures were silently swallowed (`console.error`) leaving the user stuck on a disabled button. Now: empty-cart redirect to `/trip`, visible error toasts, card expiry/CVV sanity validation. |
| Newsletter | Homepage subscribe form was a no-op (`onSubmit={preventDefault}`). Now persists subscribers and confirms/toasts. |
| Auth hardening | Middleware and `requireRole` now prefer `app_metadata.role` (server-controlled) over `user_metadata.role` (self-editable) — see Critical #3 for the remaining work. |
| Performance | `loading="lazy"` added to below-the-fold list images (there was zero lazy loading). Static prerendering now works: 87 pages build statically (previously everything was client-rendered because of the client root layout). |
| Accessibility | aria-labels on icon-only steppers, `aria-live` on guest count, labelled newsletter input, associated labels on new auth forms. |

---

## 2. CRITICAL issues (launch blockers — manual work required)

### C1. Checkout collects card data but processes no payment
`app/checkout/page.tsx` renders raw card number / expiry / CVV fields, then saves the booking as `status: 'confirmed'` **without charging anything**. The card data is (thankfully) never sent anywhere — but that means:
- Suppliers see "confirmed" bookings that were never paid for.
- Collecting PAN + CVV in your own form puts you in PCI-DSS scope the moment a processor is attached this way.
- Stripe SDKs (`stripe`, `@stripe/react-stripe-js`) are installed but completely unused.

**Required:** replace the card form with Stripe Elements/Checkout (or Paystack/PayFast/Yoco for ZAR), verify payment server-side (webhook) before marking a booking confirmed, and add a payment-failed → retry path. Until then the platform must not present itself as taking payment.

### C2. All customer PII is readable and writable by any browser
The entire operational dataset (bookings incl. names/emails/phones, message threads, properties, rooms) lives in single JSON blobs in `site_content`, accessed directly from the client with the anon key. `supabase/schema.sql` defines the policy "public SELECT / admin-only write" — but the app requires visitors and suppliers to write these keys, so the deployed policies must be wide open. Consequences:
- Anyone can `select value from site_content where key='bookings'` and download every customer's contact details (POPIA breach).
- Anyone can overwrite the entire bookings/properties/messages arrays (data wipe with one request).
- Every write is read-modify-write of the whole array — concurrent bookings can silently overwrite each other (already acknowledged in HANDOFF.md).

**Required:** migrate to the normalised tables that already exist in `supabase/schema.sql` (listings, bookings, rooms, notifications — with correct per-row RLS), or at minimum split `site_content` into per-supplier/per-user keyed rows with owner-scoped RLS. This is the largest single work item on the platform.

### C3. Role escalation via self-editable metadata
Roles are stored in `user_metadata` (set at signup from a client-chosen form value). Supabase lets any logged-in user update their own `user_metadata` — i.e. any visitor can grant themselves `role: 'admin'` and pass the middleware check. The audit changed middleware to prefer `app_metadata.role`, but roles are still *assigned* into `user_metadata`.
**Required:** assign roles into `app_metadata` via a service-role backend function or the profiles table (which the schema already has, with a trigger), and make middleware/UI read only from the trusted source. Also note: anyone can self-register as a supplier and immediately access the supplier dashboard — there is no approval gate (the schema's `is_approved` flag is never enforced).

### C4. Admin panel manages a different universe than the live site
The admin dashboard (`/admin/*`) reads/writes a FastAPI backend on Render (`drakensberg-backend.onrender.com`) — a separate Postgres with its own listings/bookings/suppliers. The actual visitor and supplier flows run on Supabase `site_content`. Approving a supplier or "managing bookings" in admin **has no effect on real platform data**. Several admin sections are static UI shells on top of that.
**Required:** pick one data plane. Either wire admin to the Supabase store the site actually uses, or move the site onto the backend API. Until then, admin workflows (approve supplier → supplier goes live) do not exist in practice.

---

## 3. HIGH priority issues

1. **No booking-time availability enforcement.** Nothing blocks double-booking a room, an unavailable date, or an oversold departure (seat counts are updated after payment "succeeds", not checked before; race-prone read-modify-write).
2. **No notifications.** Suppliers get no email/push when a booking arrives; visitors get no confirmation email. The `notifications` table and enum exist in the schema but nothing writes to them. Booking "notification" today = supplier happening to open their dashboard.
3. **Suppliers cannot manage bookings.** No confirm/decline/cancel action exists on `/supplier/bookings`; visitors also have no self-service cancellation (a `cancelled` status exists in the type but no UI sets it).
4. **~half the supplier dashboard is mock/local-state UI:** reviews, experiences, packages, events, discounts, availability, staff, guides, drivers, vehicles, routes, shuttle, media, analytics — none persist. For the promised supplier types this means the *Experience* supplier has no persistent product at all, and the *Shuttle* supplier's vehicles/routes/drivers are mock arrays (only the estimator + checkout shuttle quote flow is real).
5. **Search is not a search engine.** `/search` filters hardcoded showcase arrays (+ live stays/activities) **by region only** — there is no text query, no town/supplier/attraction search, no typo tolerance (despite `pg_trgm` being enabled in the schema, it's unused). The hero SearchBar only selects region/dates/guests. Events and restaurants in results are entirely hardcoded.
6. **Recommendations are static.** `/account/recommendations` and the trip "smart suggestions" use fixed arrays with light region matching; distance, availability, travel dates and booking context are not real inputs (the Google Maps distance work applies to shuttle quotes only). Fails the "no generic recommendations" requirement.
7. **Payment/booking amounts trust the client.** Prices come from localStorage cart state; a tampered cart writes a tampered total. Must be recomputed server-side when C1/C2 are addressed.
8. **`/activities` and `/listings` surfaces are inconsistent** — live supplier activities appear in `/search` but not on the `/activities` listing page (hardcoded a1/a2); `/listings/[id]` depends on the Render backend and 404s/errors when it's cold or empty.
9. **No rate limiting or abuse protection** on any client-triggered write (bookings, messages, newsletter), and no CAPTCHA on registration.
10. **Booking references can collide** (`DBK-XXXX-KZN`, 32⁴ ≈ 1M space, no uniqueness check) and IDs use `Date.now()` — two simultaneous bookings can collide.

## 4. MEDIUM priority issues

1. **Destination/region pages are thin.** `/regions` is a single page with anchors; there are no per-destination pages with the required hero/attractions/accommodation/activities/hiking/restaurants/events/maps/nearby/itineraries structure. Restaurants and events exist only as hardcoded cards in search. **Missing destination data: per-town content (Bergville, Winterton, Underberg, Himeville), restaurants, events, suggested itineraries per region.**
2. **Images are all remote Unsplash `<img>` tags** — no `next/image`, no responsive `srcset`, no width/height (CLS). `next.config.mjs` allows Supabase/Unsplash remotes but the optimiser is unused. Supplier "photo upload" is URL-paste only (no Supabase Storage upload, no validation of the URL).
3. **Client-only rendering of data pages.** Every data page fetches from the browser (`useEffect`), so stays/hikes/activities content is invisible to crawlers despite the new metadata, and every page pays a client waterfall (properties → rooms per property = N+1 queries from the browser). Server Components are unused; Redis caching layer (`lib/redis.ts`) is dead code.
4. **Messaging polls every 5s** per open thread with full-array reads — fine at demo scale, expensive at real scale; Supabase Realtime would be the natural replacement.
5. **Accessibility gaps remain:** icon-only buttons in supplier/admin tables, colour-contrast of gold-on-white small text, focus not trapped in the mobile menu/dropdowns, `motion-reduce` not honoured by framer-motion animations, heading order jumps on some pages.
6. **Session expiry UX:** middleware redirects to login, but in-page Supabase calls that fail after token expiry mostly render empty states with no "session expired, sign in again" messaging.
7. **`vercel.json` env hygiene:** `next.config.mjs` re-exports env vars unnecessarily (`NEXT_PUBLIC_*` are inlined anyway); no `.env.example` exists to document required vars (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `REDIS_URL`, Google Maps key).
8. **Admin "Website" editor nav management is decorative** (its own UI admits changes don't go live). Blog, media, SEO, analytics, permissions and audit-log admin sections are shells; there is **no audit logging anywhere**.
9. **Backend (`/backend`, FastAPI + Alembic) is deployed but unmaintained** relative to the frontend's data model — decide to adopt or retire it (see C4).

## 5. LOW priority improvements

- Add `Metadata` to remaining detail pages (stays/hikes/activities detail are client components → generic titles; needs server wrappers or generateMetadata once data moves server-side).
- BreadcrumbList and Product/Offer structured data on listing detail pages; FAQ schema on `/plan`.
- Newsletter double-opt-in + an admin view of subscribers.
- Trip cart edge cases: same activity for different dates/party sizes can't be added twice (`addAddon` dedupes by id).
- `?edit=1` on any page intercepts all link clicks for ordinary users (harmless but confusing) — gate the editor behind an admin check.
- Consolidate duplicated showcase datasets (search page vs stays page vs tour-dates.ts) into one content module.
- Footer social links point at bare `instagram.com` / `facebook.com` — set real profiles or hide.
- Add `sr-only` skip-to-content link; add `prefers-reduced-motion` variants.

## 6. Technical debt register

1. **`site_content` JSON-blob store** — single biggest debt item; blocks RLS, concurrency, querying, pagination and search (C2).
2. **Two backends** (Supabase blobs + FastAPI/Render) with disjoint schemas (C4).
3. **Dead code:** `lib/redis.ts` (never imported), unused Stripe/react-query/swiper/leaflet deps (leaflet & react-query add bundle weight; maps components exist but leaflet map usage is minimal), `lib/api.ts` surface mostly unused outside admin.
4. **Hardcoded showcase data interleaved with live data** (stays s1–s3, activities a1/a2, hikes, events, restaurants) — makes "is this real?" ambiguous everywhere; move showcase content to a clearly-flagged seed dataset.
5. **No tests, no CI, no lint gate** — zero automated coverage of the booking flow; `npm run lint` is available but not enforced.
6. **No error monitoring** (Sentry or similar) and no structured logging.

## 7. Analytics status (§14 of the brief)

**There is no analytics instrumentation at all** — no page-view tracking, no search/booking/registration events, no funnels. Recommend: a privacy-friendly pageview layer (Plausible/GA4) + a small `track()` helper called at the six key events (search, view listing, add to trip, checkout start, purchase, supplier signup), and Vercel Speed Insights for CWV. The admin analytics screens currently chart data from the disconnected Render backend.

## 8. Suggested launch sequence

1. **Sprint 1 (blockers):** real payment provider + server-side booking creation; move roles to `app_metadata`/profiles; supplier approval gate; RLS-safe storage for bookings & messages (even if listings stay in blobs one more sprint).
2. **Sprint 2 (trust):** booking emails (confirmation + supplier notify), supplier booking management, availability enforcement, cancellation flow.
3. **Sprint 3 (growth):** real text search with `pg_trgm`, live activities surfaced on `/activities`, per-destination pages, analytics instrumentation, image pipeline via `next/image` + Supabase Storage.

### Scoring breakdown (0–100)

| Dimension | Score | Notes |
|---|---|---|
| Visitor discovery UX | 70 | Polished, responsive, now with proper 404/error/SEO states |
| Booking & payment | 15 | Flow completes, but no real payment, no notifications, race-prone |
| Supplier experience | 45 | Core listing types real; half the modules are shells |
| Admin | 10 | Disconnected data plane; mostly shells |
| Security & privacy | 20 | Open data layer, role escalation path, no rate limiting |
| Performance | 55 | Static prerender + lazy images now; no next/image, client waterfalls |
| SEO | 60 | Full metadata/sitemap/robots/JSON-LD now; content still client-rendered |
| Accessibility | 50 | Semantic base is decent; focus/contrast/motion gaps remain |
| Observability & analytics | 5 | None |
| **Overall** | **38** | Weighted toward payment/data-safety blockers |
