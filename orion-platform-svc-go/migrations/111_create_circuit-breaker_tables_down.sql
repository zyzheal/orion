-- Auto-generated rollback for version 111. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.
-- REVIEW: unknown or non-reversible statement:
--   DROP TABLE IF EXISTS circuit_breakers

DROP INDEX IF EXISTS "idx_cb_events_timestamp";

DROP INDEX IF EXISTS "idx_cb_events_tenant";

DROP INDEX IF EXISTS "idx_cb_events_cb_id";

DROP TABLE IF EXISTS "circuit_breaker_events" CASCADE;

DROP INDEX IF EXISTS "idx_circuit_breakers_created";

DROP INDEX IF EXISTS "idx_circuit_breakers_service";

DROP INDEX IF EXISTS "idx_circuit_breakers_state";

DROP INDEX IF EXISTS "idx_circuit_breakers_tenant";

DROP TABLE IF EXISTS "circuit_breakers" CASCADE;
