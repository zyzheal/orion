-- Migration: 168_create_user_api_tokens.sql
-- Create user_api_tokens table for API token management
-- Created: 2026-05-19

CREATE TABLE IF NOT EXISTS user_api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups by user_id
CREATE INDEX idx_user_api_tokens_user_id ON user_api_tokens(user_id);

-- Index for token validation lookups
CREATE INDEX idx_user_api_tokens_token_hash ON user_api_tokens(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX idx_user_api_tokens_expires_at ON user_api_tokens(expires_at) WHERE expires_at IS NOT NULL;

-- Comment for documentation
COMMENT ON TABLE user_api_tokens IS 'User API tokens for programmatic access to the platform';
COMMENT ON COLUMN user_api_tokens.user_id IS 'The user who owns this token';
COMMENT ON COLUMN user_api_tokens.name IS 'User-friendly name for the token';
COMMENT ON COLUMN user_api_tokens.token_hash IS 'SHA-256 hash of the token (raw token is only shown once on creation)';
COMMENT ON COLUMN user_api_tokens.expires_at IS 'Optional expiration date/time';
COMMENT ON COLUMN user_api_tokens.last_used_at IS 'Timestamp of last successful token validation';