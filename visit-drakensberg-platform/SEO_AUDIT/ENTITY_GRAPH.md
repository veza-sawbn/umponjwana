# Visit Drakensberg — Entity Graph
*Current state vs required state for SEO strategy*

---

## Current Entity Map (from codebase inspection)

### Storage: `vd_entities` table (`kind` column discriminator)

| Kind | Domain Type | Public Slug? | SEO Metadata? | Own URL? | Notes |
|---|---|---|---|---|---|
| `property` | Accommodation | ❌ (uses `prop-<uuid>`) | ❌ | `/stays/[id]` — uses UUID | No slug, no SEO fields |
| `room` | Room under property | ❌ | ❌ | None (shown on property page) | Sub-entity of property |
| `activity` | Activity/Experience | ❌ (uses `act-<uuid>`) | ❌ | `/activities/[id]` — uses UUID | No slug, no SEO fields |
| `tour` | Guided tour product | ❌ | ❌ | None (shown on hike page) | Supplier product, no own URL |
| `departure` | Scheduled tour date | ❌ | ❌ | `/experiences/[id]` | Commercial page, not editorial |
| `operator_profile` | Tour operator | ❌ (uses `opr-<uuid>`) | ❌ | `/guides/operators/[id]` | No slug, no SEO fields |
| `supplier_guides` | Individual guide | ❌ | ❌ | `/guides/[id]` | No slug, no SEO fields |
| `supplier_availability` | Availability block | ❌ | ❌ | None | Admin/supplier only |
| `supplier_discounts` | Discount codes | ❌ | ❌ | None | Admin/supplier only |
| `supplier_events` | Supplier events | ❌ | ❌ | None (shown on /events) | Partial |
| `supplier_packages` | Supplier packages | ❌ | ❌ | None | Superseded by admin packages |
| `supplier_staff` | Staff members | ❌ | ❌ | None | Internal only |
| `supplier_vehicles` | Transport vehicles | ❌ | ❌ | None | Internal only |
| `supplier_drivers` | Drivers | ❌ | ❌ | None | Internal only |
| `supplier_routes` | Fixed routes | ❌ | ❌ | None (superseded by dispatch) | Legacy |
| `package` | Admin-curated package | ❌ | ❌ | `/packages/[id]` | No slug, no SEO |
| `transport_company` | Transport operator | ❌ | ❌ | None (no public page) | No public listing yet |
| `transport_insights` | Route demand data | ❌ | ❌ | None | Analytics only |

### Storage: `site_content` table (JSON blobs)

| Key | Domain Type | Public Slug? | SEO Metadata? | Own URL? | Notes |
|---|---|---|---|---|---|
| `trails` | Trail/Hike | `slug?` field (optional) | ❌ | `/hikes/[id]` | Defaults use slug-style IDs; blob storage prevents per-row ops |
| `regions` | Destination region | `slug` field | `seoTitle` + `seoDescription` | `/regions` only — NO `/regions/[slug]` | Page exists for listing but not for individual regions |
| `reserves` | Nature reserve | ❌ | ❌ | `/nature-reserves` only | No individual pages |
| `towns` | Towns/Villages | ❌ | ❌ | `/towns` only | No individual pages |
| `hero`, `footer`, etc. | CMS content | N/A | N/A | N/A | Homepage only |

### Storage: `schema.sql` tables (legacy/parallel)

| Table | Status | Notes |
|---|---|---|
| `listings` | Superseded by `vd_entities` | Has `slug`, `meta_title`, `meta_description` columns — better designed for SEO than the current vd_entities approach |
| `blog_posts` | Exists in schema, admin blog UI is a shell | Has `slug`, `status`, `featured_image`, `related_listing_ids` |
| `guides` | Superseded by `supplier_guides` in vd_entities | Has `fgasa_cert_number`, `verification_status` |
| `bookings` | Superseded by `vd_bookings` | — |
| `packages` | Superseded by `package` kind in vd_entities | — |
| `events` | Has structured columns; vd_entities `supplier_events` in parallel | — |
| `reviews` | Schema defined; UI is mock | Has `listing_id` FK |
| `itineraries` | Schema defined; used as booking addon | — |

---

## Entity Relationship Diagram — Current State

```
site_content.regions (blob)
  → has many site_content.trails (blob, via region string match)
  → has many vd_entities[property] (via region string)
  → has many vd_entities[activity] (via region string)
  → has many vd_entities[tour] (via trailId → trail region)

site_content.trails
  → has many vd_entities[departure] (via trailId)
  → has many vd_entities[tour] (via trailId)
  → departure → operator_profile (via supplierId)
  → departure → supplier_guides (via guide name string — NOT FK)

vd_entities[property]
  → has many vd_entities[room] (via propertyId string in value)
  → belongs to region (string, not FK)
  → has supplierId → profiles (FK via owner_id)

vd_entities[activity]
  → has supplierId → profiles (FK via owner_id)
  → has region (string)

vd_entities[tour]
  → has trailId (string, references trail.id in blob)
  → has supplierId → profiles (FK)
  → has many vd_entities[departure] (via tourId)

vd_entities[operator_profile]
  → has many supplier_guides (via supplierId)
  → has many tours (via supplierId)
  → has many departures (via tour → departure chain)

vd_entities[package]
  → components[] (array of {type, supplierId, entityId, ...})
  → references properties, tours, activities by ID
  → has region (string)

vd_entities[transport_company]
  → has serviceAreas[] (regions)
  → has many vd_transport_requests (via dispatch engine)

vd_bookings
  → references visitor (profiles.id)
  → has addons[] (array of ad-hoc objects — not FKs)
  → has stays[] (array of ad-hoc objects — not FKs)
  → has many vd_booking_orders (one per supplier)

vd_orders
  → references vd_bookings (booking_id)
  → has many vd_order_lines
  → has many vd_invoices
  → has many vd_order_payments

profiles
  → has role: admin | supplier | visitor
  → has is_approved: boolean
  → has supplier_type: text
```

