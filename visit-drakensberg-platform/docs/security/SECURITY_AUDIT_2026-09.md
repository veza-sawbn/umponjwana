# Production Security & Reliability Audit — Visit Drakensberg Platform

**Date:** 13 September 2026
**Scope:** `visit-drakensberg-platform/` — Next.js 14 frontend (App Router, 33 API routes),
FastAPI backend, Supabase Postgres (57 migrations, RLS + SECURITY DEFINER RPCs),
Supabase Storage, iKhokha payments, Vercel/Render deployment configuration.
**Method:** static review of source, migrations, RLS policies, dependency lockfile and
deploy manifests. **No production data was read, modified or exfiltrated.** No live
exploitation was performed against the deployed environment.

---

## Executive summary

The application is in better shape than its size suggests. SQL injection is structurally
absent (SQLAlchemy ORM on the backend, PostgREST client on the frontend — no string-built
filters anywhere). JSON-LD output is correctly escaped. Admin API routes consistently
re-check the caller's role server-side rather than trusting middleware. The payment
webhook deliberately refuses to trust its own callback body and re-verifies out-of-band
against iKhokha. Several classes the brief asks about genuinely came back clean.

What is weak is concentrated in four places:

1. **A pinned, known-vulnerable Next.js version** whose published CVE defeats the exact
   middleware that gates `/admin`, `/supplier` and `/operations`.
2. **One financial RPC** (`vd_record_order_payment`) that any signed-in customer may call
   against their own order to mark it fully paid, issue themselves a receipt, and write
   balanced ledger entries — without paying.
3. **Unvalidated `X-Forwarded-Host`** used to build the links in password-reset, waiver
   and invite emails, on a code path built specifically to bypass Supabase's redirect
   allow-list.
4. **The absence of whole controls** rather than bugs in them: no rate limiting, no
   security headers, no backup/restore or rollback procedure, no monitoring or alerting,
   no automated tests.

**26 findings: 3 critical, 7 high, 8 medium, 8 low.**

**Remediation status (all fixes on `claude/production-security-audit-b6cy75`):**
24 of 26 fixed and covered by tests. The two open items — **M6** (backups,
PITR, rollback) and **M7** (monitoring and alerting) — are controls that have
to be *set up* rather than patched: a plan tier, an owner, a tested restore.
They are scoped with procedures and unclaimed checkboxes in
[`RESILIENCE_RUNBOOK.md`](./RESILIENCE_RUNBOOK.md).

Everything in this report describes what was found. The ✅ column says what has
since changed on that branch.

