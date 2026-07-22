-- Auto-generated rollback for version 191. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_test_code_mappings_created";

DROP INDEX IF EXISTS "idx_test_code_mappings_tenant";

DROP TABLE IF EXISTS "test_code_mappings" CASCADE;

DROP INDEX IF EXISTS "idx_p_r_test_results_created";

DROP INDEX IF EXISTS "idx_p_r_test_results_tenant";

DROP TABLE IF EXISTS "p_r_test_results" CASCADE;

DROP INDEX IF EXISTS "idx_test_execution_records_created";

DROP INDEX IF EXISTS "idx_test_execution_records_tenant";

DROP TABLE IF EXISTS "test_execution_records" CASCADE;

DROP INDEX IF EXISTS "idx_test_cases_created";

DROP INDEX IF EXISTS "idx_test_cases_tenant";

DROP TABLE IF EXISTS "test_cases" CASCADE;

DROP INDEX IF EXISTS "idx_test_suites_created";

DROP INDEX IF EXISTS "idx_test_suites_tenant";
