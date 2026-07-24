-- Rollback Migration 020_create_tenant_quotas
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: tenant_quotas
DROP TABLE IF EXISTS tenant_quotas CASCADE;

