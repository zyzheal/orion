-- Auto-generated rollback for version 003. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_saga_steps_status";

DROP INDEX IF EXISTS "idx_saga_steps_transaction_id";

DROP INDEX IF EXISTS "idx_saga_steps_tenant_id";

DROP TABLE IF EXISTS "saga_steps" CASCADE;

DROP INDEX IF EXISTS "idx_saga_transactions_saga_name";

DROP INDEX IF EXISTS "idx_saga_transactions_status";

DROP INDEX IF EXISTS "idx_saga_transactions_request_id";

DROP INDEX IF EXISTS "idx_saga_transactions_tenant_id";
