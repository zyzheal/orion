-- Rollback Migration 131: Drop execution_timelines tables

DROP TABLE IF EXISTS execution_events CASCADE;
DROP TABLE IF EXISTS execution_timelines CASCADE;
