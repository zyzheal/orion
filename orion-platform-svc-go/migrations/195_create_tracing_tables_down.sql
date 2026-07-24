-- Auto-generated rollback for version 195. Review before use.

-- WARNING: Data loss may occur. Backup is taken automatically by RunMigrationsDown.

DROP INDEX IF EXISTS "idx_otel_collector_configs_created";

DROP INDEX IF EXISTS "idx_otel_collector_configs_tenant";

DROP TABLE IF EXISTS "otel_collector_configs" CASCADE;

DROP INDEX IF EXISTS "idx_trace_sampling_configs_created";

DROP INDEX IF EXISTS "idx_trace_sampling_configs_tenant";

DROP TABLE IF EXISTS "trace_sampling_configs" CASCADE;

DROP INDEX IF EXISTS "idx_trace_spans_created";

DROP INDEX IF EXISTS "idx_trace_spans_tenant";
