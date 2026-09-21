#!/usr/bin/env bash
#
# Apply pending migrations, in order, recording each one.
#
# WHY THIS EXISTS (audit finding M6)
#   Every migration header in supabase/migrations/ says to run it by hand in
#   the Supabase SQL editor, and several sequence themselves in prose. Nothing
#   recorded what had actually been applied where — which is how
#   20260823_blog_author_fields.sql came to depend silently on schema.sql, and
#   why app/api/payments/ikhokha/create/route.ts carries isMissingTipColumn()
#   to detect an unapplied migration at runtime.
#
# USAGE
#   supabase/migrate.sh status          # what is applied, what is pending
#   supabase/migrate.sh plan            # what `up` would do, without doing it
#   supabase/migrate.sh up              # apply everything pending
#   supabase/migrate.sh verify          # checksums only; no writes
#
#   Connection comes from the standard PG* variables, or DATABASE_URL:
#     DATABASE_URL='postgres://…' supabase/migrate.sh status
#
#   Get the connection string from Supabase → Project Settings → Database.
#   Use the SESSION pooler or a direct connection, not the transaction pooler:
#   migrations run in explicit transactions and create functions, neither of
#   which survives statement-level pooling.
#
# GUARANTEES, AND THE ONE IT DOES NOT MAKE
#   * Each migration runs inside its own transaction: it applies completely or
#     not at all, and a failure stops the run rather than continuing into a
#     migration that assumed the failed one landed.
#   * A migration already recorded is skipped.
#   * A migration whose file has CHANGED since it was applied aborts the whole
#     run. Editing an applied migration means the repository and production
#     disagree about what the schema is; finding that out during a deploy is
#     how a site goes down.
#   * It does NOT roll back across migrations. Postgres cannot undo a committed
#     transaction, and most of these migrations are genuinely irreversible.
#     Take a snapshot first for anything destructive — see
#     docs/security/RESILIENCE_RUNBOOK.md §3.
set -euo pipefail

cd "$(dirname "$0")/.."            # -> frontend/
MIGRATIONS_DIR="supabase/migrations"
LEDGER="vd_schema_migrations"

command="${1:-status}"

psql_q() { psql -qtAX -v ON_ERROR_STOP=1 -c "$1"; }

if ! psql -qtAX -c 'select 1' >/dev/null 2>&1; then
  echo "error: cannot reach the database. Set DATABASE_URL or the PG* variables." >&2
  exit 1
fi

# The ledger itself is the bootstrap: it is created by
# 20260914_schema_migrations_ledger.sql, which has to be applied by hand once.
if [ "$(psql_q "select to_regclass('public.$LEDGER') is not null")" != "t" ]; then
  cat >&2 <<EOF
error: $LEDGER does not exist.

Apply this one migration by hand first (Supabase SQL editor, or psql -f):
    $MIGRATIONS_DIR/20260914_schema_migrations_ledger.sql

It creates the ledger and backfills every migration up to and including
itself, so this runner starts from a true picture rather than trying to
re-apply a year of history.
EOF
  exit 1
fi

checksum_of() { sha256sum "$1" | cut -d' ' -f1; }

# GNU date understands %3N; BSD/macOS date prints a literal "3N". Fall back to
# whole seconds there rather than recording a nonsense duration.
now_ms() {
  local t
  t="$(date +%s%3N)"
  case "$t" in *[!0-9]*) echo "$(( $(date +%s) * 1000 ))" ;; *) echo "$t" ;; esac
}

# ── Work out the state of every migration on disk ───────────────────────────
pending=()
changed=()
applied_count=0

for path in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name="$(basename "$path")"
  recorded="$(psql -qtAX -c "select checksum from $LEDGER where filename = '${name//\'/\'\'}'" | tr -d '[:space:]')"
  if [ -z "$recorded" ]; then
    pending+=("$name")
  else
    applied_count=$((applied_count + 1))
    actual="$(checksum_of "$path")"
    # 'pre-ledger' marks the backfilled rows: those files were applied before
    # checksums existed, so there is nothing to compare against and a mismatch
    # would be meaningless rather than alarming.
    if [ "$recorded" != "pre-ledger" ] && [ "$recorded" != "$actual" ]; then
      changed+=("$name")
    fi
  fi
