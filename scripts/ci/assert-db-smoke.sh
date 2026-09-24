#!/bin/sh
# Runs database/checks/constraint-smoke-test.sql and fails unless every invariant it probes
# behaved as expected. The SQL deliberately provokes violations (and rolls everything back), so
# success means: each expected error appeared, and the Sale & Stock Report closing is 74.
# Needs PGHOST/PGUSER/PGPASSWORD/PGDATABASE for the owner role.
set -eu
out=$(psql -X -f database/checks/constraint-smoke-test.sql 2>&1 || true)

fail=0
expect() {
  if printf '%s\n' "$out" | grep -q -- "$1"; then
    echo "ok   $2"
  else
    echo "FAIL $2 (expected: $1)"
    fail=1
  fi
}

expect 'REQ0458 | REQ0459' 'number series allocates consecutive numbers'
expect 'violates check constraint "ck_balance_nonneg"' 'stock can never go negative'
expect 'idempotency_key' 'a ledger posting cannot be applied twice'
expect 'is append-only (UPDATE not allowed)' 'the stock ledger cannot be rewritten'
expect 'violates exclusion constraint "ex_cycle_overlap"' 'payment cycles cannot overlap'
expect 'violates unique constraint "uq_cycle_single_active"' 'only one cycle can be active'
expect 'violates check constraint "ck_sse_transfer"' 'stock report transfers must be outgoing'
if printf '%s\n' "$out" | grep -A2 'ssr_closing_expect_74' | grep -qE '^\s*74\s*$'; then
  echo "ok   Sale & Stock Report closing formula gives 74"
else
  echo "FAIL Sale & Stock Report closing formula did not give 74"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo '--- psql output ---'
  printf '%s\n' "$out"
  exit 1
fi
