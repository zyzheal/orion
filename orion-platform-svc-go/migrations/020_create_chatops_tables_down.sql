-- Auto-generated rollback for version 020. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "chatops_webhooks" CASCADE;

DROP TABLE IF EXISTS "chatops_rate_limits" CASCADE;

DROP TABLE IF EXISTS "chatops_command_versions" CASCADE;

DROP TABLE IF EXISTS "chatops_environment_permissions" CASCADE;

DROP TABLE IF EXISTS "chatops_command_permissions" CASCADE;

DROP TABLE IF EXISTS "chatops_permission_roles" CASCADE;

DROP TABLE IF EXISTS "chatops_approval_configs" CASCADE;

DROP TABLE IF EXISTS "chatops_capability_mappings" CASCADE;

DROP TABLE IF EXISTS "chatops_command_configs" CASCADE;

DROP TABLE IF EXISTS "chatops_question_configs" CASCADE;

DROP TABLE IF EXISTS "chatops_alert_states" CASCADE;

DROP TABLE IF EXISTS "chatops_platform_configs" CASCADE;

DROP TABLE IF EXISTS "chatops_dnd_settings" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_notification_preferences_tenant_id";

DROP TABLE IF EXISTS "chatops_notification_preferences" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_audit_logs_tenant_id";

DROP TABLE IF EXISTS "chatops_audit_logs" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_messages_session_id";

DROP INDEX IF EXISTS "idx_chatops_messages_tenant_id";

DROP TABLE IF EXISTS "chatops_messages" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_sessions_user_id";

DROP INDEX IF EXISTS "idx_chatops_sessions_tenant_id";

DROP TABLE IF EXISTS "chatops_sessions" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_executions_user_id";

DROP INDEX IF EXISTS "idx_chatops_executions_command_id";

DROP INDEX IF EXISTS "idx_chatops_executions_tenant_id";

DROP TABLE IF EXISTS "chatops_executions" CASCADE;

DROP INDEX IF EXISTS "idx_chatops_commands_tenant_id";
