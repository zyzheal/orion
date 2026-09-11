-- Test-Selector module tables (auto-generated)

CREATE TABLE IF NOT EXISTS test_suites (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    test_count BIGINT NOT NULL,
    avg_duration DOUBLE PRECISION NOT NULL,
    pass_rate DOUBLE PRECISION NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE NOT NULL,
    source_files VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
-- 补齐 test_suites：373_create_test_suites_table.sql 的定义晚于 191_create_test-selector_tables.sql，按序执行时表已存在
ALTER TABLE test_suites ADD COLUMN IF NOT EXISTS execution_id VARCHAR(36) NOT NULL, ADD COLUMN IF NOT EXISTS tests INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS passed INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS failed INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS skipped INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS duration_ms BIGINT DEFAULT 0;


CREATE INDEX IF NOT EXISTS idx_test_suites_tenant ON test_suites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_created ON test_suites(created_at DESC);

CREATE TABLE IF NOT EXISTS test_cases (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    suite_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    dependencies VARCHAR(255) NOT NULL,
    avg_duration DOUBLE PRECISION NOT NULL,
    flaky_score DOUBLE PRECISION NOT NULL,
    history VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);
-- 补齐 test_cases：369_create_test_execution_tables.sql 的定义晚于 191_create_test-selector_tables.sql，按序执行时表已存在
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS status VARCHAR(32), ADD COLUMN IF NOT EXISTS duration_ms BIGINT, ADD COLUMN IF NOT EXISTS class_name VARCHAR(256), ADD COLUMN IF NOT EXISTS error_msg TEXT, ADD COLUMN IF NOT EXISTS stack_trace TEXT;


CREATE INDEX IF NOT EXISTS idx_test_cases_tenant ON test_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_created ON test_cases(created_at DESC);

CREATE TABLE IF NOT EXISTS test_execution_records (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    test_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255) NOT NULL,
    passed BOOLEAN NOT NULL,
    duration DOUBLE PRECISION NOT NULL,
    failure_message VARCHAR(255),
    pr_id VARCHAR(255),
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_test_execution_records_tenant ON test_execution_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_execution_records_created ON test_execution_records(created_at DESC);

CREATE TABLE IF NOT EXISTS p_r_test_results (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    pr_id VARCHAR(255) NOT NULL,
    plan_data VARCHAR(255) NOT NULL,
    impact_data VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_p_r_test_results_tenant ON p_r_test_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_p_r_test_results_created ON p_r_test_results(created_at DESC);

CREATE TABLE IF NOT EXISTS test_code_mappings (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(36) NOT NULL,
    test_path VARCHAR(255) NOT NULL,
    source_paths VARCHAR(255) NOT NULL,
    symbol_mapping VARCHAR(255) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_test_code_mappings_tenant ON test_code_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_code_mappings_created ON test_code_mappings(created_at DESC);

