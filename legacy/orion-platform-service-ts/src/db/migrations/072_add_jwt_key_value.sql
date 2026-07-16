-- Migration 072: Add key_value column to jwt_key_rotation
-- Stores the actual JWT signing key (encrypted at rest)
-- Required for JwtKeyManager to use rotating keys for JWT signing/verification

-- Add key_value column for storing the actual signing key
-- In production this should be encrypted (AES-256-GCM via encryption.ts)
ALTER TABLE jwt_key_rotation ADD COLUMN IF NOT EXISTS key_value TEXT;

COMMENT ON COLUMN jwt_key_rotation.key_value IS 'Actual JWT signing key value (encrypted). Used by JwtKeyManager for signing and verification.';

-- Rollback:
-- ALTER TABLE jwt_key_rotation DROP COLUMN IF EXISTS key_value;
