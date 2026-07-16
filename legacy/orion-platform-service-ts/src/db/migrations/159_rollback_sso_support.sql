-- Rollback SSO support: remove sso_sub column and index
DROP INDEX IF EXISTS idx_users_sso_sub;
ALTER TABLE users DROP COLUMN IF EXISTS sso_sub;
