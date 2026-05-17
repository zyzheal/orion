-- Add SSO subject column to users table for OIDC integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS sso_sub VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_users_sso_sub ON users(sso_sub);
