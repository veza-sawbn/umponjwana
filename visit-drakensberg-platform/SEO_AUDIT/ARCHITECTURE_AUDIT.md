# Visit Drakensberg — Architecture Audit
*Produced: 2026-08-11 against branch `claude/drakensberg-seo-audit-73n17z`*

---

## A. Framework & Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js App Router | 14.1.0 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^3.4.1 |
| Database | Supabase (PostgreSQL + Auth + Storage) | ^2.39.0 |
| State | React (hooks) + Zustand | ^18 / ^4.5 |
| Forms | react-hook-form + Zod | ^7 / ^3 |
| Animation | Framer Motion | ^11 |
| Maps | React Leaflet + Leaflet | ^4 / ^1.9 |
| Payments | Stripe (wired but fake) + iKhokha | ^14 |
| Email | Resend (via Nodemailer) | — |
| Backend | FastAPI on Render (analytics shell only) | — |

---

## B. Application Architecture

### Routing
The application is built on **Next.js 14 App Router**. All pages live under `frontend/app/`.

**Critical finding: 123 of 130 `page.tsx` files are declared `'use client'`.**

This means the overwhelming majority of the public-facing site renders entirely on the client. This has severe SEO consequences because:

1. `generateMetadata()` cannot be exported from a `'use client'` file — it will be silently ignored.
2. Dynamic entity pages (`hikes/[id]`, `stays/[id]`, `activities/[id]`, `guides/[id]`, `packages/[id]`, `experiences/[id]`) have no server-rendered title, description, Open Graph, canonical, or structured data.
3. Search engine crawlers that do not render JavaScript will see empty shells on every detail page.

The only server-rendered metadata that currently works:

| Location | Type | Scope |
|---|---|---|
| `app/layout.tsx` | Root `metadata` export | Site-wide fallback |
| `app/hikes/layout.tsx` | Static `metadata` export | `/hikes` listing only |
| `app/stays/layout.tsx` | Static `metadata` export | `/stays` listing only |
| `app/activities/layout.tsx` | Static `metadata` export | `/activities` listing only |
| `app/guides/layout.tsx` | Static `metadata` export | `/guides` listing only |
| `app/shuttles/layout.tsx` | Static `metadata` export | `/shuttles` only |
| `app/packages/layout.tsx` | Static `metadata` export | `/packages` listing only |
| `app/events/layout.tsx` | Static `metadata` export | `/events` only |
| `app/regions/layout.tsx` | Static `metadata` export | `/regions` listing only |

**No `generateMetadata()` exists anywhere in the codebase.**

### Data Access Pattern

All application data flows through two storage mechanisms:

**1. `vd_entities` table — Live catalog rows**
Every business entity (property, room, activity, tour, departure, guide profile, operator profile, package, transport company, and all `supplier_*` subtypes) is stored as a single row with columns:

```
id text PRIMARY KEY          — entity identifier
kind text NOT NULL           — entity type discriminator
owner_id uuid                — auth user (supplier) who owns this row
status text DEFAULT 'active' — controls public visibility via RLS
value jsonb NOT NULL DEFAULT '{}'  — the full domain object
created_at / updated_at
```

This is a **polymorphic entity store**, not a normalised relational schema. Every domain lib (`properties.ts`, `activities.ts`, `tours.ts`, `operators.ts`, etc.) wraps `lib/entities.ts` which performs generic CRUD against this table.

**Implication for SEO**: IDs are generated as `<prefix>-<uuid>` (e.g. `prop-3c9b2d5a-...`). These are not human-readable slugs. Detail pages currently use these IDs in their URLs.

**2. `site_content` table — CMS JSON blobs**
Content that is not live catalog data is stored in the `site_content` table as JSON blobs keyed by a string name:

| Key | Contents | Now admin-only write |
|---|---|---|
| `trails` | All trail records as a JSON array | ✅ |
| `regions` | Region records | ✅ |
| `reserves` | Nature reserve records | ✅ |
| `towns` | Town records | ✅ |
| `hero`, `footer`, etc. | Homepage/CMS content | ✅ |

**Critical finding: Trails are NOT stored in `vd_entities`.** They live as a single JSON blob in `site_content`. This means trails cannot benefit from per-row RLS, cannot be queried individually, and do not support efficient per-entity operations.

### Server/Client Component Usage

