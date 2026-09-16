-- Reverse 398_create_tenant_quota.sql.
-- Drops 3 tables created by this migration.
-- Order: child tables first (CASCADE handles FK dependencies).
--
DROP TABLE IF EXISTS tenant_quota_alert CASCADE;
DROP TABLE IF EXISTS tenant_quota_usage CASCADE;
DROP TABLE IF EXISTS tenant_quota_plan CASCADE;
