-- Security scans (vulnerability scanning)
CREATE TABLE IF NOT EXISTS security_scans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scan_type VARCHAR(32) NOT NULL DEFAULT 'vulnerability',
    target VARCHAR(512) NOT NULL,
    scanner VARCHAR(64) NOT NULL DEFAULT 'trivy',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    critical_count INT NOT NULL DEFAULT 0,
    high_count INT NOT NULL DEFAULT 0,
    medium_count INT NOT NULL DEFAULT 0,
    low_count INT NOT NULL DEFAULT 0,
    total_count INT NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT false,
    gate_failed BOOLEAN NOT NULL DEFAULT false,
    scan_start_time TIMESTAMPTZ,
    scan_end_time TIMESTAMPTZ,
    duration_ms INT NOT NULL DEFAULT 0,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_scans_tenant ON security_scans(tenant_id, created_at DESC);

-- Security findings
CREATE TABLE IF NOT EXISTS security_findings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    scan_id VARCHAR(64),
    rule_id VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    title VARCHAR(512) NOT NULL,
    description TEXT,
    file_path VARCHAR(1024),
    line_start INT,
    line_end INT,
    code_snippet TEXT,
    match_text TEXT,
    confidence REAL NOT NULL DEFAULT 0.5,
    remediation TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    assigned_to VARCHAR(128),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_findings_tenant ON security_findings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_findings_scan ON security_findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_security_findings_severity ON security_findings(tenant_id, severity);

-- Audit plans
CREATE TABLE IF NOT EXISTS audit_plans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    scope JSONB NOT NULL DEFAULT '{}',
    audit_type VARCHAR(64) NOT NULL DEFAULT 'security',
    schedule_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    cron_expression VARCHAR(128),
    reviewers JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_plans_tenant ON audit_plans(tenant_id);

-- Audit executions
CREATE TABLE IF NOT EXISTS audit_executions (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    findings_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_executions_plan ON audit_executions(plan_id);

-- Audit findings
CREATE TABLE IF NOT EXISTS audit_findings (
    id VARCHAR(64) PRIMARY KEY,
    execution_id VARCHAR(64) NOT NULL REFERENCES audit_executions(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    title VARCHAR(512) NOT NULL,
    description TEXT,
    severity VARCHAR(16) NOT NULL DEFAULT 'medium',
    category VARCHAR(64),
    evidence JSONB,
    recommendation TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    assigned_to VARCHAR(128),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_findings_execution ON audit_findings(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_tenant ON audit_findings(tenant_id, severity);

-- Compliance policies
CREATE TABLE IF NOT EXISTS compliance_policies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    framework_type VARCHAR(64) NOT NULL,
    requirements JSONB NOT NULL DEFAULT '{}',
    rules JSONB NOT NULL DEFAULT '[]',
    severity_threshold VARCHAR(16) NOT NULL DEFAULT 'high',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_tenant ON compliance_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_policies_framework ON compliance_policies(tenant_id, framework_type);

-- Compliance evaluations
CREATE TABLE IF NOT EXISTS compliance_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    policy_id VARCHAR(64) NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    score REAL NOT NULL DEFAULT 0,
    total_checks INT NOT NULL DEFAULT 0,
    passed_checks INT NOT NULL DEFAULT 0,
    failed_checks INT NOT NULL DEFAULT 0,
    gaps JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_policy ON compliance_evaluations(policy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_evaluations_tenant ON compliance_evaluations(tenant_id);

-- Supply chain SBOMs
CREATE TABLE IF NOT EXISTS supply_chain_sboms (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    artifact_id VARCHAR(128) NOT NULL,
    pipeline_id VARCHAR(128),
    sbom_format VARCHAR(32) NOT NULL DEFAULT 'cyclonedx',
    sbom_version VARCHAR(16) NOT NULL DEFAULT '1.4',
    components JSONB NOT NULL DEFAULT '[]',
    dependencies JSONB NOT NULL DEFAULT '[]',
    vulnerabilities JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supply_chain_sboms_tenant ON supply_chain_sboms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supply_chain_sboms_artifact ON supply_chain_sboms(artifact_id);

-- Dependency graphs
CREATE TABLE IF NOT EXISTS dependency_graphs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    package_name VARCHAR(256) NOT NULL,
    package_version VARCHAR(64) NOT NULL,
    direct_deps JSONB NOT NULL DEFAULT '[]',
    transitive_deps JSONB NOT NULL DEFAULT '[]',
    vulnerable_paths JSONB NOT NULL DEFAULT '[]',
    depth INT NOT NULL DEFAULT 3,
    analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dependency_graphs_tenant ON dependency_graphs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dependency_graphs_package ON dependency_graphs(package_name, package_version);

-- Dependency poisoning scans
CREATE TABLE IF NOT EXISTS dependency_poisoning_scans (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    packages_scanned INT NOT NULL DEFAULT 0,
    malicious_found INT NOT NULL DEFAULT 0,
    typosquatting_found INT NOT NULL DEFAULT 0,
    risk_score INT NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'safe',
    scan_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dependency_poisoning_scans_tenant ON dependency_poisoning_scans(tenant_id);