done

report_changed() {
  if [ ${#changed[@]} -gt 0 ]; then
    echo
    echo "CHANGED SINCE APPLIED — the database and this repository disagree:"
    for name in "${changed[@]}"; do echo "  ! $name"; done
    echo
    echo "  A migration that has run is history and must not be edited. Write a"
    echo "  new migration that makes the change instead. If you are certain the"
    echo "  edit is cosmetic, re-record it deliberately:"
    echo "      psql -c \"update $LEDGER set checksum = '<sha256>' where filename = '<name>'\""
  fi
}

case "$command" in
  status|plan)
    echo "applied: $applied_count    pending: ${#pending[@]}"
    if [ ${#pending[@]} -gt 0 ]; then
      echo
      echo "PENDING, in the order they would be applied:"
      for name in "${pending[@]}"; do
        rollback="$(grep -m1 '^-- @rollback:' "$MIGRATIONS_DIR/$name" || true)"
        printf '  + %-60s %s\n' "$name" "${rollback#-- @rollback: }"
      done
    fi
    report_changed
    [ ${#changed[@]} -eq 0 ]
    ;;

  verify)
    report_changed
    if [ ${#changed[@]} -eq 0 ]; then echo "All applied migrations match their recorded checksums."; fi
    [ ${#changed[@]} -eq 0 ]
    ;;

  up)
    report_changed
    if [ ${#changed[@]} -gt 0 ]; then
      echo >&2
      echo "refusing to apply anything while an applied migration has changed." >&2
      exit 1
    fi

    if [ ${#pending[@]} -eq 0 ]; then echo "Nothing pending."; exit 0; fi

    echo "Applying ${#pending[@]} migration(s)."
    for name in "${pending[@]}"; do
      path="$MIGRATIONS_DIR/$name"
      sum="$(checksum_of "$path")"
      rollback="$(grep -m1 '^-- @rollback:' "$path" || true)"

      if [ -z "$rollback" ]; then
        echo >&2
        echo "refusing: $name has no '-- @rollback:' line in its header." >&2
        echo "Every migration must state whether it is reversible, additive or" >&2
        echo "destructive before it runs. See docs/security/RESILIENCE_RUNBOOK.md §3.2." >&2
        exit 1
      fi
      case "$rollback" in
        *destructive*)
          echo
          echo "  !! $name is marked DESTRUCTIVE:"
          echo "     ${rollback#-- @rollback: }"
          echo "     Take a snapshot before continuing (Supabase -> Database -> Backups)."
          if [ "${MIGRATE_YES:-}" != "1" ]; then
            read -r -p "     Snapshot taken? Type the snapshot id to continue: " snapshot
            [ -n "$snapshot" ] || { echo "aborted." >&2; exit 1; }
            echo "     Recorded against this run: $snapshot"
          fi
          ;;
      esac

      printf '  applying %s … ' "$name"
      started=$(now_ms)
      # One transaction per migration: it lands whole or not at all.
      psql -qX -v ON_ERROR_STOP=1 --single-transaction -f "$path" >/dev/null
      duration=$(( $(now_ms) - started ))

      psql -qtAX -v ON_ERROR_STOP=1 -c \
        "insert into $LEDGER (filename, checksum, duration_ms)
         values ('${name//\'/\'\'}', '$sum', $duration)
         on conflict (filename) do update
           set checksum = excluded.checksum,
               applied_at = now(),
               duration_ms = excluded.duration_ms" >/dev/null

      echo "ok (${duration}ms)"
    done
    echo "Done."
    ;;

  *)
    echo "usage: $0 {status|plan|up|verify}" >&2
    exit 2
    ;;
esac