| # | Severity | Finding | Area | Fixed |
|---|----------|---------|------|:---:|
| C1 | Critical | Next.js 14.1.0 — middleware auth bypass (CVE-2025-29927) + 4 further CVEs | Dependencies / AuthZ | ✅ |
| C2 | Critical | Customer can mark their own order paid via `vd_record_order_payment` | Payments / RLS | ✅ |
| C3 | Critical | Password-reset & waiver link poisoning via `X-Forwarded-Host` | Broken authentication | ✅ |
| H1 | High | No rate limiting on any endpoint | API abuse / DDoS | ✅ |
| H2 | High | No security headers (CSP, HSTS, frame-ancestors, Referrer-Policy) | Hardening | ✅ |
| H3 | High | Payment webhook is not idempotent across its rollback path | Duplicate transactions | ✅ |
| H4 | High | `vd_book_seats` / `vd_release_seats` callable against any departure | IDOR / integrity | ✅¹ |
| H5 | High | Any user can send an arbitrary email from the platform to any user | Phishing / abuse | ✅ |
| H6 | High | Open redirect in `/api/auth/callback?next=` immediately after session issue | AuthN | ✅ |
| H7 | High | Permanent admin-recovery backdoor endpoint | Broken authentication | ✅ |
| M1 | Medium | Middleware authorizes on unverified `getSession()` | AuthZ | ✅ |
| M2 | Medium | SVG uploads permitted into a public storage bucket | Unsafe file upload | ✅² |
| M3 | Medium | Unauthenticated credential-forwarding proxy at `/api/backend/*` | SSRF / insecure API | ✅ |
| M4 | Medium | Backend session revocation is broken; `/docs` public; vulnerable `python-jose` | AuthN / deps | ✅ |
| M5 | Medium | `site_content` world-readable and drives middleware redirects | RLS / open redirect | ✅³ |
| M6 | Medium | No backups, PITR policy, down-migrations or rollback procedure | Reliability | ☐ |
| M7 | Medium | No structured logging, error tracking, alerting or audit review | Monitoring | ☐ |
| M8 | Medium | Service-role key sent as a bearer token to a host-derived origin | Exposed secrets | ✅⁴ |
| L1–L8 | Low | See [Low findings](#low-findings) | Various | ✅⁵ |

¹ The IDOR in `vd_release_seats` is closed outright. `vd_book_seats` is bounded
(20-seat ceiling, audited) but stays open to authenticated callers, because
`/checkout` genuinely reserves before a booking row exists. Tying a seat hold
to a booking row with a TTL is the real fix and is architectural — see
[Follow-up work](#follow-up-work).
² New uploads only. Any SVG already in the bucket is still public; the
migration carries the query to find them.
³ The redirect's reach is bounded to trusted hosts. The world-readable `select`
on `site_content` is left as-is — every key it holds today is CMS content meant
to be public, and narrowing it would break the anonymous site for no gain. The
exposure to accept is that anything *else* put in that table is public by
default.
⁴ The destination can no longer be chosen by the request. The key still travels
as a bearer token on one internal hop; removing it needs the receipt builder
extracted from the route — see [Follow-up work](#follow-up-work).
⁵ L5 is partly accepted: the admin routes that return a Postgres error message
verify the caller is an admin first, and a constraint name is genuinely useful
when diagnosing a failed invite. The unauthenticated case that mattered
(`/api/backend/*`) is fixed.

### Verification

| Suite | Command | Coverage |
|---|---|---|
| Frontend unit | `npm test` (frontend) | 144 tests — origin allow-listing, redirect validation, rate limiting, constant-time comparison, security headers, route-artwork sanitisation |
| SQL | `npm run test:db` (frontend) | 4 files against the **real** migrations loaded into a throwaway Postgres — payment authorization and idempotency, seat authorization, notification provenance, least privilege |
| Backend | `pytest tests/ -q` (backend) | 17 tests — token type confusion, forged and unsigned tokens, the Supabase audience check, password hashing |

All three run in CI on every push (`.github/workflows/security-tests.yml`),
along with a fourth job that loads `schema.sql` plus all 58 migrations into an
empty database.

**Each regression test was checked against the pre-fix code and observed to
fail there.** A test that passes against the vulnerable version proves nothing,
so the SQL suite was run with the fix migration excluded (C2 fails as
"the statement was ALLOWED, but must be refused") and the backend suite with
`verify_aud` restored to `False` (the three audience cases fail). The procedure
is written up in `supabase/tests/README.md` and `backend/tests/README.md` so
the next person adding a regression test does the same.

### Clean — reviewed, no finding

- **SQL injection.** Backend is 100% SQLAlchemy ORM (`select()` / bound parameters); no
  `text()`, no f-string SQL. Frontend uses the Supabase JS client with parameterised
  filters; no template literal reaches `.or()`, `.filter()`, `.like()` or `.textSearch()`.
- **Reflected XSS.** Only four `dangerouslySetInnerHTML` sites exist; `JsonLd` escapes `<`
  correctly with a documented rationale, two are static strings, and the fourth is L1.
- **CSRF.** State-changing routes are JSON `POST` (unreachable from a cross-site form
  without a preflight the browser will block) and Supabase auth cookies are `SameSite=Lax`.
  Residual risk is H6 (login-CSRF via the callback route), not classic CSRF.
- **Secrets in the repository.** No committed `.env`, key, JWT or connection string in
  the working tree or history. `.env.example` files carry placeholders only.
- **Webhook body trust.** The iKhokha callback body is used only to learn *which* paylink
  to re-verify; the payment outcome comes from an authenticated server-to-server status
  call. This is the right design and should be preserved.

---

## Critical

### C1 — Next.js pinned to 14.1.0: middleware authorization bypass

**Files:** `frontend/package.json`, `frontend/package-lock.json` (resolved `next@14.1.0`),
`frontend/middleware.ts`

`next` is pinned exactly (`"next": "14.1.0"`, not `^14.1.0`), and the lockfile confirms
14.1.0 is what ships. That version is affected by:

| CVE | Impact | Fixed in |
|-----|--------|----------|
| **CVE-2025-29927** | **Middleware bypass** — a request carrying `x-middleware-subrequest` skips middleware execution entirely | 14.2.25 |
| CVE-2024-34351 | SSRF in Server Actions via the `Host` header | 14.1.1 |
| CVE-2024-46982 | Cache poisoning — a crafted request converts a dynamic page into a poisoned static one | 14.2.10 |
| CVE-2025-57752 | Cache key confusion on image optimisation responses | 14.2.32 |
| CVE-2024-51479 | Authorization bypass for paths under the root | 14.2.15 |

CVE-2025-29927 is the severe one **here specifically**, because `middleware.ts` is the only
route-level gate in front of `/admin`, `/supplier` and `/operations`: it decides staff
status, enforces maintenance mode, and redirects unauthorised users. An unauthenticated
request with the header reaches those route trees with middleware skipped.

**Mitigating factor, stated honestly:** Supabase RLS is enforced in Postgres, which
validates the JWT signature independently of Next.js. So bypassing middleware yields the
*console shell* and any data a `anon`/`authenticated` JWT can legitimately read — not
admin data. The admin API routes under `app/api/admin/*` each re-check `profiles.role`
server-side and are unaffected. This is a defence-in-depth failure with real information
disclosure (console structure, page-level client bundles, anything a page renders before
its own guard fires), not an instant full compromise.

**Fix:** upgrade to the latest `14.2.x`, and unpin to `^14.2.x` so patch CVEs land.

---

### C2 — A customer can mark their own order paid without paying

**File:** `frontend/supabase/migrations/20260804_guest_orders_repair.sql` (current
definition), granted at `20260716_order_management.sql:1127`

```sql
create or replace function public.vd_record_order_payment(
  p_order_id text, p_amount numeric, p_type text default 'payment',
  p_method text default 'card', ...
) returns text language plpgsql security definer ... as $$
begin
  ...
  if auth.uid() is not null and v_order.user_id is distinct from auth.uid() and not is_finance() then
    raise exception 'not allowed';          -- ← passes when it IS your own order
  end if;
  if auth.uid() is not null and not is_finance()
     and (v_direction = 'out' or p_method in ('cash','offline')) then
    raise exception 'finance role required'; -- ← p_method='card' sails past
  end if;
  -- …then unconditionally records the payment, updates the order and invoice
  --   to 'paid', issues a receipt and writes balanced ledger entries.
end; $$;

grant execute on function public.vd_record_order_payment(...) to authenticated;
```

The guard answers *"is this your order?"* and *"is this an instrument only staff may
use?"*. It never answers *"did money actually arrive?"* — which for a card payment is a
fact only the iKhokha webhook knows. So the legitimate owner of an order clears both
checks.

**Exploit (no special tooling — the public anon key and a browser console suffice):**

```js
await supabase.rpc('vd_record_order_payment', {
  p_order_id: '<my own vdo-… order id>',
  p_amount: 48500,            // the order total
  p_type:   'payment',
  p_method: 'card',           // not 'cash'/'offline', so no finance gate
  p_reference: 'x',
})
```

Result: `vd_orders.payment_status = 'paid'`, `outstanding_balance = 0`, the invoice flips
to `paid` with `balance = 0`, a sequential receipt is issued, and a balanced journal is
written debiting Cash. Staff dashboards, the invoice PDF and the finance ledger all agree
the trip is paid for. The only surviving discrepancy is a bank reconciliation nobody in
this codebase performs automatically.

The sibling function `vd_apply_order_tip` in `20260806_activity_tips.sql` gets this right —
`if auth.uid() is not null and not is_finance() then raise exception 'finance role
required'; end if;` — which is exactly the shape `vd_record_order_payment` needs.

**Fix:** recording money is a staff-or-service-role action. Require
`is_finance()` for any caller carrying a user JWT, regardless of ownership, and add a
uniqueness constraint on the payment reference (see H3).

---

### C3 — Password-reset, waiver and invite link poisoning via `X-Forwarded-Host`

**Files:** `frontend/lib/origin.ts`, `frontend/app/api/auth/request-password-reset/route.ts`,
`frontend/app/api/waivers/send/route.ts`, `frontend/app/api/admin/ops/invite/route.ts`,
`frontend/app/api/admin/supplier/[id]/transfer/route.ts`

```ts
export function getSiteOrigin(req: Request): string {
  const fwdHost = req.headers.get('x-forwarded-host')     // ← attacker-controlled
  if (fwdHost) {
    const host  = fwdHost.split(',')[0].trim()
    const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0].trim()
    return `${proto}://${host}`                            // ← no allow-list
  }
  ...
}
```

The header is taken first, ahead of `NEXT_PUBLIC_SITE_URL`, with the reasoning that
"forwarded headers … cannot be wrong in the same way". They can: any client may send them,
and Vercel forwards `x-forwarded-host` from the request rather than overwriting it.

This matters most at `/api/auth/request-password-reset`, whose whole design is to *avoid*
Supabase's redirect allow-list — it calls `admin.auth.admin.generateLink()` to obtain a raw
`hashed_token`, embeds it in a URL it builds itself, and mails that via the project's own
SMTP. The one control that would normally catch a poisoned host is deliberately not in the
path.

**Exploit:**

```
POST /api/auth/request-password-reset
X-Forwarded-Host: attacker.example
Content-Type: application/json

{"email":"admin@visitdrakensberg.com"}
```

The victim receives a genuine, correctly-signed email from the real Visit Drakensberg
mailbox containing
`https://attacker.example/auth/reset-password?token_hash=…&type=recovery`.
One click sends a live recovery token to the attacker, who replays it against the real
site. **Full account takeover, including the platform admin account, with no phishing
infrastructure that looks suspicious to the victim.**

The same helper poisons:

- `/api/waivers/send` — leaks the waiver signing token (`/waiver/<token>`), which is a
  bearer credential for signing a legal liability document as another person;
- `/api/admin/ops/invite` and `.../supplier/[id]/transfer` — redirect an invite or a
  supplier-account password-set link to an attacker host.

**Fix:** resolve the origin from a server-side allow-list of known hosts; fall back to
`NEXT_PUBLIC_SITE_URL`. Never let a request header choose the host in a link that carries
a credential.

---

## High

### H1 — No rate limiting anywhere

**Evidence:** no rate-limit implementation exists in the repository (searched frontend,
backend and middleware). `lib/redis.ts` exists but is a cache wrapper that, as written,
never authenticates to Upstash (see L6), so even a Redis-backed limiter has no working
substrate.

Unmetered, unauthenticated or cheaply-authenticated endpoints:

| Endpoint | Abuse |
|----------|-------|
| `/api/auth/request-password-reset` | Mail-bomb any address; burn Supabase auth quota; enumerate via timing |
| `/api/admin/recover-admin` | Offline-free brute force of `ADMIN_RECOVERY_SECRET` (see H7) |
| `/api/notifications/email` | Mass phishing from the platform's domain (see H5) |
| `/api/payments/ikhokha/create` | Forces a paylink creation per call at the gateway |
| `/api/invoices/[id]/pdf` | `@react-pdf/renderer` render per request — CPU exhaustion on serverless |
| `vd_track_event`, `vd_touch_session` (anon RPCs) | Unbounded writes into `vd_analytics_events` |
| `vd_newsletter_subscribers` (`insert with check (true)`) | Unbounded table growth |

There is no WAF configuration, no Vercel firewall rule set, and no per-IP or per-account
budget. DDoS resilience rests entirely on Vercel's platform defaults.

**Fix:** a shared limiter keyed on IP + route for the unauthenticated endpoints, and on
user id for the authenticated ones. Both hot paths (password reset, notification email)
should fail closed.

### H2 — No security headers

`next.config.mjs` defines no `headers()`, `middleware.ts` sets none, and neither
`vercel.json` nor `render.yaml` adds any. The application ships with **no**
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` /
`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` or `Permissions-Policy`.

Consequences specific to this application:

- **Clickjacking of the admin and supplier consoles** — approval flips, payment recording
  and link revocation are all one-click actions in a framable page.
- **`Referrer-Policy` is the worst omission.** The entire customer document model is
  capability URLs: `/invoices/inv-<uuid>`, `/waiver/<token>`, `/quotes/<id>`. With the
  browser default, every outbound link, image and analytics beacon from those pages leaks
  the full URL — the credential — in the `Referer` header to third parties. The invoice
  pages load Mapbox, Google Maps and Unsplash assets.
- No CSP means any XSS that does land (L1, M2) runs unconstrained.

### H3 — The payment webhook is not idempotent across its own rollback path

**File:** `frontend/app/api/payments/ikhokha/webhook/route.ts`

The compare-and-swap on `status='pending'` is good, and the `tip_applied_at` marker is
good. The hole is the error handler:

```ts
const { data: paymentId } = await admin.rpc('vd_record_order_payment', { … })  // ← commits immediately
await admin.from('vd_payment_links').update({ payment_id: paymentId })…
// …booking confirmation, trip-request update, supplier notifications, analytics…
} catch (e) {
  await admin.from('vd_payment_links').update({ status: 'pending' }).eq('id', link.id)  // ← reopens the CAS
  return NextResponse.json({ ok: false }, { status: 500 })
}
```

`vd_record_order_payment` is a separate database round-trip that commits on its own. If
anything *after* it throws — the `payment_id` write, `vd_bookings` update, a notification,
the analytics insert — the handler resets the link to `pending`. iKhokha retries. The CAS
now succeeds again and `vd_record_order_payment` runs a **second** time for the same
paylink, crediting the order twice, issuing a second receipt and writing a second journal.

`vd_order_payments.reference` already carries a natural idempotency key
(`ikhokha:<paylinkID>`) but nothing enforces uniqueness on it.

**Fix:** a unique index on the payment reference, and the RPC returning the existing
payment id instead of raising when the reference repeats. Then the rollback is safe and
retries are genuinely idempotent. Narrowing the `try` block to just the money-recording
step is a good secondary change.

### H4 — Seat inventory is writable by any authenticated user, for any departure

**File:** `frontend/supabase/migrations/20260704_secure_data_layer.sql`

```sql
create or replace function public.vd_book_seats(p_departure_id text, p_seats int) … as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  -- …no check that the caller has a booking on this departure, or owns it
```

`vd_release_seats` is weaker still — it takes any departure id and any seat count and
decrements. Both are granted to `authenticated`.

Any signed-in user (registration is open) can:

- **Deny sales:** call `vd_book_seats('<competitor departure>', <maxSeats>)` to flip a
  departure to `status='full'`, removing it from the public catalogue.
- **Oversell:** call `vd_release_seats` to decrement `bookedSeats` below the real figure,
  so the capacity check passes for seats that are already sold. Guests arrive for a tour
  with no room.

**Fix:** scope both to the departure's owner, a caller holding a booking on it, or a
finance/ops role — and drive releases from the cancellation path rather than from a
client-callable RPC.

### H5 — Anyone signed in can send an arbitrary email from the platform to anyone

**Files:** `frontend/supabase/migrations/20260704_secure_data_layer.sql`,
`frontend/app/api/notifications/email/route.ts`

```sql
create policy "Authenticated create notifications" on vd_notifications
  for insert with check (auth.uid() is not null);   -- any user → any user_id
