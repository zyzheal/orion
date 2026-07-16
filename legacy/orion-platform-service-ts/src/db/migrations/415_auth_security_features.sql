-- Migration: 415_auth_security_features.sql
-- Purpose: Add security features for authentication
-- - MFA/2FA support (TOTP)
-- - Password reset with JWT token
-- - Login failure account lockout
-- - Audit trail for security events

-- ==================== Users Table Extensions ====================

-- MFA/2FA columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'mfa_secret'
    ) THEN
        ALTER TABLE users ADD COLUMN mfa_secret VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'mfa_enabled'
    ) THEN
        ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'mfa_backup_codes'
    ) THEN
        ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT;
    END IF;
END $$;

-- Password reset columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_reset_token'
    ) THEN
        ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_reset_expires'
    ) THEN
        ALTER TABLE users ADD COLUMN password_reset_expires TIMESTAMPTZ;
    END IF;
END $$;

-- Login failure / account lockout columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'failed_login_attempts'
    ) THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'locked_until'
    ) THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
    END IF;
END $$;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_mfa_enabled ON users(mfa_enabled) WHERE mfa_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_failed_login_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;

-- ==================== Security Audit Table ====================

-- Track security-relevant events (MFA changes, password resets, account lockouts)
CREATE TABLE IF NOT EXISTS security_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    event_type      VARCHAR(50) NOT NULL,
    event_detail    TEXT,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    operator_id     UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_event ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created ON security_audit_log(created_at DESC);

-- Valid event types:
-- mfa_enabled, mfa_disabled, mfa_verified, mfa_failed, mfa_backup_used
-- password_reset_requested, password_reset_completed, password_reset_failed
-- account_locked, account_unlocked, account_login_failed, account_login_succeeded
-- password_changed

COMMENT ON TABLE security_audit_log IS 'Security audit trail for authentication events (MFA, password reset, lockout)';
COMMENT ON COLUMN users.mfa_secret IS 'TOTP secret for MFA/2FA (base32 encoded)';
COMMENT ON COLUMN users.mfa_enabled IS 'Whether MFA/2FA is enabled for this user';
COMMENT ON COLUMN users.mfa_backup_codes IS 'JSON array of backup codes for MFA recovery';
COMMENT ON COLUMN users.password_reset_token IS 'JWT token for password reset flow';
COMMENT ON COLUMN users.password_reset_expires IS 'Expiry timestamp for password reset token';
COMMENT ON COLUMN users.failed_login_attempts IS 'Consecutive failed login attempts counter';
COMMENT ON COLUMN users.locked_until IS 'Account lock expiry timestamp (NULL if not locked)';
