#!/usr/bin/env bash
#
# Dump the financial tables to a local directory.
#
# WHY THIS EXISTS (audit finding M6)
#   Supabase's own backups protect against hardware failure and against losing
#   the database. They do not protect against the two failures that actually
#   happen to this platform:
#
#     * a migration or an admin action destroying data INSIDE a healthy
#       database. 20260803_invoice_drafts_lines_edit.sql and
#       20260805_admin_fee_tax_override.sql both delete and re-insert
#       vd_order_lines; a defect in the re-insert loses invoice lines, and a
#       provider snapshot from last night takes every booking since then with
#       it when you restore.
#     * losing access to the Supabase account. A backup that lives only inside
#       the thing you lost is not a backup.
#
#   So this writes a copy somewhere else, under credentials of your choosing.
#
# WHAT IT DOES NOT DO
#   It does not upload anywhere, and it does not encrypt. Both depend on where
#   you are putting this — S3, Backblaze, a NAS — and guessing would be worse
#   than saying so. Pipe the output directory at your own storage, and encrypt
#   it there or with `age`/`gpg` before it leaves the machine. THESE FILES
#   CONTAIN CUSTOMER NAMES, EMAIL ADDRESSES AND PAYMENT RECORDS: treat them
#   exactly as you would the database.
#
# USAGE
#   DATABASE_URL='postgres://…' scripts/backup-financials.sh [output-dir]
#
#   Default output: ./backups/<UTC timestamp>/
#   Use the SESSION pooler or a direct connection, not the transaction pooler.
#
#   Run it daily. A cron entry, a GitHub Actions schedule with the connection
#   string in a secret, or whatever your team already watches — the point is
#   that it runs somewhere that is not the same account as the database.
set -euo pipefail

OUT_ROOT="${1:-./backups}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="$OUT_ROOT/$STAMP"

# The money. Losing any of these means a customer's booking, invoice, payment
# or settlement cannot be reconstructed — unlike catalogue content, which is
# re-enterable, or analytics, which is nice to have.
TABLES=(
  vd_orders
  vd_order_lines
  vd_order_payments
  vd_invoices
  vd_receipts
  vd_ledger_entries
  vd_ledger_accounts
  vd_settlements
  vd_settlement_lines
  vd_bookings
  vd_booking_orders
  vd_payment_links
  vd_quotes
  vd_audit_log
  vd_schema_migrations
  profiles
)

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "error: pg_dump not found. Install the postgresql-client package." >&2
  exit 1
fi

if ! psql -qtAX -c 'select 1' >/dev/null 2>&1; then
  echo "error: cannot reach the database. Set DATABASE_URL or the PG* variables." >&2
  exit 1
fi

mkdir -p "$OUT"
echo "Backing up to $OUT"

# One file per table rather than one dump. A restore is nearly always "this
# one table lost rows", and a per-table file can be loaded into a scratch
# schema and reconciled without touching anything else.
missing=()
for table in "${TABLES[@]}"; do
  exists="$(psql -qtAX -c "select to_regclass('public.$table') is not null" | tr -d '[:space:]')"
  if [ "$exists" != "t" ]; then
    missing+=("$table")
    continue
  fi
  printf '  %-24s ' "$table"
  pg_dump --data-only --column-inserts --no-owner --no-privileges \
          --table="public.$table" --file="$OUT/$table.sql"
  # --column-inserts is slower and larger than COPY, deliberately: the output
  # is readable, diffable, and loadable into a table whose column order has
  # since changed, which is the state you are in when you actually need this.
  printf '%s\n' "$(wc -c < "$OUT/$table.sql" | tr -d ' ') bytes"
done

# The schema too, so a restore has something to restore INTO.
echo "  (schema)"
pg_dump --schema-only --no-owner --no-privileges --file="$OUT/000-schema.sql"

{
  echo "taken_at_utc: $STAMP"
  echo "database:     $(psql -qtAX -c 'select current_database()')"
  echo "server:       $(psql -qtAX -c 'show server_version')"
  echo "migrations:   $(psql -qtAX -c "select count(*) from vd_schema_migrations" 2>/dev/null || echo 'ledger absent')"
  echo "latest:       $(psql -qtAX -c "select filename from vd_schema_migrations order by applied_at desc limit 1" 2>/dev/null || echo '-')"
  [ ${#missing[@]} -gt 0 ] && echo "missing:      ${missing[*]}"
  echo
  echo "Restore into a SCRATCH database, never over the live one:"
  echo "  createdb restore_check"
  echo "  psql -d restore_check -f 000-schema.sql"
  echo "  psql -d restore_check -f vd_orders.sql   # …and the rest, in this order:"
  printf '  %s\n' "${TABLES[@]}"
} > "$OUT/MANIFEST.txt"

if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "note: these tables do not exist in this database and were skipped: ${missing[*]}" >&2
fi

echo
echo "Done. $(du -sh "$OUT" | cut -f1) in $OUT"
echo "Move it off this machine, encrypt it, and record the restore test in"
echo "docs/security/RESILIENCE_RUNBOOK.md §2.3 when you next verify it."
