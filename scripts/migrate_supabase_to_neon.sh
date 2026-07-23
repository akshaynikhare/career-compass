#!/usr/bin/env bash
#
# Migrate the career_test_results table from Supabase -> Neon.
#
# Prereqs: PostgreSQL client tools (psql, pg_dump) installed and on PATH.
#   macOS:   brew install libpq && brew link --force libpq
#   Ubuntu:  sudo apt-get install postgresql-client
#   Windows: install via https://www.postgresql.org/download/ (or use WSL)
#
# You provide two connection strings (both include secrets — keep them private):
#   SUPABASE_DB_URL  Supabase dashboard -> Project Settings -> Database ->
#                    "Connection string" (URI). Use the direct 5432 connection.
#   NEON_DB_URL      Neon dashboard -> Connection Details -> Pooled connection string.
#
# Usage:
#   export SUPABASE_DB_URL='postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres'
#   export NEON_DB_URL='postgresql://user:...@ep-xxxx-pooler.region.aws.neon.tech/dbname?sslmode=require'
#   bash scripts/migrate_supabase_to_neon.sh
#
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL}"
: "${NEON_DB_URL:?Set NEON_DB_URL}"

DUMP_FILE="career_test_results.data.sql"

echo "==> Step 1/4: Inspect Supabase (row count before migrating)"
SRC_COUNT=$(psql "$SUPABASE_DB_URL" -tAc "select count(*) from career_test_results;")
echo "    Supabase has $SRC_COUNT rows in career_test_results."

if [ "$SRC_COUNT" -eq 0 ]; then
  echo "    No rows to migrate. You can 'Start fresh' — just run migrations/001_init.sql on Neon."
  exit 0
fi

echo "==> Step 2/4: Ensure the target table exists on Neon"
psql "$NEON_DB_URL" -f "$(dirname "$0")/../backend/migrations/001_init.sql"

echo "==> Step 3/4: Dump data-only from Supabase (preserves id + created_at)"
pg_dump --data-only --no-owner --no-privileges \
        --table=public.career_test_results \
        "$SUPABASE_DB_URL" > "$DUMP_FILE"
echo "    Wrote $DUMP_FILE"

echo "==> Step 4/4: Load into Neon"
# on_error_stop so a partial/failed import is obvious rather than silent.
psql "$NEON_DB_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

DST_COUNT=$(psql "$NEON_DB_URL" -tAc "select count(*) from career_test_results;")
echo ""
echo "==> Done. Supabase: $SRC_COUNT rows  |  Neon: $DST_COUNT rows"
if [ "$SRC_COUNT" != "$DST_COUNT" ]; then
  echo "    WARNING: counts differ. If you re-ran this, Neon may already have had rows."
  echo "    Inspect with: psql \"\$NEON_DB_URL\" -c 'select count(*), min(created_at), max(created_at) from career_test_results;'"
fi
echo "    Keep $DUMP_FILE as a backup, or delete it (it contains PII)."
