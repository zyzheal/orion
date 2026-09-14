-- Reversal of 589_create_dr_tables.sql.
DROP INDEX IF EXISTS idx_dr_policies_priority;
DROP INDEX IF EXISTS idx_dr_policies_status;
DROP INDEX IF EXISTS idx_dr_policies_strategy;
DROP INDEX IF EXISTS idx_dr_policies_tenant;
DROP INDEX IF EXISTS idx_dr_backup_configs_created;
DROP INDEX IF EXISTS idx_dr_backup_configs_enabled;
DROP INDEX IF EXISTS idx_dr_backup_configs_source;
DROP INDEX IF EXISTS idx_dr_backup_configs_tenant;
DROP INDEX IF EXISTS idx_dr_failover_tests_type;
DROP INDEX IF EXISTS idx_dr_failover_tests_result;
DROP INDEX IF EXISTS idx_dr_failover_tests_plan;
DROP INDEX IF EXISTS idx_dr_failover_tests_tenant;
DROP INDEX IF EXISTS idx_dr_plans_tenant_created;
DROP INDEX IF EXISTS idx_dr_plans_tenant_type;
DROP INDEX IF EXISTS idx_dr_plans_tenant_status;
DROP INDEX IF EXISTS idx_dr_plans_tenant;

DROP TABLE IF EXISTS dr_policies;
DROP TABLE IF EXISTS dr_backup_configs;
DROP TABLE IF EXISTS dr_failover_tests;
DROP TABLE IF EXISTS dr_plans;
