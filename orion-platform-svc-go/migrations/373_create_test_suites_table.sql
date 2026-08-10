-- Create test_suites table and extend test_cases for test-execution-engine
CREATE TABLE IF NOT EXISTS test_suites (
    id VARCHAR(36) PRIMARY KEY,
    execution_id VARCHAR(36) NOT NULL,
    name VARCHAR(256) NOT NULL,
    tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duration_ms BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_test_suites_execution ON test_suites(execution_id);

-- Extend test_cases with class_name, error_msg, stack_trace if not already present
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS class_name VARCHAR(256);
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS error_msg TEXT;
ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS stack_trace TEXT;
