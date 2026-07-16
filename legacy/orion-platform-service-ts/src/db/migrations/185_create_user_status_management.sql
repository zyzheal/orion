-- Migration: 185_create_user_status_management.sql
-- Purpose: Support for user status lifecycle management
-- - user_status_history: Audit trail for status changes
-- - users.status constraint: Enforce valid status values

-- User Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS user_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    old_status      VARCHAR(20) NOT NULL,
    new_status      VARCHAR(20) NOT NULL,
    reason          TEXT,
    operator_id     VARCHAR(36) NOT NULL,
    changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_status_history_user ON user_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_history_changed ON user_status_history(changed_at DESC);

-- Ensure users table has status column with proper defaults
-- (This migration is safe to run even if the column already exists)
DO $$
BEGIN
    -- Add status column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'status'
    ) THEN
        ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
    END IF;

    -- Add department column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'department'
    ) THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(100);
    END IF;
END $$;

-- Add check constraint for valid status values
-- (Use DO block to avoid error if constraint already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'users' AND constraint_name = 'users_status_check'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_status_check
            CHECK (status IN ('active', 'suspended', 'terminated', 'deleted'));
    END IF;
END $$;

-- Comment for documentation
COMMENT ON TABLE user_status_history IS 'Audit trail for user status changes (enable/disable/terminate)';
COMMENT ON COLUMN users.status IS 'User employment status: active/suspended/terminated/deleted';

-- Seed: Ensure all existing users without explicit status are marked as active
UPDATE users SET status = 'active' WHERE status IS NULL OR status = '';
