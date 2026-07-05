-- Rollback Migration 158: Remove environment lock columns

ALTER TABLE environments DROP COLUMN IF EXISTS locked_reason;
ALTER TABLE environments DROP COLUMN IF EXISTS locked_at;
ALTER TABLE environments DROP COLUMN IF EXISTS locked_by;
ALTER TABLE environments DROP COLUMN IF EXISTS locked;
