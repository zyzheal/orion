-- Security Scan Tables - Scan History and Findings Persistence

-- Security scan results table
CREATE TABLE IF NOT EXISTS security_scans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(32),
    scan_type VARCHAR(32) NOT NULL,  -- 'secret', 'sast', 'dependency', 'composite'
    repository VARCHAR(256) NOT NULL,
    branch VARCHAR(128),
    commit_hash VARCHAR(64),
    status VARCHAR(16) NOT NULL,     -- 'success', 'failed', 'partial'
    scanner VARCHAR(64),
    findings_count INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    info_count INTEGER DEFAULT 0,
    gate_failed BOOLEAN DEFAULT false,
    scan_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    scan_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_security_scans_repository ON security_scans(repository);
CREATE INDEX idx_security_scans_tenant ON security_scans(tenant_id);
CREATE INDEX idx_security_scans_status ON security_scans(status);
CREATE INDEX idx_security_scans_created ON security_scans(created_at);

-- Security findings table
CREATE TABLE IF NOT EXISTS security_findings (
    id VARCHAR(64) PRIMARY KEY,
    scan_id VARCHAR(64) NOT NULL REFERENCES security_scans(id) ON DELETE CASCADE,
    rule_id VARCHAR(64),
    severity VARCHAR(16) NOT NULL,   -- 'critical', 'high', 'medium', 'low', 'info'
    category VARCHAR(64),
    title VARCHAR(256) NOT NULL,
    description TEXT,
    file VARCHAR(512),
    line_start INTEGER,
    line_end INTEGER,
    code_snippet TEXT,
    match TEXT,
    confidence NUMERIC(3, 2),
    remediation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_security_findings_scan ON security_findings(scan_id);
CREATE INDEX idx_security_findings_severity ON security_findings(severity);
CREATE INDEX idx_security_findings_rule ON security_findings(rule_id);

-- Risk predictions table (for RiskAssessmentService persistence)
CREATE TABLE IF NOT EXISTS risk_predictions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(32),
    target_type VARCHAR(64),         -- 'pr', 'commit', 'deployment', 'change'
    target_id VARCHAR(128),
    risk_score NUMERIC(5, 4) NOT NULL,  -- 0.0000 to 1.0000
    risk_level VARCHAR(16) NOT NULL,    -- 'critical', 'high', 'medium', 'low'
    confidence NUMERIC(5, 4),
    model_version VARCHAR(32),
    features JSONB NOT NULL,            -- Full feature set
    shap_values JSONB,                  -- SHAP contributions
    top_risk_factors JSONB,             -- Array of risk factor strings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- Cache expiration
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_risk_predictions_target ON risk_predictions(target_type, target_id);
CREATE INDEX idx_risk_predictions_tenant ON risk_predictions(tenant_id);
CREATE INDEX idx_risk_predictions_score ON risk_predictions(risk_score DESC);
CREATE INDEX idx_risk_predictions_created ON risk_predictions(created_at);
CREATE INDEX idx_risk_predictions_expires ON risk_predictions(expires_at);

COMMENT ON TABLE security_scans IS '安全扫描结果记录';
COMMENT ON TABLE security_findings IS '安全扫描发现详情';
COMMENT ON TABLE risk_predictions IS '风险评估预测结果缓存';