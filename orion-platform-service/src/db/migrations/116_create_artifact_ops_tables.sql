-- Migration 116: Create artifact-ops tables
-- Tables: artifact_operations, retention_policies, retention_evaluations,
--          scan_reports, scan_findings, malicious_detections
-- Date: 2026-05-06

-- Artifact Operations Table
CREATE TABLE IF NOT EXISTS artifact_operations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(128) NOT NULL,
    operation VARCHAR(32) NOT NULL,          -- build, publish, deploy, scan, promote, delete, rollback
    source VARCHAR(256),
    target VARCHAR(256),
    metadata JSONB DEFAULT '{}',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed, cancelled
    initiated_by VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER
);

CREATE INDEX idx_artifact_ops_tenant ON artifact_operations (tenant_id);
CREATE INDEX idx_artifact_ops_artifact ON artifact_operations (artifact_id);
CREATE INDEX idx_artifact_ops_status ON artifact_operations (status);
CREATE INDEX idx_artifact_ops_created ON artifact_operations (created_at DESC);
CREATE INDEX idx_artifact_ops_tenant_artifact ON artifact_operations (tenant_id, artifact_id);

COMMENT ON TABLE artifact_operations IS 'Tracks all operations performed on artifacts';

-- Retention Policies Table
CREATE TABLE IF NOT EXISTS retention_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    max_age_days INTEGER NOT NULL DEFAULT 90,
    max_versions INTEGER,
    max_size_mb INTEGER,
    protected_tags TEXT[] DEFAULT '{}',
    schedule VARCHAR(64),                   -- cron expression
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_retention_policies_tenant ON retention_policies (tenant_id);
CREATE INDEX idx_retention_policies_enabled ON retention_policies (tenant_id, enabled);

COMMENT ON TABLE retention_policies IS 'Retention policies for artifact lifecycle management';

-- Retention Evaluations Table
CREATE TABLE IF NOT EXISTS retention_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL REFERENCES retention_policies(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_artifacts INTEGER NOT NULL DEFAULT 0,
    expired_count INTEGER NOT NULL DEFAULT 0,
    protected_count INTEGER NOT NULL DEFAULT 0,
    expired_artifacts JSONB DEFAULT '[]',
    space_reclaimable_mb INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_retention_evals_policy ON retention_evaluations (policy_id);
CREATE INDEX idx_retention_evals_tenant ON retention_evaluations (tenant_id);
CREATE INDEX idx_retention_evals_evaluated ON retention_evaluations (evaluated_at DESC);

COMMENT ON TABLE retention_evaluations IS 'Results of retention policy evaluations';

-- Scan Reports Table
CREATE TABLE IF NOT EXISTS scan_reports (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(128) NOT NULL,
    scan_id VARCHAR(64) NOT NULL,
    scan_type VARCHAR(32) NOT NULL DEFAULT 'full',
    status VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    summary JSONB NOT NULL DEFAULT '{"total": 0, "critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}',
    passed BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_scan_reports_tenant ON scan_reports (tenant_id);
CREATE INDEX idx_scan_reports_artifact ON scan_reports (artifact_id);
CREATE INDEX idx_scan_reports_status ON scan_reports (status);
CREATE INDEX idx_scan_reports_started ON scan_reports (started_at DESC);
CREATE INDEX idx_scan_reports_tenant_artifact ON scan_reports (tenant_id, artifact_id);

COMMENT ON TABLE scan_reports IS 'Vulnerability scan reports for artifacts';

-- Scan Findings Table
CREATE TABLE IF NOT EXISTS scan_findings (
    id VARCHAR(64) PRIMARY KEY,
    report_id VARCHAR(64) NOT NULL REFERENCES scan_reports(id) ON DELETE CASCADE,
    severity VARCHAR(16) NOT NULL,           -- critical, high, medium, low, info
    type VARCHAR(64) NOT NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    location VARCHAR(256),
    cve VARCHAR(32),
    remediation TEXT
);

CREATE INDEX idx_scan_findings_report ON scan_findings (report_id);
CREATE INDEX idx_scan_findings_severity ON scan_findings (severity);
CREATE INDEX idx_scan_findings_cve ON scan_findings (cve) WHERE cve IS NOT NULL;

COMMENT ON TABLE scan_findings IS 'Individual vulnerability findings from scan reports';

-- Malicious Detections Table
CREATE TABLE IF NOT EXISTS malicious_detections (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(128) NOT NULL,
    detected BOOLEAN NOT NULL DEFAULT false,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'safe',  -- safe, suspicious, malicious
    reasons TEXT[] DEFAULT '{}',
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (tenant_id, artifact_id)
);

CREATE INDEX idx_malicious_detections_tenant ON malicious_detections (tenant_id);
CREATE INDEX idx_malicious_detections_risk ON malicious_detections (risk_level);
CREATE INDEX idx_malicious_detections_detected ON malicious_detections (detected);

COMMENT ON TABLE malicious_detections IS 'Malicious content detection results for artifacts';
