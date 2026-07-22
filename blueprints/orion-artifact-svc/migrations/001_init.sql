-- orion-artifact-svc Database Schema Initialization
-- Artifact registry, operations, retention, and scanning tables
-- Version: 001
-- Created: 2026-05-15

-- ==================== ENUM TYPES ====================

-- Artifact type enumeration
CREATE TYPE artifact_type AS ENUM (
    'JAR',
    'WAR',
    'DOCKER',
    'NPM',
    'HELM',
    'ZIP',
    'TAR',
    'OTHER'
);

-- Artifact status enumeration
CREATE TYPE artifact_status AS ENUM (
    'AVAILABLE',
    'BUILDING',
    'DEPLOYED',
    'DEPRECATED',
    'QUARANTINED',
    'DELETED'
);

-- Operation type enumeration
CREATE TYPE operation_type AS ENUM (
    'UPLOAD',
    'DOWNLOAD',
    'DELETE',
    'COPY',
    'MOVE',
    'PROMOTE',
    'SCAN',
    'TAG',
    'UNTAG'
);

-- Scan status enumeration
CREATE TYPE scan_status AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED'
);

-- ==================== CORE ARTIFACT TABLES ====================

-- Main artifact registry table
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(100) NOT NULL,
    version VARCHAR(100) NOT NULL,
    type artifact_type NOT NULL,
    status artifact_status NOT NULL DEFAULT 'AVAILABLE',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    checksum_sha256 VARCHAR(64),
    checksum_sha512 VARCHAR(128),
    metadata JSONB DEFAULT '{}',
    storage_path VARCHAR(500) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Unique constraint: namespace + name + version
    UNIQUE(namespace, name, version)
);

-- Artifact tags table
CREATE TABLE artifact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(artifact_id, tag)
);

-- Artifact download history
CREATE TABLE artifact_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    downloaded_by VARCHAR(100) NOT NULL,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Artifact metadata key-value store
CREATE TABLE artifact_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(artifact_id, key)
);

-- ==================== ARTIFACT OPERATIONS ====================

-- Artifact operation tracking
CREATE TABLE artifact_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    operation_type operation_type NOT NULL,
    operator VARCHAR(100) NOT NULL,
    tenant_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    INDEX idx_artifact_operations_artifact_id (artifact_id),
    INDEX idx_artifact_operations_created_at (created_at),
    INDEX idx_artifact_operations_tenant_id (tenant_id)
);

-- ==================== ARTIFACT VERSION ====================

-- Artifact version tracking for pipelines
CREATE TABLE artifact_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL,
    pipeline_id VARCHAR(100) NOT NULL,
    run_id VARCHAR(100),
    stage_name VARCHAR(100),
    artifact_name VARCHAR(255) NOT NULL,
    version VARCHAR(100) NOT NULL,
    commit_sha VARCHAR(40),
    branch VARCHAR(255),
    environment VARCHAR(50),
    storage_path VARCHAR(500) NOT NULL,
    metadata JSONB DEFAULT '{}',
    promoted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, pipeline_id, artifact_name, version)
);

-- Artifact version tags
CREATE TABLE artifact_version_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES artifact_versions(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(version_id, tag)
);

-- ==================== ARTIFACT RETENTION ====================

-- Retention policy definitions
CREATE TABLE retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    namespace VARCHAR(100),
    artifact_type artifact_type,
    retention_days INTEGER NOT NULL,
    keep_min_versions INTEGER DEFAULT 1,
    keep_latest BOOLEAN DEFAULT TRUE,
    auto_delete BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(tenant_id, name)
);

-- Retention evaluation results
CREATE TABLE retention_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL REFERENCES retention_policies(id) ON DELETE CASCADE,
    artifacts_evaluated INTEGER DEFAULT 0,
    artifacts_deleted INTEGER DEFAULT 0,
    artifacts_retained INTEGER DEFAULT 0,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== ARTIFACT SCANNING ====================

-- Scan report storage
CREATE TABLE scan_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    scan_status scan_status NOT NULL DEFAULT 'PENDING',
    scanner_version VARCHAR(50),
    scan_started_at TIMESTAMP WITH TIME ZONE,
    scan_completed_at TIMESTAMP WITH TIME ZONE,
    total_files_scanned INTEGER DEFAULT 0,
    total_issues_found INTEGER DEFAULT 0,
    severity_counts JSONB DEFAULT '{}',
    summary TEXT,
    full_report JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scan findings details
CREATE TABLE scan_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES scan_reports(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    rule_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    line_number INTEGER,
    cve_id VARCHAR(50),
    remediation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Malicious detection records
CREATE TABLE malicious_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    detection_type VARCHAR(100) NOT NULL,
    threat_level VARCHAR(20) NOT NULL,
    signature VARCHAR(255),
    details JSONB,
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== PROMOTION STAGES ====================

-- Artifact promotion history
CREATE TABLE artifact_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50) NOT NULL,
    promoted_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100),
    reason TEXT,
    promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================== INDEXES ====================

-- Artifact indexes
CREATE INDEX idx_artifacts_namespace ON artifacts(namespace);
CREATE INDEX idx_artifacts_name ON artifacts(name);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_status ON artifacts(status);
CREATE INDEX idx_artifacts_created_at ON artifacts(created_at);
CREATE INDEX idx_artifacts_tenant_id ON artifacts(tenant_id);

-- Artifact tags indexes
CREATE INDEX idx_artifact_tags_artifact_id ON artifact_tags(artifact_id);

-- Artifact downloads indexes
CREATE INDEX idx_artifact_downloads_artifact_id ON artifact_downloads(artifact_id);
CREATE INDEX idx_artifact_downloads_downloaded_at ON artifact_downloads(downloaded_at);

-- Artifact version indexes
CREATE INDEX idx_artifact_versions_tenant_id ON artifact_versions(tenant_id);
CREATE INDEX idx_artifact_versions_pipeline_id ON artifact_versions(pipeline_id);
CREATE INDEX idx_artifact_versions_artifact_name ON artifact_versions(artifact_name);
CREATE INDEX idx_artifact_versions_environment ON artifact_versions(environment);
CREATE INDEX idx_artifact_versions_created_at ON artifact_versions(created_at);

-- Retention indexes
CREATE INDEX idx_retention_policies_tenant_id ON retention_policies(tenant_id);
CREATE INDEX idx_retention_policies_namespace ON retention_policies(namespace);

-- Scan indexes
CREATE INDEX idx_scan_reports_artifact_id ON scan_reports(artifact_id);
CREATE INDEX idx_scan_reports_status ON scan_reports(scan_status);
CREATE INDEX idx_scan_findings_report_id ON scan_findings(report_id);
CREATE INDEX idx_malicious_detections_artifact_id ON malicious_detections(artifact_id);

-- ==================== TRIGGERS ====================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to tables with updated_at
CREATE TRIGGER update_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_artifact_versions_updated_at
    BEFORE UPDATE ON artifact_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Soft delete trigger function
CREATE OR REPLACE FUNCTION soft_delete_artifact()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        NEW.status = 'DELETED';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER soft_delete_artifact_trigger
    BEFORE UPDATE ON artifacts
    FOR EACH ROW
    EXECUTE FUNCTION soft_delete_artifact();