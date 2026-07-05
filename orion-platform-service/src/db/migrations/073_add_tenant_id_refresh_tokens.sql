-- Migration 073: Add tenant_id to refresh_tokens
-- Task 2.20: refresh_tokens 表缺 tenant_id
-- Enables tenant-scoped token refresh and multi-tenant session management

-- Add tenant_id column
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_tenant ON refresh_tokens(tenant_id);

-- Populate tenant_id from tenant_users for existing records
UPDATE refresh_tokens rt
SET tenant_id = tu.tenant_id
FROM tenant_users tu
WHERE tu.user_id = rt.user_id AND rt.tenant_id IS NULL;

-- Rollback:
-- DROP INDEX IF EXISTS idx_refresh_tokens_tenant;
-- ALTER TABLE refresh_tokens DROP COLUMN IF EXISTS tenant_id;
