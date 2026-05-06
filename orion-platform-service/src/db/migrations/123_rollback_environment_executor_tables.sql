-- Rollback Migration 123: Drop environment executor state table
DROP TABLE IF EXISTS environment_executor_states CASCADE;