---

## Entity Relationship Diagram — Required for SEO Strategy

```
Destination (site_content.regions → own page)
  → slug: north-berg → /regions/north-berg ← MISSING
  → has many Trails
  → has many Properties (accommodation)
  → has many Activities
  → has many Tours (via trails)
  → has many Guides (via operators in region)
  → has many Packages (via region)
  → has many Events (via region)
  → has many Articles (via region tag)

Trail (site_content.trails → own page per trail)
  → slug: tugela-falls → /hikes/tugela-falls ← ALREADY EXISTS
  → belongs to Destination (region)
  → has many Departures (vd_entities[departure])
  → has many Tours (vd_entities[tour])
  → has many Operators (via tours → supplierId)
  → has many Guides (via supplier_guides → operator → trail)

Property (vd_entities[property])
  → needs slug → /stays/[slug] ← UUID only currently
  → belongs to Destination (region string)
  → has many Rooms (vd_entities[room])
  → has supplierId → Operator

Activity (vd_entities[activity])
  → needs slug → /activities/[slug] ← UUID only currently
  → belongs to Destination (region string)
  → has supplierId → Operator

Guide/Operator (vd_entities[operator_profile] + supplier_guides)
  → needs slug → /guides/operators/[slug] ← UUID only currently
  → has operatingRegions[] → Destinations
  → has many Guides (supplier_guides)
  → has many Tours

Package (vd_entities[package])
  → needs slug → /packages/[slug] ← UUID only currently
  → has region → Destination
  → components[] → Trails, Properties, Activities, Guides

Experience/Departure (vd_entities[departure])
  → /experiences/[id] ← EXISTS (commercial, not editorial)
  → references trailId → Trail
  → references tourId → Tour → Operator/Guide
```

---

## Missing Relationships (by SEO priority)

| Missing Link | Impact | Effort |
|---|---|---|
| Destination → individual URL `/regions/[slug]` | CRITICAL — no destination landing pages | Low (add `[slug]` route to existing regions system) |
| Trail → accommodation nearby | HIGH — internal linking gap | Medium (region-based query) |
| Trail → available guides | HIGH — commercial conversion | Low (region/trail filter on operator_profiles) |
| Property → region page | HIGH — internal linking gap | Low (add link in property template) |
| Activity → region page | HIGH — internal linking gap | Low |
| Package → component entities | HIGH — deep linking | Medium (parse components[]) |
| Trail → related trails (same region) | MEDIUM | Low (already partially done for default trails) |
| Guide → trails they operate on | MEDIUM | Medium (need tour→trail lookup) |
| Articles → entities | MEDIUM | Low (add `relatedListings` to blog system) |
| Property → nearby trails | MEDIUM | Low (region-based query) |

---

## Entity SEO Readiness Checklist

| Entity | Exists | Stable ID | Public Slug | Canonical URL | SEO Metadata | Structured Data | Index Status |
|---|---|---|---|---|---|---|---|
| Region/Destination | ✅ | ✅ | ✅ slug field | ❌ No `/regions/[slug]` page | ✅ seoTitle/seoDesc | ❌ | ❌ Not indexed (no page) |
| Trail/Hike | ✅ | ✅ (slug-style for defaults) | ⚠️ Optional field | ✅ `/hikes/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Property/Accommodation | ✅ | ✅ prop-uuid | ❌ No slug | ✅ `/stays/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Activity | ✅ | ✅ act-uuid | ❌ No slug | ✅ `/activities/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Tour (product) | ✅ | ✅ | ❌ No slug | ❌ No public URL | ❌ | ❌ | ❌ Not indexed |
| Departure/Experience | ✅ | ✅ | ❌ No slug | ✅ `/experiences/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Operator Profile | ✅ | ✅ opr-uuid | ❌ No slug | ✅ `/guides/operators/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Guide Profile | ✅ | ✅ | ❌ No slug | ✅ `/guides/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Package | ✅ | ✅ | ❌ No slug | ✅ `/packages/[id]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Nature Reserve | ✅ (blob) | ⚠️ | ❌ | ❌ No individual URL | ❌ | ❌ | ❌ Not indexed |
| Town | ✅ (blob) | ⚠️ | ❌ | ❌ No individual URL | ❌ | ❌ | ❌ Not indexed |
| Article | ✅ (hardcoded) | ✅ slug | ✅ | ✅ `/mydrakensberg/[slug]` | ❌ No metadata | ❌ | ⚠️ Client-rendered only |
| Event | ⚠️ (partial) | ❌ | ❌ | ❌ No individual URL | ❌ | ❌ | ❌ Not indexed |
| Shuttle/Route | ✅ (dispatch) | ❌ | ❌ | ❌ No entity pages | ❌ | ❌ | ❌ |