```

```ts
// app/api/notifications/email/route.ts
const { data: { user } } = await supabase.auth.getUser()
if (!user) return …401                                  // ← the only check
const { data: profile } = await supabaseAdmin()
  .from('profiles').select('email, full_name').eq('id', payload.userId).maybeSingle()
await sendMail({ to: profile.email, subject: payload.title, html: emailHtml({ … }) })
```

The caller supplies `userId`, `title`, `body` and `link`. The server resolves the target's
real address with the service-role client and sends. There is no check that the caller has
any relationship to the recipient, and no rate limit (H1).

So any registered user can send mail **from `noreply@visitdrakensberg.com`, passing SPF
and DKIM**, with a subject and body of their choosing, to any user id they can obtain —
and `link` is rendered as the call-to-action button. "Your payment failed — update your
card" is trivially deliverable to the entire customer base. The body is HTML-escaped, so
this is not XSS; it is high-credibility phishing from a trusted sender.

**Fix:** restrict the insert policy to notifications the caller has standing to raise, and
make the email route derive the notification content from a row it verifies, rather than
from the request body.

### H6 — Open redirect immediately after a session is issued

**File:** `frontend/app/api/auth/callback/route.ts`

```ts
const next = url.searchParams.get('next') ?? '/auth/reset-password'
…
const { error } = await supabase.auth.exchangeCodeForSession(code)
if (!error) return NextResponse.redirect(new URL(next, request.url))
```

`new URL('https://attacker.example/x', base)` returns the *absolute* URL — the base is
ignored. `?next=` is unvalidated, so
`/api/auth/callback?code=…&next=https://attacker.example` sets the session cookie and then
forwards the user off-site. Because the redirect fires on the trusted domain at the end of
an auth flow, it is a strong phishing primitive, and any token or state in the URL
fragment travels with it.

