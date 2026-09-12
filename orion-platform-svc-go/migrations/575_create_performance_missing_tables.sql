-- Migration 575: create the four performance tables the repository already
-- writes to but which no migration ever created.
--
-- internal/performance/repository.Repository issues INSERTs against
-- performance_bottlenecks, performance_suggestions, performance_regressions
-- and performance_test_results, and SELECTs from all four. None of them exist:
-- the only performance migration is 152_create_performance_tables.sql, which
-- creates baselines, evaluations and profiles -- and those three live under
-- bare names while this repository refers to them as performance_baselines,
-- performance_evaluations, performance_profiles. Every call therefore failed
-- with `relation "performance_*" does not exist`.
--
-- 152 is left untouched: baselines/evaluations/profiles already exist under
-- their bare names in every deployed database, so the repository now points at
-- the names that are actually there. New tables follow the module-prefixed
-- convention used by 100/106/145 (branch_policy_records, capacity_records,
-- middleware_ops_records).
--
-- Columns are taken from the INSERT/SELECT column lists in repository.go, not
-- invented: a column missing here would make the endpoint fail with
-- `column ... of relation ... does not exist`.

CREATE TABLE IF NOT EXISTS performance_bottlenecks (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    profile_id VARCHAR(36),
    service_name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    description TEXT,
    score DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_perf_bottlenecks_tenant
    ON performance_bottlenecks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_bottlenecks_service
    ON performance_bottlenecks(tenant_id, service_name);

CREATE TABLE IF NOT EXISTS performance_suggestions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_perf_suggestions_tenant
    ON performance_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_suggestions_service
    ON performance_suggestions(tenant_id, service_name);

CREATE TABLE IF NOT EXISTS performance_regressions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    previous DOUBLE PRECISION NOT NULL DEFAULT 0,
    current DOUBLE PRECISION NOT NULL DEFAULT 0,
    change_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_perf_regressions_tenant
    ON performance_regressions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_regressions_service
    ON performance_regressions(tenant_id, service_name);

CREATE TABLE IF NOT EXISTS performance_test_results (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    duration BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_perf_test_results_tenant
    ON performance_test_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_perf_test_results_service
    ON performance_test_results(tenant_id, service_name);

-- Rollback: 575_create_performance_missing_tables_down.sql
