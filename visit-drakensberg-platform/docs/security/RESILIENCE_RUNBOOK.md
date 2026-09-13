# Resilience runbook — backups, rollback, monitoring

Companion to `SECURITY_AUDIT_2026-09.md`, covering findings **M6** (no
backups, no rollback, no migration discipline) and **M7** (no logging,
monitoring or alerting).

These two are the only findings in the audit that code alone cannot close.
Everything else in that report was a defect with a patch; these are controls
that do not exist and have to be *set up* — an owner, a paid plan tier, a
tested restore. This document is the decision record and the procedure, so the
work is scoped rather than deferred indefinitely.

**Status: NOT YET DONE.** The sections marked ☐ are unclaimed. Nothing here is
a description of how the platform currently operates.

---

## 1. What is actually true today

| | Status |
|---|---|
| Database backups | Whatever the Supabase plan provides by default. Nobody has recorded which plan, what the retention is, or whether PITR is on. |
| Restore ever tested | No evidence of one, ever. |
| RPO / RTO | Never stated. |
| Down-migrations | None. All 57 migrations are forward-only. |
| Migration runner | Applied by hand in the Supabase SQL editor, per the migrations' own headers. Nothing records what has been applied where. |
| Migration ordering | Enforced by prose ("Run AFTER 20260809_…"). `20260823_blog_author_fields.sql` silently depends on `schema.sql`, which the audit found by loading everything into an empty database. |
| Error tracking | None. `console.error` into Vercel function logs. |
| Uptime monitoring | None. |
| Alerting | None. |
| Audit log review | `vd_audit_log` is written diligently and read by nobody. |

The one thing this branch did add is CI
(`.github/workflows/security-tests.yml`), which now runs the three test suites
and re-loads every migration into an empty Postgres on each push — so the
ordering trap above cannot silently come back.

---

## 2. Backups

### ☐ 2.1 Establish what the plan gives you

Supabase backup behaviour differs sharply by plan, and the difference is the
whole risk. Record, in this file, on the day you check:

- the project's plan tier;
- whether daily backups are enabled and their retention in days;
- whether **Point-in-Time Recovery** is enabled, and its retention window;
- the physical region the backups live in.

Until PITR is on, the recovery floor is "yesterday's snapshot", and every
booking, payment, invoice and waiver taken since then is gone in a restore.
For a platform that takes money, that is the finding — not a preference.

### ☐ 2.2 Add a backup this platform controls

A provider-managed backup protects against hardware failure. It does not
protect against the two failures that actually happen here:

- a migration or an admin action that destroys data **inside** a healthy
  database (`20260803_invoice_drafts_lines_edit.sql:393` and
  `20260805_admin_fee_tax_override.sql:366` both `delete from vd_order_lines`
  and re-insert — a defect in the re-insert loses invoice lines);
- losing access to the Supabase account itself.

Schedule a `pg_dump` of the financial tables to storage under separate
credentials — `vd_orders`, `vd_order_lines`, `vd_invoices`, `vd_receipts`,
`vd_order_payments`, `vd_ledger_entries`, `vd_settlements`, `vd_bookings`,
`vd_audit_log`. Daily is enough. Encrypt at rest. Keep 90 days.

### ☐ 2.3 Test a restore, then write the date here

An untested backup is a belief, not a control. Once per quarter:

1. restore the most recent backup into a **new** Supabase project;
2. run the SQL security tests against it (`npm run test:db` pointed at the
   restored database) — they exercise real RLS and RPC behaviour and will
   catch a structurally broken restore;
3. spot-check that the newest order, invoice and receipt are present and that
   their totals match what the live console shows;
4. record the date, the duration, and anything that went wrong.

| Date | Restored to | Time taken | Notes |
|------|-------------|-----------|-------|
| — | — | — | *no restore has ever been tested* |

**RTO and RPO are whatever this table demonstrates.** Until there is a row in
it, the platform has no recovery objective, only a hope.

---

## 3. Migrations and rollback

### 3.1 Before applying any migration to production

1. Load it into a scratch database first — `supabase/tests/run.sh` builds one
   from `schema.sql` plus every migration in order. CI does this on every push.
2. Take a manual snapshot (Supabase → Database → Backups → *Create backup*)
   **immediately before** applying anything that writes to or drops data.
   Record the snapshot id in the deploy notes.
3. Apply the migration.
4. Run `npm run test:db` against staging.

### 3.2 Every new migration needs a stated rollback

Not necessarily a `down` script — many of these genuinely cannot be reversed —
but every migration must say, in its header, which of these it is:

- **Reversible**: include the exact SQL that undoes it.
- **Forward-only, additive**: safe to leave in place if the deploy is rolled
  back (a new nullable column, a new function, a new policy). Say so.
