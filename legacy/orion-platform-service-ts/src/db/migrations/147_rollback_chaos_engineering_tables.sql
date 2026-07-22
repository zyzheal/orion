-- Rollback migration 147: Drop chaos engineering tables

DROP TABLE IF EXISTS chaos_runs;
DROP TABLE IF EXISTS chaos_experiments;
