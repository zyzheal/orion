-- Auto-generated rollback for 575_create_performance_missing_tables.sql.
-- Data loss may occur.

DROP INDEX IF EXISTS idx_perf_test_results_service;
DROP INDEX IF EXISTS idx_perf_test_results_tenant;
DROP TABLE IF EXISTS performance_test_results;

DROP INDEX IF EXISTS idx_perf_regressions_service;
DROP INDEX IF EXISTS idx_perf_regressions_tenant;
DROP TABLE IF EXISTS performance_regressions;

DROP INDEX IF EXISTS idx_perf_suggestions_service;
DROP INDEX IF EXISTS idx_perf_suggestions_tenant;
DROP TABLE IF EXISTS performance_suggestions;

DROP INDEX IF EXISTS idx_perf_bottlenecks_service;
DROP INDEX IF EXISTS idx_perf_bottlenecks_tenant;
DROP TABLE IF EXISTS performance_bottlenecks;
