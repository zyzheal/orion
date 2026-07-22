-- orion-platform-service/src/db/migrations/078_create_output_validation.sql
-- Output Validation Tables - LLM Output Schema and Security Validation

-- Output validation rules table
CREATE TABLE IF NOT EXISTS output_validation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(128) NOT NULL UNIQUE,
    rule_type VARCHAR(32) NOT NULL,  -- 'json_schema', 'ast', 'security_boundary', 'custom'
    schema_definition JSONB,          -- JSON Schema for json_type validation
    severity VARCHAR(16) NOT NULL DEFAULT 'error',  -- 'error', 'warning', 'info'
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_output_validation_rules_type ON output_validation_rules(rule_type);
CREATE INDEX idx_output_validation_rules_enabled ON output_validation_rules(enabled);

-- Output validation results table
CREATE TABLE IF NOT EXISTS output_validation_results (
    id SERIAL PRIMARY KEY,
    trace_id VARCHAR(64),                    -- LLM trace ID for correlation
    provider_id VARCHAR(32),
    model_id VARCHAR(64),
    validation_type VARCHAR(32) NOT NULL,
    rule_id INTEGER REFERENCES output_validation_rules(id),
    passed BOOLEAN NOT NULL,
    error_message TEXT,
    error_details JSONB,
    validated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_id VARCHAR(128),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_output_validation_results_trace ON output_validation_results(trace_id);
CREATE INDEX idx_output_validation_results_validated ON output_validation_results(validated_at);
CREATE INDEX idx_output_validation_results_passed ON output_validation_results(passed);

-- Security boundary patterns table
CREATE TABLE IF NOT EXISTS security_boundary_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(32) NOT NULL,      -- 'forbidden_function', 'suspicious_code', 'path_traversal'
    pattern_regex VARCHAR(512) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'high',
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_security_boundary_patterns_type ON security_boundary_patterns(pattern_type);

-- Insert default security boundary patterns
INSERT INTO security_boundary_patterns (pattern_type, pattern_regex, severity, description) VALUES
    ('forbidden_function', 'eval\s*\(', 'critical', 'Use of eval() function'),
    ('forbidden_function', 'exec\s*\(', 'critical', 'Use of exec() function'),
    ('forbidden_function', 'compile\s*\(', 'high', 'Use of compile() function'),
    ('suspicious_code', 'import\s+os\s*;', 'medium', 'OS module import'),
    ('suspicious_code', 'import\s+sys\s*;', 'medium', 'Sys module import'),
    ('path_traversal', '\.\.[/\\]', 'high', 'Path traversal attempt'),
    ('sql_injection', '(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b).*\$', 'critical', 'SQL injection risk')
ON CONFLICT DO NOTHING;

-- Patch validation schemas table
CREATE TABLE IF NOT EXISTS patch_schemas (
    id SERIAL PRIMARY KEY,
    schema_name VARCHAR(128) NOT NULL UNIQUE,
    schema_version VARCHAR(32) NOT NULL,
    json_schema JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_patch_schemas_name ON patch_schemas(schema_name);
CREATE INDEX idx_patch_schemas_active ON patch_schemas(is_active);

-- Validation statistics table
CREATE TABLE IF NOT EXISTS output_validation_stats (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL,
    provider_id VARCHAR(32),
    validation_type VARCHAR(32),
    total_validations INTEGER DEFAULT 0,
    passed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    avg_validation_ms NUMERIC(10, 2),
    metadata JSONB DEFAULT '{}',
    UNIQUE(stat_date, provider_id, validation_type)
);

CREATE INDEX idx_output_validation_stats_date ON output_validation_stats(stat_date);

COMMENT ON TABLE output_validation_rules IS 'LLM输出校验规则定义';
COMMENT ON TABLE output_validation_results IS 'LLM输出校验结果记录';
COMMENT ON TABLE security_boundary_patterns IS '安全边界检查模式';
COMMENT ON TABLE patch_schemas IS 'Patch JSON Schema定义';
COMMENT ON TABLE output_validation_stats IS '输出校验统计报表';