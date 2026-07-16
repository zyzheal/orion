-- Rollback: 415_auth_security_features.sql
-- Purpose: Remove security features added in migration 415

-- Drop indexes
DROP INDEX IF EXISTS idx_users_mfa_enabled;
DROP INDEX IF EXISTS idx_users_password_reset_token;
DROP INDEX IF EXISTS idx_users_locked_until;
DROP INDEX IF EXISTS idx_users_failed_login_attempts;
DROP INDEX IF EXISTS idx_security_audit_log_user;
DROP INDEX IF EXISTS idx_security_audit_log_event;
DROP INDEX IF EXISTS idx_security_audit_log_created;

-- Drop table
DROP TABLE IF EXISTS security_audit_log;

-- Drop columns from users
ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS mfa_backup_codes;
ALTER TABLE users DROP COLUMN IF EXISTS password_reset_token;
ALTER TABLE users DROP COLUMN IF EXISTS password_reset_expires;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_attempts;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
