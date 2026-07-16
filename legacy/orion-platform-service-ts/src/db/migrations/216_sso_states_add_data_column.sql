-- Migration 216: Add data column to sso_states for PostgreSQL-backed state storage
-- The existing sso_states table stores state/provider but not the auth data payload.
-- This migration adds a 'data' column to store the JSON-serialized auth state.

ALTER TABLE sso_states ADD COLUMN IF NOT EXISTS data TEXT DEFAULT '';

COMMENT ON COLUMN sso_states.data IS 'JSON-serialized auth state data (nonce, state) for SSO flow';

-- Rollback:
-- ALTER TABLE sso_states DROP COLUMN IF EXISTS data;
