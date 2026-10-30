#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="upco-pg-test-$$"
cleanup() { docker stop "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=upco_test postgres:17-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" pg_isready -U postgres >/dev/null
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/authorization.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/administration.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/vendors.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/vendor_retention.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/procurement_requests.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 < tests/sql/procurement_multi_items.sql
