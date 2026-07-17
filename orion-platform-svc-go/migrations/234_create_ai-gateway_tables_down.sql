-- Auto-generated rollback for version 234. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_ai_gateway_requests_provider";

DROP INDEX IF EXISTS "idx_ai_gateway_requests_model";

DROP INDEX IF EXISTS "idx_ai_gateway_requests_tenant";
