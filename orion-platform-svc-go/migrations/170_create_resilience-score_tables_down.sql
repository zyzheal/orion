-- Auto-generated rollback for version 170. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_resilience_benchmarks_created";

DROP INDEX IF EXISTS "idx_resilience_benchmarks_tenant";

DROP TABLE IF EXISTS "resilience_benchmarks" CASCADE;

DROP INDEX IF EXISTS "idx_resilience_recommendations_created";

DROP INDEX IF EXISTS "idx_resilience_recommendations_tenant";

DROP TABLE IF EXISTS "resilience_recommendations" CASCADE;

DROP INDEX IF EXISTS "idx_resilience_histories_created";

DROP INDEX IF EXISTS "idx_resilience_histories_tenant";