**Fix:** accept only same-origin paths — reject anything not matching `^/(?!/)`.

### H7 — A permanent admin-recovery backdoor

**File:** `frontend/app/api/admin/recover-admin/route.ts`

`POST /api/admin/recover-admin` with `Authorization: Bearer <ADMIN_RECOVERY_SECRET>` sets
an arbitrary password on **any** account by email and grants it `role='admin'` in both
`profiles` and `app_metadata`. The documentation says to rotate the secret after use; it
does not disable itself.

Weaknesses layered on top:

- `providedSecret !== secret` is a non-constant-time comparison.
- No rate limit (H1) — the secret is brute-forceable online with no lockout, no alert and
  no backoff. The `≥32 chars` requirement is advisory, not enforced.
- No audit row is written to `vd_audit`; the only trace is a `console.info`.
- `admin.auth.admin.listUsers({ perPage: 1000 })` loads up to a thousand user records into
  memory on every call, including failed ones.
- The comment claims it "cannot be used to change arbitrary accounts" because it only acts
  on the supplied email. It acts on *whatever* email is supplied — that is every account.

**Fix:** enforce a minimum secret length, compare in constant time, require the account to
be pre-declared in a second env var, write an audit row, and rate-limit by IP.

---

## Medium

### M1 — Middleware authorizes on an unverified token

