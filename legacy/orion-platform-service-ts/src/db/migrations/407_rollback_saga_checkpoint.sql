-- Rollback migration 407: Drop saga_checkpoints table
DROP TABLE IF EXISTS saga_checkpoints CASCADE;