The application was built code-first as a React SPA and converted to Next.js without restructuring the data-fetching layer. Every page component uses `useEffect` + `useState` to fetch data on the client after mount. This is functionally equivalent to a client-side SPA with no server rendering.

**What should be server components (but isn't)**: Every public detail page.

### Static Generation

No `generateStaticParams()` exists anywhere. No ISR (`revalidate`) is configured. No static path generation for any entity type. All dynamic routes are fully dynamic (not pre-rendered).

### API Architecture

Route handlers exist under `app/api/` for:
- Admin operations (invite, role assignment, ops)
- Channel/notification sends
- Payment processing (iKhokha webhook)
- Receipt/invoice email sending
- Cron job (expiring pending bookings)
- Backend proxy (FastAPI pass-through)

These are all server-side and correctly handle secrets. They are not relevant to the SEO strategy.

### Authentication

Supabase Auth with three roles: `admin`, `supplier`, `visitor`. Role enforcement at two layers:
- Middleware (reads `app_metadata.role`, falls back to `profiles.role`)
- RLS policies on all `vd_*` tables

Admin and supplier pages are correctly excluded from indexing by `robots.ts`.

### Deployment

No deployment config is explicit in the frontend. The platform was designed for Vercel (implied by Next.js 14 + Supabase Auth helpers). `render.yaml` in the project root configures the FastAPI backend.

---

## C. Admin Interfaces — Current State

| Admin Page | Status | SEO-Relevant? |
|---|---|---|
| `/admin/seo` | **Non-functional** — saves to local React state only, never persists | YES (broken) |
| `/admin/trails` | **Functional** — full CRUD with GPX + media; no SEO fields | YES (missing SEO) |
| `/admin/regions` | **Functional** — seoTitle + seoDescription fields present | YES (partial) |
| `/admin/listings` | **Functional** — live Supabase data | INDIRECT |
| `/admin/suppliers` | **Functional** — live Supabase data | INDIRECT |
| `/admin/packages` | **Functional** — full package builder | YES (no SEO fields) |
| `/admin/website` | **Functional** — homepage content editor | INDIRECT |
| `/admin/blog` | **UI shell** — no persistence to blog_posts table | YES (broken) |
| All other admin pages | Functional for their specific purpose | NO |

---

## D. Data Flow Diagram

```
Browser
  ↓ useEffect on mount
  ↓ Supabase JS client (anon key)
  ↓ RLS filter
  ↓ vd_entities rows (kind-filtered)
  ↓ lib/[entity].ts → hydrate React state
  ↓ render page
```

vs what SEO requires:

```
Crawler / Next.js build
  ↓ generateStaticParams (or dynamic route)
  ↓ Server Component fetch (no browser required)
  ↓ generateMetadata (returns title, description, OG, canonical)
  ↓ Server-rendered HTML with structured data
```

The current architecture and the SEO requirement are operating at opposite ends of the rendering pipeline.

---

## E. Key Architectural Constraints

1. **Trails in site_content blob** — must migrate to vd_entities (one row per trail) to support per-trail URLs, metadata, and query
2. **No slug columns** — properties, activities, tours, packages, guides have no human-readable slug; URLs currently use `prop-uuid` style IDs
3. **All pages are client components** — a targeted refactor of public detail pages to server components is required to enable generateMetadata
4. **Admin SEO panel is non-functional** — the existing `/admin/seo` page never saves; all changes are lost on refresh
5. **No structured data on entity pages** — only a global TravelAgency JSON-LD on the root layout
6. **No canonical on dynamic pages** — the sitemap correctly omits dynamic pages; canonical is set only on listing pages
7. **No breadcrumbs** — neither visual breadcrumbs nor BreadcrumbList schema exist

---

## F. What Already Works Well

1. The root metadata template (`%s | Visit Drakensberg`) is correctly configured
2. `robots.ts` correctly protects admin/supplier/checkout from indexing
3. Section-level `layout.tsx` metadata is correctly inherited by client page children
4. `metadataBase` is set to the production URL
5. Open Graph + Twitter Card metadata is present at root level
6. The 404 page is a proper server component with metadata
7. The sitemap covers all major static routes and editorial articles
8. A visual page editor (`/admin/editor`) exists for homepage content
9. Admin trail editor has GPX analytics, region assignment, featured flag, status (published/draft)
10. Region records already have `seoTitle` and `seoDescription` fields
11. Entity status system (`active/draft`) can gate public visibility
