-- Auto-generated rollback for version 030. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_query_execution_records_data_source_id";

DROP INDEX IF EXISTS "idx_query_execution_records_user_id";

DROP INDEX IF EXISTS "idx_query_execution_records_tenant_id";

DROP TABLE IF EXISTS "query_execution_records" CASCADE;

DROP INDEX IF EXISTS "idx_audit_rules_tenant_id";

DROP TABLE IF EXISTS "audit_rules" CASCADE;

DROP INDEX IF EXISTS "idx_data_sources_tenant_id";

DROP TABLE IF EXISTS "data_sources" CASCADE;

DROP INDEX IF EXISTS "idx_sql_orders_user_id";

DROP INDEX IF EXISTS "idx_sql_orders_status";

DROP INDEX IF EXISTS "idx_sql_orders_tenant_id";
