#!/usr/bin/env bash
#
# Run the SQL security tests against a throwaway Postgres.
#
# Builds the schema the way production actually gets it — supabase/schema.sql
# first, then every migration in filename order — on top of a small Supabase
# shim (00_supabase_shim.sql), then runs each *_test.sql in a transaction that
# is always rolled back. Nothing here ever touches a real project.
#
# Usage:
#   supabase/tests/run.sh                    # uses $PGHOST/$PGPORT/$PGUSER
#   PGHOST=/tmp/pg PGPORT=55432 supabase/tests/run.sh
#
# Requires a reachable Postgres 14+ superuser connection. Exits 0 if every
# test passes, 1 on the first failure, and 77 (skip) if no server is reachable.

set -uo pipefail

cd "$(dirname "$0")/../.."          # -> frontend/
TESTS_DIR="supabase/tests"
DB="${VD_TEST_DB:-vd_security_tests}"

export PGUSER="${PGUSER:-postgres}"
export PGDATABASE=postgres

if ! psql -q -c 'select 1' >/dev/null 2>&1; then
  echo "SKIP: no Postgres reachable (set PGHOST/PGPORT/PGUSER). See $TESTS_DIR/README.md."
  exit 77
fi

echo "==> building $DB"
psql -q -c "drop database if exists \"$DB\";" >/dev/null
psql -q -c "create database \"$DB\";" >/dev/null
export PGDATABASE="$DB"

load() {
  if ! psql -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null 2>"$TESTS_DIR/.last_error"; then
    echo "FAILED to load $1:"
    sed -n '1,20p' "$TESTS_DIR/.last_error"
    exit 1
  fi
}

load "$TESTS_DIR/00_supabase_shim.sql"

# schema.sql before the migrations: 20260823_blog_author_fields.sql alters
# blog_posts, which only schema.sql creates. Nothing enforces this ordering in
# production — it is applied by hand in the SQL editor (see finding M6).
load supabase/schema.sql

for migration in $(ls supabase/migrations/*.sql | sort); do
  load "$migration"
done

load "$TESTS_DIR/helpers.sql"
echo "==> schema built"

failures=0
for test_file in $(ls "$TESTS_DIR"/*_test.sql | sort); do
  name="$(basename "$test_file")"
  echo
  echo "==> $name"
  # Each test file is wrapped in its own transaction and rolled back, so the
  # files cannot affect one another and the database is left clean.
  output=$( (echo 'begin;'; cat "$test_file"; echo 'rollback;') \
            | psql -q -v ON_ERROR_STOP=1 2>&1 )
  status=$?
  echo "$output" | sed -e 's/^NOTICE:  //' -e '/^$/d'
  if [ $status -ne 0 ]; then
    echo "    *** $name FAILED"
    failures=$((failures + 1))
  fi
done

rm -f "$TESTS_DIR/.last_error"

echo
if [ $failures -eq 0 ]; then
  echo "All SQL security tests passed."
  psql -q -d postgres -c "drop database if exists \"$DB\";" >/dev/null 2>&1
  exit 0
fi
echo "$failures test file(s) failed. The database $DB was left in place for inspection."
exit 1
