-- Migration 732 down: Drop schema_migrations table

BEGIN;

DROP TABLE IF EXISTS schema_migrations;

COMMIT;