`middleware.ts` calls `supabase.auth.getSession()` and reads `session.user.app_metadata.role`.
`getSession()` decodes the JWT from the cookie without verifying its signature — Supabase's
own guidance is to use `getUser()` (which round-trips to the auth server) for any
server-side authorization decision. A forged cookie with `app_metadata.role = 'admin'`
satisfies every branch in the middleware.

As with C1, RLS limits the blast radius: Postgres verifies the signature, so forged
credentials read nothing privileged. The exposure is the console shell and its client
bundles, plus maintenance-mode bypass. The file's own comments show careful thought about
`user_metadata` vs `app_metadata` — the remaining gap is the verification step itself.

### M2 — SVG uploads into a public bucket

`frontend/supabase/migrations/20260719_media_storage.sql` creates the `media` bucket with
`public = true` and allows `image/svg+xml` (and `application/pdf`, despite the header
comment saying "images + video only"). `20260726_supplier_media.sql` extends write access
to every approved supplier under `supplier/<uid>/`.

An SVG is an active document: `<script>` inside it executes when the file is opened
directly. Served from `*.supabase.co` it cannot read the application's cookies (different
origin), so this is not a path to account takeover — it is a same-brand-looking phishing
and malware-hosting surface on infrastructure the platform is responsible for, reachable
by any approved supplier.

