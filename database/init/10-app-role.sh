#!/bin/sh
# Runs once when the Postgres container initialises an empty volume (local development only).
# Gives the application role a login. Migrations create the role's privileges; the password comes
# from the environment so it is never part of a migration.
set -e
psql -v ON_ERROR_STOP=1 -v app_password="$IE_APP_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
SELECT 'CREATE ROLE ie_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ie_app') \gexec
SELECT format('ALTER ROLE ie_app LOGIN PASSWORD %L', :'app_password') \gexec
SQL
