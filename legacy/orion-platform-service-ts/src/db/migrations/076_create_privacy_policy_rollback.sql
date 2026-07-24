-- Rollback Migration 076_create_privacy_policy
-- Auto-generated rollback script
-- Review carefully before executing in production

-- Dropping table: tenant_privacy_policies
DROP TABLE IF EXISTS tenant_privacy_policies CASCADE;

-- Dropping table: sanitization_audit_logs
DROP TABLE IF EXISTS sanitization_audit_logs CASCADE;

DROP INDEX IF EXISTS CREATE INDEX idx_tenant_privacy_policy_tenant ON tenant_privacy_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_tenant_privacy_policy_level ON tenant_privacy_policie;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
DROP INDEX IF EXISTS CREATE INDEX idx_;
