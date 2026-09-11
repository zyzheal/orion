-- Migration 261 down: Remove semantic_search_config table

-- NOTE: the migration runner (database.RunMigrations) already wraps each
-- file in its own transaction, so a literal BEGIN;/COMMIT; here commits the
-- runner's transaction early and makes tx.Commit() fail with
-- "pq: unexpected transaction status idle".

DROP TABLE IF EXISTS semantic_search_config;