Related: `frontend/next.config.mjs` allows `remotePatterns` of `*.supabase.co` — a wildcard
across every Supabase project on the internet, not just this one.

**Fix:** drop `image/svg+xml` from `allowed_mime_types` (and `application/pdf` if it is
genuinely unwanted), or serve user SVGs only through a sanitising path.

### M3 — Unauthenticated credential-forwarding proxy

**File:** `frontend/app/api/backend/[...path]/route.ts`

The route accepts `GET/POST/PUT/PATCH/DELETE` on any path, performs **no authentication**,
copies the caller's `Authorization` header through to the upstream, and on failure returns
the resolved upstream URL and raw error text to the caller.

The base is env-derived, so this is not arbitrary-host SSRF. The concerns are:

- `NEXT_PUBLIC_API_URL` is one of the fallbacks — and the root `.env.example` sets that
  variable to **the Supabase REST endpoint** (`https://…supabase.co/rest/v1/`). With that
  configuration the route becomes an unauthenticated relay to PostgREST that forwards a
  caller-supplied `Authorization` header, i.e. an open front door to the database API from
  the application's own trusted origin.
- The error branch echoes internal hostnames and upstream error text.
- A 45-second timeout with no concurrency cap makes it a cheap resource-exhaustion target.

**Fix:** require a session, restrict to an explicit path allow-list, and stop echoing the
upstream URL.

### M4 — Backend: broken revocation, public docs, vulnerable JWT library

**Files:** `backend/app/core/security.py`, `backend/app/api/v1/auth.py`,
`backend/app/main.py`, `backend/requirements.txt`

- **Logout does not revoke anything.** `/auth/logout` writes
  `blacklist:<refresh_token>`, but `get_current_user` checks
  `blacklist:<access_token>` — different key. And `/auth/refresh` never consults the
  blacklist at all, so a "logged out" refresh token keeps minting fresh access tokens for
  its full 7-day life. Session revocation is non-functional.
- **`/docs` and `/redoc` are unconditionally public**, publishing the complete API surface
  including admin routes.
- **`python-jose==3.3.0`** — CVE-2024-33663 (algorithm confusion with an OpenSSH ECDSA
  key) and CVE-2024-33664 (JWT bomb: a crafted JWE consumes unbounded memory → DoS).
- `verify_supabase_jwt` passes `options={"verify_aud": False}`.
- `passlib==1.7.4` is unmaintained and breaks against `bcrypt>=4.1` at runtime.
- No rate limiting on `/auth/login` or `/auth/register` (H1).

### M5 — `site_content` is world-readable and steers middleware redirects

