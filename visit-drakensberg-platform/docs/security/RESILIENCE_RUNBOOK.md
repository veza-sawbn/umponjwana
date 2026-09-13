# Resilience runbook — backups, rollback, monitoring

Companion to `SECURITY_AUDIT_2026-09.md`, covering findings **M6** (no
backups, no rollback, no migration discipline) and **M7** (no logging,
monitoring or alerting).

These two are the only findings in the audit that code alone cannot close.
Everything else in that report was a defect with a patch; these are controls
that do not exist and have to be *set up* — an owner, a paid plan tier, a
tested restore. This document is the decision record and the procedure, so the
work is scoped rather than deferred indefinitely.

**Status: partly done.** The tooling exists now — a migration runner with a
ledger, rollback declarations on every migration, a financial backup script,
and alerting wired into the code. What remains is the part that needs an
account, a plan tier and a person: turning on PITR, pointing the backup script
at storage the team controls, connecting an error tracker, and running a
restore test. Those are the ☐ items below.

---

## 1. What is actually true today

| | Status |
|---|---|
| Database backups | Whatever the Supabase plan provides by default. Nobody has recorded which plan, what the retention is, or whether PITR is on. |
| Restore ever tested | No evidence of one, ever. |
| RPO / RTO | Never stated. |
| Down-migrations | Still none — most of these genuinely cannot be reversed. Every migration now **declares** which it is (`-- @rollback:` … reversible / additive / destructive), and the runner refuses to apply one that does not. |
| Migration runner | `frontend/supabase/migrate.sh`, backed by the `vd_schema_migrations` ledger. Records filename, checksum and duration; skips what is applied; refuses to run if an applied migration has been edited since. Exercised in CI on every push. |
| Migration ordering | Enforced by the runner and proven by CI, which applies all 60 into an empty database on every push. `20260823_blog_author_fields.sql` silently depending on `schema.sql` is how the audit found this. |
| Financial backups | `scripts/backup-financials.sh` dumps the money tables per-table plus the schema and a manifest. **Not scheduled and not uploaded anywhere yet** — see ☐ 2.2. |
| Error tracking | Structured, redacting logger in `frontend/lib/observability.ts`. No external tracker connected yet — see ☐ 4.1. |
| Uptime monitoring | None. |
| Alerting | `frontend/lib/observability.ts` posts to `ALERT_WEBHOOK_URL`; the daily digest reads `vd_audit_log`. **Unset in production**, so nothing is being delivered — see ☐ 4.2. |
| Audit log review | `/api/cron/audit-digest` summarises it daily. Was written diligently and read by nobody. |

CI (`.github/workflows/security-tests.yml`) runs the three test suites and
applies every migration into an empty Postgres through the runner on each
push, so the ordering trap above cannot silently come back and the runner an
operator uses is itself tested.

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

### ☐ 2.2 Schedule the backup this platform controls

A provider-managed backup protects against hardware failure. It does not
protect against the two failures that actually happen here:

- a migration or an admin action that destroys data **inside** a healthy
  database (`20260803_invoice_drafts_lines_edit.sql:393` and
  `20260805_admin_fee_tax_override.sql:366` both `delete from vd_order_lines`
  and re-insert — a defect in the re-insert loses invoice lines);
- losing access to the Supabase account itself.

`scripts/backup-financials.sh` does the dump: the sixteen money tables, one
file each, plus the schema and a manifest recording which migrations the
database was on. Per-table because a real restore is nearly always "this one
table lost rows", and `--column-inserts` because the output has to load into a
table whose column order has since changed, which is the state you are in when
you actually need it.

```bash
DATABASE_URL='postgres://…' scripts/backup-financials.sh /path/to/output
```

What it deliberately does NOT do is upload or encrypt — both depend on where
you are putting it, and guessing would be worse than saying so. **The
outstanding work is the schedule and the destination:** run it daily from
somewhere that is not the same account as the database (a cron box, or a
GitHub Actions schedule with the connection string in a secret), encrypt with
`age` or `gpg` before it leaves the machine, keep 90 days. The dumps contain
customer names, email addresses and payment records — treat them exactly as
you would the database.

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
  first.

This is now mechanical rather than a convention: the declaration goes in a
`-- @rollback:` line in the migration header, all 60 existing migrations carry
one, and `migrate.sh` refuses to apply a migration that does not. Three are
tagged destructive — `20260704_secure_data_layer.sql` (deletes migrated blob
keys from `site_content`) and the two that delete and re-insert
`vd_order_lines` — and the runner stops for a snapshot id before each.

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

### 3.4 The migration runner

`frontend/supabase/migrate.sh`, against the `vd_schema_migrations` ledger.

```bash
DATABASE_URL='postgres://…' supabase/migrate.sh status   # applied vs pending
DATABASE_URL='postgres://…' supabase/migrate.sh plan     # what `up` would do
DATABASE_URL='postgres://…' supabase/migrate.sh up       # apply pending, in order
DATABASE_URL='postgres://…' supabase/migrate.sh verify   # checksums only
```

Use the **session** pooler or a direct connection, not the transaction pooler:
migrations run in explicit transactions and create functions, and neither
survives statement-level pooling.

What it enforces:

- one transaction per migration, so each lands whole or not at all, and a
  failure stops the run instead of continuing into a migration that assumed
  the failed one landed;
- a migration already recorded is skipped;
- a migration whose file changed since it was applied **aborts the whole run** —
  the repository and production disagreeing about the schema is something to
  find out now, not during a deploy;
- every migration must carry a `-- @rollback:` declaration, or it is refused;
- a migration declared `destructive` stops and asks for a snapshot id before
  running (`MIGRATE_YES=1` skips the prompt — CI only, never production).

**Bootstrapping.** `20260914_schema_migrations_ledger.sql` is the one migration
applied by hand, because it creates the ledger. On a database that already
carries the schema it backfills the 60 migrations up to itself with the
sentinel checksum `pre-ledger`; on an empty database it backfills nothing, so
every migration correctly shows as pending.

**Still outstanding:** `isMissingTipColumn()` in the iKhokha create route —
runtime code that pattern-matches PostgREST error strings to detect that
`20260806_activity_tips.sql` has not been run. With the ledger in place that
crutch can go, but removing it changes behaviour on the payment path and
belongs in its own change rather than a security branch.

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
