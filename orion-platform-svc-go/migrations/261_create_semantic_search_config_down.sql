-- Migration 261 down: Remove semantic_search_config table

BEGIN;

DROP TABLE IF EXISTS semantic_search_config;

COMMIT;
