# Customer Intelligence & Marketing Automation — Architecture Audit + Migration Plan

**Date:** 2026-08-20
**Branch:** `claude/drakensberg-customer-intelligence-dlw5rg`
**Scope:** Pre-implementation audit of the existing platform (per the handoff's §25 "Claude Code Handoff Principle" — audit before building), followed by the proposed schema/architecture for the Customer Intelligence & Engagement System, and a record of what Phase 1 actually shipped in this branch.

This document is the answer to: *"What already exists, what does the new system reuse, and what genuinely needs to be built?"* It is not a spec restatement — the full requirements live in `HANDOFF.md` at the repo root (pasted verbatim from the handoff brief). This is the audit-then-plan step §25 calls for.

---

## 1. What already exists (audit findings)

### 1.1 Data storage — two generations, one now dead
The repo history (see `HANDOFF.md`) shows the platform went through a full migration off a single `site_content` JSON-blob store onto row-level Supabase tables with RLS (`20260704_secure_data_layer.sql` onward). By the time of this audit (36 migrations deep, through `20260823_blog_author_fields.sql`), the blob pattern is retired for everything except CMS copy (`site_content` itself). **The new CRM/analytics system should follow the same convention: real tables, real RLS, `vd_` prefix.** There is no reason to reintroduce a blob store for events or customer data — that would be a regression, not a fresh choice.

### 1.2 Customer/account system
- `profiles` (1:1 with `auth.users`) is the account record: `role` (admin/supplier/visitor), `full_name`, `email`, `phone`, `avatar_url`, `bio`, `supplier_type`, `is_approved`, `loyalty_points`. RLS: users edit a column-granted subset of their own row; `role`/`is_approved` can only change through `admin_set_supplier_approval()`.
- No marketing consent, no tags/interests, no country/city, no acquisition source, no lifecycle stage anywhere in `profiles` or elsewhere. **Confirmed gap** — this is the core of §7/§9 in the handoff and did not exist before this branch.
- `lib/crm.ts` (`buildCustomerProfile`) already builds a *read-only, on-demand* customer view by joining `vd_orders` + `vd_bookings` on email, for the admin Communications Hub. It is not a stored table, has no segmentation, and does nothing with behavioural data. It stays exactly as-is — it's a legitimate, cheap way to answer "what does this admin need right now" and doesn't need to become a stored table just because a CRM exists elsewhere.

### 1.3 Booking & financial system (this is the deep part of the stack)
The booking pipeline is mature and multi-layered — newer and more complete than a green-field CRM project would assume:
- `vd_bookings` — the visitor's single itinerary (visitor + admin only; suppliers were deliberately cut off from the whole-trip view in `20260705_booking_orders.sql` for privacy).
- `vd_booking_orders` — one row per (booking × supplier), the supplier-facing fulfilment record.
- `vd_orders` / `vd_order_lines` — the **financial** master order introduced in `20260716_order_management.sql`: `user_id`, `customer_name`, `customer_email`, `trip_status` (planned/in_progress/completed/cancelled), `booking_status`, `payment_status`, `travel_start`/`travel_end`, `total_value`, `amount_paid`, `outstanding_balance`, double-entry ledger (`vd_ledger_entries`), settlements, guest (no-account) orders.
- This is the richest source of "customer value" data the handoff's §7 asks for (total spend, LTV, upcoming trip, trip count) — **it already exists and needs no new schema**, just reads. Phase 1 segmentation (below) reads directly from `vd_orders`.
- Payment is still deliberately fake (`PRODUCTION_READINESS_REPORT.md` C1) — checkout marks bookings confirmed without charging a card. This doesn't block the CRM work but means "payment_status" data is not yet trustworthy for revenue-accuracy claims beyond what the platform already reports elsewhere.

### 1.4 Supplier architecture
`vd_entities` (one row per property/room/activity/tour/departure/supplier_* profile, `kind` column, owner-scoped RLS, admin/public-read of live rows) is the general-purpose catalogue store nearly everything (`lib/properties.ts`, `lib/activities.ts`, `lib/tours.ts`, `lib/operators.ts`, `lib/transport.ts`, etc.) is a typed wrapper around. Supplier-level intelligence (§19) can be built as **queries over `vd_entities` joined to `vd_order_lines`** — no new supplier table needed for Phase 1/7 groundwork, though a dedicated `vd_supplier_metrics` materialised view is a reasonable Phase 7 addition once the query patterns stabilise.

### 1.5 Authentication
Supabase Auth + `profiles.role`, hardened in the production-hardening branch: `is_admin()`/`is_active_supplier()` SECURITY DEFINER helpers avoid RLS recursion; hard navigation (`window.location.assign`) works around a router-prefetch bug; middleware falls back to `profiles.role` when JWT metadata lacks a role. **New CRM RPCs in this branch follow the exact same SECURITY DEFINER + helper-function convention** (`is_admin()`, plus `auth.role() = 'service_role'` for the one cron-callable function) rather than inventing a new auth pattern.

### 1.6 Email
- `lib/mailer.ts` — plain SMTP via `nodemailer` (moved off Resend because of an MX/subdomain DNS limitation on the current domain setup — see the code comment). `lib/email-layout.ts` provides the shared branded HTML shell.
- Existing send routes are **all transactional**: booking receipts (`/api/receipts/send`), invoices, quotes, waivers, staff-assignment notifications. There is no marketing/campaign sending anywhere, and no email open/click tracking.
- **This matters for §22 (privacy):** transactional and marketing mail already run through visibly different code paths (different route handlers, different triggers), which is the separation the handoff asks for — Phase 5 just needs to keep campaign sends on their own path rather than reusing `sendMail()` calls that are wired to booking events.

### 1.7 Analytics
Confirmed by `PRODUCTION_READINESS_REPORT.md` §7 before this branch: **zero behavioural instrumentation existed.** `/admin/analytics` (`app/admin/analytics/page.tsx`) is real code but derives everything from `vd_orders`/`vd_order_lines`/`profiles` registrations — bookings, revenue, top listings, signups by month. It cannot show a visitor, a pageview, a search, a funnel drop-off, or a traffic source, because none of that was ever captured. This is the single biggest gap between the handoff's ask and the pre-existing platform, and is what Phase 1 of this branch addresses first (see §3 below).

### 1.8 Admin dashboard
`/admin/*` covers overview, suppliers, bookings, listings, finance, settlements, operations, orders, invoices, marketplace, transport, messages, blog, SEO, verification, roles, media, website/editor. Analytics and CRM are the two areas the handoff targets that are genuinely thin today (analytics = order-derived only, CRM = the read-only `lib/crm.ts` projection with no persistence, no segments, no journeys).

### 1.9 APIs
Two backends, confirmed still true: the Next.js app (`app/api/*` route handlers, the real one) and a FastAPI/Render backend (`backend/app/*`) that the production report says is retired in all but the admin analytics *shell* — and even that shell was replaced by the live-Supabase-derived `/admin/analytics` page audited above. **The FastAPI backend is not a dependency of this work and was not touched.** Its `app/models/event.py` is unrelated: ticketed calendar Events (start time, tickets sold), not analytics events — see §1.10.

### 1.10 A naming collision worth flagging explicitly
The codebase already uses the word **"Event"** for a ticketed calendar entity (`lib/events.ts`, `Event` type, `supplier_events` entity kind, `/events` public page, `backend/app/models/event.py`). The handoff's "events" (`page_view`, `trail_view`, `booking_started`, …) are a completely different concept — behavioural analytics events. To avoid any ambiguity in code, migrations, and future search results, every new table/column/function in this system is named `analytics_event(s)` / `vd_analytics_events`, never bare "event(s)".

### 1.11 Data relationships (the shape that matters for this system)
```
auth.users ──1:1── profiles ──1:1── vd_customer_profiles (NEW, this branch)
     │                                        │
     │                                        └── vd_customer_consents (NEW, append-only)
     │
     ├──1:N── vd_sessions (NEW) ──1:N── vd_analytics_events (NEW)
     │              (also anonymous: anon_id, no user_id, until identified)
     │
     └──1:N── vd_orders ──1:N── vd_order_lines
                   │
                   └── vd_bookings / vd_booking_orders (fulfilment side)

vd_customer_segment_members (NEW) ──N:1── vd_customer_segments (NEW)
   (computed from vd_orders + vd_customer_profiles, not hand-maintained)
```

---

## 2. Principle followed: integrate, don't replace

Per §2 and §25 of the handoff, this branch does not introduce a parallel "customers" table, a parallel "bookings" table, or a parallel identity system. Concretely:

| Handoff's "likely core table" (§20) | Decision |
|---|---|
| `customers` | **Reused**: `profiles` (existing) is the account/identity record. |
| `customer_profiles` | **New**: `vd_customer_profiles`, 1:1 extension — kept separate rather than widening `profiles`, because `profiles` already has narrow column-level grants and a signup trigger that other migrations depend on; a second table with its own grants is lower-risk than reshaping a table three prior migrations already assume the shape of. |
| `customer_segments` | **New**: `vd_customer_segments` + `vd_customer_segment_members`. |
| `customer_events` | **New**: `vd_analytics_events` (renamed from the handoff's suggested name to avoid the "Event" collision in §1.10 — carries both behavioural and booking-funnel events, per §21's "one stream" principle). |
| `customer_consents` | **New**: `vd_customer_consents` (append-only audit log) + `vd_set_consent()`/`vd_is_subscribed()`. |
| `bookings` / `booking_items` | **Reused**: `vd_bookings` / `vd_booking_orders` / `vd_orders` / `vd_order_lines` — already exactly this, more mature than the handoff's sketch (full double-entry ledger). |
| `booking_events` | **Not created as a separate table.** Booking-funnel steps (`booking_started`, `booking_step_completed`, `booking_abandoned`, `booking_completed`) are just `event_name` values in `vd_analytics_events`, per §21's explicit instruction that one system should serve analytics, CRM, automation and attribution — a second events table would violate that. |
| `products` / `suppliers` | **Reused**: `vd_entities`, `profiles.role='supplier'`. |
| `email_campaigns` / `email_templates` / `email_events` | **Deferred to Phase 5.** Not created in this branch — see §4. |
| `automation_workflows` / `automation_steps` / `automation_enrollments` | **Deferred to Phase 6.** Not created in this branch — see §4. |
| `analytics_events` | **New**: `vd_analytics_events`. |
| `sessions` | **New**: `vd_sessions`. |
| `traffic_sources` / `campaign_attribution` | **Not a separate table yet.** First-touch acquisition (referrer + UTM) is captured directly on `vd_sessions` at session start; attribution *reporting* (funnel counts, revenue-per-campaign) is a read/aggregation problem over `vd_sessions` + `vd_analytics_events` + `vd_orders`, which is Phase 3 work (dashboards), not a schema gap. A dedicated attribution table becomes worth adding once multi-touch models are needed — noted as a Phase 7 candidate, not built speculatively now. |

---

## 3. What this branch (Phase 1 — Data Foundation) actually ships

Migration: `frontend/supabase/migrations/20260824_customer_intelligence_foundation.sql`. Purely additive — no existing table altered destructively, no column dropped/renamed. Run it after `20260823_blog_author_fields.sql`.

1. **`vd_sessions`** — one row per browsing session (anonymous via `anon_id`, or identified via `user_id` once known), first-touch `landing_page`/`referrer`/UTM fields, `device_type`/`browser`.
2. **`vd_analytics_events`** — the single behavioural event stream (§21). Schemaless `properties jsonb` so new event types (§3's extensibility requirement) need zero migrations.
3. **`vd_customer_profiles`** — CRM extension of `profiles`: `country`, `province_or_city`, `marketing_consent` (cached from the consent log), `communication_preferences`, `tags`, `interests`, `favourite_destinations`, `favourite_activities`, `acquisition_source`, `first_seen_at`/`last_seen_at`, `lifecycle_stage` (visitor → prospect → customer → upcoming_traveller → traveller → returning_customer → advocate, per §1). Seeded for every existing account; the signup trigger now creates one for every new account.
4. **`vd_customer_consents`** — append-only consent audit log (§22) + `vd_set_consent()` / `vd_is_subscribed()` RPCs. Source of truth for `marketing_consent`; nothing ever updates or deletes a row here, "current state" is the latest row per (email, consent_type).
5. **`vd_customer_segments`** + **`vd_customer_segment_members`** — eight of the handoff's §9 segments (Prospects, First-time, Returning, Upcoming Travellers, Recent Travellers, High-value, International, Dormant), seeded as definitions and computed by `vd_recompute_segments()` **directly from existing `vd_orders` data** — real membership from the moment the migration runs, before a single new analytics event has been tracked. (Hiking/Adventure/Accommodation-interest segments are deferred — they need either booked-product-category joins or behavioural signal volume that doesn't exist yet; both are Phase 3/4 work once `vd_analytics_events` has real traffic.) Also derives `lifecycle_stage` from the same pass; never overwrites an admin-set `advocate` flag.
6. **`vd_touch_session()` / `vd_track_event()`** — the public write API. Client code never inserts into the new tables directly; both are SECURITY DEFINER functions that set `user_id` from `auth.uid()` server-side (never trusted from the client), and `vd_track_event()` caps the `properties` payload at 8KB as a basic abuse guard.
7. **`/api/cron/recompute-segments`** (+ `vercel.json` entry, daily) — mirrors the existing `expire-pending-bookings` cron exactly.

### Frontend wiring shipped in this branch
- **`lib/analytics.ts`** — the client `trackEvent()`/`trackPageView()` API, session/anon-id management (localStorage + 30-minute idle timeout), UTM capture from `window.location.search` at first touch.
- **`components/analytics/AnalyticsProvider.tsx`**, mounted once in `AppShell` — fires `page_view` on every route change, excluding `/admin`, `/supplier`, `/operations` (staff activity shouldn't pollute visitor funnels).
- **Newsletter signup** (`app/page.tsx`) now records real consent (`vd_set_consent`, source `newsletter_footer`) and a `newsletter_signup` event alongside the existing `vd_newsletter_subscribers` insert (unchanged).
- **Registration** (`app/auth/register/page.tsx`) gained an explicit, unchecked-by-default marketing-consent checkbox, and now fires `account_created`.
- **Login** (`app/auth/login/page.tsx`) now fires `login`.
- **`/unsubscribe`** — public, no-login opt-out page.

### Deliberately not done in this branch (next steps, in order)
- **Phase 2 — Wix migration.** No Wix export exists in this repo to work from; needs the actual export file(s) from the client before field-mapping/dedup work can start. `vd_customer_profiles`/`vd_customer_consents` are shaped to receive it (`acquisition_source`, consent log with a `source` column that can record `'wix_import'`) but the import tooling itself is unbuilt.
- **Phase 3 — Analytics dashboards & full instrumentation.** `page_view`, `newsletter_signup`, `account_created`, `login` are wired; the ~20 other event types in §3 (`trail_view`, `booking_started`, `favourite_added`, `search_performed`, …) are **not** yet fired from the ~90 route pages that would need them, and the funnel/traffic/executive dashboards in §4–§6 don't exist yet. This is intentionally the next PR, not folded into this one — instrumenting dozens of pages and building the reporting UI is a large, independently reviewable change, and §23 of the handoff explicitly says not to build everything at once.
- **Phase 4 — CRM UI.** No customer-timeline/segmentation browser UI yet; segments are real and queryable in SQL today.
- **Phase 5 — Email campaigns.** No `email_campaigns`/`email_templates`/`email_events` tables yet — deliberately not speculatively created until the sending/tracking design (which ESP, open/click tracking method) is decided, since `lib/mailer.ts` is plain SMTP with no webhook-based engagement tracking today.
- **Phase 6 — Automation engine.** No workflow/enrollment tables yet, same reasoning.
- **Phase 7 — Advanced intelligence.** Supplier-level rollups, predictive segmentation, multi-touch attribution — all read-only work once Phase 3 data volume exists.

---

## 4. Notes for whoever picks up Phase 2+

- **Recompute cadence:** `vd_recompute_segments()` runs daily via cron; it's also admin-callable on demand (`is_admin()` branch) for when a Phase 4 admin UI wants a "recompute now" button.
- **Consent columns to keep populating:** `vd_customer_consents.source` should get a distinct value per entry point (`newsletter_footer`, `registration`, `unsubscribe_link`, `wix_import`, `admin`, and eventually `campaign_preference_centre`) — the existing three are already following that convention.
- **`marketing_consent` vs transactional mail:** nothing in this branch changes how transactional mail is sent (receipts/invoices/quotes/waivers) — those must never check `marketing_consent`, only campaign sends (Phase 5) should.
- **RLS pattern to keep following:** every new table in this migration is RLS-enabled with admin-only (or owner-only) SELECT and *no* client INSERT/UPDATE policy — all writes go through a SECURITY DEFINER function. Keep that pattern for Phase 5/6 tables (`email_events` in particular will want the same shape, since ESP webhooks will write it, not the browser).
