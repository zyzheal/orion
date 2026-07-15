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
    deleted_at TIMESTAMP WITH TIME ZONE,
);

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
    deleted_at TIMESTAMP WITH TIME ZONE,
);

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
    deleted_at TIMESTAMP WITH TIME ZONE,
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
    deleted_at TIMESTAMP WITH TIME ZONE,
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
    deleted_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX IF NOT EXISTS idx_test_code_mappings_tenant ON test_code_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_test_code_mappings_created ON test_code_mappings(created_at DESC);

