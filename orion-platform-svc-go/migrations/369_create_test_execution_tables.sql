-- Create test execution tables for test-execution-engine module
CREATE TABLE IF NOT EXISTS test_executions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    framework VARCHAR(32),
    status VARCHAR(32) DEFAULT 'pending',
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    report_url TEXT,
    triggered_by VARCHAR(128),
    pipeline_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_test_executions_tenant ON test_executions(tenant_id);

CREATE TABLE IF NOT EXISTS test_cases (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(128) NOT NULL,
    name VARCHAR(256) NOT NULL,
    suite_id VARCHAR(256),
    status VARCHAR(32),
    duration_ms BIGINT,
    class_name VARCHAR(256),
    error_msg TEXT,
    stack_trace TEXT
);
CREATE INDEX idx_test_cases_tenant ON test_cases(tenant_id);
CREATE INDEX idx_test_cases_suite ON test_cases(tenant_id, suite_id);
