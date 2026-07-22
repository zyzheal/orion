-- Auto-generated rollback for version 033. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP TABLE IF EXISTS "response_history" CASCADE;

DROP TABLE IF EXISTS "playground_requests" CASCADE;

DROP INDEX IF EXISTS "idx_usage_records_subscription_id";

DROP INDEX IF EXISTS "idx_usage_records_tenant_id";

DROP TABLE IF EXISTS "usage_records" CASCADE;

DROP INDEX IF EXISTS "idx_subscriptions_status";

DROP INDEX IF EXISTS "idx_subscriptions_user_id";

DROP INDEX IF EXISTS "idx_subscriptions_tenant_id";

DROP TABLE IF EXISTS "subscriptions" CASCADE;

DROP INDEX IF EXISTS "idx_sdk_tasks_tenant_id";

DROP TABLE IF EXISTS "sdk_tasks" CASCADE;

DROP INDEX IF EXISTS "idx_mock_rules_tenant_id";

DROP TABLE IF EXISTS "mock_rules" CASCADE;

DROP TABLE IF EXISTS "document_versions" CASCADE;

DROP INDEX IF EXISTS "idx_portal_documents_status";

DROP INDEX IF EXISTS "idx_portal_documents_category";

DROP INDEX IF EXISTS "idx_portal_documents_tenant_id";

DROP TABLE IF EXISTS "portal_documents" CASCADE;
