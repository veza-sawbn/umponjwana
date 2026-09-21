# SQL security tests

Regression tests for the database half of the September 2026 security audit
(`docs/security/SECURITY_AUDIT_2026-09.md`). Each one reproduces a specific
finding against the real function bodies and RLS policies from
`supabase/migrations/`, not a paraphrase of them.

## Running them

```bash
# Any Postgres 14+ you have superuser access to. A throwaway cluster is fine:
initdb -D /var/tmp/vdpg -A trust
pg_ctl -D /var/tmp/vdpg -o '-p 55432 -k /var/tmp/vdpg' start

PGHOST=/var/tmp/vdpg PGPORT=55432 PGUSER=postgres npm run test:db
```

`run.sh` creates a throwaway database, loads it the way production is actually
built — `00_supabase_shim.sql`, then `supabase/schema.sql`, then every
migration in filename order — runs each `*_test.sql` inside a transaction it
always rolls back, and drops the database when everything passes. It exits 77
(skip) when no server is reachable, so it is safe to wire into CI before a
Postgres service is available.

**No test ever connects to a real project.** Everything runs against the local
throwaway database.

## What the shim is for

The migrations are written against a Supabase project: they assume an `auth`
schema, `auth.uid()` / `auth.role()`, the `anon` / `authenticated` /
`service_role` database roles, and a `storage` schema. Bare Postgres has none
of those, so `00_supabase_shim.sql` creates just enough of them for the
migrations to load. In the shim, `auth.uid()` and `auth.role()` read session
GUCs, which is what `vdtest.act_as()`, `vdtest.act_as_service()` and
`vdtest.act_as_nobody()` set — so a test can say "now I am this customer" and
call the real SECURITY DEFINER function.

The shim is a test fixture. Supabase supplies all of it in a real project, and
the shim is never applied to one.

## Writing a test

`helpers.sql` gives you fixtures (`make_user`, `make_order`) and four
assertions:

| | |
|---|---|
| `vdtest.ok(condition, what)` | condition must be true |
| `vdtest.eq(actual, expected, what)` | values must match |
| `vdtest.raises(sql, pattern, what)` | the statement must be refused, with a message matching `pattern` |
| `vdtest.allows(sql, what)` | the statement must succeed |

`raises` is the important one: a statement that is *allowed* when it should be
refused is exactly the class of bug these tests exist to catch, so it fails
loudly and prints the SQL that got through.

## Prove a test actually catches its finding

A regression test that passes against the vulnerable code is worthless. Before
committing one, run it against the schema without your fix and watch it fail:

```bash
# same as run.sh, but skip the migration containing the fix
for m in $(ls supabase/migrations/*.sql | sort | grep -v YOUR_MIGRATION); do
  psql -q -f "$m" >/dev/null 2>&1
done
psql -f supabase/tests/helpers.sql
psql -f supabase/tests/your_test.sql   # must FAIL here
```
