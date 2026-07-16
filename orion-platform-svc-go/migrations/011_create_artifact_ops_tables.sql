-- Artifact-ops module tables

CREATE TABLE IF NOT EXISTS artifact_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_operations_tenant_id ON artifact_operations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_operations_artifact_id ON artifact_operations(artifact_id);

CREATE TABLE IF NOT EXISTS artifact_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    report_id VARCHAR(255),
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifact_scans_tenant_id ON artifact_scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_artifact_scans_artifact_id ON artifact_scans(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_scans_status ON artifact_scans(status);

CREATE TABLE IF NOT EXISTS scan_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    scan_id VARCHAR(255) NOT NULL,
    artifact_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'clean',
    findings JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scan_reports_tenant_id ON scan_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scan_reports_scan_id ON scan_reports(scan_id);

CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    rule JSONB,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_tenant_id ON retention_policies(tenant_id);
