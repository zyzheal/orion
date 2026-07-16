-- Migration 158: Environment lock/protection columns
-- Prevent accidental deployments to locked environments (especially production)

ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked_by VARCHAR(255);
ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE environments ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- Rollback:
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked_reason;
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked_at;
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked_by;
-- ALTER TABLE environments DROP COLUMN IF EXISTS locked;
