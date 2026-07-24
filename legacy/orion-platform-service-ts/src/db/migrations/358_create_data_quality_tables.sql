-- Migration: 358_create_data_quality_tables.sql
-- Purpose: Persist data quality rules and validation results

-- Data Quality Rules
CREATE TABLE IF NOT EXISTS data_quality_rules (
    id              VARCHAR(50) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    pipeline_id     VARCHAR(50) NOT NULL,
    stage_id        VARCHAR(50),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    rule_type       VARCHAR(30) NOT NULL,          -- not_null, unique, range, pattern, custom, referential, completeness
    severity        VARCHAR(20) NOT NULL DEFAULT 'warning', -- critical, warning, info
    target_field    VARCHAR(200) NOT NULL,
    condition       JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_by      VARCHAR(200) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dqr_tenant ON data_quality_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dqr_pipeline ON data_quality_rules(tenant_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_dqr_rule_type ON data_quality_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_dqr_enabled ON data_quality_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_dqr_created ON data_quality_rules(created_at DESC);

-- Validation Results
CREATE TABLE IF NOT EXISTS data_quality_validation_results (
    id              VARCHAR(50) PRIMARY KEY,
    rule_id         VARCHAR(50) NOT NULL REFERENCES data_quality_rules(id),
    pipeline_id     VARCHAR(50) NOT NULL,
    tenant_id       VARCHAR(50) NOT NULL,
    execution_id    VARCHAR(50),
    status          VARCHAR(20) NOT NULL,          -- passed, failed, warning
    total_records   INTEGER NOT NULL DEFAULT 0,
    passed_records  INTEGER NOT NULL DEFAULT 0,
    failed_records  INTEGER NOT NULL DEFAULT 0,
    failure_rate    FLOAT NOT NULL DEFAULT 0,
    failure_samples JSONB NOT NULL DEFAULT '[]',
    duration_ms     INTEGER NOT NULL DEFAULT 0,
    validated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dqvr_rule ON data_quality_validation_results(rule_id);
CREATE INDEX IF NOT EXISTS idx_dqvr_pipeline ON data_quality_validation_results(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_dqvr_tenant ON data_quality_validation_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dqvr_execution ON data_quality_validation_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_dqvr_validated ON data_quality_validation_results(validated_at DESC);