- **Destructive**: state what data is at risk and that a snapshot is required
  first. The two `delete from vd_order_lines` migrations are this, and neither
  says so today.

The four migrations added in this security branch are all forward-only and
additive except the payment-reference unique index, whose rollback is
`drop index vd_order_payments_reference_key;`.

### 3.3 Rolling back a bad deploy

Application and database roll back separately, and **the database does not
roll back with the code**:

1. Revert the app first — Vercel → Deployments → *Promote to Production* on
   the last good build. Fastest lever, no data at risk.
2. Decide whether the migration needs undoing at all. An additive one usually
   does not: old code ignores a new column.
3. If it does, and the migration was reversible, apply its documented undo.
4. If it destroyed data, restore from the pre-migration snapshot (3.1 step 2)
   into a **new** project and reconcile, rather than restoring over the live
   database — a restore-in-place discards everything written since the
   snapshot, which for this platform means real bookings and real payments.

### 3.4 ☐ Adopt a migration runner

The end state is `supabase db push` (or Atlas, or Sqitch) with a migrations
table recording what has been applied where, run from CI rather than pasted
into the SQL editor. Until then, the runtime schema-drift detection this
codebase has grown — `isMissingTipColumn()` in the iKhokha create route, which
pattern-matches PostgREST error strings to detect an un-run migration — is
load-bearing. That it needs to exist is the finding.

---

## 4. Monitoring and alerting

### ☐ 4.1 Error tracking

Add Sentry (or equivalent) to the Next.js app and the FastAPI backend.
Minimum useful configuration:

- release tagging, so a spike maps to a deploy;
- `beforeSend` scrubbing of `email`, `customer_email`, `phone`, `token`,
  `token_hash`, `share_token`, `password` and anything matching `sk_`/`eyJ`.
  Several handlers log whole Supabase error objects, which can carry query
  fragments and row data;
- user context limited to the user **id**, never the address.

### ☐ 4.2 Alert on these specifically

Generic uptime checks would not have caught any of the audit's findings. These
would:

| Signal | Why it matters | Suggested threshold |
|---|---|---|
| `/api/payments/ikhokha/webhook` non-2xx | A payment settled at the gateway and not in our database. The route returns 500/502 and relies on iKhokha retrying; nobody is told. | any, immediately |
| `vd_payment_links` stuck `pending` > 1 hour with a paid gateway status | The same failure, seen from the data side | hourly sweep |
| `[rate-limit] … could not be evaluated` | Redis is down, so password reset and admin recovery are failing closed — users cannot reset passwords | any, immediately |
| `admin.recovery_denied` in `vd_audit_log` | Someone is guessing `ADMIN_RECOVERY_SECRET` | any, immediately |
| `admin.recovery_used` | The backdoor was used. Should be near-never | any, immediately |
| `notification rate limit reached` | An account is trying to mailshot other users | > 3/hour |
| `[origin] ignoring untrusted x-forwarded-host` | Someone is attempting the C3 link-poisoning attack | any, immediately |
| `[middleware] ignoring redirect to untrusted host` | An admin_redirects row is pointing off-site | any |
| Role changes (`admin_set_role`, `admin_set_staff_role`) | Privilege escalation, legitimate or not | daily digest |
| 5xx rate | Everything else | > 1% over 5 min |

### ☐ 4.3 Read the audit log

`vd_audit_log` records order creation, payment recording, invoice link
revocation and reissue, role changes, and now seat bookings and admin-recovery
attempts. Nothing surfaces it. A weekly digest to the admin address of
everything in the "alert" table above, plus every `invoice.link_revoked` and
every role change, turns a write-only log into a control.

### ☐ 4.4 Uptime

External checks on `/` (Next.js), `/health` (FastAPI — note the backend runs
on Render's free tier and cold-starts slowly, so allow 45s) and a synthetic
that loads a public listing page. Alert on two consecutive failures.

---

## 5. DDoS and abuse

Rate limiting now exists in the application (`lib/rate-limit.ts`), but it runs
*inside* the serverless function — every limited request still costs an
invocation.

- ☐ Set `REDIS_URL` and `REDIS_TOKEN` in production. Without them the limiter
  falls back to a per-instance counter that bounds one instance, not the
  platform. This is the single highest-value item in this document that is
  purely configuration.
- ☐ Turn on Vercel's WAF / Attack Challenge Mode for `/api/*`, so abusive
  traffic is dropped at the edge rather than billed as invocations.
- ☐ Set a Vercel spend cap. Absent one, a resource-exhaustion attack is a
  billing incident rather than an outage.
- ☐ Move the `/api/cron/*` schedule off the Hobby tier. The tier caps crons at
  daily, which is why abandoned bookings hold inventory for up to 24 hours
  (see `vercel.json` and the `CRON_SECRET` note in `.env.example`).