```sql
create policy "Site content is public" on site_content for select using (true);
```

Every key is readable by anonymous callers — including `platform_settings` (the
maintenance flag), `admin_redirects`, `business_details` and every CMS blob. Any
operational or pre-release configuration placed there is public by default.

Separately, middleware follows those redirect rows for any public GET:

```ts
const target = match.to.startsWith('http') ? match.to : new URL(match.to, req.url).toString()
return NextResponse.redirect(target, { status: match.statusCode ?? 301 })
```

A single admin-written row turns any path on the site into a **permanent (301)** redirect
to an arbitrary external host — cached by browsers and hard to undo. That is an intended
feature for legitimate off-site moves, but it concentrates a lot of authority in one CMS
row with no allow-list and no audit entry.

### M6 — No backups, no rollback, no migration discipline

- **No backup or restore documentation anywhere in the repository.** No stated RPO/RTO, no
  PITR retention policy, no evidence of a restore ever being tested. Supabase's own daily
  backup retention differs sharply by plan, and nothing here records which plan this
  project is on or what that implies.
- **No down-migrations.** All 57 migrations are forward-only, and their headers say to
  "Run in the Supabase SQL editor" by hand. Nothing enforces ordering, records what has
  been applied, or provides a rollback path. Several are explicitly sequenced by prose
  ("Run AFTER 20260809_…") rather than by tooling.
- **Destructive rewrites of financial data.** `20260803_invoice_drafts_lines_edit.sql:393`
  and `20260805_admin_fee_tax_override.sql:366` both `delete from vd_order_lines where
  order_id = …` and re-insert. A defect in the re-insert loses invoice lines with no
  snapshot to recover from.
- **Runtime schema-drift handling instead of migration gating.** The iKhokha create route
  contains a `isMissingTipColumn()` helper that detects an un-run migration by pattern
  matching PostgREST error strings. That the code needs this is the finding: deployments
  and migrations are not coupled.
- **No CI.** No `.github/workflows`, no test runner configuration, no tests of any kind.

### M7 — No logging, monitoring or alerting

Observability is `console.error` into Vercel function logs. There is no error tracker
(Sentry or equivalent), no log aggregation, no uptime monitoring, no alerting.

Specifically unmonitored:

- **Failed payment webhooks.** A `502`/`500` return relies on iKhokha retrying; nobody is
  told. An order can sit paid-at-the-gateway and unpaid-in-the-database indefinitely.
- **`vd_audit` is written but never read.** No review process, no alert on
  `invoice.link_revoked`, role changes or admin recovery.
- **No authentication anomaly detection** — no alerting on failed-login bursts, on
  `/api/admin/recover-admin` hits, or on privilege changes.
- Several handlers log full error objects, which for Supabase errors can include query
  fragments and row data. Nothing redacts PII from logs.

### M8 — The service-role key is sent over HTTP to a host-derived origin

**File:** `frontend/app/api/payments/ikhokha/webhook/route.ts`

```ts
const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
fetch(`${origin}/api/receipts/send`, {
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }, … })
```

Using the service-role key as a shared secret for an internal HTTP hop means the most
powerful credential in the system travels over the network on every confirmed payment. If
`NEXT_PUBLIC_SITE_URL` is ever unset, the fallback derives the origin from the inbound
request — which an attacker who can reach the unauthenticated webhook influences. The key
grants unrestricted, RLS-bypassing access to the entire database.

`notify-server.ts` already demonstrates the right answer: do the work in-process instead of
making an authenticated HTTP call to yourself.

---

## Low findings

**L1 — Latent stored XSS via route artwork.** `components/trails/RouteArtwork.tsx` renders
`trail.analytics.routeArtworkSvg` through `dangerouslySetInnerHTML`. Today that value is
generated server-side from GPX coordinates (`lib/gpx.ts`), so it is numeric and safe — but
it lives in the admin-writable `vd_entities.value` JSON with no sanitisation between store
and render. Any future path that lets a value be pasted rather than computed makes this a
stored XSS on public trail pages.

**L2 — Timing-unsafe secret comparisons.** `recover-admin` (`providedSecret !== secret`),
the cron routes (`auth !== \`Bearer ${secret}\``) and `receipts/send`
(`bearer === process.env.SUPABASE_SERVICE_ROLE_KEY`) all compare with `!==`/`===`. Use
`crypto.timingSafeEqual`.

**L3 — Users can rewrite their own notification address.** `20260704_secure_data_layer.sql`
grants `update (…, email, …) on profiles to authenticated`. `notify-server.ts` and
`/api/notifications/email` both resolve the recipient from `profiles.email`, so a user can
redirect their own platform mail to an address they do not control — or set a colleague's
address and receive their own notifications there.

