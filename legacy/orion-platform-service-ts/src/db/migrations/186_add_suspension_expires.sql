-- Migration: 186_add_suspension_expires.sql
-- Purpose: Add suspension_expires_at column to users table
--   for automatic suspension expiry (Task 3.8.9)

-- Add suspension_expires_at column
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_expires_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN users.suspension_expires_at IS 'Auto-restore time for suspended users (NULL = indefinite suspension)';

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_suspended_expiring
    ON users (status, suspension_expires_at)
    WHERE status = 'suspended' AND suspension_expires_at IS NOT NULL;

-- Update existing suspended users without expiry to NULL (indefinite)
UPDATE users SET suspension_expires_at = NULL WHERE status = 'suspended' AND suspension_expires_at IS NULL;
