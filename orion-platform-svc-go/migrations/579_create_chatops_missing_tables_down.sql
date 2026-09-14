-- Reverse of 579_create_chatops_missing_tables.sql
--
-- All six tables are owned by this migration, so the rollback drops them.
-- chatops_permission_roles is not dropped: 020 created it and repository.go now
-- uses it, so dropping it here would delete role data this migration never wrote.

DROP INDEX IF EXISTS idx_chatops_webhook_logs_webhook;
DROP INDEX IF EXISTS idx_chatops_webhook_logs_tenant;
DROP TABLE IF EXISTS chatops_webhook_logs;

DROP INDEX IF EXISTS idx_chatops_knowledge_tenant_context;
DROP INDEX IF EXISTS idx_chatops_knowledge_tenant;
DROP TABLE IF EXISTS chatops_knowledge_recommendations;

DROP TABLE IF EXISTS chatops_global_approval_config;

DROP INDEX IF EXISTS idx_chatops_version_tags_version;
DROP INDEX IF EXISTS idx_chatops_version_tags_tenant;
DROP TABLE IF EXISTS chatops_command_version_tags;

DROP INDEX IF EXISTS idx_chatops_approver_schedule_tenant;
DROP TABLE IF EXISTS chatops_approver_schedule;

DROP INDEX IF EXISTS idx_chatops_approvers_tenant;
DROP TABLE IF EXISTS chatops_approvers;