**L4 — Suppliers can self-publish.** `create policy "Owners update own" on vd_entities for
update using (owner_id = auth.uid())` has no `with check` narrowing `status` or `kind`, so
a supplier may move their own draft to `status='active'` (a publicly-readable state) and
bypass the moderation flow the platform otherwise maintains.

**L5 — Internal detail in error responses.** `/api/backend/*` returns the upstream URL and
raw exception text. Several routes return `error.message` straight from Postgres
(`set-level`, `invite`, `ops/assign`, `ops/profile`), exposing constraint and column names.

**L6 — The Redis client never authenticates.** `lib/redis.ts` POSTs to `REDIS_URL` with no
`Authorization: Bearer ${REDIS_TOKEN}` header, while `.env.example` defines `REDIS_TOKEN`
and the backend's `upstash_redis` client uses it. Every frontend cache call fails silently
(`catch { return null }`), so caching is inert — and any rate limiter built on this wrapper
would fail open.

**L7 — Backend CORS is a single origin with credentials.** `allow_origins=[settings.FRONTEND_URL]`
with `allow_credentials=True` and `allow_methods/headers=["*"]`. Correct as long as
`FRONTEND_URL` is exact — but `.env.example` sets it to a bare `umponjwana.vercel.app`
with no scheme, which will not match any browser `Origin` and silently disables CORS.

**L8 — Sequential document numbers.** `vd_next_number('RCP')`, `INV-2608-00001` and order
numbers are sequential. They are correctly excluded from public lookup (`vd_is_unguessable_ref`
demands a UUID), but they disclose business volume wherever they appear.

---

## Notes on the capability-URL model

`20260810_invoice_open_by_id.sql` is candid that anyone holding an invoice URL can read and
pay it, and argues this is equivalent to an emailed PDF. That reasoning holds, and the
implementation is careful: sequential numbers are rejected, revocation closes the id path
permanently, and re-issue never revives a leaked URL.

Two things undercut it from outside that migration, both already listed: the missing
`Referrer-Policy` (H2) leaks those URLs to every third-party asset host the page loads, and
`X-Forwarded-Host` poisoning (C3) puts the waiver variant of the same credential in an
attacker's hands directly. Fixing those two restores the model to what the migration
intends.

---

## Follow-up work

Three things this branch deliberately did not do, each because the right fix is
architectural and a security branch is the wrong place to make an architectural
change quietly.

**Seat holds should belong to a booking (H4).** `vd_book_seats` still lets any
authenticated caller consume seats on any departure, because `/checkout`
reserves them before the booking row exists. The ceiling and the audit line
make abuse bounded and visible, not impossible. The real shape is a
`vd_seat_holds` row keyed to a session with a TTL, claimed by the booking when
it is created and swept when it is not — which is the same pattern
`vd_expire_pending_bookings` already implements for rooms.

**The receipt hop should not be an HTTP call (M8).** The iKhokha webhook posts
to `/api/receipts/send` carrying the service-role key. The destination is now
fixed rather than request-derived, but the key should not be in flight at all.
`lib/notify-server.ts` already solved exactly this — it does the work in
process, with no HTTP hop and no session to satisfy. The receipt builder should
move out of the route the same way.

**Migrations should be applied by a runner, not by hand (M6).** Every migration
header says to run it in the Supabase SQL editor, ordering is enforced in prose,
and the app has grown runtime schema-drift detection as a result
(`isMissingTipColumn()` pattern-matches PostgREST error strings to notice an
un-run migration). CI now proves they all load into an empty database in order;
a runner with a migrations table is the next step.

## Remediation order, as carried out

1. **C1** — upgrade Next.js. One dependency change, closes five CVEs.
2. **C3** — allow-list the origin in `lib/origin.ts`.
3. **H2, H6** — security headers and the open redirect; small, self-contained.
4. **C2, H3** — finance-only payment recording, and a unique reference so a
   retried webhook cannot double-credit.
5. **H4, H5** — seat-release authorization, notification provenance and volume.
6. **H1, H7, L2, L6** — rate limiting, recovery-endpoint hardening,
   constant-time secret comparison, a Redis client that authenticates.
7. **M1–M5, M8, L1, L3, L4, L7** — defence in depth.
8. **M6, M7** — scoped in `RESILIENCE_RUNBOOK.md` rather than closed. These
   need an owner and a plan tier, not a patch.
